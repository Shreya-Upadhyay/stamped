import { haversineDistanceKm, type LatLng } from './clustering';
import type { PhotoMeta } from './types/photo';

/**
 * Where the user lives, so everyday photos aren't mistaken for travel.
 *
 * Held as a point plus a radius rather than a city name on purpose. Matching
 * by name would mean reverse-geocoding every photo — hundreds or thousands of
 * lookups, slow on-device and impossible offline — whereas a distance check is
 * free and works with no network. The label is only ever shown to the user.
 */
export interface HomeBase {
  lat: number;
  lng: number;
  /** What to show the user, e.g. "Mumbai, India". Null if geocoding failed. */
  label: string | null;
  /** How far from the point still counts as home, in km. @default 30 */
  radiusKm?: number;
}

/**
 * Roughly a metro area and its immediate surroundings.
 *
 * Wide enough to swallow a commute and the next suburb over, narrow enough
 * that a weekend an hour or two away still registers as a trip. Tunable per
 * call, since "my city" is far bigger in Mumbai than in Bruges.
 */
export const DEFAULT_HOME_RADIUS_KM = 30;

/** Whether a point falls inside the home radius. */
export function isAtHome(point: LatLng, home: HomeBase): boolean {
  const radiusKm = home.radiusKm ?? DEFAULT_HOME_RADIUS_KM;
  return haversineDistanceKm(point, { lat: home.lat, lng: home.lng }) <= radiusKm;
}

/**
 * Splits photos into those taken away from home and those taken at home.
 *
 * Only the `away` set should be clustered: without this, everyday photos
 * accumulate into one enormous "trip" spanning years, which is the flaw
 * recorded in docs/adr/0001-on-device-trip-clustering.md.
 *
 * Photos with no GPS stay in `away`. Nothing proves they were taken at home,
 * and silently dropping them would discard a case the rest of the pipeline
 * deliberately treats as first-class. The cost is that a no-GPS photo taken at
 * home between two trips attaches to the earlier one — the same behaviour such
 * a photo already has anywhere else in the timeline.
 *
 * Order is preserved within each group, so a caller that sorted by capture
 * time keeps that order.
 */
export function partitionHomePhotos(
  photos: PhotoMeta[],
  home: HomeBase | null,
): { away: PhotoMeta[]; atHome: PhotoMeta[] } {
  if (home == null) return { away: [...photos], atHome: [] };

  const away: PhotoMeta[] = [];
  const atHome: PhotoMeta[] = [];

  for (const photo of photos) {
    const locatable = photo.hasGps && photo.lat != null && photo.lng != null;
    if (locatable && isAtHome({ lat: photo.lat!, lng: photo.lng! }, home)) {
      atHome.push(photo);
    } else {
      away.push(photo);
    }
  }

  return { away, atHome };
}
