import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it } from 'vitest';

import { buildTrip, formatTripDateRange, segmentPhotosIntoTrips } from './clustering';
import { segmentTripIntoStops } from './itinerary';
import type { PhotoMeta } from './types/photo';

/**
 * A tuning harness, not a test.
 *
 * Point `tools/extract-photo-meta.py` at a folder of real photos, then run
 * this to see how the *actual* shipping clustering groups them — and how the
 * grouping moves as the radius and time-gap change. Tuning through the app UI
 * means a minute per run; this is a second per run over the whole library.
 *
 *     python tools/extract-photo-meta.py "C:/path/to/photos"
 *     cd packages/shared && npx vitest run cluster-report
 *
 * It skips itself when there's no data file, so `npm test` stays green on a
 * clean checkout.
 */

const FIXTURE = join(__dirname, '..', 'fixtures', 'photos.json');
const hasData = existsSync(FIXTURE);

/** What extract-photo-meta.py writes — the subset of PhotoMeta it can know. */
type ExtractedPhoto = {
  id: string;
  filename: string;
  lat: number | null;
  lng: number | null;
  hasGps: boolean;
  capturedAt: number;
};

function loadPhotos(): { meta: PhotoMeta; filename: string }[] {
  const raw = JSON.parse(readFileSync(FIXTURE, 'utf-8')) as ExtractedPhoto[];
  return raw.map((p) => ({
    filename: p.filename,
    meta: {
      id: p.id,
      userId: 'tuning',
      tripId: null,
      assetId: p.id,
      storagePath: null,
      lat: p.lat,
      lng: p.lng,
      hasGps: p.hasGps,
      capturedAt: p.capturedAt,
      city: null,
      region: null,
      country: null,
      source: 'camera_roll',
    },
  }));
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Radii to sweep, in km. 500 is today's default. */
const RADII = [25, 50, 100, 200, 300, 500, 800, 1200];
/** Time gaps to sweep, in days. `undefined` is today's default (distance only). */
const GAPS: (number | undefined)[] = [undefined, 30, 7, 2];

describe.skipIf(!hasData)('clustering report (real photo library)', () => {
  it('summarises the library', () => {
    const photos = loadPhotos().map((p) => p.meta);
    const withGps = photos.filter((p) => p.hasGps).length;
    const times = photos.map((p) => p.capturedAt).sort((a, b) => a - b);

    console.log('\n═══ Library ═══');
    console.log(`photos      ${photos.length}`);
    console.log(`with GPS    ${withGps}  (${Math.round((withGps / photos.length) * 100)}%)`);
    console.log(`without GPS ${photos.length - withGps}`);
    console.log(`span        ${formatTripDateRange(times[0], times[times.length - 1])}`);
  });

  it('sweeps radius and time gap', () => {
    const photos = loadPhotos().map((p) => p.meta);

    console.log('\n═══ Trips detected ═══');
    console.log('Rows: radius km. Columns: max gap before a trip splits.');
    const header = ['radius'.padEnd(8), ...GAPS.map((g) => (g ? `${g}d` : 'none').padStart(8))];
    console.log(header.join(''));

    for (const tripRadiusKm of RADII) {
      const cells = GAPS.map((days) => {
        const groups = segmentPhotosIntoTrips(photos, {
          tripRadiusKm,
          tripGapMs: days == null ? undefined : days * DAY_MS,
        });
        return String(groups.length).padStart(8);
      });
      const marker = tripRadiusKm === 500 ? '*' : ' ';
      console.log(`${marker}${String(tripRadiusKm).padEnd(7)}${cells.join('')}`);
    }
    console.log('* current default');
  });

  it('lists the trips at the current defaults', () => {
    const photos = loadPhotos();
    const byAsset = new Map(photos.map((p) => [p.meta.assetId, p.filename]));
    const groups = segmentPhotosIntoTrips(photos.map((p) => p.meta));

    console.log('\n═══ Trips at the current defaults ═══');
    groups.forEach((group, index) => {
      const trip = buildTrip(group, {
        userId: 'tuning',
        tripId: `trip-${index}`,
        city: null,
        country: null,
      });
      const stops = segmentTripIntoStops(group);
      const noGps = group.filter((p) => !p.hasGps).length;

      console.log(
        `\n${index + 1}. ${formatTripDateRange(trip.startAt, trip.endAt)}` +
          `  ${group.length} photos, ${stops.length} stops` +
          (noGps ? `, ${noGps} without GPS` : ''),
      );
      // First and last few filenames — enough to recognise the trip without
      // dumping hundreds of lines.
      const names = group.map((p) => byAsset.get(p.assetId) ?? p.assetId);
      const preview = names.length <= 6 ? names : [...names.slice(0, 3), '…', ...names.slice(-2)];
      console.log(`   ${preview.join(', ')}`);
    });
  });
});

describe.skipIf(hasData)('clustering report', () => {
  it('explains how to supply data', () => {
    console.log(
      `\nNo photo data at ${FIXTURE}.\n` +
        'Generate it with:  python tools/extract-photo-meta.py "C:/path/to/photos"\n',
    );
  });
});
