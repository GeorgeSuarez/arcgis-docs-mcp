#!/usr/bin/env node
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DocsSearch } from "./lib/search.js";
import { loadIndex } from "./lib/store.js";
import { createDocsServer } from "./server-factory.js";

const cwdData = path.resolve(process.cwd(), "data/pages.json");
const moduleData = fileURLToPath(new URL("../data/pages.json", import.meta.url));
let dataFile = moduleData;
if (process.env.ARCGIS_DOCS_DATA) {
  dataFile = path.resolve(process.env.ARCGIS_DOCS_DATA);
} else if (existsSync(cwdData)) {
  dataFile = cwdData;
}

try {
  const index = await loadIndex(dataFile);
  const search = new DocsSearch(index.pages, index.generatedAt);
  const server = createDocsServer(search, { dataFile });

  if (index.pages.length === 0) {
    console.error(
      `[arcgis-docs-mcp] No index at ${dataFile}. Run \`npm run index\` in the project directory first.`,
    );
  }

  await server.connect(new StdioServerTransport());
  console.error(`[arcgis-docs-mcp] ready: ${index.pages.length} pages from ${dataFile}`);
} catch (error) {
  console.error(`[arcgis-docs-mcp] failed to start: ${(error as Error).message}`);
  process.exitCode = 1;
}
