import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { DocsSearch } from "./lib/search.js";
import { truncate } from "./lib/store.js";

export interface DocsServerOptions {
  name?: string;
  version?: string;
  dataFile?: string;
}

const kindSchema = z
  .enum(["guide", "reference", "release-notes", "sample", "tutorial", "blog"])
  .describe("Optional page kind filter.");

const readOnly = {
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export function createDocsServer(search: DocsSearch, options: DocsServerOptions = {}): McpServer {
  const server = new McpServer(
    {
      name: options.name ?? "arcgis-docs-mcp",
      version: options.version ?? "0.1.0",
    },
    {
      instructions:
        "Local, read-only index of ArcGIS Maps SDK for JavaScript documentation. " +
        "Call search_docs first, then get_page with the returned URL. Cite the page URL in answers. " +
        "Use get_api for class or function references. " +
        "If a page is missing, the index is probably stale: ask the user to run `npm run index`.",
    },
  );

  server.registerTool(
    "search_docs",
    {
      title: "Search ArcGIS Maps SDK docs",
      description:
        "Full-text search over the locally indexed ArcGIS Maps SDK for JavaScript documentation. " +
        "Returns titles, URLs, page kinds, scores, and snippets. Use this before get_page.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe("Natural-language or keyword query, e.g. 'migrate widgets to components'."),
        kind: kindSchema.optional(),
        limit: z.number().int().min(1).max(20).default(8).describe("Maximum number of results."),
      },
      annotations: readOnly,
    },
    async ({ query, kind, limit }): Promise<CallToolResult> => {
      const results = search.search(query, { kind, limit });
      const payload = {
        query,
        count: results.length,
        results,
        ...(results.length === 0
          ? { hint: "No matches. Try a shorter query or run `npm run index` to refresh the index." }
          : {}),
      };
      return textResult(JSON.stringify(payload, null, 2));
    },
  );

  server.registerTool(
    "get_page",
    {
      title: "Get an ArcGIS docs page",
      description:
        "Return the indexed Markdown content for a documentation URL. " +
        "Use a URL returned by search_docs. Long pages are truncated to maxChars.",
      inputSchema: {
        url: z.string().url().describe("Page URL returned by search_docs."),
        maxChars: z
          .number()
          .int()
          .min(500)
          .max(200_000)
          .default(60_000)
          .describe("Maximum characters of Markdown to return."),
      },
      annotations: readOnly,
    },
    async ({ url, maxChars }): Promise<CallToolResult> => {
      const page = search.getPage(url);
      if (!page) {
        const suggestions = search.search(url, { limit: 3 });
        const suffix =
          suggestions.length > 0
            ? `\n\nDid you mean one of these?\n${suggestions
                .map((hit) => `- ${hit.title}: ${hit.url}`)
                .join("\n")}`
            : "\n\nRun `npm run index` if the docs have not been indexed yet.";
        return {
          isError: true,
          content: [{ type: "text", text: `No indexed page for ${url}.${suffix}` }],
        };
      }

      const body = truncate(page.markdown, maxChars, "page");
      const header = [
        `# ${page.title}`,
        "",
        `URL: ${page.url}`,
        `Kind: ${page.kind}`,
        `Fetched: ${page.fetchedAt}`,
        "",
        "---",
        "",
      ].join("\n");

      return textResult(`${header}${body}`);
    },
  );

  server.registerTool(
    "get_api",
    {
      title: "Find an ArcGIS API reference",
      description:
        "Search API reference pages for a class, function, or module name " +
        "(for example MapView, FeatureLayer, geometryEngine, reactiveUtils). " +
        "Returns the best reference pages with snippets; follow up with get_page.",
      inputSchema: {
        symbol: z.string().min(1).describe("Class, function, or module name."),
        limit: z.number().int().min(1).max(10).default(5).describe("Maximum number of references."),
      },
      annotations: readOnly,
    },
    async ({ symbol, limit }): Promise<CallToolResult> => {
      const results = search.getApi(symbol, limit);
      return textResult(
        JSON.stringify(
          {
            symbol,
            count: results.length,
            results,
            ...(results.length === 0
              ? { hint: "No reference pages matched. Try a shorter symbol name." }
              : {}),
          },
          null,
          2,
        ),
      );
    },
  );

  server.registerTool(
    "list_sources",
    {
      title: "List indexed doc sources",
      description:
        "Return index counts by page kind, the newest fetch time, and the data file in use. " +
        "Useful for checking whether the local index is present and fresh.",
      annotations: readOnly,
    },
    async (): Promise<CallToolResult> => {
      return textResult(
        JSON.stringify(
          {
            ...search.stats(),
            dataFile: options.dataFile ?? null,
          },
          null,
          2,
        ),
      );
    },
  );

  server.registerResource(
    "llms-txt",
    "docs://llms.txt",
    {
      title: "ArcGIS docs llms.txt",
      description: "A compact list of every indexed page, grouped by kind.",
      mimeType: "text/plain",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/plain",
          text: search.llmsTxt(),
        },
      ],
    }),
  );

  server.registerResource(
    "index-summary",
    "docs://index",
    {
      title: "ArcGIS docs index summary",
      description: "Counts by page kind, freshness, and data file location.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              ...search.stats(),
              dataFile: options.dataFile ?? null,
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  return server;
}

function textResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}
