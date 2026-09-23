import type { LatLng, PhotoMeta, Trip, TripStop } from '@stamped/shared';

/**
 * What reverse geocoding returned for a point. `name` is the placemark —
 * "Neuschwanstein Castle" — which the OS geocoder supplies free and offline;
 * no Places API involved (see CLAUDE.md: on-device geocoding only).
 */
export type Place = {
  name: string | null;
  city: string | null;
  country: string | null;
};

/** A photo offered to the user for selection, before any GPS is read. */
export type CandidatePhoto = {
  id: string;
  /** Local URI for the thumbnail. Null when the source has no real image (web mock). */
  uri: string | null;
  filename: string;
  /** Fallback tile colour, used when `uri` is null. */
  color?: string;
  /**
   * A screenshot rather than a photograph. Hidden from the picker by default:
   * a screenshot records what was on a screen, never where someone stood.
   */
  isScreenshot?: boolean;
};

/** A place the user typed, resolved to coordinates. */
export type FoundPlace = {
  lat: number;
  lng: number;
  /** What the user typed, kept for display. */
  label: string;
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

/** One stop in a trip, with the photos taken there. */
export type StopGroup = {
  stop: TripStop;
  photos: PhotoResult[];
};

/** A clustered trip plus its photos and its itinerary of stops. */
export type TripGroup = {
  trip: Trip;
  photos: PhotoResult[];
  stops: StopGroup[];
};

/** User-supplied details captured on the validate step. */
export type TripDetails = {
  title: string;
  category: string;
};

/**
 * A trip the user has stamped — the detected trip plus everything they
 * confirmed about it. This is what gets stored, via `trip-repository`.
 */
export type StampedTrip = {
  id: string;
  group: TripGroup;
  details: TripDetails;
  /** Stop names the user approved or typed, keyed by stop id. */
  stopNames: Record<string, string>;
  stampedAt: number;
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
  reverseGeocode: (point: LatLng) => Promise<Place>;
  /**
   * Resolves a place the user typed ("Füssen, Germany") to coordinates, for
   * placing a photo that recorded no location. Null when nothing matches.
   */
  findPlace: (query: string) => Promise<FoundPlace | null>;
};
