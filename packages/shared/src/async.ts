/**
 * Runs `task` over every item, at most `limit` of them in flight at once.
 *
 * Used for reverse-geocoding a trip's stops. The device geocoder throttles
 * when hit with hundreds of concurrent lookups, and a throttled lookup fails
 * exactly like a missing permission — every stop comes back unnamed, which is
 * very hard to tell apart. Bounding the concurrency keeps a large photo
 * library reliable while staying far quicker than going strictly one at a
 * time.
 *
 * Rejections propagate: the first failing task rejects the whole call, so a
 * caller that wants to tolerate individual failures should catch inside
 * `task` (which is what the trip flow does, to keep one dead lookup from
 * failing an entire run).
 */
export async function mapWithLimit<T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await task(items[index]);
    }
  });
  await Promise.all(workers);
}
