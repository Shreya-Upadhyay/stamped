import type { LatLng } from './clustering';
import type { PhotoMeta } from './types/photo';

/**
 * Deciding which photos can be placed on a map, and letting the user place
 * the ones that can't.
 *
 * Clustering and the itinerary are both built from coordinates. A photo
 * without them contributes nothing to either, so rather than carrying it
 * along and guessing, the user is offered the chance to say where it was —
 * and anything left unplaced is dropped before clustering runs.
 */

/**
 * Splits photos by whether they can be placed on a map.
 *
 * A photo counts as located only if it actually has both coordinates.
 * `hasGps` alone isn't trusted: a record claiming GPS with a null latitude
 * would drag a trip's centroid to the equator.
 */
export function partitionUnlocated(photos: PhotoMeta[]): {
  located: PhotoMeta[];
  unlocated: PhotoMeta[];
} {
  const located: PhotoMeta[] = [];
  const unlocated: PhotoMeta[] = [];

  for (const photo of photos) {
    if (photo.hasGps && photo.lat != null && photo.lng != null) located.push(photo);
    else unlocated.push(photo);
  }

  return { located, unlocated };
}

/**
 * Returns a copy of the photo placed at a point the user chose.
 *
 * `locationSource` becomes `'manual'` so everything downstream can tell a
 * place the camera recorded from one the user remembered — the second is a
 * best guess at city scale, not a fix to four decimal places.
 */
export function placePhoto(photo: PhotoMeta, point: LatLng): PhotoMeta {
  return {
    ...photo,
    lat: point.lat,
    lng: point.lng,
    hasGps: true,
    locationSource: 'manual',
  };
}
