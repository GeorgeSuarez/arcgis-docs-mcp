import { fetchHtml } from "../lib/fetch.js";
import { extractPage } from "../lib/html.js";
import { isCrawlableDocsUrl, kindFromUrl, normalizeUrl } from "../lib/url.js";
import { mapLimit, uniqueBy } from "../lib/concurrency.js";
import {
  chooseCanonicalUrl,
  loadIndex,
  mergePages,
  saveIndex,
  sha256,
  truncate,
} from "../lib/store.js";
import type { DocKind, DocPage, IndexReport, SeedPage } from "../lib/types.js";
import { SEED_PAGES } from "./seeds.js";

export interface IndexOptions {
  out: string;
  maxPages?: number;
  concurrency?: number;
  timeoutMs?: number;
  crawl?: boolean;
  force?: boolean;
  seeds?: SeedPage[];
  userAgent?: string;
  maxMarkdownChars?: number;
  maxTextChars?: number;
  log?: (line: string) => void;
}

interface SeedResult {
  page: DocPage | null;
  links: string[];
  added: boolean;
  updated: boolean;
  skipped: boolean;
  error?: { url: string; error: string };
}

interface PageLookup {
  byUrl: Map<string, DocPage>;
  byHash: Map<string, DocPage>;
}

const KIND_PRIORITY: Record<DocKind, number> = {
  guide: 0,
  reference: 1,
  "release-notes": 2,
  tutorial: 3,
  sample: 4,
  blog: 5,
};

export async function indexDocs(options: IndexOptions): Promise<IndexReport> {
  const out = options.out;
  const maxPages = Math.max(1, options.maxPages ?? 80);
  const concurrency = Math.max(1, options.concurrency ?? 4);
  const timeoutMs = options.timeoutMs ?? 20_000;
  const log = options.log ?? (() => {});
  const maxMarkdownChars = options.maxMarkdownChars ?? 180_000;
  const maxTextChars = options.maxTextChars ?? 120_000;

  const existing = await loadIndex(out);
  const lookup = buildLookup(existing.pages);
  const fetched: SeedResult[] = [];

  const seedCandidates = uniqueBy(options.seeds ?? SEED_PAGES, (seed) => normalizeUrl(seed.url)).slice(
    0,
    maxPages,
  );

  log(`Indexing ${seedCandidates.length} seed page${seedCandidates.length === 1 ? "" : "s"} → ${out}`);

  const seedResults = await mapLimit(seedCandidates, concurrency, async (seed) => {
    const result = await indexOne(seed, lookup, {
      timeoutMs,
      force: options.force ?? false,
      userAgent: options.userAgent,
      maxMarkdownChars,
      maxTextChars,
    });
    logSeedResult(result, seed.url, log);
    if (result.page) registerPage(lookup, result.page);
    return result;
  });

  fetched.push(...seedResults);

  if (options.crawl) {
    const crawled = await crawlOneLevel({
      results: seedResults,
      lookup,
      remaining: Math.max(0, maxPages - seedResults.length),
      concurrency,
      timeoutMs,
      force: options.force ?? false,
      userAgent: options.userAgent,
      maxMarkdownChars,
      maxTextChars,
      log,
    });
    fetched.push(...crawled);
  }

  const newPages = fetched
    .map((result) => result.page)
    .filter((page): page is DocPage => page !== null);
  const merged = mergePages(existing.pages, newPages);
  const generatedAt = await saveIndex(out, merged);

  return {
    out,
    pages: merged.length,
    added: fetched.filter((result) => result.added).length,
    updated: fetched.filter((result) => result.updated).length,
    skipped: fetched.filter((result) => result.skipped).length,
    failed: fetched.flatMap((result) => (result.error ? [result.error] : [])),
    generatedAt,
  };
}

interface IndexOneOptions {
  timeoutMs: number;
  force: boolean;
  userAgent?: string;
  maxMarkdownChars: number;
  maxTextChars: number;
}

async function indexOne(
  seed: SeedPage,
  lookup: PageLookup,
  options: IndexOneOptions,
): Promise<SeedResult> {
  try {
    const fetched = await fetchHtml(seed.url, {
      timeoutMs: options.timeoutMs,
      userAgent: options.userAgent,
    });
    const extracted = extractPage(fetched.html, fetched.finalUrl);
    if (!extracted) {
      return {
        page: null,
        links: [],
        added: false,
        updated: false,
        skipped: false,
        error: { url: seed.url, error: "No extractable documentation content" },
      };
    }

    const pageUrl = normalizeUrl(extracted.canonicalUrl || fetched.finalUrl);
    const hash = sha256(extracted.markdown);
    const existingByUrl = findExisting(lookup.byUrl, [seed.url, fetched.finalUrl, pageUrl]);
    const sameContent = existingByUrl ?? lookup.byHash.get(hash);
    const aliases = mergeAliases(
      sameContent?.aliases ?? [],
      [seed.url, fetched.finalUrl, pageUrl],
      sameContent?.url ?? pageUrl,
    );

    if (sameContent && sameContent.hash === hash) {
      const [keepUrl, dropUrl] = chooseCanonicalUrl(sameContent.url, pageUrl);
      const page: DocPage = {
        ...sameContent,
        url: keepUrl,
        aliases: mergeAliases(
          [...sameContent.aliases, sameContent.url, dropUrl, seed.url, fetched.finalUrl],
          [],
          keepUrl,
        ),
        ...(existingByUrl && options.force
          ? { fetchedAt: new Date().toISOString(), status: fetched.status }
          : {}),
      };
      return { page, links: extracted.links, added: false, updated: false, skipped: true };
    }

    const markdown = truncate(extracted.markdown, options.maxMarkdownChars, "page");
    const page: DocPage = {
      url: pageUrl,
      aliases,
      title: seed.title ?? extracted.title,
      kind: seed.kind ?? kindFromUrl(pageUrl),
      markdown,
      text: truncate(extracted.text, options.maxTextChars, "text"),
      headings: extracted.headings,
      hash,
      fetchedAt: new Date().toISOString(),
      status: fetched.status,
      bytes: Buffer.byteLength(markdown, "utf8"),
    };

    return {
      page,
      links: extracted.links,
      added: !existingByUrl,
      updated: Boolean(existingByUrl),
      skipped: false,
    };
  } catch (error) {
    return {
      page: null,
      links: [],
      added: false,
      updated: false,
      skipped: false,
      error: { url: seed.url, error: (error as Error).message },
    };
  }
}

interface CrawlOptions {
  results: SeedResult[];
  lookup: PageLookup;
  remaining: number;
  concurrency: number;
  timeoutMs: number;
  force: boolean;
  userAgent?: string;
  maxMarkdownChars: number;
  maxTextChars: number;
  log: (line: string) => void;
}

async function crawlOneLevel(options: CrawlOptions): Promise<SeedResult[]> {
  if (options.remaining <= 0) return [];

  const candidates = uniqueBy(
    options.results.flatMap((result) =>
      result.links.flatMap((url) =>
        isCrawlableDocsUrl(url) ? [{ url: normalizeUrl(url) }] : [],
      ),
    ),
    (candidate) => candidate.url,
  )
    .filter((candidate) => !options.lookup.byUrl.has(candidate.url))
    .sort((a, b) => KIND_PRIORITY[kindFromUrl(a.url)] - KIND_PRIORITY[kindFromUrl(b.url)])
    .slice(0, options.remaining);

  if (candidates.length === 0) return [];

  options.log(`Crawling ${candidates.length} linked page${candidates.length === 1 ? "" : "s"}`);
  return mapLimit(candidates, options.concurrency, async (candidate) => {
    const result = await indexOne({ url: candidate.url }, options.lookup, {
      timeoutMs: options.timeoutMs,
      force: options.force,
      userAgent: options.userAgent,
      maxMarkdownChars: options.maxMarkdownChars,
      maxTextChars: options.maxTextChars,
    });
    logSeedResult(result, candidate.url, options.log);
    if (result.page) registerPage(options.lookup, result.page);
    return result;
  });
}

function buildLookup(pages: readonly DocPage[]): PageLookup {
  const lookup: PageLookup = { byUrl: new Map(), byHash: new Map() };
  for (const page of pages) registerPage(lookup, page);
  return lookup;
}

function registerPage(lookup: PageLookup, page: DocPage): void {
  lookup.byUrl.set(normalizeUrl(page.url), page);
  for (const alias of page.aliases) lookup.byUrl.set(normalizeUrl(alias), page);
  if (page.hash) lookup.byHash.set(page.hash, page);
}

function findExisting(lookup: Map<string, DocPage>, urls: readonly string[]): DocPage | undefined {
  for (const url of urls) {
    const found = lookup.get(normalizeUrl(url));
    if (found) return found;
  }
  return undefined;
}

function mergeAliases(existing: readonly string[], incoming: readonly string[], pageUrl: string): string[] {
  const normalizedPage = normalizeUrl(pageUrl);
  return [...new Set([...existing, ...incoming].map((url) => normalizeUrl(url)))]
    .filter((url) => url !== normalizedPage)
    .sort((a, b) => a.localeCompare(b));
}

function logSeedResult(result: SeedResult, url: string, log: (line: string) => void): void {
  if (result.error) {
    log(`  ✗ ${url} — ${result.error.error}`);
    return;
  }
  let status = "unchanged";
  if (result.added) status = "added";
  else if (result.updated) status = "updated";
  log(`  ✓ ${status} — ${result.page?.title ?? url}`);
}
