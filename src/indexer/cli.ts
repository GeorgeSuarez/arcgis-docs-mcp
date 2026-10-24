import { Command } from "commander";
import path from "node:path";
import pc from "picocolors";
import { DocsSearch } from "../lib/search.js";
import { loadIndex, writeTextFile } from "../lib/store.js";
import type { DocKind, SeedPage } from "../lib/types.js";
import { indexDocs } from "./indexer.js";
import { SEED_PAGES, seedsFromUrls } from "./seeds.js";

const DEFAULT_OUT = process.env.ARCGIS_DOCS_DATA ?? path.resolve(process.cwd(), "data/pages.json");

const program = new Command();

program
  .name("arcgis-docs-mcp")
  .description("Index and query ArcGIS Maps SDK for JavaScript documentation locally.")
  .version("0.1.0");

program
  .command("index")
  .description("Fetch docs pages and write a local search index.")
  .option("--out <path>", "index file to write", DEFAULT_OUT)
  .option("--max-pages <n>", "maximum pages to fetch this run", parsePositiveInt, 80)
  .option("--concurrency <n>", "parallel fetches", parsePositiveInt, 4)
  .option("--timeout <ms>", "per-request timeout in milliseconds", parsePositiveInt, 20_000)
  .option("--crawl", "follow same-site documentation links one level deep", false)
  .option("--force", "re-fetch pages even when the content hash is unchanged", false)
  .option("--seed <url...>", "override the built-in seed URLs")
  .option("--dry-run", "print the seed URLs without fetching")
  .option("--strict", "exit non-zero if any page fails")
  .action(async (options: IndexCommandOptions) => {
    const seeds: SeedPage[] = options.seed?.length ? seedsFromUrls(options.seed) : SEED_PAGES;

    if (options.dryRun) {
      for (const seed of seeds) console.log(seed.url);
      return;
    }

    const report = await indexDocs({
      out: options.out,
      maxPages: options.maxPages,
      concurrency: options.concurrency,
      timeoutMs: options.timeout,
      crawl: options.crawl,
      force: options.force,
      seeds,
      log: (line) => console.error(pc.dim(line)),
    });

    console.log("");
    console.log(pc.bold("Index complete"));
    console.log(`  file:      ${report.out}`);
    console.log(`  pages:     ${report.pages}`);
    console.log(`  added:     ${report.added}`);
    console.log(`  updated:   ${report.updated}`);
    console.log(`  unchanged: ${report.skipped}`);
    console.log(`  failed:    ${report.failed.length}`);
    console.log(`  generated: ${report.generatedAt}`);

    if (report.failed.length > 0) {
      console.log("");
      console.log(pc.yellow("Failures:"));
      for (const failure of report.failed) {
        console.log(`  - ${failure.url}: ${failure.error}`);
      }
      if (options.strict) process.exitCode = 1;
    }
  });

program
  .command("status")
  .description("Show index counts and freshness.")
  .option("--out <path>", "index file to read", DEFAULT_OUT)
  .action(async (options: { out: string }) => {
    const index = await loadIndex(options.out);
    const search = new DocsSearch(index.pages, index.generatedAt);
    console.log(JSON.stringify({ file: options.out, ...search.stats() }, null, 2));
  });

program
  .command("search <query>")
  .description("Search the local index from the terminal.")
  .option("--out <path>", "index file to read", DEFAULT_OUT)
  .option("--kind <kind>", "filter by page kind")
  .option("--limit <n>", "number of results", parsePositiveInt, 8)
  .action(async (query: string, options: { out: string; kind?: string; limit: number }) => {
    const index = await loadIndex(options.out);
    const search = new DocsSearch(index.pages, index.generatedAt);
    const hits = search.search(query, {
      kind: options.kind as DocKind | undefined,
      limit: options.limit,
    });

    if (hits.length === 0) {
      console.log("No results.");
      return;
    }

    for (const [index, hit] of hits.entries()) {
      console.log(`${index + 1}. ${pc.bold(hit.title)} ${pc.dim(`[${hit.kind}]`)}`);
      console.log(`   ${pc.cyan(hit.url)}`);
      console.log(`   ${hit.snippet}`);
      console.log("");
    }
  });

program
  .command("llms")
  .description("Write an llms.txt file from the local index.")
  .option("--out <path>", "index file to read", DEFAULT_OUT)
  .option("--file <path>", "llms.txt output path")
  .action(async (options: { out: string; file?: string }) => {
    const index = await loadIndex(options.out);
    const search = new DocsSearch(index.pages, index.generatedAt);
    const output = options.file ?? path.join(path.dirname(options.out), "llms.txt");
    await writeTextFile(output, search.llmsTxt());
    console.log(`Wrote ${output} (${search.size} pages)`);
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(pc.red((error as Error).message));
  process.exitCode = 1;
});

interface IndexCommandOptions {
  out: string;
  maxPages: number;
  concurrency: number;
  timeout: number;
  crawl: boolean;
  force: boolean;
  seed?: string[];
  dryRun: boolean;
  strict: boolean;
}

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`Expected a positive integer, got "${value}"`);
  }
  return parsed;
}
