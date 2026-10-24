import type { SeedPage } from "../lib/types.js";

const docs = "https://developers.arcgis.com";
const latest = `${docs}/javascript/latest`;

/**
 * Curated seed list. This is intentionally small and high-signal: the goal is
 * an index that answers "how do I build / migrate / debug this?" questions,
 * not a mirror of the entire documentation site.
 */
export const SEED_PAGES: SeedPage[] = [
  // Entry points and release information
  { url: `${latest}/`, kind: "guide" },
  { url: `${latest}/faq/`, kind: "guide" },
  { url: `${latest}/release-notes/`, kind: "release-notes" },
  { url: `${latest}/v5-1/`, kind: "release-notes" },
  { url: `${latest}/v5-0/`, kind: "release-notes" },
  { url: `${latest}/v4-34/`, kind: "release-notes" },
  { url: `${latest}/version-matrix/`, kind: "guide" },
  { url: `${latest}/breaking-changes/`, kind: "guide" },
  { url: `${latest}/downloads-and-previous-versions/`, kind: "guide" },

  // Components and migration
  { url: `${latest}/components-transition-plan/`, kind: "guide" },
  { url: `${latest}/migrating-to-components/`, kind: "guide" },
  { url: `${latest}/building-your-ui/`, kind: "guide" },
  { url: `${latest}/programming-patterns/`, kind: "guide" },
  { url: `${latest}/react/`, kind: "guide" },
  { url: `${latest}/custom-ui/`, kind: "guide" },
  { url: `${latest}/view-models/`, kind: "guide" },
  { url: `${latest}/get-started/`, kind: "guide" },
  { url: `${latest}/get-started-npm/`, kind: "guide" },
  { url: `${latest}/es-modules/`, kind: "guide" },
  { url: `${latest}/amd-build/`, kind: "guide" },
  { url: `${latest}/system-requirements/`, kind: "guide" },
  { url: `${latest}/troubleshooting/`, kind: "guide" },
  { url: `${latest}/disconnected-environment/`, kind: "guide" },
  { url: `${latest}/layers/`, kind: "guide" },

  // AI components
  { url: `${latest}/references/ai-components/`, kind: "reference" },
  { url: `${latest}/agentic-apps/ai-faq/`, kind: "guide" },
  { url: `${latest}/agentic-apps/ai-webmap-setup/`, kind: "guide" },
  { url: `${latest}/references/ai-components/utils/index/`, kind: "reference" },
  { url: `${latest}/references/ai-components/components/arcgis-assistant/`, kind: "reference" },
  { url: `${latest}/references/ai-components/components/arcgis-assistant-agent/`, kind: "reference" },
  { url: `${latest}/references/ai-components/components/arcgis-assistant-navigation-agent/`, kind: "reference" },
  { url: `${latest}/references/ai-components/components/arcgis-assistant-data-exploration-agent/`, kind: "reference" },
  { url: `${latest}/sample-code/ai-assistant/`, kind: "sample" },

  // Core API references
  { url: `${latest}/references/core/Map/`, kind: "reference" },
  { url: `${latest}/references/core/views/MapView/`, kind: "reference" },
  { url: `${latest}/references/core/views/SceneView/`, kind: "reference" },
  { url: `${latest}/references/core/layers/FeatureLayer/`, kind: "reference" },
  { url: `${latest}/references/core/layers/GraphicsLayer/`, kind: "reference" },
  { url: `${latest}/references/core/layers/BaseTileLayer/`, kind: "reference" },
  { url: `${latest}/references/core/layers/ImageryTileLayer/`, kind: "reference" },
  { url: `${latest}/references/core/layers/IntegratedMesh3DTilesLayer/`, kind: "reference" },
  { url: `${latest}/references/core/layers/OGCFeatureLayer/`, kind: "reference" },
  { url: `${latest}/references/core/layers/SceneLayer/`, kind: "reference" },
  { url: `${latest}/references/core/layers/Layer/`, kind: "reference" },
  { url: `${latest}/references/core/rest/print/`, kind: "reference" },
  { url: `${latest}/references/core/views/2d/layers/BaseLayerView2D/`, kind: "reference" },
  { url: `${latest}/references/core/geometry/geometryEngine/`, kind: "reference" },
  { url: `${latest}/references/core/core/reactiveUtils/`, kind: "reference" },

  // Map component references
  { url: `${latest}/references/map-components/components/arcgis-map/`, kind: "reference" },
  { url: `${latest}/references/map-components/components/arcgis-scene/`, kind: "reference" },
  { url: `${latest}/references/map-components/components/arcgis-search/`, kind: "reference" },
  { url: `${latest}/references/map-components/components/arcgis-legend/`, kind: "reference" },
  { url: `${latest}/references/map-components/components/arcgis-editor/`, kind: "reference" },
  { url: `${latest}/references/map-components/components/arcgis-feature-table/`, kind: "reference" },
  { url: `${latest}/references/map-components/components/arcgis-popup/`, kind: "reference" },

  // Samples and tutorials
  { url: `${latest}/sample-code/intro-mapview/`, kind: "sample" },
  { url: `${latest}/sample-code/intro-featurelayer/`, kind: "sample" },
  { url: `${latest}/sample-code/layers-imagerytilelayer-cog/`, kind: "sample" },
  { url: `${latest}/sample-code/custom-lv-deckgl/`, kind: "sample" },
  { url: `${latest}/tutorials/create-a-web-app-using-components/`, kind: "tutorial" },
  // Esri's blog host currently returns 403 to non-browser clients, so these
  // are opt-in. Pass them with `--seed` or import this array in a custom script.
];

export const OPTIONAL_BLOG_SEEDS: SeedPage[] = [
  {
    url: "https://www.esri.com/arcgis-blog/products/js-api-arcgis/announcements/arcgis-maps-sdk-for-javascript-whats-new-in-5-0",
    kind: "blog",
  },
  {
    url: "https://www.esri.com/arcgis-blog/products/js-api-arcgis/announcements/arcgis-maps-sdk-for-javascript-whats-new-in-5-1",
    kind: "blog",
  },
  {
    url: "https://www.esri.com/arcgis-blog/products/js-api-arcgis/announcements/arcgis-maps-sdk-for-javascript-is-moving-to-semantic-versioning",
    kind: "blog",
  },
  {
    url: "https://www.esri.com/arcgis-blog/products/js-api-arcgis/developers/introducing-ai-components-beta-in-the-js-maps-sdk",
    kind: "blog",
  },
  {
    url: "https://www.esri.com/arcgis-blog/products/js-api-arcgis/developers/future-proof-your-arcgis-javascript-app",
    kind: "blog",
  },
  {
    url: "https://www.esri.com/arcgis-blog/products/js-api-arcgis/developers/javascript-maps-sdk-a-full-transition-to-components",
    kind: "blog",
  },
  {
    url: "https://www.esri.com/arcgis-blog/products/js-api-arcgis/developers/ssr-esm",
    kind: "blog",
  },
  {
    url: "https://www.esri.com/arcgis-blog/products/js-api-arcgis/developers/evolution-of-view-models-and-building-custom-workflows-with-javascript-maps-sdk",
    kind: "blog",
  },
];

export function seedsFromUrls(urls: readonly string[]): SeedPage[] {
  return urls.map((url) => ({ url }));
}
