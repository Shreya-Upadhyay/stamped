import type { LatLng, PhotoMeta, Trip } from '@stamped/shared';

/** A photo offered to the user for selection, before any GPS is read. */
export type CandidatePhoto = {
  id: string;
  /** Local URI for the thumbnail. Null when the source has no real image (web mock). */
  uri: string | null;
  filename: string;
  /** Fallback tile colour, used when `uri` is null. */
  color?: string;
};

/**
 * A photo whose metadata has been read. `filename`/`uri` are UI-only display
 * conveniences and deliberately not part of the shared `PhotoMeta` contract.
 */
export type PhotoResult = {
  meta: PhotoMeta;
  filename: string;
  uri: string | null;
  color?: string;
};

/** A clustered trip plus the photos that belong to it. */
export type TripGroup = {
  trip: Trip;
  photos: PhotoResult[];
};

/** User-supplied details captured on the validate step. */
export type TripDetails = {
  title: string;
  category: string;
};

/**
 * Everything the trip flow needs from the platform. Native supplies this with
 * expo-media-library + expo-location; web supplies fixtures. Keeping the UI
 * behind this seam means the whole flow renders in a browser without native
 * modules, which is how it gets developed and reviewed.
 */
export type PhotoSource = {
  /**
   * Null while the permission state is still being determined.
   *
   * `accessPrivileges` is 'limited' when the OS granted access to only a
   * hand-picked subset of the library (Android 14+ / iOS 14+). That looks
   * identical to "no photos found" from inside the app, so it has to be
   * surfaced — otherwise a user whose photos are right there sees an empty
   * grid with no explanation.
   */
  permission: {
    granted: boolean;
    canAskAgain: boolean;
    accessPrivileges?: 'all' | 'limited' | 'none';
  } | null;
  requestPermission: () => void;
  /** Opens system settings, when permission was permanently denied. */
  openSettings: () => void;
  /** Re-opens the OS picker so more photos can be shared with the app. */
  presentPicker?: () => void;
  loadCandidates: () => Promise<CandidatePhoto[]>;
  readMeta: (
    ids: string[],
    onProgress: (completed: number, total: number) => void,
  ) => Promise<PhotoResult[]>;
  reverseGeocode: (point: LatLng) => Promise<{ city: string | null; country: string | null }>;
};
