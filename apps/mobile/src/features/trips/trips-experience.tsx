import { useCallback, useEffect, useState } from 'react';

import { useTripArchive } from './archive';
import { PastTripsScreen, TripHomeScreen, TripsHubScreen } from './archive-screens';
import { TripFlow } from './trip-flow';
import { TripItineraryScreen } from './trip-itinerary-screen';
import type { PhotoSource } from './types';

/**
 * The Trips tab.
 *
 * Mirrors the MVP prototype's information architecture — Trips hub → Past
 * trips → Trip home → itinerary, with trip detection as a flow you enter and
 * come back out of.
 *
 * It's a state machine rather than Expo Router routes on purpose: the flow is
 * one task with a back stack of its own, and adding route files while Metro is
 * running has repeatedly corrupted this project's generated route types (see
 * README). Nothing here needs deep links yet.
 */
type Mode =
  | { name: 'hub' }
  | { name: 'archive' }
  | { name: 'trip'; tripId: string }
  | { name: 'itinerary'; tripId: string }
  | { name: 'flow' };

export function TripsExperience({ source }: { source: PhotoSource }) {
  const [mode, setMode] = useState<Mode>({ name: 'hub' });
  const { pendingTripId, consumePendingTrip } = useTripArchive();

  // Home lists stamped trips but can't render the detail itself — tapping one
  // parks its id here and switches tab, and this picks it up.
  useEffect(() => {
    if (pendingTripId == null) return;
    setMode({ name: 'trip', tripId: pendingTripId });
    consumePendingTrip();
  }, [pendingTripId, consumePendingTrip]);

  const toHub = useCallback(() => setMode({ name: 'hub' }), []);
  const toArchive = useCallback(() => setMode({ name: 'archive' }), []);

  switch (mode.name) {
    case 'flow':
      return <TripFlow source={source} onExit={toArchive} />;

    case 'archive':
      return (
        <PastTripsScreen
          onBack={toHub}
          onOpenTrip={(tripId) => setMode({ name: 'trip', tripId })}
        />
      );

    case 'trip':
      return (
        <TripHomeScreen
          tripId={mode.tripId}
          onBack={toArchive}
          onOpenItinerary={() => setMode({ name: 'itinerary', tripId: mode.tripId })}
        />
      );

    case 'itinerary':
      return (
        <TripItineraryScreen
          tripId={mode.tripId}
          onBack={() => setMode({ name: 'trip', tripId: mode.tripId })}
        />
      );

    default:
      return <TripsHubScreen onOpenArchive={toArchive} onFindTrips={() => setMode({ name: 'flow' })} />;
  }
}
