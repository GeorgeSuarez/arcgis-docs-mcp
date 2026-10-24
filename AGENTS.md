# AGENTS.md

## Commands

```bash
npm install
npm run typecheck
npm test
npm run build
npm run index
npm run index:status
npm run index:search -- "migrate widgets to components"
npm run llms
```

## Architecture

- `src/server.ts` — stdio entry point. Resolves the data file, loads the index, connects the MCP transport. **Never log to stdout here.**
- `src/server-factory.ts` — creates an `McpServer` with `search_docs`, `get_page`, `get_api`, `list_sources`, and the `docs://` resources. Pure except for the injected `DocsSearch`.
- `src/lib/search.ts` — MiniSearch wrapper. Fields: title, headings, text. Returns snippets and `llms.txt`.
- `src/lib/html.ts` — Cheerio extraction (`main .page-content`), noise removal, code-block normalization, Turndown + GFM.
- `src/lib/fetch.ts` — fetch with timeout, retries, and `<meta http-equiv="refresh">` handling.
- `src/lib/store.ts` — JSON index I/O, SHA-256 hashes, alias/hash dedupe, truncation.
- `src/lib/url.ts` — normalization, page-kind detection, crawl filters.
- `src/indexer/indexer.ts` — seed fetch, optional one-level crawl, merge, report.
- `src/indexer/cli.ts` — `index`, `status`, `search`, `llms`.
- `src/indexer/seeds.ts` — curated seeds plus opt-in blog seeds.

## Conventions

- **stdout is protocol.** In server code, log only with `console.error`. The indexer may print its report to stdout.
- **No network in tests.** Use `tests/fixtures/page.html` and in-memory MCP transports.
- **Every indexer failure is isolated.** One bad URL must not abort the run; collect it in `IndexReport.failed`.
- **Keep extraction deterministic.** Strip nav/aside/buttons/scripts; normalize code line divs into fenced code; resolve links to absolute URLs.
- **Dedupe by content hash.** Release-note aliases (`/release-notes`, `/v5-1`) should collapse into one page with aliases, not duplicate text.
- **Do not commit `data/pages.json` or `data/llms.txt`.** They are generated and gitignored.
- **Respect the source.** Do not add a tile scraper, bypass 403s, or publish the index as a docs mirror.

## Add a page or a source

1. Add a `SeedPage` to `SEED_PAGES` in `src/indexer/seeds.ts` (or pass `--seed`).
2. Run `npm run index -- --seed <url> --force`.
3. Check `npm run index:search -- "<term>"` and `npm run index:status`.
4. If extraction is wrong, add a fixture under `tests/fixtures/` and a test in `tests/html.test.ts`.

## Add a tool

1. Add `server.registerTool(...)` in `src/server-factory.ts`.
2. Use a Zod input schema, a clear description, and `annotations: readOnly`.
3. Return `content: [{ type: "text", text }]`; use `isError: true` for expected failures.
4. Add a test in `tests/server.test.ts` using the in-memory transport.
