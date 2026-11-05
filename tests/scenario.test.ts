import { describe, expect, it } from "vitest";
import { decodeScenario, encodeScenario, type Scenario } from "../src/scenario";
import { comparisonToCSV } from "../src/csv";
import { compare } from "../src/cost";

const scenario: Scenario = {
  promptTokens: 1200,
  extraInput: 3000,
  output: 400,
  cachedPercent: 60,
  requestsPerDay: 25_000,
  batch: true,
  steps: 4,
  toolResultTokens: 800,
  customModels: [{ id: "mine", name: "Mine — ünïcode", input: 1.5, output: 6, custom: true }],
};

describe("scenario links", () => {
  it("round-trips through the URL hash", () => {
    const hash = "#" + encodeScenario(scenario);
    expect(hash).toMatch(/^#s=[A-Za-z0-9_-]+$/);
    expect(decodeScenario(hash)).toEqual(scenario);
  });

  it("leaves batch mode off for links without it", () => {
    expect(decodeScenario("#" + encodeScenario({ ...scenario, batch: false }))?.batch).toBe(false);
  });

  it("returns null for missing or corrupt hashes", () => {
    expect(decodeScenario("")).toBeNull();
    expect(decodeScenario("#s=not-base64-json")).toBeNull();
    expect(decodeScenario("#other=1")).toBeNull();
  });

  it("clamps out-of-range numbers", () => {
    const evil = btoa(JSON.stringify({ v: 1, p: -5, x: "a", o: 10, c: 500, r: 1, m: [] }))
      .replace(/=+$/, "");
    expect(decodeScenario(`#s=${evil}`)).toMatchObject({ promptTokens: 0, extraInput: 0, cachedPercent: 100 });
  });

  it("rejects invalid models in a link", () => {
    const bad = btoa(JSON.stringify({ v: 1, p: 1, x: 0, o: 1, c: 0, r: 0, m: [{ id: "x", input: -1, output: 1 }] }))
      .replace(/=+$/, "");
    expect(decodeScenario(`#s=${bad}`)).toBeNull();
  });
});

describe("comparisonToCSV", () => {
  it("writes a header and one escaped row per model", () => {
    const models = [{ id: "a", name: 'Model "A", large', input: 1, output: 2 }];
    const csv = comparisonToCSV(compare(models, { inputTokens: 1_000_000, outputTokens: 0, requestsPerDay: 1 }), models);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("model,input_usd,cached_input_usd,output_usd,per_request_usd,per_month_usd,exceeds_context");
    expect(lines[1]).toBe('"Model ""A"", large",1,0,0,1,30,false');
  });
});
