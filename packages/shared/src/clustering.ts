import type { PhotoMeta } from './types/photo';
import type { Trip } from './types/trip';

/** A plain latitude/longitude pair, in decimal degrees. */
export interface LatLng {
  lat: number;
  lng: number;
}

export interface ClusterOptions {
  /** Gap since the previous photo that starts a new trip, in ms. @default 24h */
  tripGapMs?: number;
  /**
   * Distance from the previous photo that starts a new trip, in km — only
   * checked when both photos have GPS. @default 300
   */
  tripDistanceKm?: number;
}

const DEFAULT_TRIP_GAP_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TRIP_DISTANCE_KM = 300;
const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two points, in kilometers. */
export function haversineDistanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Arithmetic mean of a set of points. Null if the list is empty. */
export function computeCentroid(points: LatLng[]): LatLng | null {
  if (points.length === 0) return null;
  const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 });
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

/**
 * Groups photos into trips using threshold logic on consecutive,
 * chronologically-sorted photos: a new trip starts when the gap since the
 * previous photo exceeds `tripGapMs`, or (when both photos have GPS) the
 * distance from the previous photo exceeds `tripDistanceKm`. Photos without
 * GPS can only trigger the time-based split, never the distance-based one —
 * see docs/adr/0001-on-device-trip-clustering.md for why this doesn't anchor
 * to a fixed "home" location.
 */
export function segmentPhotosIntoTrips(photos: PhotoMeta[], options: ClusterOptions = {}): PhotoMeta[][] {
  const tripGapMs = options.tripGapMs ?? DEFAULT_TRIP_GAP_MS;
  const tripDistanceKm = options.tripDistanceKm ?? DEFAULT_TRIP_DISTANCE_KM;

  const sorted = [...photos].sort((a, b) => a.capturedAt - b.capturedAt);
  const groups: PhotoMeta[][] = [];
  let current: PhotoMeta[] = [];

  for (const photo of sorted) {
    const prev = current[current.length - 1];
    if (prev) {
      const timeGap = photo.capturedAt - prev.capturedAt;
      const bothHaveGps =
        photo.hasGps && prev.hasGps && photo.lat != null && photo.lng != null && prev.lat != null && prev.lng != null;
      const distanceJumpKm = bothHaveGps
        ? haversineDistanceKm({ lat: prev.lat!, lng: prev.lng! }, { lat: photo.lat!, lng: photo.lng! })
        : null;
      const startsNewTrip = timeGap > tripGapMs || (distanceJumpKm != null && distanceJumpKm > tripDistanceKm);
      if (startsNewTrip) {
        groups.push(current);
        current = [];
      }
    }
    current.push(photo);
  }
  if (current.length > 0) groups.push(current);

  return groups;
}

export interface BuildTripParams {
  userId: string;
  tripId: string;
  city: string | null;
  country: string | null;
}

/** Builds a Trip record from an already-segmented, non-empty group of photos. */
export function buildTrip(photos: PhotoMeta[], params: BuildTripParams): Trip {
  const sorted = [...photos].sort((a, b) => a.capturedAt - b.capturedAt);
  const startAt = sorted[0].capturedAt;
  const endAt = sorted[sorted.length - 1].capturedAt;

  return {
    id: params.tripId,
    userId: params.userId,
    title: params.city ?? `Trip — ${new Date(startAt).toLocaleDateString()}`,
    startAt,
    endAt,
    primaryCity: params.city,
    country: params.country,
    photoCount: sorted.length,
    coverPhotoId: sorted[0].assetId,
    createdAt: Date.now(),
  };
}
