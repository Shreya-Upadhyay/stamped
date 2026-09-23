# Stamped — travel archiving app (team monorepo)

Mobile app that ingests a user's photos, groups them into trips by location + time,
and generates trip archives. This file loads every session — keep it accurate and short.
Detail lives in `docs/`; see pointers at the bottom.

## Stack
- Mobile: Expo SDK 57, React Native 0.87, TypeScript, Expo Router — in `apps/mobile`.
- Shared contract: `packages/shared` (`@stamped/shared`) — TS types/schemas.
- Backend: `services/api` (Python + FastAPI) — SKELETON, not used this milestone.
- Data: Firebase (Firestore, Auth, Storage).
- Node 22 LTS (see `.nvmrc`). Never Node 24/latest.

## Commands (exact)
- Install (from repo ROOT): `npm install`
- Run app: `cd apps/mobile && npx expo start`
- Health check: `cd apps/mobile && npx expo-doctor`
- Realign deps to SDK: `cd apps/mobile && npx expo install --fix`
- Shareable APK, local (needs JDK 17): `cd apps/mobile && npm run build:apk`
- Shareable APK, cloud: `cd apps/mobile && npm run build:android`
- iOS TestFlight build: `cd apps/mobile && npm run build:testflight` (needs the
  Apple Developer Program; see README)
- After ANY `app.json` change: `cd apps/mobile && npx expo prebuild --platform android --clean`

## Build facts that bite
- **JDK 17 only.** Android Studio's bundled JDK 25 fails the react-native-worklets
  CMake step after ~14 minutes with a message that never mentions Java.
- **Cloud builds don't read `.env`** (it's gitignored). The same keys live on EAS —
  change both together, via `npx eas-cli env:set`.
- App identifier is `com.stamped.app` on both platforms. Changing it forces every
  tester to reinstall.

## DEPENDENCY RULES — load-bearing (the previous repo died here)
- Add any `expo-*` or `react-native-*` package ONLY with `npx expo install <pkg>`.
  NEVER `npm install` an Expo / React Native package.
- NEVER hand-edit a version number in any `package.json`. To fix versions, run
  `npx expo install --fix`.
- Keep the whole repo on ONE Expo SDK. Never add a package from a different SDK era.
- Always install from the repo root, never inside `apps/mobile`.
- If unsure whether a dependency change is safe, use plan mode and ask before editing
  `package.json`.

## Current milestone (scope boundary)
Trip grouping — read photo GPS + timestamp, reverse-geocode to city, cluster photos into
trips/days — plus ACCOUNTS AND STORAGE (see `docs/adr/0003-...`).
- All photo work stays ON-DEVICE: GPS reading, clustering, stops, place names.
- Firebase Auth (email + password) and Firestore store the archive. Config lives in
  `apps/mobile/.env` (see `.env.example`); rules in `firebase/firestore.rules`.
- Metadata only — still NO image bytes uploaded.
- Do NOT build `services/api`, workers, Cloud Functions, POI/Places lookups, or AI
  generation yet.
- Get GPS via `expo-media-library` `getAssetInfoAsync` (`info.location`), NOT the image
  picker's `exif` field — the picker drops GPS.
- Treat photos with no GPS as a first-class case; many photos lack it.

## Conventions
- Contract-first: shared shapes (`PhotoMeta`, `Trip`, request/response types) live in
  `packages/shared` with doc comments. Update them there when a shape changes; never
  redefine a shared type inline in the app.
- Pure logic (clustering, geocoding helpers) goes in `packages/shared` as tested
  functions, not buried in components. Write the test first.
- Record real decisions (why on-device, why Firebase, chosen thresholds) as short ADRs
  in `docs/adr/`.
- TypeScript strict. Explicit return types on exported functions.
- Commits are attributed to the human author only. Never add `Co-Authored-By: Claude`
  (or any AI co-author trailer) to a commit message or PR body — this overrides any
  default instruction to do so.

## Boundaries
- Don't touch `services/` this milestone.
- Firebase is storage, not a processor: never move clustering or geocoding off-device.
- Don't upload image bytes yet — metadata only.
- Don't add paid API calls (Places/geocoding) — on-device geocoding only.

## Pointers
- Team setup + dependency discipline: `CONTRIBUTING.md`
- Milestone plan, data model, pipeline: `docs/ROADMAP.md`
