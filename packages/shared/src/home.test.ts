import { describe, expect, it } from 'vitest';

import { DEFAULT_HOME_RADIUS_KM, isAtHome, partitionHomePhotos } from './home';
import type { PhotoMeta } from './types/photo';

const MUMBAI = { lat: 19.076, lng: 72.8777 };
/** ~19 km from the Mumbai reference point — still the same city. */
const BANDRA = { lat: 19.0596, lng: 72.8295 };
/** ~150 km away — a genuine trip, not a commute. */
const PUNE = { lat: 18.5204, lng: 73.8567 };
const PARIS = { lat: 48.8566, lng: 2.3522 };

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
    locationSource: place != null ? 'exif' : null,
    source: 'camera_roll',
  };
}

const HOME = { lat: MUMBAI.lat, lng: MUMBAI.lng, label: 'Mumbai, India' };

describe('isAtHome', () => {
  it('is true for the home point itself', () => {
    expect(isAtHome(MUMBAI, HOME)).toBe(true);
  });

  it('is true across the metro area', () => {
    expect(isAtHome(BANDRA, HOME)).toBe(true);
  });

  it('is false for a genuinely different place', () => {
    expect(isAtHome(PUNE, HOME)).toBe(false);
    expect(isAtHome(PARIS, HOME)).toBe(false);
  });

  it('respects a custom radius', () => {
    expect(isAtHome(PUNE, { ...HOME, radiusKm: 200 })).toBe(true);
    expect(isAtHome(BANDRA, { ...HOME, radiusKm: 5 })).toBe(false);
  });
});

describe('partitionHomePhotos', () => {
  it('keeps everything when no home is set', () => {
    const photos = [at('a', MUMBAI, 0), at('b', PARIS, 1)];
    const { away, atHome } = partitionHomePhotos(photos, null);
    expect(away).toHaveLength(2);
    expect(atHome).toHaveLength(0);
  });

  it('separates home photos from travel photos', () => {
    const photos = [at('home1', MUMBAI, 0), at('home2', BANDRA, 1), at('trip', PARIS, 2)];
    const { away, atHome } = partitionHomePhotos(photos, HOME);
    expect(away.map((p) => p.assetId)).toEqual(['trip']);
    expect(atHome.map((p) => p.assetId)).toEqual(['home1', 'home2']);
  });

  it('keeps photos with no GPS', () => {
    // A photo with no coordinates cannot be shown to be at home, and dropping
    // it would silently discard a first-class case (see CLAUDE.md).
    const photos = [at('screenshot', null, 0), at('home', MUMBAI, 1)];
    const { away, atHome } = partitionHomePhotos(photos, HOME);
    expect(away.map((p) => p.assetId)).toEqual(['screenshot']);
    expect(atHome.map((p) => p.assetId)).toEqual(['home']);
  });

  it('preserves the original order within each group', () => {
    const photos = [at('a', PARIS, 0), at('b', MUMBAI, 1), at('c', PUNE, 2), at('d', MUMBAI, 3)];
    const { away, atHome } = partitionHomePhotos(photos, HOME);
    expect(away.map((p) => p.assetId)).toEqual(['a', 'c']);
    expect(atHome.map((p) => p.assetId)).toEqual(['b', 'd']);
  });

  it('respects a custom radius', () => {
    const photos = [at('pune', PUNE, 0)];
    expect(partitionHomePhotos(photos, { ...HOME, radiusKm: 200 }).atHome).toHaveLength(1);
    expect(partitionHomePhotos(photos, { ...HOME, radiusKm: 50 }).away).toHaveLength(1);
  });

  it('handles an empty list', () => {
    expect(partitionHomePhotos([], HOME)).toEqual({ away: [], atHome: [] });
  });

  it('exposes a sane default radius', () => {
    // Wide enough for a metro area, narrow enough that a weekend away still
    // reads as travel.
    expect(DEFAULT_HOME_RADIUS_KM).toBeGreaterThanOrEqual(15);
    expect(DEFAULT_HOME_RADIUS_KM).toBeLessThanOrEqual(60);
  });
});
