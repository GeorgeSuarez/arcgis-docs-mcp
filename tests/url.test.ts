import { describe, expect, it } from "vitest";
import {
  isCrawlableDocsUrl,
  kindFromUrl,
  normalizeUrl,
} from "../src/lib/url.js";

describe("normalizeUrl", () => {
  it("removes fragments, queries, and trailing slashes", () => {
    expect(normalizeUrl("https://developers.arcgis.com/javascript/latest/faq/?x=1#y")).toBe(
      "https://developers.arcgis.com/javascript/latest/faq",
    );
  });

  it("keeps the root slash", () => {
    expect(normalizeUrl("https://developers.arcgis.com/")).toBe("https://developers.arcgis.com/");
  });

  it("resolves relative URLs", () => {
    expect(
      normalizeUrl("../Map/", "https://developers.arcgis.com/javascript/latest/references/core/views/"),
    ).toBe("https://developers.arcgis.com/javascript/latest/references/core/Map");
  });
});

describe("kindFromUrl", () => {
  it.each([
    ["https://developers.arcgis.com/javascript/latest/release-notes/", "release-notes"],
    ["https://developers.arcgis.com/javascript/latest/v5-1/", "release-notes"],
    ["https://developers.arcgis.com/javascript/latest/references/core/Map/", "reference"],
    ["https://developers.arcgis.com/javascript/latest/sample-code/intro-mapview/", "sample"],
    ["https://developers.arcgis.com/javascript/latest/tutorials/foo/", "tutorial"],
    [
      "https://www.esri.com/arcgis-blog/products/js-api-arcgis/announcements/whats-new/",
      "blog",
    ],
    ["https://developers.arcgis.com/javascript/latest/faq/", "guide"],
  ])("%s -> %s", (url, kind) => {
    expect(kindFromUrl(url)).toBe(kind);
  });
});

describe("isCrawlableDocsUrl", () => {
  it("accepts documentation pages", () => {
    expect(isCrawlableDocsUrl("https://developers.arcgis.com/javascript/latest/faq/")).toBe(true);
    expect(
      isCrawlableDocsUrl("https://developers.arcgis.com/javascript/latest/references/core/Map/"),
    ).toBe(true);
  });

  it("rejects samples, assets, and other hosts", () => {
    expect(
      isCrawlableDocsUrl("https://developers.arcgis.com/javascript/latest/sample-code/intro-mapview/"),
    ).toBe(false);
    expect(isCrawlableDocsUrl("https://developers.arcgis.com/javascript/latest/sample-code")).toBe(
      false,
    );
    expect(isCrawlableDocsUrl("https://developers.arcgis.com/javascript/latest/showcase")).toBe(
      false,
    );
    expect(isCrawlableDocsUrl("https://developers.arcgis.com/javascript/latest/file.pdf")).toBe(
      false,
    );
    expect(isCrawlableDocsUrl("https://www.esri.com/arcgis-blog/products/js-api-arcgis/")).toBe(
      false,
    );
  });
});
