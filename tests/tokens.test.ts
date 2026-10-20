import { describe, expect, it } from "vitest";
import { estimateTokens } from "../src/tokens";

describe("estimateTokens", () => {
  it("returns zero for empty text", () => {
    expect(estimateTokens("")).toEqual({ tokens: 0, characters: 0, words: 0 });
  });

  it("is close to common rules of thumb for English prose", () => {
    const text =
      "Large language models are priced per token, so estimating how many tokens a prompt " +
      "uses is the first step to understanding what an application will cost to run.";
    const { tokens, words } = estimateTokens(text);
    expect(words).toBe(28);
    // ~4 chars/token gives ~41 and ~0.75 words/token gives ~37.
    expect(tokens).toBeGreaterThanOrEqual(36);
    expect(tokens).toBeLessThanOrEqual(46);
  });

  it("counts code as denser than prose of the same length", () => {
    const prose = "the quick brown fox jumps over the lazy dog again and again";
    const code = 'if(x){y=f(a,b);}else{z=[1,2,3];}//ok;';
    expect(code.length).toBeLessThan(prose.length);
    expect(estimateTokens(code).tokens).toBeGreaterThan(estimateTokens(prose).tokens * 0.8);
  });

  it("counts CJK characters as roughly one token each", () => {
    const { tokens, characters } = estimateTokens("大規模言語モデル");
    expect(characters).toBe(8);
    expect(tokens).toBeGreaterThanOrEqual(8);
    expect(tokens).toBeLessThanOrEqual(10);
  });

  it("grows linearly with input size", () => {
    const one = estimateTokens("hello world, this is a test. ").tokens;
    const ten = estimateTokens("hello world, this is a test. ".repeat(10)).tokens;
    expect(ten).toBeGreaterThan(one * 8);
    expect(ten).toBeLessThan(one * 12);
  });
});
