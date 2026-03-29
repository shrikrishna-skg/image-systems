async function mapPool(items, concurrency, fn) {
  if (items.length === 0) return [];
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    for (; ; ) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}
export {
  mapPool
};
