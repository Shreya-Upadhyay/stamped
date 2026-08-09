/**
 * Metadata for a single photo, extracted on-device (Milestone 1).
 * No image bytes are uploaded at this stage — this is the lightweight
 * record used for reverse-geocoding and trip clustering.
 *
 * See docs/ROADMAP.md §3.
 */
export interface PhotoMeta {
  /** Firestore document id for this photo record. */
  id: string;

  /** Owning user's id. */
  userId: string;

  /** Id of the Trip this photo has been clustered into. Null until clustered. */
  tripId: string | null;

  /**
   * Device-local reference to the original asset (from expo-media-library).
   * No image bytes are uploaded yet — this is a pointer, not storage.
   */
  assetId: string;

  /**
   * Path in Cloud Storage, set later only if the photo is kept (Milestone 2).
   * Null in Milestone 1, since no image bytes are uploaded.
   */
  storagePath: string | null;

  /** Latitude in decimal degrees. Null when the photo has no GPS data. */
  lat: number | null;

  /** Longitude in decimal degrees. Null when the photo has no GPS data. */
  lng: number | null;

  /**
   * Whether this photo carried GPS data. Many photos (screenshots,
   * downloaded/WhatsApp images, some cameras) have none — this is a
   * first-class case, not an edge case. Never assume GPS is present.
   */
  hasGps: boolean;

  /** Capture time as epoch milliseconds, UTC-normalized, for timeline ordering. */
  capturedAt: number;

  /** Reverse-geocoded city, derived on-device. Null if ungeocoded or no GPS. */
  city: string | null;

  /** Reverse-geocoded region/state, derived on-device. Null if ungeocoded or no GPS. */
  region: string | null;

  /** Reverse-geocoded country, derived on-device. Null if ungeocoded or no GPS. */
  country: string | null;

  /** Where this photo came from. Room to grow: 'google_photos', etc. */
  source: 'camera_roll';
}
