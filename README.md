# LLM Cost Lens

[![CI and Pages](https://github.com/Amineabdessalem/llm-cost-lens/actions/workflows/ci.yml/badge.svg)](https://github.com/Amineabdessalem/llm-cost-lens/actions/workflows/ci.yml)

**Live:** https://amineabdessalem.github.io/llm-cost-lens/

A small web app for estimating what an LLM-powered feature will cost. Paste a
prompt, set expected output length, prompt-cache hit rate and daily traffic,
and compare cost per request and per month across models.

## Features

- **Token estimate as you type**, with no tokenizer download: uses the
  ~4 characters/token and ~0.75 words/token rules, counts CJK characters as
  about one token each and accounts for symbol-heavy text such as code and JSON
- **Cost per request and per month** (30-day months), with an input / cached /
  output breakdown on hover
- **Prompt caching**: set the share of input served from cache; models with a
  cached-input price are billed accordingly
- **Context-window check** that flags models the request would not fit
- **Your own models**: add prices from your provider's pricing page; they are
  saved in your browser and can be exported and imported as JSON

Built-in rows are generic example tiers, not quotes for any named model,
because provider prices change often.

## Model file format

```json
[
  { "id": "my-model", "name": "My model", "input": 3, "output": 15, "cachedInput": 0.3, "contextWindow": 200000 }
]
```

Prices are USD per 1M tokens. `cachedInput` and `contextWindow` are optional.

## Development

```bash
npm install
npm run dev      # local dev server
npm test         # unit tests (Vitest)
npm run build    # type-check and build to dist/
```

The `CI and Pages` workflow tests and builds every push and deploys `main`
to GitHub Pages.

## Layout

```
src/tokens.ts    token estimation
src/pricing.ts   model price types, example tiers, validation
src/cost.ts      cost math and comparison
src/storage.ts   localStorage persistence
src/main.ts      UI
```

## Roadmap

See [ROADMAP.md](ROADMAP.md).

## License

MIT
