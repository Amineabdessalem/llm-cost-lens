import { describe, expect, it } from "vitest";
import { loadCustomModels, saveCustomModels, slugId } from "../src/storage";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe("custom model storage", () => {
  it("round-trips only custom models", () => {
    const s = memoryStorage();
    saveCustomModels(s, [
      { id: "mine", name: "Mine", input: 1, output: 2, custom: true },
      { id: "builtin", name: "Built in", input: 1, output: 2 },
    ]);
    expect(loadCustomModels(s)).toEqual([{ id: "mine", name: "Mine", input: 1, output: 2, custom: true }]);
  });

  it("returns nothing for missing or corrupt data", () => {
    expect(loadCustomModels(undefined)).toEqual([]);
    const s = memoryStorage();
    s.setItem("llm-cost-lens:custom-models", "{not json");
    expect(loadCustomModels(s)).toEqual([]);
  });

  it("survives a storage that throws", () => {
    const broken = { setItem: () => { throw new Error("quota"); } };
    expect(() => saveCustomModels(broken, [])).not.toThrow();
  });
});

describe("slugId", () => {
  it("makes unique, URL-safe ids", () => {
    expect(slugId("My Model 2.0!", [])).toBe("my-model-2-0");
    expect(slugId("My Model", ["my-model", "my-model-2"])).toBe("my-model-3");
    expect(slugId("!!!", [])).toBe("model");
  });
});
