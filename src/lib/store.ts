import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { DocIndexFile, DocPage, IndexStats } from "./types.js";

export const INDEX_VERSION = 1 as const;

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export async function loadIndex(file: string): Promise<DocIndexFile> {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: INDEX_VERSION, generatedAt: null, pages: [] };
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Index at ${file} is not valid JSON: ${(error as Error).message}`);
  }

  if (!isIndexFile(parsed)) {
    throw new Error(`Index at ${file} has an unsupported shape (expected version ${INDEX_VERSION}).`);
  }

  return parsed;
}

function isIndexFile(value: unknown): value is DocIndexFile {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DocIndexFile>;
  return candidate.version === INDEX_VERSION && Array.isArray(candidate.pages);
}

export async function saveIndex(file: string, pages: DocPage[]): Promise<string> {
  const generatedAt = new Date().toISOString();
  const payload: DocIndexFile = {
    version: INDEX_VERSION,
    generatedAt,
    pages: dedupePages(pages),
  };

  await mkdir(dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await rename(temp, file);
  return generatedAt;
}

export async function writeTextFile(file: string, contents: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, contents, "utf8");
}

export function mergePages(existing: readonly DocPage[], incoming: readonly DocPage[]): DocPage[] {
  const byUrl = new Map<string, DocPage>();
  for (const page of existing) byUrl.set(page.url, page);
  for (const page of incoming) byUrl.set(page.url, page);
  return dedupePages([...byUrl.values()]);
}

/**
 * Collapse pages with identical content, preserving the most canonical URL and
 * merging the others into its aliases. This handles versioned release-note
 * aliases such as /release-notes and /v5-1 without dropping either URL.
 */
export function dedupePages(pages: readonly DocPage[]): DocPage[] {
  const byHash = new Map<string, DocPage>();
  const withoutHash: DocPage[] = [];

  for (const page of pages) {
    if (!page.hash) {
      withoutHash.push(page);
      continue;
    }

    const existing = byHash.get(page.hash);
    if (!existing) {
      byHash.set(page.hash, { ...page, aliases: [...page.aliases] });
      continue;
    }

    const [keep, drop] = chooseCanonical(existing, page);
    const merged = {
      ...keep,
      aliases: [...new Set([...keep.aliases, ...drop.aliases, drop.url])]
        .filter((url) => url !== keep.url)
        .sort((a, b) => a.localeCompare(b)),
    };
    byHash.set(page.hash, merged);
  }

  return sortPages([...byHash.values(), ...withoutHash]);
}

export function chooseCanonicalUrl(a: string, b: string): [string, string] {
  const scoreA = canonicalScore(a);
  const scoreB = canonicalScore(b);
  return scoreA <= scoreB ? [a, b] : [b, a];
}

function chooseCanonical(a: DocPage, b: DocPage): [DocPage, DocPage] {
  const [keepUrl] = chooseCanonicalUrl(a.url, b.url);
  return keepUrl === a.url ? [a, b] : [b, a];
}

function canonicalScore(url: string): number {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return 0;
  }
  let score = path.split("/").filter(Boolean).length;
  if (/\/v\d+-\d+\/?$/.test(path)) score += 10;
  if (path.includes("/release-notes")) score -= 5;
  return score;
}

export function sortPages(pages: readonly DocPage[]): DocPage[] {
  return [...pages].sort((a, b) => {
    const kind = a.kind.localeCompare(b.kind);
    return kind !== 0 ? kind : a.title.localeCompare(b.title);
  });
}

export function truncate(text: string, maxChars: number, label = "content"): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[truncated ${label}: ${text.length - maxChars} characters omitted]`;
}

export function statsFromPages(pages: readonly DocPage[], generatedAt: string | null): IndexStats {
  const byKind: Record<string, number> = {};
  let lastFetchedAt: string | null = null;

  for (const page of pages) {
    byKind[page.kind] = (byKind[page.kind] ?? 0) + 1;
    if (!lastFetchedAt || page.fetchedAt > lastFetchedAt) lastFetchedAt = page.fetchedAt;
  }

  return { pages: pages.length, generatedAt, byKind, lastFetchedAt };
}
