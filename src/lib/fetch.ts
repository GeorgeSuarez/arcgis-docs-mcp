import { sleep } from "./concurrency.js";

export interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
  userAgent?: string;
}

export interface FetchResult {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  html: string;
  contentType: string;
}

const DEFAULT_USER_AGENT =
  "arcgis-docs-mcp/0.1 (+https://github.com/georgesuarezmbp/arcgis-docs-mcp; local documentation index)";

export async function fetchHtml(url: string, options: FetchOptions = {}): Promise<FetchResult> {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const retries = options.retries ?? 2;
  const userAgent = options.userAgent ?? process.env.ARCGIS_DOCS_USER_AGENT ?? DEFAULT_USER_AGENT;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchOnce(url, timeoutMs, userAgent);
    } catch (error) {
      lastError = error as Error;
      const status = (error as Error & { status?: number }).status;
      if (status === 404 || attempt === retries) break;
      await sleep(400 * 2 ** attempt);
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

async function fetchOnce(url: string, timeoutMs: number, userAgent: string): Promise<FetchResult> {
  const requestedUrl = url;
  let current = url;

  for (let hop = 0; hop < 3; hop++) {
    const response = await fetch(current, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
        "accept-language": "en-US,en;q=0.9",
        "user-agent": userAgent,
      },
    });

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status} ${response.statusText} for ${current}`) as Error & {
        status?: number;
      };
      error.status = response.status;
      throw error;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      throw new Error(`Unsupported content type "${contentType}" for ${current}`);
    }

    const html = await response.text();
    const refreshUrl = extractMetaRefresh(html, current);
    if (refreshUrl && refreshUrl !== current) {
      current = refreshUrl;
      continue;
    }

    return {
      requestedUrl,
      finalUrl: current,
      status: response.status,
      html,
      contentType,
    };
  }

  throw new Error(`Too many meta-refresh redirects for ${requestedUrl}`);
}

export function extractMetaRefresh(html: string, baseUrl: string): string | null {
  const patterns = [
    /<meta[^>]+http-equiv\s*=\s*["']?refresh["']?[^>]+content\s*=\s*["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+http-equiv\s*=\s*["']?refresh["']?[^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match) continue;
    const urlMatch = match[1].match(/url\s*=\s*([^;]+)/i);
    if (!urlMatch) continue;
    const raw = urlMatch[1].trim().replace(/^["']|["']$/g, "");
    try {
      return new URL(raw, baseUrl).href;
    } catch {
      return null;
    }
  }

  return null;
}
