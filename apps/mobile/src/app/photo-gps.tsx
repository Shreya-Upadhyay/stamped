import type { LatLng, PhotoMeta } from '@stamped/shared';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import { useCallback, useMemo } from 'react';
import { Linking } from 'react-native';

import { TripFlow } from '@/features/trips/trip-flow';
import type { CandidatePhoto, PhotoResult, PhotoSource } from '@/features/trips/types';

const CANDIDATE_LIMIT = 60;
const LOCAL_USER_ID = 'local-device-user';

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

  const loadCandidates = useCallback(async (): Promise<CandidatePhoto[]> => {
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

        // Creation time comes from MediaStore's DATE_TAKEN, which is only
        // populated when the scanner parsed an EXIF DateTimeOriginal. Plenty
        // of real photos (and anything side-loaded) have no DATE_TAKEN at
        // all, and falling through to 0 would date them to 1970 and collapse
        // every time-gap check. Modification time is the next-best signal.
        const capturedAt = creationTime ?? modificationTime ?? 0;

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

  const reverseGeocode = useCallback(async (point: LatLng) => {
    const [address] = await Location.reverseGeocodeAsync({
      latitude: point.lat,
      longitude: point.lng,
    });
    return { city: address?.city ?? null, country: address?.country ?? null };
  }, []);

  const source: PhotoSource = useMemo(
    () => ({
      permission: permissionResponse
        ? { granted: permissionResponse.granted, canAskAgain: permissionResponse.canAskAgain }
        : null,
      requestPermission: () => {
        requestPermission();
      },
      openSettings: () => {
        Linking.openSettings();
      },
      loadCandidates,
      readMeta,
      reverseGeocode,
    }),
    [permissionResponse, requestPermission, loadCandidates, readMeta, reverseGeocode],
  );

  return <TripFlow source={source} />;
}
