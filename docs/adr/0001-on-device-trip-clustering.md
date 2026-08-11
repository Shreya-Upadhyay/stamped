# 0001. On-device trip clustering, by proximity to the trip's centre

## Context

`docs/ROADMAP.md` §1 originally put clustering in a Cloud Function, and its §4
sketch split a trip on "big time gap AND far from `homeCity`" — `homeCity`
requiring a concept of "home" that doesn't exist yet (no auth/user profile).

`CLAUDE.md`'s current milestone supersedes that: trip grouping runs **entirely
on-device**, and `services/` isn't touched this milestone.

A first implementation split a trip whenever *consecutive* photos were more
than 300 km apart. That has a real flaw: a slow drift never splits, because
each individual hop stays under the threshold. Five 200 km moves chain into one
trip spanning a continent.

## Decision

Implemented in `packages/shared/src/clustering.ts`.

A trip has a **centre**: the running centroid of the located photos in it. The
trip continues while photos stay within **500 km** of that centre; the first
photo beyond it starts a new trip.

- **Distance only by default.** No time threshold — a trip runs until the
  camera actually moves somewhere else. `tripGapMs` is available as an option
  for callers that want time-based splitting too.
- **Photos without GPS join the trip in progress and never move its centre.**
  A screenshot between two distant places therefore cannot bridge them into one
  trip, which matches ROADMAP §2's "no-GPS is a first-class case".
- **No country check.** It would need reverse-geocoding every photo, which is
  slow on-device and impossible offline; distance is a good enough proxy.

## Consequences

- Cross-country travel inside 500 km reads as one trip: a Germany→Austria hop
  stays together. That is intended — the radius describes "roughly one place",
  not a political boundary.
- **Photos from the same place years apart merge into a single trip**, since
  nothing splits on time. Most visibly, everyday photos at home accumulate into
  one enormous trip with a multi-year date range.
  The intended fix is excluding a home radius, which is why onboarding already
  collects a home city; until then, callers wanting the old behaviour can pass
  `tripGapMs`.
- No "day trip near home" suppression — that was the point of the home anchor
  in the original sketch. Out of scope until there's a real home concept.
- `tripRadiusKm` and `tripGapMs` are options, not constants, so they can be
  tuned against real seed data per ROADMAP §9.
