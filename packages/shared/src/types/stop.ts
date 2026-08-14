/**
 * One place visited during a trip — a run of photos taken close together in
 * space and time.
 *
 * Stops are the unit of geocoding and the rows of the itinerary. Grouping
 * photos into stops first means one lookup per place rather than one per
 * photo, which matters because the on-device geocoder is comparatively slow
 * and a trip can hold hundreds of photos.
 */
export interface TripStop {
  /** Stable id for this stop within its trip. */
  id: string;

  /** The trip this stop belongs to. */
  tripId: string;

  /** Position in the trip, chronological, starting at 0. */
  order: number;

  /**
   * Calendar day in the device's local time, as `YYYY-MM-DD`.
   * The itinerary groups stops under these.
   */
  day: string;

  /** First photo at this stop, epoch ms. */
  startAt: number;

  /** Last photo at this stop, epoch ms. */
  endAt: number;

  /** Centre of the stop's located photos. Null when none had GPS. */
  lat: number | null;
  lng: number | null;

  /**
   * What reverse geocoding proposed, e.g. "Neuschwanstein Castle".
   * A suggestion only — never shown as confirmed until the user accepts it.
   */
  suggestedName: string | null;

  /** What the user accepted or typed. Null while still unconfirmed. */
  confirmedName: string | null;

  city: string | null;
  country: string | null;

  photoCount: number;

  /**
   * True when no photo here carried GPS, so nothing can be suggested and the
   * user has to name the place themselves. A first-class case, not an error:
   * screenshots and downloaded images routinely lack location.
   */
  needsManualPlace: boolean;
}

/** The name to display: what the user confirmed, else the suggestion. */
export function stopDisplayName(stop: TripStop): string | null {
  return stop.confirmedName ?? stop.suggestedName;
}
