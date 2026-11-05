import "./style.css";
import { compare, formatUSD, type Usage } from "./cost";
import { comparisonToCSV } from "./csv";
import { EXAMPLE_MODELS, parseModels, PricingError, type ModelPrice } from "./pricing";
import { loadCustomModels, saveCustomModels, slugId } from "./storage";
import { decodeScenario, encodeScenario } from "./scenario";
import { estimateTokens } from "./tokens";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const promptEl = $<HTMLTextAreaElement>("prompt");
const statsEl = $("stats");
const resultsEl = $("results");
const messageEl = $("message");
const inputs = {
  extra: $<HTMLInputElement>("extra-input"),
  output: $<HTMLInputElement>("output"),
  cached: $<HTMLInputElement>("cached"),
  rpd: $<HTMLInputElement>("rpd"),
  batch: $<HTMLInputElement>("batch"),
  steps: $<HTMLInputElement>("steps"),
  tool: $<HTMLInputElement>("tool"),
};

const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
})();

let models: ModelPrice[] = [...EXAMPLE_MODELS, ...loadCustomModels(storage)];
// Token count of the prompt from a shared link; used while the textarea is empty.
let sharedPromptTokens = 0;

const shared = decodeScenario(location.hash);
if (shared) {
  sharedPromptTokens = shared.promptTokens;
  inputs.extra.value = String(shared.extraInput);
  inputs.output.value = String(shared.output);
  inputs.cached.value = String(shared.cachedPercent);
  inputs.rpd.value = String(shared.requestsPerDay);
  inputs.batch.checked = shared.batch ?? false;
  inputs.steps.value = String(shared.steps ?? 1);
  inputs.tool.value = String(shared.toolResultTokens ?? 0);
  const taken = new Set(models.map((m) => m.id));
  models = [...models, ...shared.customModels.filter((m) => !taken.has(m.id))];
}

const num = (el: HTMLInputElement) => {
  const v = Number(el.value);
  return Number.isFinite(v) && v > 0 ? v : 0;
};

function promptTokens(): number {
  const est = estimateTokens(promptEl.value);
  if (!promptEl.value && sharedPromptTokens > 0) {
    statsEl.textContent = `≈ ${sharedPromptTokens.toLocaleString()} prompt tokens from a shared link (paste a prompt to replace)`;
    return sharedPromptTokens;
  }
  statsEl.textContent = `≈ ${est.tokens.toLocaleString()} tokens · ${est.words.toLocaleString()} words · ${est.characters.toLocaleString()} characters`;
  return est.tokens;
}

function usage(): Usage {
  return {
    inputTokens: promptTokens() + num(inputs.extra),
    outputTokens: num(inputs.output),
    cachedFraction: num(inputs.cached) / 100,
    requestsPerDay: num(inputs.rpd),
    batch: inputs.batch.checked,
    steps: Math.max(1, num(inputs.steps)),
    toolResultTokens: num(inputs.tool),
  };
}

function render(): void {
  const rows = compare(models, usage());
  const max = Math.max(...rows.map((r) => r.perRequest), Number.EPSILON);
  const byId = new Map(models.map((m) => [m.id, m]));
  resultsEl.replaceChildren(
    ...rows.map((r) => {
      const m = byId.get(r.modelId)!;
      const tr = document.createElement("tr");

      const name = document.createElement("th");
      name.scope = "row";
      name.textContent = m.name;
      if (r.exceedsContext) {
        const warn = document.createElement("span");
        warn.className = "badge";
        warn.textContent = "exceeds context";
        name.append(" ", warn);
      }

      const per = document.createElement("td");
      per.textContent = formatUSD(r.perRequest);
      per.title = `input ${formatUSD(r.input)} · cached ${formatUSD(r.cachedInput)} · output ${formatUSD(r.output)}`;

      const month = document.createElement("td");
      month.textContent = formatUSD(r.perMonth);

      const barCell = document.createElement("td");
      barCell.className = "bar-col";
      const bar = document.createElement("div");
      bar.className = "bar";
      bar.style.width = `${Math.max(2, (r.perRequest / max) * 100)}%`;
      barCell.append(bar);

      const actions = document.createElement("td");
      if (m.custom) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "link";
        remove.textContent = "Remove";
        remove.setAttribute("aria-label", `Remove ${m.name}`);
        remove.addEventListener("click", () => {
          models = models.filter((x) => x.id !== m.id);
          saveCustomModels(storage, models);
          render();
        });
        actions.append(remove);
      }

      tr.append(name, per, month, barCell, actions);
      return tr;
    }),
  );
}

function say(text: string, isError = false): void {
  messageEl.textContent = text;
  messageEl.classList.toggle("error", isError);
}

$<HTMLFormElement>("add-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.currentTarget as HTMLFormElement;
  const data = Object.fromEntries(new FormData(form));
  const optional = (v: FormDataEntryValue | undefined) => (v === "" || v === undefined ? undefined : Number(v));
  try {
    const name = String(data.name).trim();
    const [model] = parseModels([
      {
        id: slugId(name, models.map((m) => m.id)),
        name,
        input: Number(data.input),
        output: Number(data.output),
        cachedInput: optional(data.cachedInput),
        batchDiscount: data.batchDiscount ? Number(data.batchDiscount) / 100 : undefined,
        contextWindow: optional(data.contextWindow),
        custom: true,
      },
    ]);
    models = [...models, model!];
    saveCustomModels(storage, models);
    form.reset();
    say(`Added ${name}.`);
    render();
  } catch (err) {
    say(err instanceof PricingError ? err.message : "Could not add that model.", true);
  }
});

function download(filename: string, type: string, content: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

$("export").addEventListener("click", () => {
  download("llm-models.json", "application/json", JSON.stringify(models, null, 2));
});

$("csv").addEventListener("click", () => {
  download("llm-cost-comparison.csv", "text/csv", comparisonToCSV(compare(models, usage()), models));
});

$("share").addEventListener("click", async () => {
  const hash = encodeScenario({
    promptTokens: promptTokens(),
    extraInput: num(inputs.extra),
    output: num(inputs.output),
    cachedPercent: num(inputs.cached),
    requestsPerDay: num(inputs.rpd),
    batch: inputs.batch.checked,
    steps: Math.max(1, num(inputs.steps)),
    toolResultTokens: num(inputs.tool),
    customModels: models.filter((m) => m.custom),
  });
  history.replaceState(null, "", `#${hash}`);
  try {
    await navigator.clipboard.writeText(location.href);
    say("Share link copied. It includes token counts and your models, not the prompt text.");
  } catch {
    say("Share link is in the address bar. It includes token counts and your models, not the prompt text.");
  }
});

$<HTMLInputElement>("import").addEventListener("change", async (e) => {
  const input = e.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  try {
    const imported = parseModels(JSON.parse(await file.text())).map((m) => ({ ...m, custom: true }));
    const taken = new Set(models.map((m) => m.id));
    const fresh = imported.filter((m) => !taken.has(m.id));
    models = [...models, ...fresh];
    saveCustomModels(storage, models);
    say(`Imported ${fresh.length} model(s)${fresh.length < imported.length ? "; skipped ids that already exist" : ""}.`);
    render();
  } catch (err) {
    say(err instanceof Error ? `Import failed: ${err.message}` : "Import failed.", true);
  }
});

for (const el of [promptEl, ...Object.values(inputs)]) el.addEventListener("input", render);
render();
