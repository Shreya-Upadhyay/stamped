# Stamped

A travel-archiving mobile app. It reads the photos already on your phone, pulls each
one's GPS location and timestamp, and automatically groups them into **trips** — so
your travel history builds itself instead of being something you have to journal.

Everything in this milestone happens **on your device**. No photo is uploaded, no
backend is called, and no paid API is used.

---

## What works today

The app runs end to end from first launch through to grouped trips.

### Onboarding (presentational)

| Screen | What it does |
|---|---|
| **Welcome** | Rotating globe, brand intro |
| **Sign up / Sign in** | Google · Instagram · Facebook · mobile OTP |
| **OTP** | Six-box code entry, simulated SMS auto-fill, resend countdown |
| **Profile** | Confirms the details the provider "returned", plus home city |
| **Permissions** | Explains what the app will ask for and why |
| **Consent** | Data-use preferences |

> **Sign-in is deliberately not real.** No password or token is ever handled, and no
> account exists. Nothing in the photo → GPS → clustering pipeline needs one, so real
> auth is a later milestone (see *Adding real auth* below).

### Trip grouping (fully functional)

| Step | Screen | What it does |
|---|---|---|
| 1 | **Select photos** | Requests media-library permission, lists your camera roll, multi-select |
| 2 | **Reading photos** | Live progress while GPS + timestamp are read from each photo |
| 3 | **We found your trips** | Photos clustered into trips, reverse-geocoded to a city, thumbnails per trip |
| 4 | **Add trip details** | Edit the trip name, see auto-detected dates, pick a category |
| 5 | **Trips stamped** | Passport-stamp summary of each trip |

Also done:

- **Shared data contract** — `PhotoMeta` and `Trip` types with doc comments (`packages/shared`)
- **Clustering algorithm** — pure, dependency-free, **15 unit tests** (`packages/shared/src/clustering.ts`)
- **Design system** — the warm brown/cream/gold Stamped look, light + dark mode
- **Handles photos with no GPS** as a first-class case, not a crash

Not built yet (deliberately — see `docs/ROADMAP.md`): real accounts, uploading photos,
saving trips to a server, POI/venue names, AI trip write-ups, sharing.

**Trips are not saved.** They exist only for the length of a session; closing the app
loses them. Persistence is the next milestone.

---

## Prerequisites

- **Node 22 LTS.** Not 24/latest — it breaks the Expo tooling. `nvm use` reads `.nvmrc`.
- **Git**
- For Android testing: **Android Studio** (for the emulator)

```bash
node -v   # expect v22.x
```

## Install

```bash
git clone <repo-url> stamped
cd stamped
nvm use
npm install
```

Always install from the **repo root** — this is an npm-workspaces monorepo, and installing
inside `apps/mobile` corrupts dependency hoisting. Read `CONTRIBUTING.md` before adding any
dependency; the dependency rules there are load-bearing.

---

## Running the app

There are three ways to run it. **Start with web** — it needs no device and no build.

### Option A — Web (fastest, no device needed)

```bash
cd apps/mobile
npx expo start --web
```

Opens at `http://localhost:8081`. You'll land on **Welcome** — click through onboarding,
then **Find my trips** (or the **Photos** tab).

The photo picker itself is native-only (`expo-media-library` has no web build), so on web
the flow runs against **nine built-in fixture photos** — Paris, Rome, Tokyo, plus one with
no GPS. You get the complete, clickable multi-step experience and the *real* clustering
algorithm; only the photo source is faked.

Use this for all UI work. It's also the only place reverse-geocoding (city names) is
reliably visible, since the Android emulator can't reach Google's geocoder.

### Option B — Android emulator (real photos, full feature)

This is the way to exercise the genuine `expo-media-library` path.

**1. Create an emulator** (once): Android Studio → **Device Manager** → **Create Virtual
Device** → pick any phone → choose a system image **with Google Play** → Finish → ▶ to boot it.

**2. Build a development client** (once, ~15 min, needs a free Expo account):

```bash
npm install -g eas-cli
eas login
cd apps/mobile
eas build --profile development --platform android
```

> Expo Go will **not** work for this app — it ships a fixed SDK version and doesn't include
> our native modules. A development build is your own version of Expo Go containing exactly
> the native code this project needs. You only rebuild it when native config changes.

**3. Install it on the emulator**, using the APK link EAS prints:

```bash
adb install -r --no-streaming <downloaded>.apk
```

**4. Start the dev server and connect:**

```bash
cd apps/mobile
npx expo start --dev-client
```

Press **`a`** to open it on the emulator. If it can't connect, forward the port and relaunch:

```bash
adb reverse tcp:8081 tcp:8081
```

> These `adb reverse` mappings drop frequently. If the app suddenly says it can't reach the
> dev server, re-run that command — it's almost always the cause.

**5. Load test photos** — see the next section. A fresh emulator's gallery is empty.

### Option C — iPhone

**Currently blocked**, and not for a reason you can fix in code: installing custom native
code on a physical iPhone requires either a **paid Apple Developer Program** membership
($99/year, for `eas build --platform ios`) or a **Mac** running Xcode. Expo Go isn't a way
around it — the version on the App Store supports an older Expo SDK than this project uses.

Use Option A or B until an Apple Developer account exists.

---

## Loading test photos (emulator)

An emulator has no photos, and ordinary images have no GPS — so the feature would have
nothing to show. This script generates nine photos with real GPS and timestamps baked into
their EXIF, matching the cases the unit tests cover:

```bash
pip install Pillow
python tools/make-sample-photos.py
```

Then push them to the running emulator and index them:

```bash
adb push sample-photos/. /sdcard/DCIM/Camera/
adb shell content call --uri content://media --method scan_file \
    --arg /sdcard/DCIM/Camera/stamped-paris-1.jpg   # repeat for each file
```

A correct run groups these into **exactly three trips** (Paris / Rome / Tokyo), with the
no-GPS photo absorbed into the Rome trip and flagged "1 without GPS".

> **Gotcha:** Android's MediaStore usually ignores EXIF dates on side-loaded files, leaving
> `DATE_TAKEN` empty. The app falls back to file modification time, so set that too if you
> want realistic dates: `adb shell touch -t 202607101624 /sdcard/DCIM/Camera/stamped-paris-1.jpg`.
> Without this the trips still group correctly by distance, but show 1970 dates.

---

## Tests

```bash
cd packages/shared && npm test          # 15 clustering tests
cd apps/mobile && npx tsc --noEmit      # typecheck
cd apps/mobile && npx expo-doctor       # dependency health — run before every push
```

Clustering logic is pure and tested in isolation, with no React or native modules
involved. When changing how trips are grouped, **write the test first** — the fixtures in
`packages/shared/src/clustering.test.ts` are the specification.

---

## Project structure

```
apps/mobile/                  Expo app (Expo Router, TypeScript)
  src/app/
    _layout.tsx               Session gate — picks onboarding or the app
    (onboarding)/             welcome, signup, signin, otp, profile, permissions, consent
    (tabs)/                   Home, Explore, Photos
      photo-gps.tsx           native (real camera roll)
      photo-gps.web.tsx       web (fixtures)
  src/features/auth/          Session state — the seam a real auth backend plugs into
  src/features/trips/         The trip flow UI + its PhotoSource seam
  src/components/ui/          Design-system pieces (buttons, cards, header, progress)
  src/constants/theme.ts      Colour palette, spacing, radii
packages/shared/              @stamped/shared — THE data contract. Read this first.
  src/types/                  PhotoMeta, Trip
  src/clustering.ts           Trip segmentation (+ .test.ts)
docs/ROADMAP.md               Milestone plan and data model
docs/adr/                     Short records of decisions already settled
tools/                        Dev utilities (sample photo generator)
```

### Navigation

The root layout (`src/app/_layout.tsx`) holds two route groups and swaps between them
with `Stack.Protected`, guarded on session state. Onboarding shows until it completes;
after that the tab bar takes over. Onboarding replays on every launch — nothing is
persisted yet, which is convenient while demoing.

### How the same UI runs on both web and device

`src/features/trips/trip-flow.tsx` contains the entire multi-step flow and knows nothing
about the platform. It consumes a **`PhotoSource`** (`src/features/trips/types.ts`) —
permission state, load photos, read metadata, reverse-geocode.

- `app/photo-gps.tsx` implements it with `expo-media-library` + `expo-location`
- `app/photo-gps.web.tsx` implements it with fixtures

One UI, two data sources. That's why the whole experience is reviewable in a browser.

> `expo-media-library` has **no web implementation**. Importing it from a `.web.tsx` route
> crashes the entire web build, because Expo Router evaluates every route module to build
> its route table. Keep native-only imports out of web variants.

---

## How trips are grouped

Photos are sorted by capture time. A trip has a **centre** — the running average of the
located photos in it — and continues while photos stay within **500 km** of that centre.
The first photo beyond the radius starts a new trip.

Measuring from the trip's centre rather than the previous photo matters: consecutive-photo
distance lets a slow drift chain across a continent, because each individual hop stays
under the threshold.

Two deliberate behaviours:

- **Nothing splits on time by default.** A trip runs until the camera actually moves. The
  side effect is that photos from the same place years apart merge into one trip — most
  visibly, everyday photos at home. Excluding a home radius is the planned fix (it's why
  onboarding collects a home city); `tripGapMs` is available meanwhile.
- **Photos without GPS join the trip in progress and never move its centre**, so a
  screenshot between two distant places can't bridge them into one trip.

`tripRadiusKm` and `tripGapMs` are options on `segmentPhotosIntoTrips`, not constants.
Full reasoning in `docs/adr/0001-on-device-trip-clustering.md`.

---

## Adding real auth later

Everything an auth backend would provide sits behind one interface,
`src/features/auth/session.tsx`. Screens only ever call `signInWith`,
`completeOnboarding` and read `profile` — none of them know how a session is produced.

Swapping in Firebase Auth means reimplementing `SessionProvider` against it. No screen
needs to change. (Same idea as the `PhotoSource` seam for photos.)

Worth knowing before you start that work:

- **Firebase is not needed for anything currently built.** Reading photos, extracting
  GPS, clustering, and reverse-geocoding all run on-device. Firebase becomes relevant
  for *saving* trips, not for producing them.
- Google sign-in needs a Firebase project plus OAuth client IDs per platform, native
  config in `app.json`, and **a new dev-client build** before it can be tested.
- Phone OTP needs billing enabled on the Firebase project.
- Instagram and Facebook login need their own Meta developer apps — Firebase alone
  doesn't cover them.

## Known limitations

- **iPhone testing is blocked** without an Apple Developer account or a Mac (above).
- **City names don't appear on the Android emulator.** `reverseGeocodeAsync` needs Google's
  geocoder backend, which the emulator can't reach; trips fall back to date-based titles.
  Works on a real device with network, and on web.
- **Trips are not saved.** They live in screen state only; leaving the screen loses them.
  Persistence is a later milestone.
- **Sign-in is presentational** — see *Adding real auth* above.
- `services/` is referenced in `CLAUDE.md` but does not exist yet — the backend is not part
  of this milestone.

### Gotcha: stale generated route types

Expo Router generates `.expo/types/router.d.ts` from your route files. If you add files
**while the dev server is running**, that generator can end up polluted — `tsc` then
reports nonsense like `"/signup" is not assignable` or lists non-route files as routes,
even though the app runs fine.

Fix is a cold restart:

```bash
rm -rf apps/mobile/.expo && npx expo start --clear
```

If `tsc` disagrees with an app that visibly works, suspect this first.

---

## Where to read next

- `CONTRIBUTING.md` — dependency rules. Read before installing anything.
- `docs/ROADMAP.md` — the milestone plan and data model.
- `docs/adr/` — decisions already made, so they don't get re-litigated.
- `packages/shared/src/types/` — the data contract every part of the app agrees on.
