import type { PhotoMeta } from './types/photo';
import type { Trip } from './types/trip';

/** A plain latitude/longitude pair, in decimal degrees. */
export interface LatLng {
  lat: number;
  lng: number;
}

export interface ClusterOptions {
  /**
   * How far a photo can be from the trip's centre before it starts a new
   * trip, in km. @default 500
   */
  tripRadiusKm?: number;
  /**
   * Gap since the previous photo that starts a new trip, in ms.
   *
   * Off by default: grouping is distance-driven, so a trip continues until
   * the camera actually moves somewhere else. Supply a value to also split on
   * time.
   */
  tripGapMs?: number;
}

const DEFAULT_TRIP_RADIUS_KM = 500;
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

/** The GPS coordinates of a photo, or null when it has none. */
function locationOf(photo: PhotoMeta): LatLng | null {
  if (!photo.hasGps || photo.lat == null || photo.lng == null) return null;
  return { lat: photo.lat, lng: photo.lng };
}

/**
 * Groups chronologically-sorted photos into trips by proximity.
 *
 * A trip has a centre — the running centroid of the located photos in it —
 * and continues for as long as photos stay within `tripRadiusKm` of it. The
 * first photo beyond that radius starts a new trip. Optionally a `tripGapMs`
 * also splits on elapsed time.
 *
 * Measuring against the trip's centre rather than the previous photo is the
 * important part: consecutive-photo distance lets a slow drift chain across a
 * continent, since each individual hop stays under the threshold.
 *
 * Photos without GPS join whichever trip is in progress and never influence
 * its centre — so a screenshot between two distant places can't bridge them
 * into one trip. See docs/adr/0001-on-device-trip-clustering.md.
 */
export function segmentPhotosIntoTrips(
  photos: PhotoMeta[],
  options: ClusterOptions = {},
): PhotoMeta[][] {
  const tripRadiusKm = options.tripRadiusKm ?? DEFAULT_TRIP_RADIUS_KM;
  const tripGapMs = options.tripGapMs;

  const sorted = [...photos].sort((a, b) => a.capturedAt - b.capturedAt);
  const groups: PhotoMeta[][] = [];

  let current: PhotoMeta[] = [];
  let located: LatLng[] = [];
  let centre: LatLng | null = null;

  for (const photo of sorted) {
    const previous = current[current.length - 1];
    const place = locationOf(photo);

    let startsNewTrip = false;
    if (previous) {
      if (tripGapMs != null && photo.capturedAt - previous.capturedAt > tripGapMs) {
        startsNewTrip = true;
      } else if (place && centre && haversineDistanceKm(centre, place) > tripRadiusKm) {
        startsNewTrip = true;
      }
    }

    if (startsNewTrip) {
      groups.push(current);
      current = [];
      located = [];
      centre = null;
    }

    current.push(photo);
    if (place) {
      located.push(place);
      centre = computeCentroid(located);
    }
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
