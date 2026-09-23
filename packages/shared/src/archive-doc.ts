/**
 * The stored shape of a stamped trip.
 *
 * The archive lives in Firestore, which is stricter than React state: it
 * rejects `undefined`, and it will happily hand back a document written by an
 * older version of the app. So the conversion both ways is a pure function
 * here, tested, rather than object spreading scattered through the data layer.
 *
 * Photos are listed once per trip and stops reference them by `assetId`,
 * because a stop's photos are always a subset of its trip's. Storing them
 * twice would roughly double a document that already carries every photo's
 * metadata.
 *
 * Deliberately no image bytes — only what was read from them. See
 * docs/adr/0003-firebase-backend-and-accounts.md.
 */

import type { PhotoMeta } from './types/photo';
import type { TripStop } from './types/stop';
import type { Trip } from './types/trip';

/**
 * Bumped when the stored shape changes incompatibly. `fromStampedTripDoc`
 * rejects anything it doesn't recognise rather than guessing, so a future
 * change means writing a migration instead of crashing an archive screen.
 */
export const STAMPED_TRIP_DOC_VERSION = 1;

/** One photo inside a stored trip. */
export interface StampedPhotoDoc {
  assetId: string;
  filename: string;
  /**
   * Where the image file sits on the device that stamped the trip.
   *
   * Kept so thumbnails still render after a restart, and null when unknown.
   * It means nothing on any other device — no bytes are uploaded — so readers
   * must treat a broken uri as ordinary rather than as an error.
   */
  uri: string | null;
  meta: PhotoMeta;
}

/** One stop inside a stored trip, pointing at the trip's photo list. */
export interface StampedStopDoc {
  stop: TripStop;
  photoAssetIds: string[];
}

/** A stamped trip as stored at `users/{uid}/trips/{tripId}`. */
export interface StampedTripDoc {
  version: number;
  id: string;
  trip: Trip;
  /** What the user titled it, which may differ from `trip.title`. */
  title: string;
  category: string;
  /** Stop names the user approved or typed, keyed by stop id. */
  stopNames: Record<string, string>;
  stampedAt: number;
  photos: StampedPhotoDoc[];
  stops: StampedStopDoc[];
}

/** What the app hands over to be stored. Looser than the document itself. */
export interface StampedTripInput {
  id: string;
  trip: Trip;
  title: string;
  category: string;
  stopNames: Record<string, string>;
  stampedAt: number;
  photos: { assetId: string; filename: string; uri?: string | null; meta: PhotoMeta }[];
  stops: { stop: TripStop; photoAssetIds: string[] }[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The value if it is a string, else null — used for both required and nullable fields. */
function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** The value if it is a real number, else null. NaN and Infinity don't count. */
function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Converts what the app holds into what Firestore accepts.
 *
 * Two things it fixes: `undefined` anywhere in the tree, which Firestore
 * throws on, and stop names belonging to other trips, so each stored document
 * is self-contained.
 */
export function toStampedTripDoc(input: StampedTripInput): StampedTripDoc {
  const stopIds = new Set(input.stops.map(({ stop }) => stop.id));
  const stopNames: Record<string, string> = {};
  for (const [stopId, name] of Object.entries(input.stopNames)) {
    if (stopIds.has(stopId) && typeof name === 'string') stopNames[stopId] = name;
  }

  return {
    version: STAMPED_TRIP_DOC_VERSION,
    id: input.id,
    trip: { ...input.trip },
    title: input.title,
    category: input.category,
    stopNames,
    stampedAt: input.stampedAt,
    photos: input.photos.map((photo) => ({
      assetId: photo.assetId,
      filename: photo.filename,
      uri: photo.uri ?? null,
      meta: { ...photo.meta },
    })),
    stops: input.stops.map(({ stop, photoAssetIds }) => ({
      stop: { ...stop },
      photoAssetIds: [...photoAssetIds],
    })),
  };
}

function parsePhotoMeta(value: unknown): PhotoMeta | null {
  if (!isRecord(value)) return null;
  const assetId = asString(value.assetId);
  const capturedAt = asNumber(value.capturedAt);
  if (assetId === null || capturedAt === null) return null;

  const locationSource = value.locationSource;
  return {
    id: asString(value.id) ?? assetId,
    userId: asString(value.userId) ?? '',
    tripId: asString(value.tripId),
    assetId,
    storagePath: asString(value.storagePath),
    lat: asNumber(value.lat),
    lng: asNumber(value.lng),
    hasGps: value.hasGps === true,
    locationSource:
      locationSource === 'exif' || locationSource === 'manual' ? locationSource : null,
    capturedAt,
    city: asString(value.city),
    region: asString(value.region),
    country: asString(value.country),
    source: 'camera_roll',
  };
}

function parseTrip(value: unknown): Trip | null {
  if (!isRecord(value)) return null;
  const id = asString(value.id);
  const startAt = asNumber(value.startAt);
  const endAt = asNumber(value.endAt);
  if (id === null || startAt === null || endAt === null) return null;

  return {
    id,
    userId: asString(value.userId) ?? '',
    title: asString(value.title) ?? '',
    startAt,
    endAt,
    primaryCity: asString(value.primaryCity),
    country: asString(value.country),
    photoCount: asNumber(value.photoCount) ?? 0,
    coverPhotoId: asString(value.coverPhotoId),
    createdAt: asNumber(value.createdAt) ?? startAt,
  };
}

function parseStop(value: unknown): TripStop | null {
  if (!isRecord(value)) return null;
  const id = asString(value.id);
  const startAt = asNumber(value.startAt);
  const endAt = asNumber(value.endAt);
  if (id === null || startAt === null || endAt === null) return null;

  return {
    id,
    tripId: asString(value.tripId) ?? '',
    order: asNumber(value.order) ?? 0,
    day: asString(value.day) ?? '',
    startAt,
    endAt,
    lat: asNumber(value.lat),
    lng: asNumber(value.lng),
    suggestedName: asString(value.suggestedName),
    confirmedName: asString(value.confirmedName),
    city: asString(value.city),
    country: asString(value.country),
    photoCount: asNumber(value.photoCount) ?? 0,
    needsManualPlace: value.needsManualPlace === true,
  };
}

/**
 * Reads a stored document back, or null if it isn't one we understand.
 *
 * Defensive on purpose: this parses data from the network and from a disk
 * cache, and one malformed trip should cost the user that trip, not the whole
 * archive screen.
 */
export function fromStampedTripDoc(value: unknown): StampedTripDoc | null {
  if (!isRecord(value)) return null;
  if (value.version !== STAMPED_TRIP_DOC_VERSION) return null;

  const id = asString(value.id);
  const trip = parseTrip(value.trip);
  const stampedAt = asNumber(value.stampedAt);
  if (id === null || trip === null || stampedAt === null) return null;
  if (!Array.isArray(value.photos) || !Array.isArray(value.stops)) return null;

  const photos: StampedPhotoDoc[] = [];
  for (const entry of value.photos) {
    if (!isRecord(entry)) continue;
    const meta = parsePhotoMeta(entry.meta);
    const assetId = asString(entry.assetId);
    if (meta === null || assetId === null) continue;
    photos.push({
      assetId,
      filename: asString(entry.filename) ?? assetId,
      uri: asString(entry.uri),
      meta,
    });
  }

  const stops: StampedStopDoc[] = [];
  for (const entry of value.stops) {
    if (!isRecord(entry)) continue;
    const stop = parseStop(entry.stop);
    if (stop === null) continue;
    const ids = Array.isArray(entry.photoAssetIds) ? entry.photoAssetIds : [];
    stops.push({
      stop,
      photoAssetIds: ids.filter((assetId): assetId is string => typeof assetId === 'string'),
    });
  }

  const stopNames: Record<string, string> = {};
  if (isRecord(value.stopNames)) {
    for (const [stopId, name] of Object.entries(value.stopNames)) {
      if (typeof name === 'string') stopNames[stopId] = name;
    }
  }

  return {
    version: STAMPED_TRIP_DOC_VERSION,
    id,
    trip,
    title: asString(value.title) ?? trip.title,
    category: asString(value.category) ?? 'Group',
    stopNames,
    stampedAt,
    photos,
    stops,
  };
}
