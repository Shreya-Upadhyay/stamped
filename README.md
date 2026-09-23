# Stamped

A travel-archiving mobile app. It reads the photos already on your phone, pulls each
one's GPS location and timestamp, and automatically groups them into **trips** — so
your travel history builds itself instead of being something you have to journal.

Your photos never leave your device: reading GPS, grouping trips and naming places all
happen on the phone, with no paid API. Accounts and the trip archive are the one thing
that talks to a server — Firebase stores what was *read* from your photos, never the
images themselves.

---

## What works today

The app runs end to end from first launch through to grouped trips.

### Onboarding

| Screen | What it does |
|---|---|
| **Welcome** | Rotating globe, brand intro |
| **Sign up / Sign in** | Real accounts — email and password, via Firebase Auth |
| **Profile** | Confirms your name and home city |
| **Permissions** | Explains what the app will ask for and why |
| **Consent** | Data-use preferences |

> Onboarding runs **once per account**, not once per launch: the session is restored on
> start, and your home city and stamped trips come back with it.

### Trip grouping (fully functional)

| Step | Screen | What it does |
|---|---|---|
| 1 | **Select photos** | Requests media-library permission, lists your camera roll, multi-select |
| 2 | **Reading photos** | Live progress while GPS + timestamp are read from each photo |
| 3 | **We found your trips** | Photos clustered into trips, each titled by country, thumbnails per trip |
| 4 | **Add trip details** | Edit the trip name, see auto-detected dates, pick a category |
| 5 | **Where you went** | Itinerary of stops by day, each with a suggested place name to approve |
| 6 | **Trips stamped** | Passport-stamp summary of each trip |

Also done:

- **Shared data contract** — `PhotoMeta`, `Trip` and `TripStop` types with doc comments (`packages/shared`)
- **Clustering + itinerary logic** — pure, dependency-free, **85 unit tests**
  (`packages/shared/src/clustering.ts`, `itinerary.ts`, `archive-doc.ts`)
- **Design system** — the warm brown/cream/gold Stamped look, light + dark mode
- **Handles photos with no GPS** as a first-class case, not a crash

- **Accounts and a saved archive** — Firebase Auth (email + password) and Firestore;
  stamped trips, home city and onboarding state survive a restart
  (`docs/adr/0003-firebase-backend-and-accounts.md`)

Not built yet (deliberately — see `docs/ROADMAP.md`): uploading photos, social sign-in,
POI/venue names, AI trip write-ups, sharing.

**Photos are never uploaded.** A trip restored on a *different* device shows its dates,
stops and place names, but no thumbnails — the images are on the phone that stamped it.

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

For accounts and saved trips you also need a Firebase project and an `apps/mobile/.env`
— see *Firebase setup* below. Without it the app still runs; it just can't sign you in
or save anything.

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
cd packages/shared && npm test          # 85 unit tests
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
    index.tsx                 Home: your stamped trips
    photo-gps.tsx             Trips tab, native (real camera roll)
    photo-gps.web.tsx         Trips tab, web (fixtures)
  src/lib/firebase.ts         Firebase init — the only file that creates it
  src/features/auth/          Session state, backed by Firebase Auth
  src/features/onboarding/    The signup wizard, as local step state (not routes)
  src/features/trips/         The trip flow UI, its PhotoSource seam, the archive
    trip-repository.ts        Reading/writing trips: Firestore + offline copy
  src/features/home/          Home-city detection
  src/components/ui/          Design-system pieces (buttons, cards, header, progress)
  src/constants/theme.ts      Colour palette, spacing, radii
packages/shared/              @stamped/shared — THE data contract. Read this first.
  src/types/                  PhotoMeta, Trip, TripStop
  src/clustering.ts           Trip segmentation (+ .test.ts)
  src/itinerary.ts            Stops within a trip (+ .test.ts)
  src/archive-doc.ts          What a stored trip looks like (+ .test.ts)
firebase/firestore.rules      Access rules — deploy before sharing a build
docs/ROADMAP.md               Milestone plan and data model
docs/adr/                     Short records of decisions already settled
tools/                        Dev utilities (sample photo generator)
```

### Navigation

The root layout (`src/app/_layout.tsx`) keeps the tab navigator mounted and renders the
onboarding wizard *over* it until the signed-in user has completed onboarding. Routes
were tried first and fought Expo Router on Android three separate ways; the comment in
that file records exactly how. Onboarding now runs once per account: the session is
restored from AsyncStorage on launch, so a returning user lands straight on Home.

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

## How places are named

Each trip is then split into **stops** — the places actually visited — by the same
centroid sweep at a much smaller scale: **1 km** radius, and a **3 hour** pause ends a
stop even without moving. The itinerary screen lists them by day, in order.

Names are **suggested, never assumed**. Each stop is reverse-geocoded once (not once per
photo) via `expo-location`, which returns the OS placemark — "Eiffel Tower" — free,
offline-capable, and with no API key. The app falls back `name → street → district → city`
when the placemark is just a street number. Every suggestion appears in an editable field
with an **Approve** button; a stop whose photos all lack GPS asks you to name it instead
of guessing.

The trip's own country and city are the **most common** values across its stops, so one
odd stop can't rename the whole trip.

`stopRadiusKm` and `stopGapMs` are options on `segmentTripIntoStops`. Full reasoning in
`docs/adr/0002-itinerary-stops-and-place-names.md`.

---

## Firebase setup (accounts and the saved archive)

The app runs without this — it just reports itself unconfigured on the sign-up screen
and saves nothing. To switch accounts on:

1. **Create a project** at [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication → Sign-in method → Email/Password → Enable.**
3. **Firestore Database → Create database**, in production mode.
4. **Rules:** paste `firebase/firestore.rules` into Firestore → Rules → Publish.
   Do this before sharing any build — the default test rules let the whole internet
   read and write your database.
5. **Project settings → Your apps → Web app** (the `</>` icon), then copy the config.
6. `cp apps/mobile/.env.example apps/mobile/.env` and fill in the six values.
7. Restart the dev server so Expo picks up the new environment.

The `EXPO_PUBLIC_FIREBASE_*` keys are **not secrets** — they ship inside the app and
identify the project without authorising anything. What protects the data is the rules
file in step 4.

### Testing without a real project

The Firebase emulators run auth and Firestore locally, against a project id that
doesn't have to exist:

```bash
npx firebase-tools emulators:start --project demo-stamped
```

Then set `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=10.0.2.2` in `apps/mobile/.env` (that
address is how an Android emulator reaches your machine) along with any placeholder
values for the six keys, and restart the dev server. Sign-ups and trips land in the
emulator — inspect them at http://localhost:4000. Nothing touches the real project.

### What's stored

```
users/{uid}                    name, home city, onboarding state
users/{uid}/trips/{tripId}     one stamped trip: dates, stops, place names, photo metadata
```

No image bytes, ever. The shape and its conversions live in
`packages/shared/src/archive-doc.ts`, with tests.

### Adding social sign-in later

`src/features/auth/session.tsx` is the only file that knows Firebase exists; screens
just call `signUp`, `signIn` and read `profile`. Adding a provider means extending that
one file, but each has a setup cost outside the code:

- **Google** needs OAuth client IDs plus the app's SHA-1 fingerprint per build type,
  and **a new dev-client build** — and re-registering when the signing key changes.
- **Phone OTP** needs billing enabled, and its Expo reCAPTCHA helper is unmaintained.
- **Instagram and Facebook** need Meta developer apps; Firebase doesn't cover Instagram
  at all.

Reasoning in `docs/adr/0003-firebase-backend-and-accounts.md`.

## Building an APK to share

Produces one installable file testers can sideload — no Play Store, no review.

```bash
cd apps/mobile/android && ./gradlew app:assembleRelease -x lint -x test
```

Output: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.
Send it however you like; testers tap it and allow "install from unknown sources".

**Java 17 is required.** Android Studio now bundles JDK 25, and the CMake configure
step for `react-native-worklets` fails on it after ~14 minutes with the unhelpful
message *"WARNING: A restricted method in java.lang.System has been called"*. Point
`JAVA_HOME` at a JDK 17 first — Gradle keeps one at
`~/.gradle/jdks/eclipse_adoptium-17-amd64-windows.2` if it has ever provisioned one:

```bash
export JAVA_HOME=~/.gradle/jdks/eclipse_adoptium-17-amd64-windows.2
```

After changing `app.json` (name, icon, permissions), regenerate the native project
first, or the change won't reach the manifest:

```bash
cd apps/mobile && npx expo prebuild --platform android --clean
```

### Before sharing it more widely

- **It's signed with the debug key.** Fine for sideloading; the Play Store needs a
  real keystore, and switching keys later means testers reinstall rather than update.
- **The package is still `com.anonymous.mobile`.** Changing it later also forces a
  reinstall, so change it before the APK goes far.
- **The Firebase config is baked in at build time** from `apps/mobile/.env`. Rebuild
  after changing it, and deploy `firebase/firestore.rules` before anyone installs.
- **iOS has no equivalent.** Any installable iOS build needs the Apple Developer
  Program ($99/year) plus TestFlight or per-device ad-hoc registration.

---

## Known limitations

- **iPhone testing is blocked** without an Apple Developer account or a Mac (above).
- **Place lookup needs location permission, and the app asks for it mid-flow.**
  `reverseGeocodeAsync` is a pure coordinate→address call that never reads the device's
  own position, but Android gates it behind `ACCESS_COARSE/FINE_LOCATION` anyway — without
  it the native call rejects with *"Not authorized to use location services"*. The prompt
  therefore appears during trip detection rather than during onboarding. Declining is
  handled: stops come through unnamed, the itinerary explains why, and every stop can be
  named by hand.
- **Placemark quality varies.** Geocoders return a Plus Code (`HP3W+C7`) or a bare house
  number (`1`) as the placemark when they have nothing better; `pickPlaceName` filters
  those out and falls back to street → district → city. What's left is still uneven —
  landmarks resolve well in towns, remote coordinates often give only a road.
- **No password reset, and no social sign-in yet** — email and password only. Why the
  others were deferred is in `docs/adr/0003-firebase-backend-and-accounts.md`.
- **Thumbnails are device-local.** Trips restored on another phone have no images.
- `services/` is referenced in `CLAUDE.md` but does not exist — Firebase replaced the
  need for it.

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
