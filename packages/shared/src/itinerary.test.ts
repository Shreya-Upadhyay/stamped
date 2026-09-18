import { describe, expect, it } from 'vitest';

import { buildStop, dominantValue, localDayKey, segmentTripIntoStops } from './itinerary';
import type { PhotoMeta } from './types/photo';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

const CASTLE = { lat: 47.5576, lng: 10.7498 };
/** ~600 m from the castle — same stop. */
const CASTLE_VIEWPOINT = { lat: 47.5628, lng: 10.7502 };
/** ~90 km away — a different stop. */
const MUNICH = { lat: 48.1351, lng: 11.582 };

function at(assetId: string, place: { lat: number; lng: number } | null, ms: number): PhotoMeta {
  return {
    id: assetId,
    assetId,
    userId: 'test-user',
    tripId: null,
    storagePath: null,
    lat: place?.lat ?? null,
    lng: place?.lng ?? null,
    hasGps: place != null,
    capturedAt: ms,
    city: null,
    region: null,
    country: null,
    locationSource: null,
    source: 'camera_roll',
  };
}

describe('localDayKey', () => {
  it('formats as YYYY-MM-DD', () => {
    const key = localDayKey(new Date(2026, 4, 30, 14, 30).getTime());
    expect(key).toBe('2026-05-30');
  });

  it('pads single-digit months and days', () => {
    expect(localDayKey(new Date(2026, 0, 5, 9, 0).getTime())).toBe('2026-01-05');
  });

  it('groups times on the same local day under one key', () => {
    const morning = localDayKey(new Date(2026, 4, 30, 8, 0).getTime());
    const evening = localDayKey(new Date(2026, 4, 30, 23, 0).getTime());
    expect(morning).toBe(evening);
  });
});

describe('segmentTripIntoStops', () => {
  it('returns nothing for no photos', () => {
    expect(segmentTripIntoStops([])).toEqual([]);
  });

  it('keeps nearby photos taken close together in one stop', () => {
    const stops = segmentTripIntoStops([
      at('a', CASTLE, 0),
      at('b', CASTLE_VIEWPOINT, 20 * MINUTE_MS),
      at('c', CASTLE, 40 * MINUTE_MS),
    ]);
    expect(stops).toHaveLength(1);
    expect(stops[0]).toHaveLength(3);
  });

  it('starts a new stop when the location moves', () => {
    const stops = segmentTripIntoStops([at('a', CASTLE, 0), at('b', MUNICH, HOUR_MS)]);
    expect(stops).toHaveLength(2);
  });

  it('starts a new stop after a long pause at the same place', () => {
    // Returning to the same spot the next day is a separate visit, and should
    // read as two rows in the itinerary rather than one long blur.
    const stops = segmentTripIntoStops([at('a', CASTLE, 0), at('b', CASTLE, 26 * HOUR_MS)]);
    expect(stops).toHaveLength(2);
  });

  it('keeps photos without GPS in the stop in progress', () => {
    const stops = segmentTripIntoStops([
      at('a', CASTLE, 0),
      at('screenshot', null, 10 * MINUTE_MS),
      at('c', CASTLE, 20 * MINUTE_MS),
    ]);
    expect(stops).toHaveLength(1);
    expect(stops[0]).toHaveLength(3);
  });

  it('sorts chronologically first', () => {
    const stops = segmentTripIntoStops([at('b', CASTLE, HOUR_MS), at('a', CASTLE, 0)]);
    expect(stops[0].map((p) => p.assetId)).toEqual(['a', 'b']);
  });
});

describe('dominantValue', () => {
  it('returns the most common value', () => {
    expect(dominantValue(['Germany', 'Germany', 'Austria'])).toBe('Germany');
  });

  it('ignores nulls', () => {
    expect(dominantValue([null, 'Germany', null])).toBe('Germany');
  });

  it('returns null when there is nothing to count', () => {
    expect(dominantValue([null, null])).toBeNull();
    expect(dominantValue([])).toBeNull();
  });
});

describe('buildStop', () => {
  const photos = [at('a', CASTLE, HOUR_MS), at('b', CASTLE_VIEWPOINT, 0)];

  it('derives timing, centre and day from its photos', () => {
    const stop = buildStop(photos, { tripId: 't1', stopId: 's1', order: 2 });
    expect(stop.startAt).toBe(0);
    expect(stop.endAt).toBe(HOUR_MS);
    expect(stop.photoCount).toBe(2);
    expect(stop.order).toBe(2);
    expect(stop.day).toBe(localDayKey(0));
    expect(stop.lat).toBeCloseTo((CASTLE.lat + CASTLE_VIEWPOINT.lat) / 2, 4);
  });

  it('starts unconfirmed and unnamed', () => {
    const stop = buildStop(photos, { tripId: 't1', stopId: 's1', order: 0 });
    expect(stop.suggestedName).toBeNull();
    expect(stop.confirmedName).toBeNull();
    expect(stop.needsManualPlace).toBe(false);
  });

  it('flags a stop with no GPS as needing a manual place', () => {
    const stop = buildStop([at('x', null, 0)], { tripId: 't1', stopId: 's1', order: 0 });
    expect(stop.needsManualPlace).toBe(true);
    expect(stop.lat).toBeNull();
  });
});
