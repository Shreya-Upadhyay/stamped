import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { StopGroup, TripDetails, TripGroup } from './types';

/**
 * A trip the user has stamped — the detected trip plus everything they
 * confirmed about it.
 */
export type StampedTrip = {
  id: string;
  group: TripGroup;
  details: TripDetails;
  /** Stop names the user approved or typed, keyed by stop id. */
  stopNames: Record<string, string>;
  stampedAt: number;
};

type TripArchive = {
  trips: StampedTrip[];
  stamp: (groups: TripGroup[], details: Record<string, TripDetails>, stopNames: Record<string, string>) => StampedTrip[];
  getTrip: (id: string) => StampedTrip | null;
  renameStop: (tripId: string, stopId: string, name: string) => void;
  clear: () => void;
};

const TripArchiveContext = createContext<TripArchive | null>(null);

/**
 * Holds stamped trips for the session.
 *
 * In memory only, deliberately: this milestone writes no backend and uploads
 * no bytes (see CLAUDE.md). It exists because the archive screens — Trips hub,
 * Past trips, Trip home — all read a list of stamped trips, and before this
 * trips lived inside the detection flow's own state and vanished the moment
 * you left it. Swapping this for Firestore later means reimplementing this
 * provider and nothing else.
 */
export function TripArchiveProvider({ children }: { children: ReactNode }) {
  const [trips, setTrips] = useState<StampedTrip[]>([]);

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

      setTrips((previous) => {
        // Re-stamping a trip replaces it rather than duplicating it.
        const incoming = new Set(stamped.map((t) => t.id));
        return [...previous.filter((t) => !incoming.has(t.id)), ...stamped].sort(
          (a, b) => b.group.trip.startAt - a.group.trip.startAt,
        );
      });

      return stamped;
    },
    [],
  );

  const getTrip = useCallback(
    (id: string) => trips.find((t) => t.id === id) ?? null,
    [trips],
  );

  const renameStop = useCallback((tripId: string, stopId: string, name: string) => {
    setTrips((previous) =>
      previous.map((t) =>
        t.id === tripId ? { ...t, stopNames: { ...t.stopNames, [stopId]: name } } : t,
      ),
    );
  }, []);

  const clear = useCallback(() => setTrips([]), []);

  const value = useMemo<TripArchive>(
    () => ({ trips, stamp, getTrip, renameStop, clear }),
    [trips, stamp, getTrip, renameStop, clear],
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
