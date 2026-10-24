/** Run `fn` over `items` with a bounded number of concurrent workers. */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workerCount = Math.max(1, Math.min(Math.floor(limit) || 1, items.length));

  const workers: Promise<void>[] = [];
  for (let worker = 0; worker < workerCount; worker++) {
    workers.push(
      (async () => {
        while (true) {
          const index = next++;
          if (index >= items.length) return;
          results[index] = await fn(items[index], index);
        }
      })(),
    );
  }

  await Promise.all(workers);
  return results;
}

export function uniqueBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const value = key(item);
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(item);
  }
  return result;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
