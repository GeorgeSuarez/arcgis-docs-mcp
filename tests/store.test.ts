import { describe, expect, it } from "vitest";
import { dedupePages, truncate } from "../src/lib/store.js";
import type { DocPage } from "../src/lib/types.js";

function page(url: string, hash: string, title = "Title"): DocPage {
  return {
    url,
    aliases: [],
    title,
    kind: "release-notes",
    markdown: `# ${title}`,
    text: title,
    headings: [],
    hash,
    fetchedAt: "2026-10-23T00:00:00.000Z",
    status: 200,
    bytes: title.length,
  };
}

describe("dedupePages", () => {
  it("keeps the canonical release-notes URL and merges aliases", () => {
    const pages = dedupePages([
      page("https://developers.arcgis.com/javascript/latest/v5-1", "same", "Release notes for 5.1"),
      page(
        "https://developers.arcgis.com/javascript/latest/release-notes",
        "same",
        "Release notes for 5.1",
      ),
    ]);

    expect(pages).toHaveLength(1);
    expect(pages[0].url).toContain("/release-notes");
    expect(pages[0].aliases).toContain(
      "https://developers.arcgis.com/javascript/latest/v5-1",
    );
  });

  it("keeps pages with different content", () => {
    const pages = dedupePages([
      page("https://example.com/a", "a"),
      page("https://example.com/b", "b"),
    ]);
    expect(pages).toHaveLength(2);
  });
});

describe("truncate", () => {
  it("leaves short text alone", () => {
    expect(truncate("short", 10)).toBe("short");
  });

  it("adds a truncation marker", () => {
    expect(truncate("0123456789", 5, "page")).toContain("[truncated page: 5 characters omitted]");
  });
});
