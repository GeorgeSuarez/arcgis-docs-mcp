import { describe, expect, it } from "vitest";
import { DocsSearch, makeSnippet } from "../src/lib/search.js";
import { sha256 } from "../src/lib/store.js";
import type { DocPage } from "../src/lib/types.js";

function makePage(
  input: Pick<DocPage, "url" | "title" | "kind"> & Partial<DocPage>,
): DocPage {
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
  makePage({
    url: "https://developers.arcgis.com/javascript/latest/migrating-to-components",
    aliases: ["https://developers.arcgis.com/javascript/latest/migrating-to-components/"],
    title: "Migrate to components",
    kind: "guide",
    headings: ["Widget migration", "Slots"],
    text: "Widget migration replaces view.ui.add with slots and arcgis-map. Use the component packages.",
  }),
  makePage({
    url: "https://developers.arcgis.com/javascript/latest/references/core/views/MapView",
    title: "MapView",
    kind: "reference",
    headings: ["Overview", "Properties"],
    text: "A MapView displays a 2D view. Use map and container. MapView extends View2D.",
  }),
  makePage({
    url: "https://developers.arcgis.com/javascript/latest/sample-code/intro-mapview",
    title: "Intro to MapView",
    kind: "sample",
    text: "Create a MapView with a basemap and a center.",
  }),
];

describe("DocsSearch", () => {
  const search = new DocsSearch(pages, "2026-10-23T00:00:00.000Z");

  it("searches titles and body text", () => {
    const hits = search.search("widget migration");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].title).toBe("Migrate to components");
    expect(hits[0].snippet).toContain("Widget migration");
  });

  it("filters by kind", () => {
    const hits = search.search("mapview", { kind: "reference" });
    expect(hits).toHaveLength(1);
    expect(hits[0].url).toContain("/references/core/views/MapView");
  });

  it("returns an empty list for an empty index", () => {
    expect(new DocsSearch([]).search("mapview")).toEqual([]);
  });

  it("gets a page by canonical URL or alias", () => {
    expect(search.getPage(pages[0].url)?.title).toBe("Migrate to components");
    expect(search.getPage(`${pages[0].url}/`)?.title).toBe("Migrate to components");
    expect(search.getPage(pages[0].aliases[0])?.title).toBe("Migrate to components");
    expect(search.getPage("https://example.com/missing")).toBeNull();
  });

  it("finds API references", () => {
    const hits = search.getApi("MapView");
    expect(hits[0].title).toBe("MapView");
    expect(hits[0].kind).toBe("reference");
  });

  it("reports stats and llms.txt", () => {
    const stats = search.stats();
    expect(stats.pages).toBe(3);
    expect(stats.byKind.guide).toBe(1);
    expect(stats.byKind.reference).toBe(1);
    expect(search.llmsTxt()).toContain("## Guides");
    expect(search.llmsTxt()).toContain("[Migrate to components]");
  });
});

describe("makeSnippet", () => {
  it("centers on the query and adds ellipses", () => {
    const snippet = makeSnippet("a".repeat(400) + " MapView " + "b".repeat(400), "MapView", 20);
    expect(snippet).toContain("MapView");
    expect(snippet.startsWith("…")).toBe(true);
    expect(snippet.endsWith("…")).toBe(true);
  });

  it("handles missing terms", () => {
    expect(makeSnippet("short text", "missing")).toBe("short text");
  });
});
