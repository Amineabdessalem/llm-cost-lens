import { formatUSD } from "./cost";

export interface ChartSeries {
  name: string;
  /** Cost of one request (or task) in USD. */
  perRequest: number;
}

const W = 640;
const H = 260;
const PAD = { left: 64, right: 150, top: 12, bottom: 36 };
const PALETTE = ["#2563eb", "#d97706", "#059669", "#db2777", "#7c3aed", "#0891b2"];

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Rounds up to 1, 2 or 5 times a power of ten, for tidy axis ends. */
export function niceCeil(x: number): number {
  if (!(x > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(x));
  for (const m of [1, 2, 5, 10]) if (m * p >= x) return m * p;
  return 10 * p;
}

/**
 * Line chart (SVG markup) of monthly cost against requests per day, for up to
 * six models. A dashed rule marks the current traffic.
 */
export function monthlyCostChart(series: readonly ChartSeries[], requestsPerDay: number, days = 30): string {
  const shown = series.slice(0, PALETTE.length);
  const xMax = niceCeil(Math.max(requestsPerDay * 2, 10));
  const yMax = niceCeil(Math.max(...shown.map((s) => s.perRequest * xMax * days), 0.01));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const x = (v: number) => r1(PAD.left + (v / xMax) * plotW);
  const y = (v: number) => r1(PAD.top + plotH - (v / yMax) * plotH);

  const parts: string[] = [];
  for (let i = 0; i <= 4; i++) {
    const yv = (yMax * i) / 4;
    const xv = (xMax * i) / 4;
    parts.push(
      `<line class="grid" x1="${PAD.left}" x2="${PAD.left + plotW}" y1="${y(yv)}" y2="${y(yv)}"/>`,
      `<text class="tick" x="${PAD.left - 6}" y="${y(yv) + 4}" text-anchor="end">${escapeXml(formatUSD(yv))}</text>`,
      `<text class="tick" x="${x(xv)}" y="${H - PAD.bottom + 16}" text-anchor="middle">${xv.toLocaleString("en-US")}</text>`,
    );
  }
  parts.push(
    `<text class="axis" x="${PAD.left + plotW / 2}" y="${H - 4}" text-anchor="middle">requests per day</text>`,
    `<line class="now" x1="${x(requestsPerDay)}" x2="${x(requestsPerDay)}" y1="${PAD.top}" y2="${PAD.top + plotH}"/>`,
  );
  shown.forEach((s, i) => {
    const end = s.perRequest * xMax * days;
    const color = PALETTE[i]!;
    parts.push(
      `<line class="series" stroke="${color}" x1="${x(0)}" y1="${y(0)}" x2="${x(xMax)}" y2="${y(end)}"/>`,
      `<circle fill="${color}" r="3.5" cx="${x(requestsPerDay)}" cy="${y(s.perRequest * requestsPerDay * days)}"/>`,
      `<text class="label" fill="${color}" x="${x(xMax) + 6}" y="${y(end) + 4}">${escapeXml(s.name)}</text>`,
    );
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" ` +
    `aria-label="Monthly cost against requests per day">${parts.join("")}</svg>`
  );
}
