# Building Stamped for iOS — handover

For someone with an Apple Developer Program membership who is putting Stamped on
TestFlight. Everything on the code side is done and verified; what's missing is an
Apple account to sign with.

**You do not need a Mac.** EAS builds on macOS machines in the cloud. You need Node 22,
an Apple Developer membership, and about twenty minutes.

---

## 1. Get the code

```bash
git clone https://github.com/Shreya-Upadhyay/stamped.git
cd stamped
nvm use          # Node 22 — not 24, it breaks the Expo tooling
npm install      # from the repo root; this is an npm-workspaces monorepo
```

## 2. Firebase config

Shreya will send you six values separately — they're deliberately not in the repo.

```
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID
```

```bash
cp apps/mobile/.env.example apps/mobile/.env   # then fill in the six values
```

These point at Shreya's Firebase project, so accounts created by iOS testers land in
the same place as the Android ones. That's intended — don't substitute your own
project unless you want the two split. The keys ship inside the app and are not
secrets; access is controlled by `firebase/firestore.rules`, already deployed.

`.env` is gitignored. Keep it that way.

## 3. Point EAS at your own account

The repo carries Shreya's EAS project id, so the first build would otherwise try to
write to her account.

```bash
cd apps/mobile
npx eas-cli login          # your Expo account
npx eas-cli init --force   # creates your own EAS project, rewrites the id in app.json
```

Don't commit that `app.json` change — it's local to your setup.

Cloud builds can't read `.env`, so the same six values need to exist on EAS:

```bash
npx eas-cli env:set --name EXPO_PUBLIC_FIREBASE_API_KEY --value "…" \
  --visibility plaintext --environment production --environment preview
```

…once per key. `npx eas-cli env:list` to check.

## 4. Build and submit

```bash
npm run build:testflight    # signs with your Apple account — it prompts you
npm run submit:ios          # uploads to TestFlight
```

The first build asks you to sign in to Apple and then creates the App Store Connect
record, the distribution certificate and the provisioning profile by itself. Later
builds reuse them.

Then add testers in App Store Connect → TestFlight → by email. Internal testers (your
team, up to 100) get it immediately; external testers need a one-time Apple review of
the build, usually a day.

## 5. Before you start — two things worth knowing

**The app will live under your Apple account.** The TestFlight listing, and anything
that later goes to the App Store from it, belongs to the team that signed it. Moving an
app between developer accounts afterwards is possible but tedious, so if this is meant
to become Shreya's App Store listing eventually, decide that now rather than after
users exist.

**The bundle id is `com.stamped.app`** (`apps/mobile/app.json`). Bundle ids are unique
across all of Apple — if someone else has registered that one, change it to something
under your own reverse-domain and re-run the build. Nothing else depends on it.

---

## What the app does, in case you're asked

Reads the photos already on the phone, pulls each one's GPS and timestamp **on the
device**, groups them into trips, and names the places by reverse-geocoding with the
OS geocoder. No photo ever leaves the phone. Only what was read from them — dates,
coordinates, place names — is stored, in Firestore under the signed-in user.

It asks for two permissions and uses both: photo library (to read the photos) and
location (Android requires it for the geocoder; on iOS it also sets the home city).

Verified working: an EAS iOS simulator build produces the right `Info.plist`
(`NSLocationWhenInUseUsageDescription`, `NSPhotoLibraryUsageDescription`, no
always-location or motion keys, `ITSAppUsesNonExemptEncryption: false` so TestFlight
won't ask you the encryption question).

The Android side is finished and shipping as an APK — see the README. Nothing you do
for iOS affects it.
