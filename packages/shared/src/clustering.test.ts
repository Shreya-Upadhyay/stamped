import { describe, expect, it } from 'vitest';

import { buildTrip, computeCentroid, haversineDistanceKm, segmentPhotosIntoTrips } from './clustering';
import type { PhotoMeta } from './types/photo';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const YEAR_MS = 365 * DAY_MS;

const PARIS = { lat: 48.8566, lng: 2.3522 };
/** ~430 km from Paris — inside the default radius. */
const AMSTERDAM = { lat: 52.3676, lng: 4.9041 };
/** ~1100 km from Paris — outside it. */
const ROME = { lat: 41.9028, lng: 12.4964 };
const TOKYO = { lat: 35.6762, lng: 139.6503 };

function makePhoto(
  overrides: Partial<PhotoMeta> & Pick<PhotoMeta, 'assetId' | 'capturedAt'>,
): PhotoMeta {
  return {
    id: overrides.assetId,
    userId: 'test-user',
    tripId: null,
    storagePath: null,
    lat: null,
    lng: null,
    hasGps: false,
    city: null,
    region: null,
    country: null,
    source: 'camera_roll',
    ...overrides,
  };
}

/** Photo at a place, `hours` after an arbitrary epoch. */
function at(assetId: string, place: { lat: number; lng: number } | null, ms: number): PhotoMeta {
  return makePhoto({
    assetId,
    capturedAt: ms,
    lat: place?.lat ?? null,
    lng: place?.lng ?? null,
    hasGps: place != null,
  });
}

describe('haversineDistanceKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineDistanceKm(PARIS, PARIS)).toBe(0);
  });

  it('returns the known Paris–Rome distance', () => {
    const distance = haversineDistanceKm(PARIS, ROME);
    expect(distance).toBeGreaterThan(1050);
    expect(distance).toBeLessThan(1150);
  });
});

describe('computeCentroid', () => {
  it('returns null for an empty list', () => {
    expect(computeCentroid([])).toBeNull();
  });

  it('averages multiple points', () => {
    expect(
      computeCentroid([
        { lat: 0, lng: 0 },
        { lat: 10, lng: 20 },
      ]),
    ).toEqual({ lat: 5, lng: 10 });
  });
});

describe('segmentPhotosIntoTrips', () => {
  it('returns an empty array for no photos', () => {
    expect(segmentPhotosIntoTrips([])).toEqual([]);
  });

  it('keeps photos within the radius in one trip', () => {
    const groups = segmentPhotosIntoTrips([
      at('a', PARIS, 0),
      at('b', AMSTERDAM, 3 * HOUR_MS),
      at('c', PARIS, 6 * HOUR_MS),
    ]);
    expect(groups).toHaveLength(1);
  });

  it('starts a new trip when a photo falls outside the radius', () => {
    const groups = segmentPhotosIntoTrips([at('a', PARIS, 0), at('b', ROME, HOUR_MS)]);
    expect(groups).toHaveLength(2);
  });

  it('does not split on time alone — a long gap in one place stays one trip', () => {
    // The rule is distance-only by default, so photos from the same place
    // years apart belong to the same trip. Deliberate: see the ADR.
    const groups = segmentPhotosIntoTrips([at('a', PARIS, 0), at('b', PARIS, 2 * YEAR_MS)]);
    expect(groups).toHaveLength(1);
  });

  it('measures distance from the trip centre, so a slow drift eventually splits', () => {
    // Each hop is under the radius, but the trip's centre keeps moving. Under
    // the old consecutive-photo rule this marched around the world as a single
    // trip; anchoring to the centre is what stops that.
    const eastward = [0, 4, 8, 12, 16, 20].map((lng, i) =>
      at(`p${i}`, { lat: 0, lng }, i * HOUR_MS),
    );
    const groups = segmentPhotosIntoTrips(eastward);
    expect(groups.length).toBeGreaterThan(1);
  });

  it('honours a time gap when one is supplied', () => {
    const groups = segmentPhotosIntoTrips([at('a', PARIS, 0), at('b', PARIS, 2 * DAY_MS)], {
      tripGapMs: DAY_MS,
    });
    expect(groups).toHaveLength(2);
  });

  it('respects a custom radius', () => {
    // Amsterdam is ~430 km from Paris: inside the default, outside 100 km.
    const photos = [at('a', PARIS, 0), at('b', AMSTERDAM, HOUR_MS)];
    expect(segmentPhotosIntoTrips(photos, { tripRadiusKm: 100 })).toHaveLength(2);
    expect(segmentPhotosIntoTrips(photos, { tripRadiusKm: 1000 })).toHaveLength(1);
  });

  it('treats photos with no GPS as part of the trip in progress', () => {
    const groups = segmentPhotosIntoTrips([
      at('a', PARIS, 0),
      at('screenshot', null, HOUR_MS),
      at('c', PARIS, 2 * HOUR_MS),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
  });

  it('does not let a no-GPS photo anchor a trip', () => {
    // A no-GPS photo carries no location, so it must not become the centre
    // the next photo is measured against — otherwise it would bridge two
    // genuinely distant trips.
    const groups = segmentPhotosIntoTrips([
      at('a', PARIS, 0),
      at('screenshot', null, HOUR_MS),
      at('c', TOKYO, 2 * HOUR_MS),
    ]);
    expect(groups).toHaveLength(2);
  });

  it('sorts photos chronologically before grouping', () => {
    const groups = segmentPhotosIntoTrips([at('b', PARIS, HOUR_MS), at('a', PARIS, 0)]);
    expect(groups[0].map((p) => p.assetId)).toEqual(['a', 'b']);
  });
});

describe('buildTrip', () => {
  const photos = [
    at('a', PARIS, HOUR_MS),
    at('b', PARIS, 0),
    at('c', PARIS, 2 * HOUR_MS),
  ];

  it('computes startAt/endAt/photoCount/coverPhotoId from the group', () => {
    const trip = buildTrip(photos, {
      userId: 'test-user',
      tripId: 'trip-1',
      city: 'Paris',
      country: 'France',
    });
    expect(trip.startAt).toBe(0);
    expect(trip.endAt).toBe(2 * HOUR_MS);
    expect(trip.photoCount).toBe(3);
    expect(trip.coverPhotoId).toBe('b');
    expect(trip.id).toBe('trip-1');
  });

  it('uses the city as the title when available', () => {
    const trip = buildTrip(photos, {
      userId: 'test-user',
      tripId: 'trip-1',
      city: 'Paris',
      country: 'France',
    });
    expect(trip.title).toBe('Paris');
    expect(trip.primaryCity).toBe('Paris');
  });

  it('falls back to a date title when there is no city', () => {
    const trip = buildTrip(photos, {
      userId: 'test-user',
      tripId: 'trip-1',
      city: null,
      country: null,
    });
    expect(trip.title).toContain('Trip');
    expect(trip.primaryCity).toBeNull();
  });
});
