# 0001. On-device trip clustering, threshold-based without a home anchor

## Context

`docs/ROADMAP.md` §1 originally put clustering in a Cloud Function, and its §4
sketch splits a trip on "big time gap AND far from `homeCity`" — `homeCity`
requiring a concept of "home" that doesn't exist yet (no auth/user profile).

`CLAUDE.md`'s current milestone boundary supersedes that: trip grouping runs
**entirely on-device**, and `services/` isn't touched this milestone.

## Decision

Implemented in `packages/shared/src/clustering.ts`. A trip is a run of
chronologically-sorted photos; a new trip starts when, compared to the
previous photo:

- the time gap exceeds **24 hours**, or
- (only when both photos have GPS) the distance exceeds **300 km**.

This drops the home-anchor entirely in favor of a consecutive-photo distance
check — still "threshold logic, not DBSCAN" per ROADMAP's own guidance, but
self-contained: no home-location permission flow, no profile concept required.
Photos without GPS can only trigger the time-based split (never the
distance-based one), matching ROADMAP §2's "no-GPS is a first-class case."

## Consequences

- A same-day flight to a city >300km away starts a new trip even without a
  24h gap; a slow multi-day drive within 300km of the previous photo does not,
  even if >24h has elapsed, unless the two also lack GPS entirely.
- No "day trip near home" suppression — that was the whole point of the
  home-anchor in the original sketch. Out of scope until there's a real home
  concept (post-auth).
- Thresholds (`tripGapMs`, `tripDistanceKm`) are constructor options on
  `segmentPhotosIntoTrips`, not hardcoded, so they can be tuned later against
  real seed data per ROADMAP §9's open decision.
