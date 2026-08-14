# 0002. Itinerary stops, and where place names come from

## Context

A trip needs more than a title. The wanted behaviour: name the trip after the
**country**, and under it list an **itinerary** — the actual places visited, by
date, in chronological order — with names *suggested* from each photo's GPS so
the user only has to approve rather than type.

Two questions had to be settled:

1. What is a "place visited"? A photo isn't one — twenty photos of the same
   cathedral are one stop, not twenty.
2. Where do names come from without a paid Places API? `CLAUDE.md` is explicit:
   on-device geocoding only, no paid API calls this milestone.

## Decision

### Stops reuse the trip algorithm at a smaller scale

`packages/shared/src/itinerary.ts` — `segmentTripIntoStops` is the same
centroid-anchored sweep as `segmentPhotosIntoTrips` (ADR 0001), with tighter
defaults:

- **1 km radius** — a stop is "one place you stood", not a region.
- **3 hour gap** splits a stop even without moving, so returning to the same
  spot the next day is a second visit rather than one stop with a 30-hour span.

Reusing the shape rather than inventing a second algorithm means the no-GPS
rule carries over for free: photos without GPS join the stop in progress and
never move its centre.

### Names come from `expo-location`'s placemark, free and offline-capable

`Location.reverseGeocodeAsync` returns a `name` field — the OS placemark, e.g.
"Neuschwanstein Castle". It costs nothing and needs no API key.

It does, however, **require location permission on Android**, which is not
obvious: the call is a pure coordinate→address lookup that never reads where
the device actually is, and expo-location's JS layer has no permission check.
The gate is in the native module, and without it every call rejects with
"Not authorized to use location services" — which looks exactly like a broken
geocoder. The app requests permission lazily, once, on the first lookup.

The placemark itself needs filtering. When a geocoder has no real name for a
point it substitutes a Plus Code ("HP3W+C7") or a bare house number ("1"),
either of which is worse than no name at all as the title of a stop.
`pickPlaceName` (`packages/shared/src/place.ts`) rejects both and falls back
`name → street → district → city`. The trip's own country/city are the
**dominant** values across its stops (`dominantValue`), not whichever stop
happened to be first.

Geocoding runs **once per stop, not once per photo**. On a real trip that is
the difference between tens of lookups and thousands, and the OS geocoder is
slow enough for it to be obvious.

### Names are suggested, never assumed

Every stop shows its suggested name in an editable field with a "suggested"
pill and an **Approve** button; approving flips it to ✓. A stop whose photos
all lack GPS has no coordinates to geocode, so it is marked
`needsManualPlace` and asks for a name instead of guessing one.

### Geocoding is not in the shared package

`buildStop` deliberately knows nothing about geocoding — it returns
`suggestedName: null` and the app fills names in afterwards. This keeps the
shared logic pure and testable with no async mocking, and puts the slow,
failure-prone work at the edge where it can be caught per stop.

## Consequences

- **A failed lookup degrades to an unnamed stop, not a failed run.** No network,
  or a declined location permission, leaves the field empty for the user to
  fill, and the itinerary states why rather than showing blank fields.
- **Placemark quality varies by region and OS**, even after filtering. Verified
  against real photos: Füssen, Schwangau, Bingen am Rhein and Boppard all
  resolved to sensible names ("Gedeonseck" for the Rhine viewpoint). Remote
  coordinates still tend to give only a road. This is the accepted cost of not
  calling a paid Places API — and why every name stays editable.
- **Approved names are screen state only.** Nothing persists yet, consistent
  with the rest of this milestone.
- The 1 km / 3 h defaults are `StopOptions`, not constants, so they can be tuned
  against real photo sets.
