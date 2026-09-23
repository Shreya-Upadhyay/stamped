import { describe, expect, it } from 'vitest';

import {
  fromStampedTripDoc,
  toStampedTripDoc,
  STAMPED_TRIP_DOC_VERSION,
  type StampedTripInput,
} from './archive-doc';
import type { PhotoMeta } from './types/photo';
import type { TripStop } from './types/stop';
import type { Trip } from './types/trip';

const START = Date.UTC(2025, 5, 1, 9, 0);

function photo(assetId: string, place: { lat: number; lng: number } | null): PhotoMeta {
  return {
    id: assetId,
    assetId,
    userId: 'test-user',
    tripId: null,
    storagePath: null,
    lat: place?.lat ?? null,
    lng: place?.lng ?? null,
    hasGps: place != null,
    locationSource: place != null ? 'exif' : null,
    capturedAt: START,
    city: null,
    region: null,
    country: null,
    source: 'camera_roll',
  };
}

function stop(id: string): TripStop {
  return {
    id,
    tripId: 'trip-1',
    order: 0,
    day: '2025-06-01',
    startAt: START,
    endAt: START + 3_600_000,
    lat: 41.9028,
    lng: 12.4964,
    suggestedName: 'Pantheon',
    confirmedName: null,
    city: 'Rome',
    country: 'Italy',
    photoCount: 1,
    needsManualPlace: false,
  };
}

const TRIP: Trip = {
  id: 'trip-1',
  userId: 'test-user',
  title: 'Italy',
  startAt: START,
  endAt: START + 86_400_000,
  primaryCity: 'Rome',
  country: 'Italy',
  photoCount: 2,
  coverPhotoId: null,
  createdAt: START,
};

function input(overrides: Partial<StampedTripInput> = {}): StampedTripInput {
  return {
    id: 'trip-1',
    // Copied, so a test that mutates its input can't poison the next one.
    trip: { ...TRIP },
    title: 'Rome weekend',
    category: 'Group',
    stopNames: { 'stop-1': 'Pantheon' },
    stampedAt: START + 90_000_000,
    photos: [
      { assetId: 'a', filename: 'a.jpg', uri: 'file:///a.jpg', meta: photo('a', { lat: 41.9, lng: 12.5 }) },
      { assetId: 'b', filename: 'b.jpg', meta: photo('b', null) },
    ],
    stops: [{ stop: stop('stop-1'), photoAssetIds: ['a', 'b'] }],
    ...overrides,
  };
}

describe('toStampedTripDoc', () => {
  it('survives a round trip unchanged', () => {
    const doc = toStampedTripDoc(input());
    expect(fromStampedTripDoc(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  });

  it('replaces a missing uri with null, since Firestore rejects undefined', () => {
    const doc = toStampedTripDoc(input());
    expect(doc.photos[1].uri).toBeNull();
    expect(JSON.stringify(doc)).not.toContain('undefined');
  });

  it('keeps only the stop names belonging to this trip', () => {
    const doc = toStampedTripDoc(
      input({ stopNames: { 'stop-1': 'Pantheon', 'other-trip-stop': 'Shibuya' } }),
    );
    expect(doc.stopNames).toEqual({ 'stop-1': 'Pantheon' });
  });

  it('stamps the current schema version', () => {
    expect(toStampedTripDoc(input()).version).toBe(STAMPED_TRIP_DOC_VERSION);
  });

  it('copies rather than aliases the caller state', () => {
    const source = input();
    const doc = toStampedTripDoc(source);
    source.trip.title = 'changed';
    expect(doc.trip.title).toBe('Italy');
  });
});

describe('fromStampedTripDoc', () => {
  it('rejects a document from an unknown schema version', () => {
    const doc = { ...toStampedTripDoc(input()), version: 99 };
    expect(fromStampedTripDoc(doc)).toBeNull();
  });

  it('rejects anything that is not a trip document', () => {
    for (const value of [null, undefined, 42, 'trip', [], {}]) {
      expect(fromStampedTripDoc(value)).toBeNull();
    }
  });

  it('drops a malformed photo rather than the whole trip', () => {
    const doc = toStampedTripDoc(input());
    const damaged = { ...doc, photos: [doc.photos[0], { assetId: 'c' }] };
    const parsed = fromStampedTripDoc(damaged);
    expect(parsed?.photos.map((p) => p.assetId)).toEqual(['a']);
  });

  it('keeps a photo the user placed by hand', () => {
    const placed = photo('b', { lat: 41.9, lng: 12.5 });
    placed.locationSource = 'manual';
    const doc = toStampedTripDoc(
      input({ photos: [{ assetId: 'b', filename: 'b.jpg', uri: null, meta: placed }] }),
    );
    expect(fromStampedTripDoc(doc)?.photos[0].meta.locationSource).toBe('manual');
  });

  it('falls back to the trip title when the stored title is missing', () => {
    const { title: _dropped, ...rest } = toStampedTripDoc(input());
    expect(fromStampedTripDoc(rest)?.title).toBe('Italy');
  });

  it('tolerates a stop whose photo ids are missing', () => {
    const doc = toStampedTripDoc(input());
    const damaged = { ...doc, stops: [{ stop: doc.stops[0].stop }] };
    expect(fromStampedTripDoc(damaged)?.stops[0].photoAssetIds).toEqual([]);
  });
});
