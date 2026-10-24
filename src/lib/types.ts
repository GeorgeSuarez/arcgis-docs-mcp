export const DOC_KINDS = [
  "guide",
  "reference",
  "release-notes",
  "sample",
  "tutorial",
  "blog",
] as const;

export type DocKind = (typeof DOC_KINDS)[number];

export interface SeedPage {
  url: string;
  kind?: DocKind;
  title?: string;
}

export interface DocPage {
  /** Canonical URL used as the stable id. */
  url: string;
  /** Other URLs that resolve to this page (seed URL, redirect target). */
  aliases: string[];
  title: string;
  kind: DocKind;
  markdown: string;
  /** Plain-text projection used for search snippets. */
  text: string;
  headings: string[];
  /** SHA-256 of `markdown`, used to skip unchanged pages. */
  hash: string;
  fetchedAt: string;
  status: number;
  bytes: number;
}

export interface DocIndexFile {
  version: 1;
  generatedAt: string | null;
  pages: DocPage[];
}

export interface SearchHit {
  url: string;
  title: string;
  kind: DocKind;
  score: number;
  snippet: string;
}

export interface SearchOptions {
  kind?: DocKind;
  limit?: number;
}

export interface IndexStats {
  pages: number;
  generatedAt: string | null;
  byKind: Record<string, number>;
  lastFetchedAt: string | null;
}

export interface IndexReport {
  out: string;
  pages: number;
  added: number;
  updated: number;
  skipped: number;
  failed: Array<{ url: string; error: string }>;
  generatedAt: string;
}

export interface ExtractedPage {
  title: string;
  canonicalUrl: string;
  markdown: string;
  text: string;
  headings: string[];
  links: string[];
}
