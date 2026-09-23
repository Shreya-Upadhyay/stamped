# Stamped — Backend & Ingestion Roadmap

Scope of this doc: getting from "screens exist" to "**photos → locations → grouped trips**",
built on the existing monorepo (`apps/mobile`, `packages/shared`, `services`) + Firebase.
It deliberately stops at trip grouping. POI/venue resolution, AI blogs, and multi-user
sync are later milestones and are noted only so we don't accidentally build them early.

---

## 0. Principles

- **Docs-first, types-as-contract.** Every shared shape lives in `packages/shared` with
  doc comments. That file *is* the primary documentation of the data flow.
- **Metadata on device, bytes in the cloud lazily.** Never upload 300 photos to read EXIF.
  Extract the small stuff on-device; upload image bytes only for photos the user keeps.
- **Cost boundaries are explicit and logged.** Anything that calls a paid API or touches
  user data goes through one clearly named function, so it can be measured and swapped.
- **Each milestone only reads clean data the previous one wrote.** No stage reaches back
  into raw photos.

---

## 1. Where each step runs (the core cost/architecture decision)

| Step                          | Where it runs                                   | Why |
|-------------------------------|-------------------------------------------------|-----|
| Read GPS + timestamp          | On device — `expo-media-library`                | Free, instant, no upload |
| Reverse-geocode to city/place | On device — `expo-location.reverseGeocodeAsync` | **Free** (OS geocoder, no API key). Sufficient for city/neighborhood level |
| Cluster photos → trips/days   | **On device** — `packages/shared/src/clustering.ts` | Deterministic and unit-tested without a server; instant, works offline (ADR 0001) |
| Accounts                      | Firebase Auth (email + password)                | No server to run; native config only when social logins arrive (ADR 0003) |
| Store metadata                | Firestore, `users/{uid}/trips/{tripId}`         | Small docs, cheap |
| Store image bytes             | Cloud Storage, **lazily**                       | Only kept photos, not all of them |
| POI / venue names (LATER, M2) | Cloud Function → Places API                     | $17–30 / 1k calls — deferred, not needed for grouping |

**Firestore + geo caveat:** Firestore has no native radius query. It does not matter here —
we cluster a single user's few hundred photos *in memory inside a function*, not by
distance-querying a giant collection. If Stamped ever needs cross-user proximity search,
that is the moment to consider Postgres + PostGIS. Not this milestone. (See ADR-003.)

---

## 2. The photo-GPS gotcha (read before writing M1)

The "zero-permission photo picker" (`expo-image-picker` / iOS PHPicker) **strips GPS.**
It commonly returns `exif: null` or drops `GPSLatitude`, and modern Expo SDKs won't hand
over the original file without media-library permission anyway.

**Get location via `expo-media-library`, not the picker:**

```ts
import * as MediaLibrary from 'expo-media-library';

async function readPhotoMeta(asset: MediaLibrary.Asset) {
  const info = await MediaLibrary.getAssetInfoAsync(asset);
  return {
    assetId: asset.id,
    lat: info.location?.latitude ?? null,
    lng: info.location?.longitude ?? null,
    capturedAt: asset.creationTime,       // epoch ms, for timeline ordering
    hasGps: info.location != null,
  };
}
```

Design consequences (bake in from day one):
1. Ask for **media-library permission** (not the zero-permission picker). Honest tradeoff
   for a location app; the consent screens already frame it.
2. **Many photos have no GPS** (screenshots, WhatsApp/downloaded images, some cameras).
   A no-GPS photo is a first-class case: cluster by time only, or trigger a manual
   "pick the place" prompt. Never assume GPS is present.

---

## 3. Data model (Milestone 1)

Keep it minimal. These belong in `packages/shared` as typed, doc-commented interfaces —
that's the contract every collaborator (and Claude Code) reads.

```ts
// packages/shared/src/types/photo.ts
export interface PhotoMeta {
  id: string;
  userId: string;
  tripId: string | null;      // null until clustered
  assetId: string;            // device-local reference (no upload yet)
  storagePath: string | null; // set later, only if the photo is kept (M2)
  lat: number | null;
  lng: number | null;
  hasGps: boolean;
  capturedAt: number;         // epoch ms, UTC-normalized
  city: string | null;
  region: string | null;
  country: string | null;
  source: 'camera_roll';      // room to grow: 'google_photos', etc.
}

// packages/shared/src/types/trip.ts
export interface Trip {
  id: string;
  userId: string;
  title: string;              // e.g. "Goa" — from dominant city
  startAt: number;
  endAt: number;
  primaryCity: string | null;
  country: string | null;
  photoCount: number;
  coverPhotoId: string | null;
  createdAt: number;
}

// The callable contract — this is the API "documentation"
export interface GroupTripsRequest {
  photos: Array<Pick<PhotoMeta,
    'assetId' | 'lat' | 'lng' | 'capturedAt' | 'hasGps' | 'city' | 'region' | 'country'>>;
  homeCity?: { lat: number; lng: number };
}
export interface GroupTripsResponse {
  trips: Trip[];
  photos: PhotoMeta[];
}
```

---

## 4. Milestone-1 pipeline

> **Built differently — read this first.** Steps 4–6 below describe a callable
> Cloud Function. It was never built and is not planned: clustering a few hundred
> of one user's photos is milliseconds of work the phone can do offline, and
> shipping every coordinate to a server to get back a grouping the device could
> compute would cost privacy and latency for nothing. The same threshold logic now
> lives in `packages/shared/src/clustering.ts`, pure and unit-tested. Firestore
> stores the result. See ADR 0001 and ADR 0003. The sketch is kept because the
> segmentation rules it describes are still the ones in use.

1. User grants media-library permission, picks a date window (or selects photos).
2. **On device:** loop assets → `getAssetInfoAsync` → build the lightweight metadata array.
   No image upload.
3. **On device:** `reverseGeocodeAsync` on cluster centroids → `{ city, region, country }`.
4. Send the metadata array to a callable Cloud Function (`groupTrips`).
5. **In the function:** normalize timestamps to UTC, then cluster:
   - **Trip segmentation:** start a new trip when there's a large time gap (~>24h) *and*
     the location is far from `homeCity`. (Distance-from-home stops a weekend across town
     from becoming a "trip.")
   - **Day segmentation:** split each trip by calendar day in local time.
   - Start with **threshold logic**, not DBSCAN — it's debuggable and you'll understand it.
     Swap in DBSCAN later only if thresholding proves insufficient.
6. Function writes `trips` + `photos` docs, returns them; the app renders existing trip cards.

**Clustering sketch (function side):**

```ts
function segmentTrips(photos: PhotoInput[], home?: LatLng): Trip[] {
  const sorted = [...photos].sort((a, b) => a.capturedAt - b.capturedAt);
  const trips: PhotoInput[][] = [];
  let current: PhotoInput[] = [];

  for (const p of sorted) {
    const prev = current[current.length - 1];
    const bigTimeGap = prev && (p.capturedAt - prev.capturedAt) > 24 * 3600_000;
    const awayFromHome = !home || !p.hasGps || haversine(p, home) > 60; // km
    if (bigTimeGap && awayFromHome && current.length) {
      trips.push(current);
      current = [];
    }
    current.push(p);
  }
  if (current.length) trips.push(current);
  return trips.map(toTrip);
}
```

**Definition of done:** pick photos → correct trips grouped by place and day, with
no-GPS photos handled gracefully.

---

## 5. Milestone sequence

- **M0 — Foundations — done.** Shared types locked; clustering tested against real
  photos via the offline harness (`packages/shared/src/cluster-report.test.ts`).
- **M1 — Ingestion → grouping — done.** On device, including stops and place names.
- **M1.5 — Accounts and storage — done.** Firebase Auth + Firestore; onboarding and the
  stamped archive survive a restart (ADR 0003). Metadata only.
- **M2 — Enrichment:** lazy image upload + thumbnails (which is also what would make a
  restored archive show photos on a second device); POI/venue resolution (Places + OCR).
- **M3 — Sharing / AI blog:** consumes the structured metadata M1–M2 produced.

Do not pull M2/M3 work into M1.

---

## 6. Cost model (M1)

- GPS extraction: free (device).
- Reverse geocoding: free (device OS geocoder).
- Firestore writes: negligible at this scale.
- Cloud Storage: ~zero until M2 (no bytes uploaded yet).
- **Places API: not used in M1.** Deferred to M2, behind one logged function.

Net: the grouping milestone is effectively free to run.

---

## 7. Repo & docs structure

```
packages/shared/src/types/   # THE contract. Doc-commented. Read this first.
# services/functions/        # planned, never built — clustering runs on device instead
firebase/firestore.rules     # access rules; deploy before sharing a build
apps/mobile/                 # ingestion screen, permission flow, results
docs/
  ROADMAP.md                 # this file
  pipeline.md                # M1 data-flow + diagram
  adr/
    0001-on-device-metadata.md
    0002-cluster-in-function.md
    0003-firebase-not-postgres.md
CONTRIBUTING.md              # run emulator + seed data in <5 min
```

ADRs are short (context / decision / consequences). They stop settled decisions from being
re-litigated by a new collaborator — or future-you.

---

## 8. Working with Claude Code

- Point it at `packages/shared` + `docs/adr/` at session start so it inherits conventions.
- Work in **vertical slices** (one milestone's device code + function + types together),
  not "build all the backend." Each slice stays reviewable.
- Write the **deterministic clustering test first** (against the M0 seed set). It gives
  Claude Code a target and gives you a regression guard on logic that's easy to break silently.

---

## 9. Open decisions to make explicitly (write these as ADRs)

- Trip-segmentation thresholds (time gap, distance-from-home radius) — tune against seed data.
- No-GPS fallback UX: time-only clustering vs. manual place prompt vs. both.
- When to upload image bytes (on "keep"? on first view? on share?) — affects storage cost.
- Timezone source: derive from GPS (`tz-lookup`) vs. trust device local time. GPS-derived is
  more correct for multi-timezone trips; device-local is simpler. Fine to defer to M2.
