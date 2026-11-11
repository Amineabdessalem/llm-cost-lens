// @vitest-environment happy-dom
import { beforeAll, describe, expect, it } from "vitest";
import page from "../index.html?raw";

// Drop the module script tag: the test imports main.ts itself.
const html = page.replace(/<script[^>]*><\/script>/g, "");

function rows(): { name: string; perRequest: string }[] {
  return [...document.querySelectorAll("#results tr")].map((tr) => ({
    name: tr.querySelector("th")!.textContent!,
    perRequest: tr.querySelectorAll("td")[0]!.textContent!,
  }));
}

function set(id: string, value: string | boolean): void {
  const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement;
  if (typeof value === "boolean") (el as HTMLInputElement).checked = value;
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

const cost = (name: string) => rows().find((r) => r.name.startsWith(name))!.perRequest;

describe("UI", () => {
  beforeAll(async () => {
    document.body.innerHTML = new DOMParser().parseFromString(html, "text/html").body.innerHTML;
    localStorage.clear();
    await import("../src/main");
  });

  it("renders one row per example model, cheapest first, and a chart", () => {
    expect(rows().map((r) => r.name)[0]).toMatch(/Self-hosted|Small/);
    expect(rows()).toHaveLength(4);
    expect(document.querySelector("#chart svg")).not.toBeNull();
  });

  it("updates the token estimate and costs as the prompt changes", () => {
    const before = cost("Large");
    set("prompt", "word ".repeat(2000));
    expect(document.getElementById("stats")!.textContent).toMatch(/tokens/);
    expect(cost("Large")).not.toBe(before);
  });

  it("applies batch discounts only to models that have one", () => {
    const large = cost("Large");
    const open = cost("Self-hosted");
    set("batch", true);
    expect(cost("Large")).not.toBe(large);
    expect(cost("Self-hosted")).toBe(open);
    set("batch", false);
    expect(cost("Large")).toBe(large);
  });

  it("adds a custom model from the form and saves it", () => {
    const form = document.getElementById("add-form") as HTMLFormElement;
    (form.elements.namedItem("name") as HTMLInputElement).value = "My model";
    (form.elements.namedItem("input") as HTMLInputElement).value = "1";
    (form.elements.namedItem("output") as HTMLInputElement).value = "2";
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    expect(rows().some((r) => r.name.startsWith("My model"))).toBe(true);
    expect(localStorage.getItem("llm-cost-lens:custom-models")).toContain("My model");
  });
});
