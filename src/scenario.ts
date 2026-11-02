import { parseModels, type ModelPrice } from "./pricing";

/**
 * A shareable scenario. The prompt text itself is not included (it may be
 * long or private); only its token count is, as `promptTokens`.
 */
export interface Scenario {
  promptTokens: number;
  extraInput: number;
  output: number;
  cachedPercent: number;
  requestsPerDay: number;
  batch?: boolean;
  customModels: ModelPrice[];
}

const VERSION = 1;

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(data: string): string {
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Encodes a scenario for the URL hash, e.g. `#s=eyJ2Ijox...`. */
export function encodeScenario(s: Scenario): string {
  const payload = {
    v: VERSION,
    p: s.promptTokens,
    x: s.extraInput,
    o: s.output,
    c: s.cachedPercent,
    r: s.requestsPerDay,
    ...(s.batch ? { b: 1 } : {}),
    m: s.customModels.map(({ custom: _custom, ...m }) => m),
  };
  return `s=${toBase64Url(JSON.stringify(payload))}`;
}

/** Decodes a URL hash produced by encodeScenario; returns null if invalid. */
export function decodeScenario(hash: string): Scenario | null {
  const match = /(?:^#?|&)s=([A-Za-z0-9_-]+)/.exec(hash);
  if (!match?.[1]) return null;
  try {
    const raw = JSON.parse(fromBase64Url(match[1])) as Record<string, unknown>;
    if (raw.v !== VERSION) return null;
    const n = (v: unknown, max = Number.MAX_SAFE_INTEGER) =>
      typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : 0;
    return {
      promptTokens: n(raw.p),
      extraInput: n(raw.x),
      output: n(raw.o),
      cachedPercent: n(raw.c, 100),
      requestsPerDay: n(raw.r),
      batch: raw.b === 1,
      customModels: parseModels(raw.m ?? []).map((m) => ({ ...m, custom: true })),
    };
  } catch {
    return null;
  }
}
