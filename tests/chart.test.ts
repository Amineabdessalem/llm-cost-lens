import { describe, expect, it } from "vitest";
import { monthlyCostChart, niceCeil } from "../src/chart";

describe("niceCeil", () => {
  it("rounds up to 1, 2 or 5 times a power of ten", () => {
    expect([0.003, 7, 13, 2000, 2001, 0].map(niceCeil)).toEqual([0.005, 10, 20, 2000, 5000, 1]);
  });
});

describe("monthlyCostChart", () => {
  const series = [
    { name: "Cheap <model>", perRequest: 0.001 },
    { name: "Pricey", perRequest: 0.01 },
  ];

  it("draws one line, marker and escaped label per model", () => {
    const svg = monthlyCostChart(series, 1000);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.match(/class="series"/g)).toHaveLength(2);
    expect(svg.match(/<circle/g)).toHaveLength(2);
    expect(svg).toContain("Cheap &#60;model&#62;");
    expect(svg).not.toContain("<model>");
  });

  it("scales the axes to twice the current traffic", () => {
    const svg = monthlyCostChart(series, 1000);
    expect(svg).toContain(">2,000</text>");
    // 0.01 * 2000 * 30 = $600, rounded up to $1,000.
    expect(svg).toContain(">$1,000.00</text>");
  });

  it("caps the number of lines", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ name: `m${i}`, perRequest: i / 1000 }));
    expect(monthlyCostChart(many, 10).match(/class="series"/g)).toHaveLength(6);
  });
});
