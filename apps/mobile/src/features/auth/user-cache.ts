import type { HomeBase } from '@stamped/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * A local copy of `users/{uid}`.
 *
 * Firestore has no on-disk cache on React Native, so without this every launch
 * would have to reach the network before it could know whether the user has
 * onboarded or where they live. Offline — on a plane, abroad, on hotel wifi —
 * that means either hanging on the splash screen or showing onboarding to
 * someone who finished it months ago. Neither is acceptable for an app whose
 * whole subject is travel.
 */

/** What `users/{uid}` holds. Trips live in a subcollection beneath it. */
export type UserDoc = {
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  homeCity?: string | null;
  homeBase?: HomeBase | null;
  onboardingCompletedAt?: number | null;
  createdAt?: number;
};

const PREFIX = 'stamped.user.v1.';

function key(uid: string): string {
  return `${PREFIX}${uid}`;
}

export async function readCachedUserDoc(uid: string): Promise<UserDoc | null> {
  try {
    const raw = await AsyncStorage.getItem(key(uid));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    // Only the shape is checked; the fields are all optional anyway, and a
    // stale field is corrected by the next successful read from Firestore.
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as UserDoc)
      : null;
  } catch {
    return null;
  }
}

/** Merges fields into the cached copy, mirroring how Firestore is written. */
export async function writeCachedUserDoc(uid: string, update: UserDoc): Promise<void> {
  try {
    const existing = (await readCachedUserDoc(uid)) ?? {};
    await AsyncStorage.setItem(key(uid), JSON.stringify({ ...existing, ...update }));
  } catch {
    // A cache that can't be written costs a network round trip next launch,
    // nothing more.
  }
}
