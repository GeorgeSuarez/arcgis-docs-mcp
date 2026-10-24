import { describe, expect, it } from "vitest";
import { extractMetaRefresh } from "../src/lib/fetch.js";

describe("extractMetaRefresh", () => {
  it("follows the http-equiv-first form", () => {
    const html =
      '<meta http-equiv="refresh" content="0; url=/javascript/latest/faq/">';
    expect(extractMetaRefresh(html, "https://developers.arcgis.com/javascript/latest/")).toBe(
      "https://developers.arcgis.com/javascript/latest/faq/",
    );
  });

  it("follows the content-first form", () => {
    const html =
      '<meta content="0; URL=https://developers.arcgis.com/javascript/latest/faq/" http-equiv="refresh">';
    expect(extractMetaRefresh(html, "https://example.com/")).toBe(
      "https://developers.arcgis.com/javascript/latest/faq/",
    );
  });

  it("returns null when there is no refresh", () => {
    expect(extractMetaRefresh("<html><body>Hello</body></html>", "https://example.com/")).toBeNull();
  });
});
