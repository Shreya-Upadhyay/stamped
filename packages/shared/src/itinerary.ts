import { computeCentroid, haversineDistanceKm, type LatLng } from './clustering';
import type { PhotoMeta } from './types/photo';
import type { TripStop } from './types/stop';

export interface StopOptions {
  /**
   * Photos within this distance of the stop's centre belong to it, in km.
   * Small by design — a stop is "one place you stood", not a region.
   * @default 1
   */
  stopRadiusKm?: number;
  /**
   * A pause longer than this ends the stop even without moving, in ms.
   * Returning to the same spot the next day is a separate visit.
   * @default 3h
   */
  stopGapMs?: number;
}

const DEFAULT_STOP_RADIUS_KM = 1;
const DEFAULT_STOP_GAP_MS = 3 * 60 * 60 * 1000;

/** Calendar day in the device's local time, as `YYYY-MM-DD`. */
export function localDayKey(timestampMs: number): string {
  const date = new Date(timestampMs);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The most frequently occurring non-null value, or null if there are none. */
export function dominantValue<T extends string>(values: (T | null | undefined)[]): T | null {
  const counts = new Map<T, number>();
  for (const value of values) {
    if (value == null) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  let best: T | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function locationOf(photo: PhotoMeta): LatLng | null {
  if (!photo.hasGps || photo.lat == null || photo.lng == null) return null;
  return { lat: photo.lat, lng: photo.lng };
}

/**
 * Splits one trip's photos into stops — the places visited, in order.
 *
 * Same shape as trip segmentation, at a much smaller scale: a stop continues
 * while photos stay within `stopRadiusKm` of its centre, and a pause longer
 * than `stopGapMs` ends it even if you haven't moved.
 *
 * Photos without GPS join the stop in progress and don't move its centre, so
 * a screenshot can't drag a stop across town.
 */
export function segmentTripIntoStops(
  photos: PhotoMeta[],
  options: StopOptions = {},
): PhotoMeta[][] {
  const stopRadiusKm = options.stopRadiusKm ?? DEFAULT_STOP_RADIUS_KM;
  const stopGapMs = options.stopGapMs ?? DEFAULT_STOP_GAP_MS;

  const sorted = [...photos].sort((a, b) => a.capturedAt - b.capturedAt);
  const stops: PhotoMeta[][] = [];

  let current: PhotoMeta[] = [];
  let located: LatLng[] = [];
  let centre: LatLng | null = null;

  for (const photo of sorted) {
    const previous = current[current.length - 1];
    const place = locationOf(photo);

    let startsNewStop = false;
    if (previous) {
      if (photo.capturedAt - previous.capturedAt > stopGapMs) {
        startsNewStop = true;
      } else if (place && centre && haversineDistanceKm(centre, place) > stopRadiusKm) {
        startsNewStop = true;
      }
    }

    if (startsNewStop) {
      stops.push(current);
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
  if (current.length > 0) stops.push(current);

  return stops;
}

export interface BuildStopParams {
  tripId: string;
  stopId: string;
  order: number;
}

/**
 * Builds a stop record from an already-grouped run of photos.
 *
 * Deliberately knows nothing about geocoding: names are filled in afterwards,
 * so this stays pure and testable and the slow network-ish work sits at the
 * edge.
 */
export function buildStop(photos: PhotoMeta[], params: BuildStopParams): TripStop {
  const sorted = [...photos].sort((a, b) => a.capturedAt - b.capturedAt);
  const located = sorted.map(locationOf).filter((p): p is LatLng => p !== null);
  const centre = computeCentroid(located);

  return {
    id: params.stopId,
    tripId: params.tripId,
    order: params.order,
    day: localDayKey(sorted[0].capturedAt),
    startAt: sorted[0].capturedAt,
    endAt: sorted[sorted.length - 1].capturedAt,
    lat: centre?.lat ?? null,
    lng: centre?.lng ?? null,
    suggestedName: null,
    confirmedName: null,
    city: null,
    country: null,
    photoCount: sorted.length,
    needsManualPlace: centre === null,
  };
}
