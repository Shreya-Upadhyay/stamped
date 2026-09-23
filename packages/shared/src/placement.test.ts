import { describe, expect, it } from 'vitest';

import { partitionUnlocated, placePhoto } from './placement';
import type { PhotoMeta } from './types/photo';

const PARIS = { lat: 48.8566, lng: 2.3522 };

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
    capturedAt: 0,
    city: null,
    region: null,
    country: null,
    source: 'camera_roll',
  };
}

describe('partitionUnlocated', () => {
  it('separates photos that can be placed from those that cannot', () => {
    const photos = [photo('a', PARIS), photo('b', null), photo('c', PARIS)];
    const { located, unlocated } = partitionUnlocated(photos);
    expect(located.map((p) => p.assetId)).toEqual(['a', 'c']);
    expect(unlocated.map((p) => p.assetId)).toEqual(['b']);
  });

  it('treats a photo the user placed as located', () => {
    const placed = placePhoto(photo('b', null), PARIS);
    const { located, unlocated } = partitionUnlocated([placed]);
    expect(located).toHaveLength(1);
    expect(unlocated).toHaveLength(0);
  });

  it('handles an empty list', () => {
    expect(partitionUnlocated([])).toEqual({ located: [], unlocated: [] });
  });

  it('distrusts a photo flagged hasGps but missing coordinates', () => {
    // Defensive: a malformed record must not reach clustering, where a null
    // coordinate would poison a trip's centroid.
    const broken = { ...photo('x', PARIS), lat: null };
    expect(partitionUnlocated([broken]).unlocated).toHaveLength(1);
  });
});

describe('placePhoto', () => {
  it('sets the coordinates the user chose', () => {
    const placed = placePhoto(photo('b', null), PARIS);
    expect(placed.lat).toBe(PARIS.lat);
    expect(placed.lng).toBe(PARIS.lng);
    expect(placed.hasGps).toBe(true);
  });

  it('records that the location was supplied by hand, not read from the file', () => {
    // The itinerary should be able to distinguish a place the camera recorded
    // from one the user remembered.
    expect(placePhoto(photo('b', null), PARIS).locationSource).toBe('manual');
  });

  it('does not mutate the original photo', () => {
    const original = photo('b', null);
    placePhoto(original, PARIS);
    expect(original.lat).toBeNull();
    expect(original.hasGps).toBe(false);
    expect(original.locationSource).toBeNull();
  });

  it('can correct a photo that already had coordinates', () => {
    const corrected = placePhoto(photo('a', PARIS), { lat: 0, lng: 0 });
    expect(corrected.lat).toBe(0);
    expect(corrected.locationSource).toBe('manual');
  });
});
