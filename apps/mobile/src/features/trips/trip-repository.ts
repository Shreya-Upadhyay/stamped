import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fromStampedTripDoc,
  toStampedTripDoc,
  type StampedTripDoc,
} from '@stamped/shared';
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';

import { getFirebase } from '@/lib/firebase';

import type { PhotoResult, StampedTrip, StopGroup } from './types';

/**
 * Reading and writing the stamped-trip archive.
 *
 * Trips live at `users/{uid}/trips/{tripId}` — one document each, so stamping
 * a new trip never rewrites the others and a corrupt one can't take the
 * archive down with it.
 *
 * A whole trip in one document is safe at this scale: a photo's metadata is a
 * few hundred bytes and the picker offers at most 500 photos per run, so a
 * trip lands around 200 KB against Firestore's 1 MB limit. Splitting photos
 * into their own subcollection is what to do if that ever stops being true.
 *
 * A copy also goes to AsyncStorage. The Firebase JS SDK has no on-disk
 * Firestore cache on React Native, so without this a cold start with no signal
 * shows an empty archive — precisely the situation this app is used in, since
 * people open it while travelling.
 */

const CACHE_PREFIX = 'stamped.archive.v1.';

function cacheKey(uid: string): string {
  return `${CACHE_PREFIX}${uid}`;
}

/** Newest first, the order every archive screen expects. */
function byNewestTrip(a: StampedTrip, b: StampedTrip): number {
  return b.group.trip.startAt - a.group.trip.startAt;
}

function toDoc(trip: StampedTrip): StampedTripDoc {
  return toStampedTripDoc({
    id: trip.id,
    trip: trip.group.trip,
    title: trip.details.title,
    category: trip.details.category,
    stopNames: trip.stopNames,
    stampedAt: trip.stampedAt,
    photos: trip.group.photos.map((photo) => ({
      assetId: photo.meta.assetId,
      filename: photo.filename,
      uri: photo.uri,
      meta: photo.meta,
    })),
    stops: trip.group.stops.map(({ stop, photos }) => ({
      stop,
      photoAssetIds: photos.map((photo) => photo.meta.assetId),
    })),
  });
}

function fromDoc(document: StampedTripDoc): StampedTrip {
  const photos: PhotoResult[] = document.photos.map((photo) => ({
    meta: photo.meta,
    filename: photo.filename,
    uri: photo.uri,
  }));

  // Stops reference the trip's photos by asset id rather than repeating them.
  const byAssetId = new Map(photos.map((photo) => [photo.meta.assetId, photo]));
  const stops: StopGroup[] = document.stops.map(({ stop, photoAssetIds }) => ({
    stop,
    photos: photoAssetIds
      .map((assetId) => byAssetId.get(assetId))
      .filter((photo): photo is PhotoResult => photo != null),
  }));

  return {
    id: document.id,
    group: { trip: document.trip, photos, stops },
    details: { title: document.title, category: document.category },
    stopNames: document.stopNames,
    stampedAt: document.stampedAt,
  };
}

/** Every trip the user has stamped. Throws if Firestore can't be reached. */
export async function loadTrips(uid: string): Promise<StampedTrip[]> {
  const firebase = getFirebase();
  if (!firebase) return [];

  const snapshot = await getDocs(collection(firebase.db, 'users', uid, 'trips'));
  const trips: StampedTrip[] = [];
  for (const document of snapshot.docs) {
    const parsed = fromStampedTripDoc(document.data());
    // A document we can't read is skipped, not fatal: one bad trip shouldn't
    // empty someone's archive.
    if (parsed) trips.push(fromDoc(parsed));
  }
  return trips.sort(byNewestTrip);
}

/** Writes trips as one batch, so the archive is never half-saved. */
export async function saveTrips(uid: string, trips: StampedTrip[]): Promise<void> {
  const firebase = getFirebase();
  if (!firebase || trips.length === 0) return;

  const batch = writeBatch(firebase.db);
  for (const trip of trips) {
    batch.set(doc(firebase.db, 'users', uid, 'trips', trip.id), toDoc(trip));
  }
  await batch.commit();
}

/** The archive as of the last successful load, for offline and cold starts. */
export async function readCachedTrips(uid: string): Promise<StampedTrip[]> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(uid));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const trips: StampedTrip[] = [];
    for (const entry of parsed) {
      const document = fromStampedTripDoc(entry);
      if (document) trips.push(fromDoc(document));
    }
    return trips.sort(byNewestTrip);
  } catch {
    // Unreadable cache is the same as no cache.
    return [];
  }
}

export async function writeCachedTrips(uid: string, trips: StampedTrip[]): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(uid), JSON.stringify(trips.map(toDoc)));
  } catch {
    // The cache is an optimisation; failing to write it changes nothing that
    // the user can see while they stay online.
  }
}

export async function clearCachedTrips(uid: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(cacheKey(uid));
  } catch {
    // Nothing to do — the next write overwrites it anyway.
  }
}
