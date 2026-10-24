import MiniSearch, { type SearchResult } from "minisearch";
import { normalizeUrl } from "./url.js";
import { statsFromPages } from "./store.js";
import type { DocKind, DocPage, IndexStats, SearchHit, SearchOptions } from "./types.js";

const KIND_LABELS: Record<DocKind, string> = {
  guide: "Guides",
  reference: "API references",
  "release-notes": "Release notes",
  sample: "Samples",
  tutorial: "Tutorials",
  blog: "Blog posts",
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "can",
  "do",
  "does",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "what",
  "when",
  "where",
  "which",
  "with",
]);

export class DocsSearch {
  private readonly pages: DocPage[];
  private readonly byUrl: Map<string, DocPage>;
  private readonly index: MiniSearch<DocPage>;
  readonly generatedAt: string | null;

  constructor(pages: readonly DocPage[], generatedAt: string | null = null) {
    this.pages = [...pages];
    this.generatedAt = generatedAt;
    this.byUrl = new Map();

    for (const page of this.pages) {
      this.byUrl.set(normalizeUrl(page.url), page);
      for (const alias of page.aliases) {
        this.byUrl.set(normalizeUrl(alias), page);
      }
    }

    this.index = new MiniSearch<DocPage>({
      idField: "url",
      fields: ["title", "headings", "text"],
      storeFields: ["url", "title", "kind", "text"],
      processTerm: (term) => {
        const normalized = term.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
        if (!normalized || STOP_WORDS.has(normalized)) return null;
        return normalized;
      },
      searchOptions: {
        boost: { title: 4, headings: 2 },
        fuzzy: 0.2,
        prefix: true,
      },
    });

    this.index.addAll(this.pages);
  }

  get size(): number {
    return this.pages.length;
  }

  search(query: string, options: SearchOptions = {}): SearchHit[] {
    const trimmed = query.trim();
    if (!trimmed || this.pages.length === 0) return [];

    const limit = clamp(options.limit ?? 8, 1, 50);
    const baseOptions = {
      fields: ["title", "headings", "text"],
      boost: { title: 4, headings: 2 },
      fuzzy: 0.2,
      prefix: true,
    };

    let results = this.index.search(trimmed, { ...baseOptions, combineWith: "AND" });
    if (results.length === 0) {
      results = this.index.search(trimmed, { ...baseOptions, combineWith: "OR" });
    }

    return results
      .filter((result) => !options.kind || result.kind === options.kind)
      .slice(0, limit)
      .map((result) => this.toHit(result, trimmed));
  }

  getPage(url: string): DocPage | null {
    const normalized = normalizeUrl(url);
    return this.byUrl.get(normalized) ?? this.findByLooseMatch(normalized);
  }

  getApi(symbol: string, limit = 5): SearchHit[] {
    const results = this.search(symbol, { kind: "reference", limit: 20 });
    const exact = results.filter((result) => result.title.toLowerCase() === symbol.toLowerCase());
    const rest = results.filter((result) => result.title.toLowerCase() !== symbol.toLowerCase());
    return [...exact, ...rest].slice(0, clamp(limit, 1, 20));
  }

  stats(): IndexStats {
    return statsFromPages(this.pages, this.generatedAt);
  }

  llmsTxt(): string {
    const lines = [
      "# ArcGIS Maps SDK for JavaScript — local docs index",
      "",
      `Generated: ${this.generatedAt ?? "unknown"}`,
      `Pages: ${this.pages.length}`,
      "",
      "Use the `search_docs` tool to find a page, then `get_page` with the returned URL.",
      "",
    ];

    for (const kind of Object.keys(KIND_LABELS) as DocKind[]) {
      const pages = this.pages
        .filter((page) => page.kind === kind)
        .sort((a, b) => a.title.localeCompare(b.title));
      if (pages.length === 0) continue;

      lines.push(`## ${KIND_LABELS[kind]}`, "");
      for (const page of pages) {
        lines.push(`- [${page.title}](${page.url})`);
      }
      lines.push("");
    }

    return lines.join("\n").trimEnd() + "\n";
  }

  private findByLooseMatch(normalized: string): DocPage | null {
    const withoutTrailing = normalized.replace(/\/$/, "");
    for (const page of this.pages) {
      if (normalizeUrl(page.url).replace(/\/$/, "") === withoutTrailing) return page;
      if (page.aliases.some((alias) => normalizeUrl(alias).replace(/\/$/, "") === withoutTrailing)) {
        return page;
      }
    }
    return null;
  }

  private toHit(result: SearchResult, query: string): SearchHit {
    return {
      url: String(result.url),
      title: String(result.title),
      kind: result.kind as DocKind,
      score: Math.round(result.score * 1000) / 1000,
      snippet: makeSnippet(String(result.text ?? ""), query),
    };
  }
}

export function makeSnippet(text: string, query: string, radius = 140): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";

  const lower = clean.toLowerCase();
  const queryLower = query.toLowerCase();
  const terms = queryLower
    .split(/[^a-z0-9_]+/)
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term));

  let index = lower.indexOf(queryLower);
  if (index < 0) {
    for (const term of terms) {
      const found = lower.indexOf(term);
      if (found >= 0 && (index < 0 || found < index)) index = found;
    }
  }
  if (index < 0) index = 0;

  const start = Math.max(0, index - radius);
  const end = Math.min(clean.length, index + radius * 2);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < clean.length ? "…" : "";
  return `${prefix}${clean.slice(start, end).trim()}${suffix}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
