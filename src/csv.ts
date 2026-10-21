import type { CostBreakdown } from "./cost";
import type { ModelPrice } from "./pricing";

function cell(value: string | number | boolean): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialises a comparison as CSV with full-precision dollar amounts. */
export function comparisonToCSV(rows: CostBreakdown[], models: readonly ModelPrice[]): string {
  const names = new Map(models.map((m) => [m.id, m.name]));
  const header = ["model", "input_usd", "cached_input_usd", "output_usd", "per_request_usd", "per_month_usd", "exceeds_context"];
  const lines = rows.map((r) =>
    [names.get(r.modelId) ?? r.modelId, r.input, r.cachedInput, r.output, r.perRequest, r.perMonth, r.exceedsContext]
      .map(cell)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n") + "\n";
}
