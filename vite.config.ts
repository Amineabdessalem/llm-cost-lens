import { defineConfig } from "vite";

// Served from https://<user>.github.io/llm-cost-lens/ on GitHub Pages.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/llm-cost-lens/" : "/",
  test: { environment: "node" },
});
