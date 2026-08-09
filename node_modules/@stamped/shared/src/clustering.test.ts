import { describe, expect, it } from 'vitest';

import { buildTrip, computeCentroid, haversineDistanceKm, segmentPhotosIntoTrips } from './clustering';
import type { PhotoMeta } from './types/photo';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const PARIS = { lat: 48.8566, lng: 2.3522 };
const LONDON = { lat: 51.5074, lng: -0.1278 };
const NEW_YORK = { lat: 40.7128, lng: -74.006 };

function makePhoto(overrides: Partial<PhotoMeta> & Pick<PhotoMeta, 'assetId' | 'capturedAt'>): PhotoMeta {
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

describe('haversineDistanceKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineDistanceKm(PARIS, PARIS)).toBe(0);
  });

  it('returns the known distance between Paris and London', () => {
    const distance = haversineDistanceKm(PARIS, LONDON);
    expect(distance).toBeGreaterThan(340);
    expect(distance).toBeLessThan(350);
  });
});

describe('computeCentroid', () => {
  it('returns null for an empty list', () => {
    expect(computeCentroid([])).toBeNull();
  });

  it('returns the point itself for a single point', () => {
    expect(computeCentroid([PARIS])).toEqual(PARIS);
  });

  it('averages multiple points', () => {
    const centroid = computeCentroid([
      { lat: 0, lng: 0 },
      { lat: 10, lng: 20 },
    ]);
    expect(centroid).toEqual({ lat: 5, lng: 10 });
  });
});

describe('segmentPhotosIntoTrips', () => {
  it('returns an empty array for no photos', () => {
    expect(segmentPhotosIntoTrips([])).toEqual([]);
  });

  it('groups photos close in time and space into a single trip', () => {
    const photos = [
      makePhoto({ assetId: 'a', capturedAt: 0, lat: PARIS.lat, lng: PARIS.lng, hasGps: true }),
      makePhoto({ assetId: 'b', capturedAt: 2 * HOUR_MS, lat: PARIS.lat + 0.01, lng: PARIS.lng + 0.01, hasGps: true }),
      makePhoto({ assetId: 'c', capturedAt: 5 * HOUR_MS, lat: PARIS.lat - 0.01, lng: PARIS.lng, hasGps: true }),
    ];
    const groups = segmentPhotosIntoTrips(photos);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
  });

  it('splits into a new trip after a >24h time gap', () => {
    const photos = [
      makePhoto({ assetId: 'a', capturedAt: 0, lat: PARIS.lat, lng: PARIS.lng, hasGps: true }),
      makePhoto({ assetId: 'b', capturedAt: 2 * DAY_MS, lat: PARIS.lat, lng: PARIS.lng, hasGps: true }),
    ];
    const groups = segmentPhotosIntoTrips(photos);
    expect(groups).toHaveLength(2);
    expect(groups[0].map((p) => p.assetId)).toEqual(['a']);
    expect(groups[1].map((p) => p.assetId)).toEqual(['b']);
  });

  it('splits into a new trip after a large distance jump, even with a small time gap', () => {
    const photos = [
      makePhoto({ assetId: 'a', capturedAt: 0, lat: PARIS.lat, lng: PARIS.lng, hasGps: true }),
      makePhoto({ assetId: 'b', capturedAt: HOUR_MS, lat: NEW_YORK.lat, lng: NEW_YORK.lng, hasGps: true }),
    ];
    const groups = segmentPhotosIntoTrips(photos);
    expect(groups).toHaveLength(2);
  });

  it('does not split on a short hop within the distance threshold', () => {
    // ~55km north of Paris — well under the 300km default threshold
    // (unlike Paris->London, which is ~344km and does split; see the test above).
    const nearbyTown = { lat: PARIS.lat + 0.5, lng: PARIS.lng };
    const photos = [
      makePhoto({ assetId: 'a', capturedAt: 0, lat: PARIS.lat, lng: PARIS.lng, hasGps: true }),
      makePhoto({ assetId: 'b', capturedAt: HOUR_MS, lat: nearbyTown.lat, lng: nearbyTown.lng, hasGps: true }),
    ];
    const groups = segmentPhotosIntoTrips(photos);
    expect(groups).toHaveLength(1);
  });

  it('handles no-GPS photos without crashing, falling back to time-only grouping', () => {
    const photos = [
      makePhoto({ assetId: 'a', capturedAt: 0 }),
      makePhoto({ assetId: 'b', capturedAt: HOUR_MS, lat: NEW_YORK.lat, lng: NEW_YORK.lng, hasGps: true }),
      makePhoto({ assetId: 'c', capturedAt: 2 * HOUR_MS }),
    ];
    const groups = segmentPhotosIntoTrips(photos);
    expect(groups).toHaveLength(1);
    expect(groups[0].map((p) => p.assetId)).toEqual(['a', 'b', 'c']);
  });

  it('sorts photos chronologically before grouping', () => {
    const photos = [
      makePhoto({ assetId: 'b', capturedAt: HOUR_MS }),
      makePhoto({ assetId: 'a', capturedAt: 0 }),
    ];
    const groups = segmentPhotosIntoTrips(photos);
    expect(groups[0].map((p) => p.assetId)).toEqual(['a', 'b']);
  });
});

describe('buildTrip', () => {
  const photos = [
    makePhoto({ assetId: 'a', capturedAt: HOUR_MS, lat: PARIS.lat, lng: PARIS.lng, hasGps: true }),
    makePhoto({ assetId: 'b', capturedAt: 0, lat: PARIS.lat, lng: PARIS.lng, hasGps: true }),
    makePhoto({ assetId: 'c', capturedAt: 2 * HOUR_MS, lat: PARIS.lat, lng: PARIS.lng, hasGps: true }),
  ];

  it('computes startAt/endAt/photoCount/coverPhotoId from the photo group', () => {
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
    expect(trip.userId).toBe('test-user');
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
    expect(trip.country).toBe('France');
  });

  it('falls back to a date-range title when there is no city', () => {
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
