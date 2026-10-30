---
name: arcgis-docs
description: Ground ArcGIS Maps SDK for JavaScript answers in the local docs index (arcgis-docs MCP). Use for MapView/@arcgis/core API questions, map-component tags like <arcgis-map>, v4-to-v5 widget migration, and release-note or breaking-change checks.
---

# ArcGIS Maps SDK docs

The `arcgis-docs` MCP serves a snapshot of ~54 curated ArcGIS Maps SDK for JavaScript pages: guides, API references, release notes, samples, one tutorial. Search is lexical, so it matches terms rather than meaning.

Every claim you make is **sourced** — it carries an indexed URL you opened this turn — or it is unsourced, and you say so. A search result is a **shortlist** of candidates; only a page you opened is evidence.

## Loop

1. **Frame.** A symbol or class name (`MapView`, `reactiveUtils`, `geometryEngine`) goes to `get_api`. A question — how something works, how to migrate, what changed — goes to `search_docs`, adding `kind` when you know the page type: `reference` for API pages, `release-notes` for version questions. Done when you can name what you want: a symbol, or a question.
2. **Shortlist.** Read titles, kinds, and snippets. Done when you hold 1–3 candidate URLs whose snippets plausibly answer the question.
3. **Read.** Call `get_page` on each candidate before asserting detail. Done when every fact you intend to state traces to a page you opened.
4. **Answer.** Cite the canonical URL from the page header, and mark anything the index does not reach as unsourced.

## Reading the shortlist

Score ranks term frequency, not relevance, and fuzzy/prefix matching means any query carrying one common word returns strong-looking hits. `arcgis-sketch-toolbar zzz` returns the editor reference at 136. A score above 50 confirms nothing; the snippet does. Only `count: 0` means nothing matched.

Prefer the page whose title is the symbol or feature name and whose kind matches the question. `get_api` pads the tail with weak hits, so when the top score dwarfs the second, trust only the top.

## What the index covers

API references are the deepest part (core and map components), then guides (components, migration, UI, React, view models, ES modules, troubleshooting, FAQ, breaking changes), then release notes for 4.34/5.0/5.1. Samples are sparse: 5 sample pages and 1 tutorial, so treat a sample request as a guide or reference lookup.

A miss means the local index lacks the page. Say exactly that, and point to the live docs for the rest — the published site is far larger than this snapshot, and blog posts are excluded because Esri's host rejects non-browser clients.

## Release notes and versions

Release notes are the authority for "when did X change" and "is X deprecated". Each version has its own page, so check the specific version instead of assuming the newest applies. Aliased URLs (`/release-notes`, `/v5-1`) resolve to a canonical page: cite the `URL:` line in the response, never the URL you passed, since the index merges duplicates.

## Failures

- **`get_page` errors with suggestions** — the URL is not indexed, and those suggestions are fuzzy guesses. Retry with `search_docs` on the page title.
- **`[truncated page: N characters omitted]` at the end** — raise `maxChars` (default 60,000) and re-read before concluding the page lacks an answer.
- **Empty or stale index** — `list_sources` reports page count and newest fetch time. When it is empty or predates the release in question, ask the user to run `npm run index` in the arcgis-docs-mcp checkout; the index is local and read-only, so no other refresh exists.

## Answering

Lead with the answer, then the citation. Include the import path and a runnable snippet when the page shows one — extraction preserves fenced code. Name the version a claim applies to when it came from release notes or a version-gated guide.
