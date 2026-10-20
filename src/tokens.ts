/**
 * Fast, dependency-free token estimation.
 *
 * Real tokenizers differ by model, so this is an estimate. It blends two
 * well-known rules of thumb for English BPE tokenizers (about 4 characters
 * per token and about 0.75 words per token), taking the larger of the two, and treats text that is not
 * whitespace-separated (CJK scripts) and code-like symbols separately, since
 * those tokenize much more densely.
 */

export interface TokenEstimate {
  tokens: number;
  characters: number;
  words: number;
}

const CJK = /[぀-ヿ㐀-䶿一-鿿가-힯]/g;
const SYMBOLS = /[{}()[\]<>;:=+\-*/\\|&^%$#@!~`"',.?]/g;

export function estimateTokens(text: string): TokenEstimate {
  const characters = [...text].length;
  if (characters === 0) return { tokens: 0, characters: 0, words: 0 };

  // CJK characters are roughly one token each.
  const cjk = text.match(CJK)?.length ?? 0;
  const rest = text.replace(CJK, " ");

  const words = rest.split(/\s+/).filter(Boolean).length;
  const symbols = rest.match(SYMBOLS)?.length ?? 0;
  const restChars = [...rest.replace(/\s+/g, " ").trim()].length;

  const byChars = restChars / 4;
  const byWords = words / 0.75;
  // For prose the two rules agree; for text without spaces (code, URLs,
  // JSON) the word rule undercounts badly, so take the larger. Symbols
  // usually become their own tokens, so they add half a token each on top.
  const latin = restChars === 0 ? 0 : Math.max(byChars, byWords) + symbols * 0.5;

  return {
    tokens: Math.max(1, Math.round(latin + cjk)),
    characters,
    words: words + cjk,
  };
}
