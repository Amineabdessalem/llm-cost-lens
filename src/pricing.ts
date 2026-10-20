/**
 * Model pricing. Prices are in US dollars per one million tokens.
 *
 * Providers change prices often, so the app ships with generic example tiers
 * rather than claiming to know today's price of any named model. Users add
 * their own models (with prices from the provider's pricing page), and those
 * are saved in the browser and can be exported/imported as JSON.
 */

export interface ModelPrice {
  id: string;
  name: string;
  /** USD per 1M input tokens. */
  input: number;
  /** USD per 1M output tokens. */
  output: number;
  /** USD per 1M cached input tokens, when the provider offers prompt caching. */
  cachedInput?: number;
  /** Maximum context window in tokens, if known. */
  contextWindow?: number;
  /** True for models the user entered rather than the built-in examples. */
  custom?: boolean;
}

export const EXAMPLE_MODELS: readonly ModelPrice[] = [
  { id: "example-small", name: "Small model (example)", input: 0.25, output: 1.25, cachedInput: 0.03, contextWindow: 200_000 },
  { id: "example-medium", name: "Medium model (example)", input: 3, output: 15, cachedInput: 0.3, contextWindow: 200_000 },
  { id: "example-large", name: "Large model (example)", input: 15, output: 75, cachedInput: 1.5, contextWindow: 200_000 },
  { id: "example-open", name: "Self-hosted open model (example)", input: 0.2, output: 0.6, contextWindow: 128_000 },
];

export class PricingError extends Error {}

/** Validates untrusted data (an imported file, localStorage) as a model list. */
export function parseModels(data: unknown): ModelPrice[] {
  if (!Array.isArray(data)) throw new PricingError("expected a JSON array of models");
  const seen = new Set<string>();
  return data.map((raw, i) => {
    if (typeof raw !== "object" || raw === null) throw new PricingError(`model ${i}: not an object`);
    const m = raw as Record<string, unknown>;
    const id = typeof m.id === "string" && m.id.trim() ? m.id.trim() : null;
    const name = typeof m.name === "string" && m.name.trim() ? m.name.trim() : id;
    if (!id || !name) throw new PricingError(`model ${i}: "id" is required`);
    if (seen.has(id)) throw new PricingError(`model ${i}: duplicate id "${id}"`);
    seen.add(id);
    const price = (key: string, required: boolean): number | undefined => {
      const v = m[key];
      if (v === undefined || v === null) {
        if (required) throw new PricingError(`model "${id}": "${key}" is required`);
        return undefined;
      }
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
        throw new PricingError(`model "${id}": "${key}" must be a non-negative number`);
      }
      return v;
    };
    const model: ModelPrice = { id, name, input: price("input", true)!, output: price("output", true)! };
    const cached = price("cachedInput", false);
    if (cached !== undefined) model.cachedInput = cached;
    const ctx = price("contextWindow", false);
    if (ctx !== undefined) model.contextWindow = Math.round(ctx);
    if (m.custom === true) model.custom = true;
    return model;
  });
}
