import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DocsSearch } from "../src/lib/search.js";
import { sha256 } from "../src/lib/store.js";
import type { DocPage } from "../src/lib/types.js";
import { createDocsServer } from "../src/server-factory.js";

function page(input: Pick<DocPage, "url" | "title" | "kind"> & Partial<DocPage>): DocPage {
  const markdown = input.markdown ?? `# ${input.title}\n\n${input.text ?? "Documentation content."}`;
  return {
    aliases: [],
    headings: [],
    markdown,
    text: markdown.replace(/[#*`]/g, ""),
    hash: sha256(markdown),
    fetchedAt: "2026-10-23T00:00:00.000Z",
    status: 200,
    bytes: Buffer.byteLength(markdown),
    ...input,
  };
}

const pages: DocPage[] = [
  page({
    url: "https://developers.arcgis.com/javascript/latest/references/core/views/MapView",
    title: "MapView",
    kind: "reference",
    headings: ["Overview", "Properties"],
    text: "A MapView displays a 2D view. Use map and container. MapView extends View2D.",
  }),
  page({
    url: "https://developers.arcgis.com/javascript/latest/migrating-to-components",
    title: "Migrate to components",
    kind: "guide",
    headings: ["Widget migration", "Slots"],
    text: "Widget migration replaces view.ui.add with slots and arcgis-map.",
  }),
];

let server: McpServer;
let client: Client;

beforeEach(async () => {
  const search = new DocsSearch(pages, "2026-10-23T00:00:00.000Z");
  server = createDocsServer(search, { dataFile: ":memory:" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  client = new Client({ name: "arcgis-docs-mcp-test", version: "1.0.0" });
  await client.connect(clientTransport);
});

afterEach(async () => {
  await client.close();
  await server.close();
});

describe("MCP server", () => {
  it("lists the docs tools and resources", async () => {
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(["search_docs", "get_page", "get_api", "list_sources"]),
    );

    const resources = await client.listResources();
    expect(resources.resources.map((resource) => resource.uri)).toEqual(
      expect.arrayContaining(["docs://llms.txt", "docs://index"]),
    );
  });

  it("searches docs", async () => {
    const result = await client.callTool({
      name: "search_docs",
      arguments: { query: "widget migration", limit: 5 },
    });
    const text = firstText(result);
    const payload = JSON.parse(text);

    expect(payload.count).toBeGreaterThan(0);
    expect(payload.results[0].title).toBe("Migrate to components");
    expect(payload.results[0].url).toContain("migrating-to-components");
  });

  it("returns page markdown and truncates it", async () => {
    const result = await client.callTool({
      name: "get_page",
      arguments: { url: pages[0].url, maxChars: 500 },
    });
    const text = firstText(result);
    expect(text).toContain("# MapView");
    expect(text).toContain("URL: https://developers.arcgis.com");
    expect(text).toContain("A MapView displays a 2D view");
  });

  it("returns an error for a missing page", async () => {
    const result = await client.callTool({
      name: "get_page",
      arguments: { url: "https://example.com/missing" },
    });
    expect(result.isError).toBe(true);
    expect(firstText(result)).toContain("No indexed page");
  });

  it("finds API references", async () => {
    const result = await client.callTool({
      name: "get_api",
      arguments: { symbol: "MapView" },
    });
    const payload = JSON.parse(firstText(result));
    expect(payload.count).toBe(1);
    expect(payload.results[0].title).toBe("MapView");
  });

  it("reports index sources and reads llms.txt", async () => {
    const sources = await client.callTool({ name: "list_sources", arguments: {} });
    const payload = JSON.parse(firstText(sources));
    expect(payload.pages).toBe(2);
    expect(payload.dataFile).toBe(":memory:");

    const resource = await client.readResource({ uri: "docs://llms.txt" });
    const contents = resource.contents[0];
    expect(contents.mimeType).toBe("text/plain");
    expect("text" in contents ? contents.text : "").toContain("# ArcGIS Maps SDK");
  });
});

function firstText(result: unknown): string {
  const content = (result as { content?: Array<{ type: string; text?: string }> }).content ?? [];
  const item = content.find((entry) => entry.type === "text");
  return item?.text ?? "";
}
