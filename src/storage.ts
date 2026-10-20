import { parseModels, type ModelPrice } from "./pricing";

const KEY = "llm-cost-lens:custom-models";

/** Loads the user's custom models, ignoring storage that is missing or corrupt. */
export function loadCustomModels(storage: Pick<Storage, "getItem"> | undefined): ModelPrice[] {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return [];
    return parseModels(JSON.parse(raw)).map((m) => ({ ...m, custom: true }));
  } catch {
    return [];
  }
}

export function saveCustomModels(storage: Pick<Storage, "setItem"> | undefined, models: ModelPrice[]): void {
  try {
    storage?.setItem(KEY, JSON.stringify(models.filter((m) => m.custom)));
  } catch {
    // Private browsing or a full quota: the models still work for this visit.
  }
}

/** Generates a URL-safe id from a model name, unique among existing ids. */
export function slugId(name: string, taken: Iterable<string>): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "model";
  const used = new Set(taken);
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  return id;
}
