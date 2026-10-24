import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { extractPage } from "../src/lib/html.js";

const PAGE_URL = "https://developers.arcgis.com/javascript/latest/references/core/views/MapView";

describe("extractPage", () => {
  it("extracts title, markdown, code, tables, headings, and links", async () => {
    const html = await readFile(new URL("./fixtures/page.html", import.meta.url), "utf8");
    const page = extractPage(html, PAGE_URL);

    expect(page).not.toBeNull();
    expect(page?.title).toBe("MapView");
    expect(page?.canonicalUrl).toBe(PAGE_URL);
    expect(page?.markdown).toContain("## Overview");
    expect(page?.markdown).toContain(
      "[Map](https://developers.arcgis.com/javascript/latest/references/core/Map)",
    );
    expect(page?.markdown).toContain("```javascript");
    expect(page?.markdown).toContain("const view = new MapView({");
    expect(page?.markdown).toContain("  map: myMap,");
    expect(page?.markdown).toContain("| Property | Type |");
    expect(page?.markdown).toContain("| center | Point |");
    expect(page?.markdown).toContain("[external guide](https://example.com/guide)");
    expect(page?.markdown).not.toContain("(#overview)");
    expect(page?.markdown).not.toContain("Site nav should not be indexed");
    expect(page?.markdown).not.toContain("Footer should not be indexed");
    expect(page?.markdown).not.toContain("Table of contents noise");
    expect(page?.markdown).not.toContain("[Overview](https://developers.arcgis.com");
    expect(page?.headings).toContain("Overview");
    expect(page?.headings).toContain("Handling events");
    expect(page?.links).toContain(
      "https://developers.arcgis.com/javascript/latest/references/core/Map",
    );
    expect(page?.links).toContain(
      "https://developers.arcgis.com/javascript/latest/sample-code/intro-mapview",
    );
    expect(page?.links).not.toContain(PAGE_URL);
  });

  it("returns null for pages with no meaningful content", () => {
    expect(extractPage("<html><body><p>short</p></body></html>", PAGE_URL)).toBeNull();
  });
});
