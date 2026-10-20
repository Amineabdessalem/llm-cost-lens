import "./style.css";
import { compare, formatUSD, type Usage } from "./cost";
import { EXAMPLE_MODELS, parseModels, PricingError, type ModelPrice } from "./pricing";
import { loadCustomModels, saveCustomModels, slugId } from "./storage";
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
};

const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
})();

let models: ModelPrice[] = [...EXAMPLE_MODELS, ...loadCustomModels(storage)];

const num = (el: HTMLInputElement) => {
  const v = Number(el.value);
  return Number.isFinite(v) && v > 0 ? v : 0;
};

function usage(): Usage {
  const est = estimateTokens(promptEl.value);
  statsEl.textContent = `≈ ${est.tokens.toLocaleString()} tokens · ${est.words.toLocaleString()} words · ${est.characters.toLocaleString()} characters`;
  return {
    inputTokens: est.tokens + num(inputs.extra),
    outputTokens: num(inputs.output),
    cachedFraction: num(inputs.cached) / 100,
    requestsPerDay: num(inputs.rpd),
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

$("export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(models, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "llm-models.json";
  a.click();
  URL.revokeObjectURL(a.href);
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
