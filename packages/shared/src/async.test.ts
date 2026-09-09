import { describe, expect, it } from 'vitest';

import { mapWithLimit } from './async';

/** Resolves after a tick, so overlapping work is observable. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

describe('mapWithLimit', () => {
  it('visits every item exactly once', async () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    const seen: number[] = [];

    await mapWithLimit(items, 3, async (n) => {
      await tick();
      seen.push(n);
    });

    expect(seen.sort((a, b) => a - b)).toEqual(items);
  });

  it('never exceeds the concurrency limit', async () => {
    let inFlight = 0;
    let peak = 0;

    await mapWithLimit(Array.from({ length: 20 }, (_, i) => i), 4, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await tick();
      inFlight -= 1;
    });

    expect(peak).toBeLessThanOrEqual(4);
  });

  it('actually runs work in parallel up to the limit', async () => {
    // Guards against a regression to fully sequential work, which would make
    // naming hundreds of stops unbearably slow.
    let inFlight = 0;
    let peak = 0;

    await mapWithLimit(Array.from({ length: 12 }, (_, i) => i), 4, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await tick();
      inFlight -= 1;
    });

    expect(peak).toBeGreaterThan(1);
  });

  it('handles an empty list without hanging', async () => {
    let calls = 0;
    await mapWithLimit([], 4, async () => {
      calls += 1;
    });
    expect(calls).toBe(0);
  });

  it('handles a limit larger than the list', async () => {
    const seen: number[] = [];
    await mapWithLimit([1, 2], 10, async (n) => {
      await tick();
      seen.push(n);
    });
    expect(seen.sort()).toEqual([1, 2]);
  });

  it('propagates a rejection', async () => {
    await expect(
      mapWithLimit([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });
});
