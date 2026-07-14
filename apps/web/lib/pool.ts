// Small concurrency pool. Runs `worker` over `items` with at most `size` calls
// in flight at once, preserving input order in the returned array. Used by every
// batch runner (Evals, OCR, STT, Router) so per-model "batch size" is honoured.
//
// A worker that throws rejects the whole pool; callers that want per-item error
// capture (all of ours do) should catch inside the worker and return an error
// result instead of throwing.

export async function runPool<T, R>(
  items: T[],
  size: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const n = items.length;
  const results: R[] = new Array(n);
  if (n === 0) return results;
  const width = Math.max(1, Math.min(Math.floor(size) || 1, n));
  let next = 0;
  async function lane(): Promise<void> {
    while (true) {
      const i = next++;
      if (i >= n) return;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: width }, () => lane()));
  return results;
}
