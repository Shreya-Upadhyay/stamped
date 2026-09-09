import { pickPlaceName, type LatLng, type PhotoMeta } from '@stamped/shared';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import { useCallback, useMemo, useRef } from 'react';
import { Linking } from 'react-native';

import { TripsExperience } from '@/features/trips/trips-experience';
import type { CandidatePhoto, Place, PhotoResult, PhotoSource } from '@/features/trips/types';

/**
 * How many photos the picker offers, newest first.
 *
 * Sized for testing clustering against a real camera roll rather than a
 * handful of samples — a couple of hundred photos rarely spans more than one
 * or two trips.
 */
const CANDIDATE_LIMIT = 500;
const LOCAL_USER_ID = 'local-device-user';

/**
 * EXIF stores capture time as "YYYY:MM:DD HH:MM:SS" (colons in the date, and
 * no timezone). `Date.parse` doesn't accept that, so convert it by hand and
 * treat it as local time — which is what the camera meant.
 */
function parseExifDate(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  const ms = new Date(year, month - 1, day, hour, minute, second).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Pulls capture time out of whichever EXIF tag the file happens to carry. */
function exifCapturedAt(exif: Record<string, unknown> | null): number | null {
  if (!exif) return null;
  for (const key of ['DateTimeOriginal', 'DateTimeDigitized', 'DateTime']) {
    const parsed = parseExifDate(exif[key]);
    if (parsed !== null) return parsed;
  }
  return null;
}

/**
 * Native photo source: reads real GPS + timestamps via expo-media-library.
 *
 * NOTE: SDK 57 replaced the legacy free-function API (`getAssetInfoAsync`,
 * which docs/ROADMAP.md still shows) with this class-based Query/Asset API —
 * the old functions throw at runtime. Verified against the installed
 * package's type definitions.
 */
export default function PhotoGpsScreen() {
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions({
    granularPermissions: ['photo'],
  });

  // Keep asset handles around so readMeta can call methods on them later.
  const assetsById = useMemo(() => new Map<string, MediaLibrary.Asset>(), []);

  const locationRequest = useRef<Promise<boolean> | null>(null);

  /**
   * Asks for location permission at most once, however many stops need it.
   *
   * Stops are geocoded concurrently, so caching the *promise* rather than the
   * result is what keeps the OS from stacking up a prompt per stop.
   */
  const ensureLocationPermission = useCallback((): Promise<boolean> => {
    locationRequest.current ??= Location.requestForegroundPermissionsAsync()
      .then((response) => response.granted)
      .catch(() => false);
    return locationRequest.current;
  }, []);

  const loadCandidates = useCallback(async (): Promise<CandidatePhoto[]> => {
    // Newest first by capture time — what a photo picker should show. Photos
    // missing DATE_TAKEN sort to the end rather than disappearing, since the
    // limit is generous.
    const assets = await new MediaLibrary.Query()
      .eq(MediaLibrary.AssetField.MEDIA_TYPE, MediaLibrary.MediaType.IMAGE)
      .orderBy({ key: MediaLibrary.AssetField.CREATION_TIME, ascending: false })
      .limit(CANDIDATE_LIMIT)
      .exe();

    return Promise.all(
      assets.map(async (asset): Promise<CandidatePhoto> => {
        assetsById.set(asset.id, asset);
        const [uri, filename] = await Promise.all([asset.getUri(), asset.getFilename()]);
        return { id: asset.id, uri, filename };
      }),
    );
  }, [assetsById]);

  const readMeta = useCallback(
    async (
      ids: string[],
      onProgress: (completed: number, total: number) => void,
    ): Promise<PhotoResult[]> => {
      const results: PhotoResult[] = [];
      // Sequential so the progress indicator reflects real work, not a jump to 100%.
      for (const [index, id] of ids.entries()) {
        const asset = assetsById.get(id);
        if (!asset) continue;

        const [location, creationTime, modificationTime, filename, uri] = await Promise.all([
          asset.getLocation(),
          asset.getCreationTime(),
          asset.getModificationTime(),
          asset.getFilename(),
          asset.getUri(),
        ]);

        // MediaStore only fills DATE_TAKEN when its scanner parsed the file's
        // EXIF, and it routinely skips that for anything copied onto the
        // device rather than shot by its camera. So when it's missing, read
        // the photo's own EXIF instead of trusting the index — the capture
        // date is right there in the file. Order matters: EXIF beats file
        // modification time, which for a copied file is just when it landed.
        let capturedAt = creationTime ?? null;
        let exif: Record<string, unknown> | null = null;

        if (capturedAt === null) {
          try {
            exif = (await asset.getExif()) as Record<string, unknown>;
            capturedAt = exifCapturedAt(exif);
          } catch {
            // Unreadable EXIF is not fatal — fall through to the file's mtime.
          }
        }
        capturedAt = capturedAt ?? modificationTime ?? 0;

        const meta: PhotoMeta = {
          id: asset.id,
          userId: LOCAL_USER_ID,
          tripId: null,
          assetId: asset.id,
          storagePath: null,
          lat: location?.latitude ?? null,
          lng: location?.longitude ?? null,
          hasGps: location != null,
          capturedAt,
          city: null,
          region: null,
          country: null,
          source: 'camera_roll',
        };

        results.push({ meta, filename, uri });
        onProgress(index + 1, ids.length);
      }
      return results;
    },
    [assetsById],
  );

  const reverseGeocode = useCallback(
    async (point: LatLng): Promise<Place> => {
      // Android gates the geocoder behind location permission even though this
      // is a pure coordinate→address lookup that never reads where the device
      // actually is. Without it the native call rejects with "Not authorized
      // to use location services" and every stop comes back unnamed.
      if (!(await ensureLocationPermission())) {
        throw new Error('Location permission is needed to look up place names');
      }

      const [address] = await Location.reverseGeocodeAsync({
        latitude: point.lat,
        longitude: point.lng,
      });

      // The placemark is the best label when it's a real one, but Android
      // substitutes a house number ("1") or a Plus Code ("HP3W+C7") when it
      // has nothing — pickPlaceName skips those and falls back.
      return {
        name: pickPlaceName({
          name: address?.name,
          street: address?.street,
          district: address?.district,
          city: address?.city,
        }),
        city: address?.city ?? address?.subregion ?? null,
        country: address?.country ?? null,
      };
    },
    [ensureLocationPermission],
  );

  const source: PhotoSource = useMemo(
    () => ({
      permission: permissionResponse
        ? {
            granted: permissionResponse.granted,
            canAskAgain: permissionResponse.canAskAgain,
            accessPrivileges: permissionResponse.accessPrivileges,
          }
        : null,
      requestPermission: () => {
        requestPermission();
      },
      openSettings: () => {
        Linking.openSettings();
      },
      presentPicker: () => {
        // No-ops unless access is actually limited, so it's safe to always offer.
        MediaLibrary.presentPermissionsPicker(['photo']).catch(() => {
          // Unsupported on this OS version — the settings route still works.
        });
      },
      loadCandidates,
      readMeta,
      reverseGeocode,
    }),
    [permissionResponse, requestPermission, loadCandidates, readMeta, reverseGeocode],
  );

  return <TripsExperience source={source} />;
}
