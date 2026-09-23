# 0003. Accounts and a backend: Firebase Auth + Firestore

## Context

Everything the app produced lived in React state. Closing it lost the stamped
trips, the home city, and the fact that onboarding had ever been done — so the
next launch started from the welcome screen with an empty archive.

That is survivable while the only user is the person writing the code. It stops
being survivable the moment a build goes to other people, which is the point we
reached: a tester would redo onboarding every launch and lose every trip they
stamped, so the only feedback obtainable would be "it grouped my photos once".

The milestone boundary in `CLAUDE.md` said all-on-device, no backend. This ADR
is where that boundary moves, deliberately and only as far as storage.

## Decision

### Firebase, not `services/api`

`services/api` (Python + FastAPI) has been a named-but-unbuilt skeleton since
the beginning. Building it now would mean writing an API, an auth scheme, a
database schema, a deployment and a host — to store a few hundred small
documents per user.

Firebase Auth + Firestore is what the stack already named. It needs no server
code, no deployment, and no cost at this size. The Firebase JS SDK works in
Expo without a native module beyond AsyncStorage.

### Email and password only

The mock sign-up screen offered Google, Instagram, Facebook and phone OTP. What
each actually costs:

- **Google** — an OAuth client per build type, with the app's SHA-1 fingerprint
  registered; breaks when the signing key changes, which it does on the way to
  the Play Store.
- **Instagram** — not a Firebase Auth provider at all. It would need a custom
  OAuth flow plus a Cloud Function minting custom tokens.
- **Facebook** — a Meta developer app and app review.
- **Phone OTP** — on the Expo JS SDK this needs a reCAPTCHA workaround whose
  Expo library is unmaintained, and SMS is billed per message.

Email and password needs none of that and no native configuration. The others
can be added later; the session interface doesn't change when they are.

### Clustering stays on the device

Only storage moved. Reading GPS, segmenting trips, splitting stops and naming
places all still run on the phone, exactly as ADR 0001 and ADR 0002 describe.
`docs/ROADMAP.md` had pencilled clustering in as a Cloud Function; that would
mean shipping every photo's coordinates to a server to get back a grouping the
device can compute for free, offline, in milliseconds. Firestore is a
filing cabinet here, not a processor.

### Metadata only — no image bytes

A stored trip carries each photo's metadata and the file's path *on the device
that stamped it*. Nothing is uploaded. This follows the roadmap principle
("metadata on device, bytes in the cloud lazily") and keeps the promise the
consent screen makes.

The consequence is deliberate and visible: sign in on a second phone and the
trips, dates, stops and place names are all there, but the thumbnails are
blank, because the photos are on the other phone. Uploading cover images would
fix it, and would mean Cloud Storage, upload progress, retries and storage
cost — a later decision, not this one.

### What is stored, and where

```
users/{uid}                    profile, home base, onboarding completion
users/{uid}/trips/{tripId}     one stamped trip: trip, stops, photo metadata
```

One document per trip, so stamping a new one never rewrites the others and a
single unreadable document can't take the archive down with it. The shape and
both conversions are pure functions in `packages/shared/src/archive-doc.ts`,
tested, and versioned with `STAMPED_TRIP_DOC_VERSION` so a later shape change
becomes a migration rather than a crash.

### Rules are the security boundary

`firebase/firestore.rules` allows a signed-in user to touch `users/{uid}/**`
and nothing else. This matters more than it looks: the `EXPO_PUBLIC_FIREBASE_*`
keys ship inside the app and are readable by anyone who has it. They identify
the project; they authorise nothing. Firestore's default "test mode" rules let
the whole internet read and write, so the rules must be deployed before any
build is shared.

### An offline copy in AsyncStorage

The Firebase JS SDK has no on-disk Firestore cache on React Native — that
feature depends on IndexedDB. Without a cache, opening the app with no signal
shows an empty archive, which is precisely the situation this app is used in:
abroad, on a bad connection, looking at photos from a trip. So each successful
load is mirrored into AsyncStorage and rendered until Firestore answers.

## Consequences

- Onboarding runs once per account, not once per launch. Trips survive
  reinstalling the app.
- The app now needs configuration to be useful. A build with no `.env` still
  runs, reports itself unconfigured on the sign-up screen, and does not crash.
- A trip restored on a different device shows no thumbnails.
- Firestore reads cost one read per trip on each archive load. At a few hundred
  trips per user this stays inside the free tier comfortably.
- `services/` remains unbuilt, and is now less likely to be needed at all.
