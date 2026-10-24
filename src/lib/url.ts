import type { DocKind } from "./types.js";

const DOCS_HOST = "developers.arcgis.com";
const DOCS_PREFIX = "/javascript/latest/";
const BLOG_HOST = "www.esri.com";
const BLOG_PREFIX = "/arcgis-blog/products/js-api-arcgis/";

/** Remove fragments, query strings, and trailing slashes so URLs compare cleanly. */
export function normalizeUrl(input: string, base?: string): string {
  const url = new URL(input, base);
  url.hash = "";
  url.username = "";
  url.password = "";
  url.search = "";
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.href;
}

export function absoluteUrl(href: string, base: string): string | null {
  try {
    return normalizeUrl(href, base);
  } catch {
    return null;
  }
}

export function kindFromUrl(input: string): DocKind {
  const url = parseUrl(input);
  if (!url) return "guide";
  const path = url.pathname;

  if (path.includes("/release-notes") || /\/v\d+-\d+\/?$/.test(path)) {
    return "release-notes";
  }
  if (path.includes("/references/") || path.includes("/api-reference/")) {
    return "reference";
  }
  if (path.includes("/sample-code/")) {
    return "sample";
  }
  if (path.includes("/tutorials/")) {
    return "tutorial";
  }
  if (url.hostname === BLOG_HOST && path.startsWith(BLOG_PREFIX)) {
    return "blog";
  }
  return "guide";
}

export function isDocsPage(input: string): boolean {
  const url = parseUrl(input);
  return Boolean(url && url.hostname === DOCS_HOST && url.pathname.startsWith(DOCS_PREFIX));
}

/**
 * Pages worth following when crawling. We deliberately avoid samples, showcase,
 * downloads, search, and static assets because they add noise and little text.
 */
export function isCrawlableDocsUrl(input: string): boolean {
  const url = parseUrl(input);
  if (!url || url.hostname !== DOCS_HOST || !url.pathname.startsWith(DOCS_PREFIX)) return false;
  const path = url.pathname;
  if (path === "/javascript/latest" || path === "/javascript/latest/") return true;
  if (isUnder(path, "/javascript/latest/sample-code")) return false;
  if (isUnder(path, "/javascript/latest/showcase")) return false;
  if (isUnder(path, "/javascript/latest/downloads")) return false;
  if (isUnder(path, "/javascript/latest/search")) return false;
  if (isUnder(path, "/javascript/latest/blogs")) return false;
  if (isUnder(path, "/javascript/latest/sandbox")) return false;

  return !/\.(?:pdf|zip|png|jpe?g|gif|svg|webp|js|mjs|css|json|xml|txt|wasm)$/i.test(path);
}

function isUnder(path: string, base: string): boolean {
  return path === base || path.startsWith(`${base}/`);
}

export function isBlogUrl(input: string): boolean {
  const url = parseUrl(input);
  return Boolean(url && url.hostname === BLOG_HOST && url.pathname.startsWith(BLOG_PREFIX));
}

function parseUrl(input: string): URL | null {
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

export function displayPath(input: string): string {
  try {
    const url = new URL(input);
    return `${url.pathname}${url.search}`;
  } catch {
    return input;
  }
}
