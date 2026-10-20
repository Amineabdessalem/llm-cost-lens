import type { ModelPrice } from "./pricing";

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  /** Share of input tokens served from the prompt cache, 0..1. */
  cachedFraction?: number;
  /** Requests per day, used for monthly projections. */
  requestsPerDay?: number;
}

export interface CostBreakdown {
  modelId: string;
  input: number;
  cachedInput: number;
  output: number;
  perRequest: number;
  perMonth: number;
  /** True when the prompt plus output would not fit the model's context window. */
  exceedsContext: boolean;
}

const PER_MILLION = 1_000_000;
const DAYS_PER_MONTH = 30;

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

export function costFor(model: ModelPrice, usage: Usage): CostBreakdown {
  const inputTokens = Math.max(0, usage.inputTokens);
  const outputTokens = Math.max(0, usage.outputTokens);
  // Without a cached price the provider has no caching, so every input
  // token is billed at the normal rate.
  const cachedShare = model.cachedInput === undefined ? 0 : clamp01(usage.cachedFraction ?? 0);
  const cachedTokens = inputTokens * cachedShare;

  const input = ((inputTokens - cachedTokens) * model.input) / PER_MILLION;
  const cachedInput = (cachedTokens * (model.cachedInput ?? 0)) / PER_MILLION;
  const output = (outputTokens * model.output) / PER_MILLION;
  const perRequest = input + cachedInput + output;

  return {
    modelId: model.id,
    input,
    cachedInput,
    output,
    perRequest,
    perMonth: perRequest * Math.max(0, usage.requestsPerDay ?? 0) * DAYS_PER_MONTH,
    exceedsContext:
      model.contextWindow !== undefined && inputTokens + outputTokens > model.contextWindow,
  };
}

/** Costs for every model, cheapest per request first. */
export function compare(models: readonly ModelPrice[], usage: Usage): CostBreakdown[] {
  return models.map((m) => costFor(m, usage)).sort((a, b) => a.perRequest - b.perRequest);
}

/** Formats a dollar amount, keeping sub-cent precision for tiny costs. */
export function formatUSD(amount: number): string {
  if (amount === 0) return "$0";
  if (amount < 0.01) return `$${amount.toPrecision(2)}`;
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}
