# arcgis-docs-mcp

A local [Model Context Protocol](https://modelcontextprotocol.io/) server for searching **ArcGIS Maps SDK for JavaScript** documentation.

The ArcGIS docs site has no `llms.txt`, no first-party Agent Skill, and the information an agent needs is spread across release notes, guides, API references, and samples. This project fetches a curated set of those pages, converts them to Markdown, and exposes fast local search plus page retrieval over MCP.

## Why

- Agents need **local, citable context**; scraping the docs on every prompt is slow and brittle.
- Release notes, migration guides, and API references answer different questions; one index makes them searchable together.
- The index is plain JSON, so it is easy to inspect, diff, or replace with a different corpus.
- No API key, no database, no network at query time. Indexing is the only network step.

## Quick start

```bash
npm install
npm run index        # fetch ~54 docs pages -> data/pages.json
npm run build
node dist/server.js  # normally launched by an MCP client, not by hand
```

During development:

```bash
npm run dev          # stdio server through tsx
npm run index:status
npm run index:search -- "migrate widgets to components"
npm run llms         # write data/llms.txt
```

The index is about 4–5 MB of JSON and is **gitignored**. Re-run `npm run index` on a new checkout.

## MCP client configuration

Point your client at the built server. Use absolute paths; MCP clients do not all expand `~`.

```json
{
  "mcpServers": {
    "arcgis-docs": {
      "command": "node",
      "args": ["/absolute/path/to/arcgis-docs-mcp/dist/server.js"],
      "env": {
        "ARCGIS_DOCS_DATA": "/absolute/path/to/arcgis-docs-mcp/data/pages.json"
      }
    }
  }
}
```

A copy is in [`examples/mcp.json`](./examples/mcp.json). For Claude Desktop this usually goes in `claude_desktop_config.json`; for Cursor it goes in `.cursor/mcp.json`. If you run the server with the project as its working directory, `ARCGIS_DOCS_DATA` is optional.

## Tools

| Tool           | What it does                                                     | Typical use                                  |
| -------------- | ---------------------------------------------------------------- | -------------------------------------------- |
| `search_docs`  | Full-text search with kind filter, URL, score, and snippet       | “How do I migrate widgets to components?”    |
| `get_page`     | Returns the indexed Markdown for a URL, with optional truncation | Read the migration guide or API reference    |
| `get_api`      | Searches API reference pages for a class/function/module         | `MapView`, `FeatureLayer`, `geometryEngine`  |
| `list_sources` | Counts by kind, freshness, and data-file path                    | Check whether the index is present and fresh |

Resources:

- `docs://llms.txt` — every indexed page, grouped by kind.
- `docs://index` — counts and freshness as JSON.

All tools are read-only and local (`readOnlyHint: true`, `openWorldHint: false`).

Example `search_docs` response:

```json
{
  "query": "migrate widgets to components",
  "count": 2,
  "results": [
    {
      "url": "https://developers.arcgis.com/javascript/latest/migrating-to-components",
      "title": "Migrate to components",
      "kind": "guide",
      "score": 31.84,
      "snippet": "If you're migrating an existing widget-based application, widgets are deprecated as of version 5.0…"
    }
  ]
}
```

## Indexing

```bash
# Default: 60 curated seed pages
npm run index

# Refresh everything (ignore content hashes)
npm run index:refresh

# Follow same-site docs links one level deep, up to 100 pages
npm run index -- --crawl --max-pages 100

# Only specific pages
npm run index -- --seed https://developers.arcgis.com/javascript/latest/faq/ \
  --seed https://developers.arcgis.com/javascript/latest/references/core/views/MapView/

# See what would be fetched
npm run index -- --dry-run
```

| Option              | Default                                   | Meaning                                          |
| ------------------- | ----------------------------------------- | ------------------------------------------------ |
| `--out <path>`      | `data/pages.json` (or `ARCGIS_DOCS_DATA`) | Index file                                       |
| `--max-pages <n>`   | `80`                                      | Maximum pages fetched in this run                |
| `--concurrency <n>` | `4`                                       | Parallel fetches                                 |
| `--timeout <ms>`    | `20000`                                   | Per-request timeout                              |
| `--crawl`           | off                                       | Follow same-site docs links one level            |
| `--force`           | off                                       | Re-fetch even when the content hash is unchanged |
| `--seed <url...>`   | built-in list                             | Override the seed URLs                           |
| `--dry-run`         | off                                       | Print seeds without fetching                     |
| `--strict`          | off                                       | Exit non-zero if any page fails                  |

The seed list lives in [`src/indexer/seeds.ts`](./src/indexer/seeds.ts). It covers:

- release notes (5.1, 5.0, 4.34), FAQ, version matrix, breaking changes
- components, migration, UI, React, view models, ES modules, troubleshooting
- AI components, agent utilities, assistant and agent references
- core references (`Map`, `MapView`, `SceneView`, `FeatureLayer`, `BaseTileLayer`, `print`, …)
- map component references (`arcgis-map`, `arcgis-search`, `arcgis-editor`, …)
- a handful of samples and one tutorial

Esri's blog host returns `403` to non-browser clients, so blog posts are in `OPTIONAL_BLOG_SEEDS` and are not part of the default run.

## How it works

```text
seed URL
  -> fetch (retry, timeout, meta-refresh follow)
  -> cheerio: main .page-content, strip nav/aside/scripts/buttons
  -> normalize code blocks (line divs -> fenced code)
  -> turndown + GFM -> Markdown
  -> JSON page record (hash, aliases, headings, text)
  -> MiniSearch index at server startup
  -> MCP stdio tools
```

Design choices:

- **Hash-based skip**: pages are re-fetched, but unchanged Markdown is not rewritten. `--force` overrides.
- **Alias and hash dedupe**: `/release-notes` and `/v5-1` share content; one canonical page keeps the other as an alias.
- **Plain JSON**: no SQLite/native dependency. The index is easy to inspect and portable.
- **Curated, not exhaustive**: 60 high-signal pages beat 10,000 noisy ones for agent context.
- **Stdout is reserved for MCP**: all server logging goes to stderr. The indexer logs to stderr and prints the report to stdout.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

Tests do not hit the network. They cover URL normalization, HTML extraction, search/snippets, and the MCP server over an in-memory transport.

Architecture:

| Path                     | Responsibility                                                |
| ------------------------ | ------------------------------------------------------------- |
| `src/server.ts`          | stdio entry point; loads the index and connects the transport |
| `src/server-factory.ts`  | MCP tools/resources; no I/O except the loaded search object   |
| `src/lib/search.ts`      | MiniSearch wrapper, snippets, `llms.txt`, page lookup         |
| `src/lib/html.ts`        | Cheerio + Turndown extraction pipeline                        |
| `src/lib/fetch.ts`       | fetch with retries, timeout, meta-refresh handling            |
| `src/lib/store.ts`       | JSON index read/write, hashing, dedupe, truncation            |
| `src/lib/url.ts`         | URL normalization, page-kind detection, crawl filters         |
| `src/indexer/indexer.ts` | seed fetch, crawl, merge, report                              |
| `src/indexer/cli.ts`     | `index`, `status`, `search`, `llms` commands                  |
| `src/indexer/seeds.ts`   | curated seed list and optional blog list                      |

## Limitations

- **Not the full docs site.** Run with `--crawl --max-pages 200` if you need broader coverage. Crawling follows one level only.
- **HTML changes break extraction.** The `.page-content` selector and code-block normalization are best-effort; add a fixture when you change them.
- **Lexical search only.** No embeddings, reranking, or query expansion. Good for exact terms and phrases; weaker for paraphrases.
- **No private/authenticated docs.** Only public pages.
- **No freshness guarantee.** The index is a snapshot. Re-run `npm run index` after releases; `list_sources` exposes the newest fetch time.
- **Blog posts are opt-in.** `www.esri.com` returns 403 to this client.
- **Respect the source.** This is a local cache for development. Check Esri's terms and `robots.txt` before redistributing content; do not publish the index as a docs mirror.

## License

MIT. The documentation content remains Esri's; this project only caches it locally for search.
