import type { LatLng } from '@stamped/shared';
import { useCallback, useMemo } from 'react';

import { TripsExperience } from '@/features/trips/trips-experience';
import type {
  CandidatePhoto,
  FoundPlace,
  Place,
  PhotoResult,
  PhotoSource,
} from '@/features/trips/types';

// expo-media-library has no web implementation (its native binding is
// undefined on web), so this file must never import it — Expo Router
// evaluates every route module to build the route table, and importing it
// here would crash the whole web build.
//
// The flow UI itself is platform-agnostic, so web drives it with fixtures.
// That makes the entire multi-step experience reviewable in a browser, and
// exercises the real clustering + trip-building logic end to end.

const LOCAL_USER_ID = 'local-device-user';
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const PARIS = {
  lat: 48.8566,
  lng: 2.3522,
  city: 'Paris',
  country: 'France',
  landmarks: ['Eiffel Tower', 'Musée du Louvre', 'Jardin du Luxembourg'],
};
const ROME = {
  lat: 41.9028,
  lng: 12.4964,
  city: 'Rome',
  country: 'Italy',
  landmarks: ['Colosseum', 'Trevi Fountain', 'Pantheon'],
};
const TOKYO = {
  lat: 35.6762,
  lng: 139.6503,
  city: 'Tokyo',
  country: 'Japan',
  landmarks: ['Shibuya Crossing', 'Meiji Jingu', 'Tsukiji Outer Market'],
};

const base = Date.now() - 30 * DAY_MS;

type Fixture = {
  filename: string;
  offset: number;
  place: { lat: number; lng: number } | null;
  color: string;
};

// Covers every branch of segmentPhotosIntoTrips: photos close in time+space
// stay together, a big distance jump splits (Paris -> Rome), a big time gap
// splits (Rome -> Tokyo), and a no-GPS photo is absorbed without forcing a
// split. Mirrors packages/shared/src/clustering.test.ts.
//
// Also covers both no-GPS shapes the itinerary has to handle: `screenshot.png`
// sits inside a stop that has GPS (so the stop is still named), while
// `no-gps-note.jpg` is stranded on its own by a long gap, producing a stop
// with no coordinates at all — the case that has to fall back to asking.
const FIXTURES: Fixture[] = [
  { filename: 'paris-1.jpg', offset: 0, place: PARIS, color: '#4A6496' },
  {
    filename: 'paris-2.jpg',
    offset: 3 * HOUR_MS,
    place: { lat: PARIS.lat + 0.01, lng: PARIS.lng - 0.01 },
    color: '#5470A0',
  },
  { filename: 'paris-3.jpg', offset: DAY_MS, place: PARIS, color: '#5E78AA' },
  { filename: 'rome-1.jpg', offset: DAY_MS + 4 * HOUR_MS, place: ROME, color: '#A05A3C' },
  {
    filename: 'rome-2.jpg',
    offset: DAY_MS + 6 * HOUR_MS,
    place: { lat: ROME.lat - 0.01, lng: ROME.lng },
    color: '#AA6446',
  },
  { filename: 'screenshot.png', offset: DAY_MS + 7 * HOUR_MS, place: null, color: '#6E6E6E' },
  { filename: 'tokyo-1.jpg', offset: 12 * DAY_MS, place: TOKYO, color: '#3C8C6E' },
  {
    filename: 'tokyo-2.jpg',
    offset: 12 * DAY_MS + 5 * HOUR_MS,
    place: { lat: TOKYO.lat, lng: TOKYO.lng + 0.01 },
    color: '#469678',
  },
  {
    filename: 'no-gps-note.jpg',
    offset: 12 * DAY_MS + 10 * HOUR_MS,
    place: null,
    color: '#8A7A6E',
  },
  { filename: 'tokyo-3.jpg', offset: 13 * DAY_MS, place: TOKYO, color: '#50A082' },
];

/**
 * Scatters a coordinate into a bucket index. Rounded to ~100 m first, so the
 * same spot always resolves to the same name while neighbouring stops differ.
 * Needs to actually mix — arithmetic on the raw degrees keeps landing nearby
 * points in the same bucket.
 */
function hashPoint(point: LatLng): number {
  const key = `${point.lat.toFixed(3)},${point.lng.toFixed(3)}`;
  let h = 0;
  for (let i = 0; i < key.length; i += 1) {
    h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Nearest fixture city to a point — stands in for the OS geocoder on web,
 * which has none.
 *
 * `name` mimics the placemark a real device returns, picked from the city's
 * landmarks by the point's own coordinates so that nearby-but-distinct stops
 * get distinct names — otherwise every stop in a city reads the same and the
 * itinerary screen can't be reviewed properly.
 */
function nearestCity(point: LatLng): Place {
  const cities = [PARIS, ROME, TOKYO];
  let best = cities[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const c of cities) {
    const d = (c.lat - point.lat) ** 2 + (c.lng - point.lng) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }

  const name = best.landmarks[hashPoint(point) % best.landmarks.length];
  return { name, city: best.city, country: best.country };
}

/** Stands in for forward geocoding, which Expo doesn't offer on web. */
function findFixturePlace(query: string): FoundPlace | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const city = [PARIS, ROME, TOKYO].find((c) => q.includes(c.city.toLowerCase()));
  return city ? { lat: city.lat, lng: city.lng, label: query.trim() } : null;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function PhotoGpsScreenWeb() {
  const loadCandidates = useCallback(async (): Promise<CandidatePhoto[]> => {
    await delay(300);
    return FIXTURES.map((f) => ({
      id: f.filename,
      uri: null,
      filename: f.filename,
      color: f.color,
      isScreenshot: f.filename.startsWith('screenshot'),
    }));
  }, []);

  const readMeta = useCallback(
    async (
      ids: string[],
      onProgress: (completed: number, total: number) => void,
    ): Promise<PhotoResult[]> => {
      const chosen = FIXTURES.filter((f) => ids.includes(f.filename));
      const results: PhotoResult[] = [];

      for (const [index, f] of chosen.entries()) {
        // Paced so the progress screen is actually observable, as on a device.
        await delay(120);
        results.push({
          filename: f.filename,
          uri: null,
          color: f.color,
          meta: {
            id: f.filename,
            userId: LOCAL_USER_ID,
            tripId: null,
            assetId: f.filename,
            storagePath: null,
            lat: f.place?.lat ?? null,
            lng: f.place?.lng ?? null,
            hasGps: f.place != null,
            locationSource: f.place != null ? 'exif' : null,
            capturedAt: base + f.offset,
            city: null,
            region: null,
            country: null,
            source: 'camera_roll',
          },
        });
        onProgress(index + 1, chosen.length);
      }
      return results;
    },
    [],
  );

  const source: PhotoSource = useMemo(
    () => ({
      permission: { granted: true, canAskAgain: true },
      requestPermission: () => {},
      openSettings: () => {},
      loadCandidates,
      readMeta,
      reverseGeocode: async (point: LatLng) => {
        await delay(80);
        return nearestCity(point);
      },
      findPlace: async (query: string) => {
        await delay(80);
        return findFixturePlace(query);
      },
    }),
    [loadCandidates, readMeta],
  );

  return <TripsExperience source={source} />;
}
