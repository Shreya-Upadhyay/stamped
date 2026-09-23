import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useSession } from '@/features/auth/session';

import {
  clearCachedTrips,
  loadTrips,
  readCachedTrips,
  saveTrips,
  writeCachedTrips,
} from './trip-repository';
import type { StampedTrip, StopGroup, TripDetails, TripGroup } from './types';

export type { StampedTrip } from './types';

type TripArchive = {
  trips: StampedTrip[];
  stamp: (groups: TripGroup[], details: Record<string, TripDetails>, stopNames: Record<string, string>) => StampedTrip[];
  getTrip: (id: string) => StampedTrip | null;
  renameStop: (tripId: string, stopId: string, name: string) => void;
  clear: () => void;
  /** True until the archive has been read for the signed-in user. */
  loading: boolean;
  /**
   * Set when a change could not be saved. The trip is still in the list — the
   * user keeps what they stamped — but it only exists on this device.
   */
  saveError: string | null;
  /**
   * A trip the Home tab asked the Trips tab to open.
   *
   * Home and the trip detail live in different tabs, and the detail is a mode
   * inside the Trips tab's state machine rather than a route, so there's no
   * URL to link to. Home parks an id here and the Trips tab picks it up.
   */
  pendingTripId: string | null;
  requestTrip: (id: string) => void;
  consumePendingTrip: () => void;
};

const TripArchiveContext = createContext<TripArchive | null>(null);

/** The archive as held for one account. Tagged, so it can never outlive it. */
type ArchiveState = {
  /** Whose trips these are. Null before anything has been loaded. */
  uid: string | null;
  trips: StampedTrip[];
  /** True once the account's own copy has been read, cache aside. */
  loaded: boolean;
  saveError: string | null;
};

const EMPTY: ArchiveState = { uid: null, trips: [], loaded: false, saveError: null };

/**
 * The stamped-trip archive, stored per account in Firestore.
 *
 * Local state leads and the write follows: stamping a trip has to feel
 * instant, and the alternative — a spinner over a network round trip at the
 * end of a long detection run — would be the worst possible moment for one.
 * A failed write leaves the trip on screen and sets `saveError`.
 *
 * Photos themselves are never uploaded. A restored trip carries its photos'
 * metadata and their paths on the device that stamped it, so thumbnails
 * render there and nowhere else. See
 * docs/adr/0003-firebase-backend-and-accounts.md.
 */
export function TripArchiveProvider({ children }: { children: ReactNode }) {
  const { uid } = useSession();
  const [state, setState] = useState<ArchiveState>(EMPTY);
  const [pendingTripId, setPendingTripId] = useState<string | null>(null);

  // Everything on screen is tagged with the account it belongs to, so signing
  // out shows an empty archive in the same render — no effect needed to clear
  // it, and no window where one account's trips are visible to the next.
  // Memoised: it feeds every callback below, and a fresh [] each render would
  // rebuild them all.
  const trips = useMemo(() => (state.uid === uid ? state.trips : []), [state, uid]);
  const loading = uid !== null && !(state.uid === uid && state.loaded);
  const saveError = state.uid === uid ? state.saveError : null;

  useEffect(() => {
    if (!uid) return;

    // Cancelled on cleanup, which React runs before re-running this for a
    // different account — so a load in flight can never land on the next one.
    let cancelled = false;

    // Cache first so the archive appears immediately — and stays visible with
    // no connection — then the authoritative copy replaces it.
    void readCachedTrips(uid).then((cached) => {
      if (cancelled || cached.length === 0) return;
      setState((previous) =>
        // Never overwrite trips already loaded for this account.
        previous.uid === uid && (previous.loaded || previous.trips.length > 0)
          ? previous
          : { uid, trips: cached, loaded: false, saveError: null },
      );
    });

    void loadTrips(uid)
      .then((loaded) => {
        if (cancelled) return;
        setState((previous) => {
          // A trip stamped while this load was in flight isn't in the result.
          // Dropping it would lose work the user watched happen, so anything
          // local the server didn't return is kept — nothing deletes trips,
          // so there is no absence here worth honouring.
          const returned = new Set(loaded.map((trip) => trip.id));
          const local =
            previous.uid === uid ? previous.trips.filter((trip) => !returned.has(trip.id)) : [];
          const trips = [...loaded, ...local].sort(
            (a, b) => b.group.trip.startAt - a.group.trip.startAt,
          );
          void writeCachedTrips(uid, trips);
          return { uid, trips, loaded: true, saveError: null };
        });
      })
      .catch(() => {
        if (cancelled) return;
        // Offline, most likely. Whatever the cache gave us stays on screen.
        setState((previous) => ({
          uid,
          trips: previous.uid === uid ? previous.trips : [],
          loaded: true,
          saveError: 'Couldn’t reach your archive. Showing the last saved copy.',
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [uid]);

  /** Saves the changed trips — to this device first, then to the account. */
  const persist = useCallback((owner: string, next: StampedTrip[], changed: StampedTrip[]) => {
    // The local copy is written first and unconditionally. A Firestore write
    // made with no connection stays pending until there is one, rather than
    // failing, so anything sequenced after it would never run on the flight
    // home — which is exactly when someone stamps a trip.
    void writeCachedTrips(owner, next);

    const withError = (message: string | null) => (previous: ArchiveState) =>
      previous.uid === owner ? { ...previous, saveError: message } : previous;

    saveTrips(owner, changed)
      .then(() => setState(withError(null)))
      .catch(() => {
        setState(withError('Saved on this device only — we couldn’t reach your account.'));
      });
  }, []);

  /**
   * Shows the new archive at once, then saves it.
   *
   * The order is the point: stamping a trip has to feel instant, and the
   * alternative — a spinner over a network round trip at the end of a long
   * detection run — would be the worst possible moment for one.
   */
  const commit = useCallback(
    (next: StampedTrip[], changed: StampedTrip[]) => {
      const owner = uid;
      setState((previous) => ({
        uid: owner,
        trips: next,
        // A signed-out user can still stamp; nothing is loaded or saved then.
        loaded: previous.uid === owner ? previous.loaded : true,
        saveError: previous.uid === owner ? previous.saveError : null,
      }));
      if (owner) persist(owner, next, changed);
    },
    [uid, persist],
  );

  const stamp = useCallback(
    (
      groups: TripGroup[],
      details: Record<string, TripDetails>,
      stopNames: Record<string, string>,
    ): StampedTrip[] => {
      const stampedAt = Date.now();
      const stamped = groups.map((group): StampedTrip => {
        // Keep only the names belonging to this trip's stops, so each archived
        // trip is self-contained rather than sharing one global map.
        const ownNames: Record<string, string> = {};
        for (const { stop } of group.stops) {
          if (stopNames[stop.id] != null) ownNames[stop.id] = stopNames[stop.id];
        }
        return {
          id: group.trip.id,
          group,
          details: details[group.trip.id] ?? { title: group.trip.title, category: 'Group' },
          stopNames: ownNames,
          stampedAt,
        };
      });

      // Re-stamping a trip replaces it rather than duplicating it.
      const incoming = new Set(stamped.map((t) => t.id));
      const next = [...trips.filter((t) => !incoming.has(t.id)), ...stamped].sort(
        (a, b) => b.group.trip.startAt - a.group.trip.startAt,
      );

      commit(next, stamped);
      return stamped;
    },
    [trips, commit],
  );

  const getTrip = useCallback((id: string) => trips.find((t) => t.id === id) ?? null, [trips]);

  const renameStop = useCallback(
    (tripId: string, stopId: string, name: string) => {
      const next = trips.map((t) =>
        t.id === tripId ? { ...t, stopNames: { ...t.stopNames, [stopId]: name } } : t,
      );
      commit(
        next,
        next.filter((t) => t.id === tripId),
      );
    },
    [trips, commit],
  );

  /** Empties the archive on this device. Stored trips are left untouched. */
  const clear = useCallback(() => {
    setState({ uid, trips: [], loaded: true, saveError: null });
    if (uid) void clearCachedTrips(uid);
  }, [uid]);

  const requestTrip = useCallback((id: string) => setPendingTripId(id), []);
  const consumePendingTrip = useCallback(() => setPendingTripId(null), []);

  const value = useMemo<TripArchive>(
    () => ({
      trips,
      stamp,
      getTrip,
      renameStop,
      clear,
      loading,
      saveError,
      pendingTripId,
      requestTrip,
      consumePendingTrip,
    }),
    [
      trips,
      stamp,
      getTrip,
      renameStop,
      clear,
      loading,
      saveError,
      pendingTripId,
      requestTrip,
      consumePendingTrip,
    ],
  );

  return <TripArchiveContext.Provider value={value}>{children}</TripArchiveContext.Provider>;
}

export function useTripArchive(): TripArchive {
  const context = useContext(TripArchiveContext);
  if (!context) throw new Error('useTripArchive must be used inside a TripArchiveProvider');
  return context;
}

/** Totals across the whole archive, for the hub's "28 stamps · 12 countries" line. */
export function archiveSummary(trips: StampedTrip[]): {
  tripCount: number;
  photoCount: number;
  countries: number;
  stops: number;
} {
  const countries = new Set<string>();
  let photoCount = 0;
  let stops = 0;
  for (const t of trips) {
    if (t.group.trip.country) countries.add(t.group.trip.country);
    photoCount += t.group.trip.photoCount;
    stops += t.group.stops.length;
  }
  return { tripCount: trips.length, photoCount, countries: countries.size, stops };
}

/** Display name for a stop: what the user confirmed, else what was suggested. */
export function stopLabel(trip: StampedTrip, stopGroup: StopGroup): string | null {
  return trip.stopNames[stopGroup.stop.id] ?? stopGroup.stop.suggestedName ?? null;
}
