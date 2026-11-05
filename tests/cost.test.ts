import { describe, expect, it } from "vitest";
import { compare, costFor, formatUSD } from "../src/cost";
import { EXAMPLE_MODELS, parseModels, PricingError, type ModelPrice } from "../src/pricing";

const model: ModelPrice = { id: "m", name: "M", input: 2, output: 10, cachedInput: 0.2, contextWindow: 10_000 };

describe("costFor", () => {
  it("prices input and output per million tokens", () => {
    const c = costFor(model, { inputTokens: 500_000, outputTokens: 100_000 });
    expect(c.input).toBeCloseTo(1);
    expect(c.output).toBeCloseTo(1);
    expect(c.perRequest).toBeCloseTo(2);
    expect(c.perMonth).toBe(0);
  });

  it("applies the cached-input price to the cached share", () => {
    const c = costFor(model, { inputTokens: 1_000_000, outputTokens: 0, cachedFraction: 0.75 });
    expect(c.input).toBeCloseTo(0.5);
    expect(c.cachedInput).toBeCloseTo(0.15);
  });

  it("ignores caching for models without a cached price", () => {
    const noCache = { ...model, cachedInput: undefined };
    const c = costFor(noCache, { inputTokens: 1_000_000, outputTokens: 0, cachedFraction: 0.9 });
    expect(c.input).toBeCloseTo(2);
    expect(c.cachedInput).toBe(0);
  });

  it("projects monthly cost and flags context overflow", () => {
    const c = costFor(model, { inputTokens: 9_000, outputTokens: 2_000, requestsPerDay: 1000 });
    expect(c.perMonth).toBeCloseTo(c.perRequest * 30_000);
    expect(c.exceedsContext).toBe(true);
  });

  it("clamps nonsense inputs", () => {
    const c = costFor(model, { inputTokens: -5, outputTokens: 10, cachedFraction: 3 });
    expect(c.input).toBe(0);
    expect(c.perRequest).toBeGreaterThan(0);
  });
});

describe("compare", () => {
  it("sorts models by cost per request", () => {
    const rows = compare(EXAMPLE_MODELS, { inputTokens: 2000, outputTokens: 500 });
    const costs = rows.map((r) => r.perRequest);
    expect(costs).toEqual([...costs].sort((a, b) => a - b));
    expect(rows).toHaveLength(EXAMPLE_MODELS.length);
  });
});

describe("formatUSD", () => {
  it("keeps precision for tiny amounts", () => {
    expect(formatUSD(0)).toBe("$0");
    expect(formatUSD(0.000123)).toBe("$0.00012");
    expect(formatUSD(1234.5)).toBe("$1,234.50");
  });
});

describe("parseModels", () => {
  it("accepts valid models and keeps optional fields", () => {
    const [m] = parseModels([{ id: "x", name: "X", input: 1, output: 2, cachedInput: 0.1, contextWindow: 8000.4 }]);
    expect(m).toEqual({ id: "x", name: "X", input: 1, output: 2, cachedInput: 0.1, contextWindow: 8000 });
  });

  it("defaults the name to the id", () => {
    expect(parseModels([{ id: "x", input: 1, output: 2 }])[0]?.name).toBe("x");
  });

  it.each([
    [{}, "expected a JSON array"],
    [[{ name: "no id", input: 1, output: 1 }], '"id" is required'],
    [[{ id: "a", input: 1 }], '"output" is required'],
    [[{ id: "a", input: -1, output: 1 }], "non-negative"],
    [[{ id: "a", input: 1, output: 1 }, { id: "a", input: 1, output: 1 }], "duplicate id"],
  ])("rejects %j", (data, message) => {
    expect(() => parseModels(data)).toThrow(PricingError);
    expect(() => parseModels(data)).toThrow(message);
  });

  it("round-trips the built-in examples", () => {
    expect(parseModels(JSON.parse(JSON.stringify(EXAMPLE_MODELS)))).toEqual(EXAMPLE_MODELS);
  });
});

describe("batch discount", () => {
  const model = { id: "b", name: "B", input: 2, output: 10, cachedInput: 0.2, batchDiscount: 0.5 };

  it("halves every component in batch mode", () => {
    const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000, cachedFraction: 0.5 };
    const normal = costFor(model, usage);
    const batch = costFor(model, { ...usage, batch: true });
    expect(batch.perRequest).toBeCloseTo(normal.perRequest / 2);
    expect(batch.cachedInput).toBeCloseTo(0.05);
  });

  it("bills models without a batch discount at full price", () => {
    const { batchDiscount: _d, ...plain } = model;
    const usage = { inputTokens: 1000, outputTokens: 1000 };
    expect(costFor(plain, { ...usage, batch: true }).perRequest).toBe(costFor(plain, usage).perRequest);
  });

  it("validates batchDiscount on import", () => {
    expect(parseModels([{ id: "x", input: 1, output: 1, batchDiscount: 0.25 }])[0]?.batchDiscount).toBe(0.25);
    expect(() => parseModels([{ id: "x", input: 1, output: 1, batchDiscount: 1.5 }])).toThrow(/between 0 and 1/);
  });
});

describe("agent steps", () => {
  const flat = { id: "f", name: "F", input: 1, output: 2, contextWindow: 10_000 };

  it("re-sends the growing context on every step", () => {
    // Inputs per call: 1000, 1000+700, 1000+1400 => 5100 input, 3 * 500 output.
    const c = costFor(flat, { inputTokens: 1000, outputTokens: 500, toolResultTokens: 200, steps: 3 });
    expect(c.input).toBeCloseTo((5100 * 1) / 1e6);
    expect(c.output).toBeCloseTo((1500 * 2) / 1e6);
  });

  it("matches a single call when steps is 1 or missing", () => {
    const u = { inputTokens: 1234, outputTokens: 321 };
    expect(costFor(flat, { ...u, steps: 1 })).toEqual(costFor(flat, u));
  });

  it("checks the context window against the last, largest call", () => {
    const u = { inputTokens: 4000, outputTokens: 1000, toolResultTokens: 1000 };
    expect(costFor(flat, { ...u, steps: 3 }).exceedsContext).toBe(false); // 4000+4000+1000
    expect(costFor(flat, { ...u, steps: 4 }).exceedsContext).toBe(true); // 4000+6000+1000
  });
});
