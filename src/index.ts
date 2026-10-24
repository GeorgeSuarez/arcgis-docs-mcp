export { createDocsServer, type DocsServerOptions } from "./server-factory.js";
export { DocsSearch, makeSnippet } from "./lib/search.js";
export { indexDocs, type IndexOptions } from "./indexer/indexer.js";
export { SEED_PAGES, seedsFromUrls } from "./indexer/seeds.js";
export { extractPage } from "./lib/html.js";
export { fetchHtml, extractMetaRefresh } from "./lib/fetch.js";
export { loadIndex, saveIndex, statsFromPages, truncate } from "./lib/store.js";
export { normalizeUrl, kindFromUrl, isCrawlableDocsUrl } from "./lib/url.js";
export type {
  DocIndexFile,
  DocKind,
  DocPage,
  IndexReport,
  IndexStats,
  SearchHit,
  SearchOptions,
  SeedPage,
} from "./lib/types.js";
