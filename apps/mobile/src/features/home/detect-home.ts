import type { HomeBase } from '@stamped/shared';
import * as Location from 'expo-location';

/**
 * Establishing where the user lives.
 *
 * Detected from the device's current position, then confirmed or corrected by
 * the user — a first launch happens wherever they happen to be, which is
 * usually but not always home. Everything here degrades to null rather than
 * throwing: no home simply means nothing is excluded from clustering.
 */

/**
 * How long to wait on the OS location services before giving up.
 *
 * Neither `geocodeAsync` nor `getCurrentPositionAsync` takes a timeout, and
 * both can hang indefinitely — a device with no GPS fix, or an Android
 * geocoder that never answers. Without this the screen sits on "Detecting
 * your location…" or an unresponsive button forever, with nothing to tell the
 * user and nothing to retry.
 */
const LOCATION_TIMEOUT_MS = 8000;

/** Resolves to null if `work` hasn't finished in time. */
async function withTimeout<T>(work: Promise<T>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), LOCATION_TIMEOUT_MS);
  });
  try {
    return await Promise.race([work, expiry]);
  } finally {
    clearTimeout(timer);
  }
}

/** Builds the display label a geocoded address should show. */
function labelFor(address: Location.LocationGeocodedAddress | undefined): string | null {
  if (!address) return null;
  const parts = [address.city ?? address.subregion ?? address.region, address.country];
  const label = parts.filter(Boolean).join(', ');
  return label.length > 0 ? label : null;
}

/**
 * Reads the device's current position and names it.
 *
 * Returns null if location permission is refused or no fix can be had.
 *
 * Tries the last known position first — it is instant and free, and a
 * city-level answer does not need a fresh fix. Falling back to `Balanced`
 * rather than `Low` matters: `Low` is served by the network/passive provider,
 * and on a device where only GPS is available (an emulator, or a phone with
 * network location switched off) nothing answers it and detection silently
 * fails. `Balanced` will use whichever provider exists.
 */
export async function detectHomeBase(): Promise<HomeBase | null> {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return null;

    const position =
      (await withTimeout(Location.getLastKnownPositionAsync())) ??
      (await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      ));
    if (!position) return null;
    const { latitude, longitude } = position.coords;

    let label: string | null = null;
    try {
      const addresses = await withTimeout(
        Location.reverseGeocodeAsync({ latitude, longitude }),
      );
      label = labelFor(addresses?.[0]);
    } catch {
      // A nameless home still works — the radius check only needs the point.
    }

    return { lat: latitude, lng: longitude, label };
  } catch {
    return null;
  }
}

/**
 * Turns a place the user typed ("Mumbai, India") into a home point.
 *
 * Returns null when the OS geocoder can't resolve it, so the caller can say so
 * rather than silently keeping the wrong location. Note this returns nothing on
 * web, where Expo removed forward geocoding.
 */
export async function geocodeHomeBase(query: string): Promise<HomeBase | null> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return null;

  try {
    const matches = await withTimeout(Location.geocodeAsync(trimmed));
    const match = matches?.[0];
    if (!match) return null;
    return { lat: match.latitude, lng: match.longitude, label: trimmed };
  } catch {
    return null;
  }
}
