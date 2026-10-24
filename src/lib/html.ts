import * as cheerio from "cheerio";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { absoluteUrl, normalizeUrl } from "./url.js";
import type { ExtractedPage } from "./types.js";

const MIN_TEXT_LENGTH = 200;

const NOISE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "svg",
  "nav",
  "aside",
  "footer",
  "button",
  "astro-island",
  "figcaption",
  ".sidebar-container",
  ".table-of-contents",
  ".toc",
  ".tab-nav",
  "[role='tablist']",
  ".page-header",
  ".feedback",
  ".pagination",
  ".edit-page",
  ".copy-code-button",
  ".skip-link",
].join(",");

export function extractPage(html: string, pageUrl: string): ExtractedPage | null {
  const $ = cheerio.load(html);
  const canonicalHref = $('link[rel="canonical"]').attr("href");
  const canonicalUrl = canonicalHref ? normalizeUrl(canonicalHref, pageUrl) : normalizeUrl(pageUrl);

  const main = $("main").first();
  const content = selectContent($, main);

  const title = extractTitle($, content);
  content.find(NOISE_SELECTORS).remove();
  removeSelfAnchorLists($, content, canonicalUrl);
  normalizeCodeBlocks($, content);
  removeEmptyNodes($, content);

  const markdown = toMarkdown(content, canonicalUrl);
  const text = content.text().replace(/\s+/g, " ").trim();

  if (text.length < MIN_TEXT_LENGTH || markdown.length < MIN_TEXT_LENGTH) {
    return null;
  }

  const headings = content
    .find("h1, h2, h3, h4")
    .map((_, element) => $(element).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean);

  const links = content
    .find("a[href]")
    .map((_, element) => {
      const href = $(element).attr("href") ?? "";
      if (!href || href.startsWith("#")) return null;
      return absoluteUrl(href, canonicalUrl);
    })
    .get()
    .filter((link): link is string => Boolean(link && /^https?:\/\//.test(link)));

  return {
    title,
    canonicalUrl,
    markdown,
    text,
    headings: [...new Set(headings)].slice(0, 80),
    links: [...new Set(links)],
  };
}

function extractTitle($: cheerio.CheerioAPI, content: cheerio.Cheerio<any>): string {
  const candidates = [
    $("h1").first().text(),
    $(".page-title").first().text(),
    $('meta[property="og:title"]').attr("content") ?? "",
    $("title").text(),
    content.find("h1, h2").first().text(),
  ];

  for (const candidate of candidates) {
    const cleaned = cleanTitle(candidate);
    if (cleaned) return cleaned;
  }

  return "Untitled";
}

function cleanTitle(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .split("|")[0]
    .replace(/\s*[-–—]\s*ArcGIS Maps SDK for JavaScript$/i, "")
    .trim();
}

function selectContent(
  $: cheerio.CheerioAPI,
  main: cheerio.Cheerio<any>,
): cheerio.Cheerio<any> {
  const pageContent = main.find(".page-content").first();
  if (pageContent.length > 0) return pageContent;
  if (main.length > 0) return main;

  const article = $("article").first();
  if (article.length > 0) return article;

  const fallback = $(".page-content").first();
  if (fallback.length > 0) return fallback;

  return $("body");
}

function removeSelfAnchorLists(
  $: cheerio.CheerioAPI,
  content: cheerio.Cheerio<any>,
  pageUrl: string,
): void {
  let pagePath: string;
  try {
    pagePath = normalizePath(new URL(pageUrl).pathname);
  } catch {
    return;
  }

  content.find("ul, ol").each((_, element) => {
    const list = $(element);
    const links = list.find("a[href]");
    if (links.length < 3) return;

    const allSelfAnchors = links.toArray().every((link) => {
      const href = $(link).attr("href") ?? "";
      if (href.startsWith("#")) return true;
      try {
        const url = new URL(href, pageUrl);
        return normalizePath(url.pathname) === pagePath && Boolean(url.hash);
      } catch {
        return false;
      }
    });

    if (allSelfAnchors) list.remove();
  });
}

function normalizePath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
}

function normalizeCodeBlocks($: cheerio.CheerioAPI, content: cheerio.Cheerio<any>): void {
  content.find("pre").each((_, element) => {
    const pre = $(element);
    const code = pre.find("code").first();
    const lines = code.find(".ec-line");

    let text = lines.length
      ? lines
          .map((__, line) => $(line).text())
          .get()
          .join("\n")
      : (code.text() || pre.text());

    text = text.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (!text) {
      pre.remove();
      return;
    }

    const language =
      pre.attr("data-language") ??
      code.attr("class")?.match(/language-([\w-]+)/)?.[1] ??
      pre.find("[data-language]").first().attr("data-language") ??
      "";

    const replacement = $("<pre>").append($("<code>").text(text));
    if (language) replacement.find("code").attr("class", `language-${language}`);
    pre.replaceWith(replacement);
  });
}

function removeEmptyNodes($: cheerio.CheerioAPI, content: cheerio.Cheerio<any>): void {
  content.find("p, li, td, th").each((_, element) => {
    const node = $(element);
    if (!node.text().trim() && node.find("img, table, pre, code").length === 0) {
      node.remove();
    }
  });
}

function toMarkdown(content: cheerio.Cheerio<any>, baseUrl: string): string {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    fence: "```",
    bulletListMarker: "-",
    emDelimiter: "_",
    strongDelimiter: "**",
  });

  turndown.use(gfm);
  turndown.addRule("absoluteLinks", {
    filter: (node) => node.nodeName === "A" && Boolean(node.getAttribute("href")),
    replacement: (text, node) => {
      const href = node.getAttribute("href");
      if (!href) return text;
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return text;

      const absolute = absoluteUrl(href, baseUrl);
      if (!absolute) return text;
      return text ? `[${text}](${absolute})` : "";
    },
  });

  return turndown
    .turndown(content.html() ?? "")
    .replace(/\[\]\([^)]*\)/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
