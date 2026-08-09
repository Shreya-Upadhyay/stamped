/**
 * A group of photos clustered by location and time (Milestone 1 output).
 * Produced by the `groupTrips` callable function from a user's PhotoMeta records.
 *
 * See docs/ROADMAP.md §3.
 */
export interface Trip {
  /** Firestore document id for this trip. */
  id: string;

  /** Owning user's id. */
  userId: string;

  /** Display title, e.g. "Goa" — derived from the dominant city in the cluster. */
  title: string;

  /** Start of the trip, epoch milliseconds UTC. */
  startAt: number;

  /** End of the trip, epoch milliseconds UTC. */
  endAt: number;

  /** Most common city among the trip's photos. Null if no photos had GPS/geocoding. */
  primaryCity: string | null;

  /** Country of the primary city. Null if no photos had GPS/geocoding. */
  country: string | null;

  /** Number of photos clustered into this trip. */
  photoCount: number;

  /** Id of the PhotoMeta chosen to represent this trip. Null if not yet chosen. */
  coverPhotoId: string | null;

  /** When this trip record was created, epoch milliseconds UTC. */
  createdAt: number;
}
