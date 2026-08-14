import { formatTripDateRange } from '@stamped/shared';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PrimaryButton } from '@/components/ui/buttons';
import { PhoneFrame } from '@/components/ui/phone-frame';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Card, Chip, InfoStrip, Pill, SectionLabel } from '@/components/ui/surfaces';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';

import { archiveSummary, stopLabel, useTripArchive, type StampedTrip } from './archive';
import { MoreTile, Thumb } from './thumb';

/**
 * Screens that read the stamped-trip archive, ported from the MVP prototype's
 * Trips hub → Past trips → Trip home flow.
 *
 * Where the prototype shows a feature this milestone doesn't build — live
 * trips, reels, blogs, budgets, companions — it is rendered visibly disabled
 * with the reason, rather than mocked up with invented data. A greyed card
 * reads as "later"; a fake budget reads as a working feature that lies.
 */

/** Prototype's "Not in MVP" treatment for a feature that doesn't exist yet. */
function LockedCard({
  icon,
  title,
  description,
  reason,
}: {
  icon: string;
  title: string;
  description: string;
  reason: string;
}) {
  return (
    <Card style={styles.locked}>
      <View style={styles.cardHeaderRow}>
        <ThemedView type="accentLight" style={styles.iconTile}>
          <ThemedText style={styles.iconGlyph}>{icon}</ThemedText>
        </ThemedView>
        <Pill label="Not yet" />
      </View>
      <ThemedText type="cardTitle">{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {description}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {reason}
      </ThemedText>
    </Card>
  );
}

// ── Trips hub ────────────────────────────────────────────────────────
export function TripsHubScreen({
  onOpenArchive,
  onFindTrips,
}: {
  onOpenArchive: () => void;
  onFindTrips: () => void;
}) {
  const { trips } = useTripArchive();
  const summary = archiveSummary(trips);

  return (
    <PhoneFrame>
      <ScreenHeader
        title="Trips"
        subtitle={
          summary.tripCount === 0
            ? 'nothing stamped yet'
            : `${summary.tripCount} stamped · ${summary.countries} ${summary.countries === 1 ? 'country' : 'countries'}`
        }
      />
      <ScrollView contentContainerStyle={styles.body}>
        <LockedCard
          icon="📍"
          title="Live Trip"
          description="Track a route as you travel, with shared expenses and a live log."
          reason="Needs background location and a backend — neither exists yet."
        />

        <Card onPress={onOpenArchive}>
          <View style={styles.cardHeaderRow}>
            <ThemedView type="accentLight" style={styles.iconTile}>
              <ThemedText style={styles.iconGlyph}>📚</ThemedText>
            </ThemedView>
            <Pill label={`${summary.tripCount} stamped`} tone="brand" />
          </View>
          <ThemedText type="cardTitle">Past trips</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Browse everything you&apos;ve stamped — dates, places and the photos behind each stop.
          </ThemedText>
        </Card>

        <PrimaryButton
          label={trips.length === 0 ? 'Find my trips' : 'Find more trips'}
          onPress={onFindTrips}
          style={styles.cta}
        />
        <InfoStrip>
          Stamped reads the time and place from photos already on your phone and groups them into
          trips. Nothing is uploaded.
        </InfoStrip>
      </ScrollView>
    </PhoneFrame>
  );
}

// ── Past trips ───────────────────────────────────────────────────────
type BrowseMode = 'place' | 'time';

export function PastTripsScreen({
  onBack,
  onOpenTrip,
}: {
  onBack: () => void;
  onOpenTrip: (id: string) => void;
}) {
  const { trips } = useTripArchive();
  const [mode, setMode] = useState<BrowseMode>('place');
  const [filter, setFilter] = useState<string | null>(null);

  // Facets come from the trips themselves rather than a fixed list of
  // continents/years, so they can never offer a filter that matches nothing.
  const facets = useMemo(() => {
    const values = new Set<string>();
    for (const t of trips) {
      if (mode === 'place') {
        if (t.group.trip.country) values.add(t.group.trip.country);
      } else {
        values.add(String(new Date(t.group.trip.startAt).getFullYear()));
      }
    }
    return [...values].sort();
  }, [trips, mode]);

  const visible = useMemo(() => {
    if (filter == null) return trips;
    return trips.filter((t) =>
      mode === 'place'
        ? t.group.trip.country === filter
        : String(new Date(t.group.trip.startAt).getFullYear()) === filter,
    );
  }, [trips, mode, filter]);

  return (
    <PhoneFrame>
      <ScreenHeader title="Past trips" subtitle={`${trips.length} in your archive`} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.body}>
        {trips.length === 0 ? (
          <InfoStrip>
            Nothing stamped yet. Find your trips from the Trips screen and they&apos;ll collect here.
          </InfoStrip>
        ) : (
          <>
            <View style={styles.chipRow}>
              <Chip
                label="By place"
                selected={mode === 'place'}
                onPress={() => {
                  setMode('place');
                  setFilter(null);
                }}
              />
              <Chip
                label="By year"
                selected={mode === 'time'}
                onPress={() => {
                  setMode('time');
                  setFilter(null);
                }}
              />
            </View>

            {facets.length > 0 && (
              <View style={styles.chipRow}>
                <Chip label="All" selected={filter === null} onPress={() => setFilter(null)} />
                {facets.map((f) => (
                  <Chip
                    key={f}
                    label={f}
                    selected={filter === f}
                    onPress={() => setFilter(f)}
                  />
                ))}
              </View>
            )}

            <SectionLabel>{`${visible.length} ${visible.length === 1 ? 'trip' : 'trips'}`}</SectionLabel>
            {visible.map((t) => (
              <ArchiveTripCard key={t.id} trip={t} onPress={() => onOpenTrip(t.id)} />
            ))}
          </>
        )}

        {/*
          The prototype also browses by companion. Face detection and contact
          matching aren't built, so offering the tab would be an empty promise.
        */}
        <InfoStrip>
          Browsing by travel companion needs face detection and contact matching — not part of this
          milestone.
        </InfoStrip>
      </ScrollView>
    </PhoneFrame>
  );
}

function ArchiveTripCard({ trip, onPress }: { trip: StampedTrip; onPress: () => void }) {
  const { group, details } = trip;
  return (
    <Card onPress={onPress}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardHeaderText}>
          <ThemedText type="cardTitle">{details.title || group.trip.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatTripDateRange(group.trip.startAt, group.trip.endAt)} · {group.trip.photoCount}{' '}
            photos
          </ThemedText>
          {group.trip.primaryCity && (
            <ThemedText type="small" themeColor="textSecondary">
              📍 {group.trip.primaryCity}
              {group.trip.country ? `, ${group.trip.country}` : ''}
            </ThemedText>
          )}
        </View>
        <Pill label="✦ Stamped" tone="brand" />
      </View>
      <View style={styles.thumbRow}>
        {group.photos.slice(0, 4).map((p) => (
          <Thumb key={p.meta.assetId} photo={p} size={52} />
        ))}
        {group.photos.length > 4 && <MoreTile count={group.photos.length - 4} size={52} />}
      </View>
    </Card>
  );
}

// ── Trip home ────────────────────────────────────────────────────────
export function TripHomeScreen({
  tripId,
  onBack,
  onOpenItinerary,
}: {
  tripId: string;
  onBack: () => void;
  onOpenItinerary: () => void;
}) {
  const { getTrip } = useTripArchive();
  const trip = getTrip(tripId);

  if (!trip) {
    return (
      <PhoneFrame>
        <ScreenHeader title="Trip" subtitle="not found" onBack={onBack} />
        <ScrollView contentContainerStyle={styles.body}>
          <InfoStrip>This trip is no longer in the archive.</InfoStrip>
        </ScrollView>
      </PhoneFrame>
    );
  }

  const { group, details } = trip;
  const days = new Set(group.stops.map((s) => s.stop.day)).size;
  const named = group.stops.filter((s) => stopLabel(trip, s) != null).length;

  return (
    <PhoneFrame>
      <ScreenHeader
        title={details.title || group.trip.title}
        subtitle={`${formatTripDateRange(group.trip.startAt, group.trip.endAt)} · ${details.category}`}
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.statRow}>
          <Stat value={String(group.trip.photoCount)} label="photos" />
          <Stat value={String(group.stops.length)} label="stops" />
          <Stat value={String(days)} label="days" />
          <Stat value={String(named)} label="named" />
        </View>

        <SectionLabel>Photos</SectionLabel>
        <View style={styles.thumbRow}>
          {group.photos.slice(0, 6).map((p) => (
            <Thumb key={p.meta.assetId} photo={p} size={52} />
          ))}
          {group.photos.length > 6 && <MoreTile count={group.photos.length - 6} size={52} />}
        </View>

        <PrimaryButton
          label={`View itinerary — ${group.stops.length} ${group.stops.length === 1 ? 'stop' : 'stops'}`}
          onPress={onOpenItinerary}
          style={styles.cta}
        />

        <SectionLabel>Coming later</SectionLabel>
        <LockedCard
          icon="🎬"
          title="Highlight reel"
          description="Pick the best shots automatically, dedupe and apply a filter."
          reason="Needs on-device image scoring — not part of the trip-grouping milestone."
        />
        <LockedCard
          icon="✍️"
          title="Travel blog"
          description="A written story of the trip from its stops and photos."
          reason="Needs AI generation, explicitly out of scope for this milestone."
        />
        <LockedCard
          icon="💸"
          title="Budget & meals"
          description="What the trip cost, broken down by category."
          reason="Needs manual entry plus a place database to attribute spend."
        />
      </ScrollView>
    </PhoneFrame>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <ThemedView type="backgroundElement" style={styles.stat}>
      <ThemedText type="cardTitle" themeColor="brand">
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.six,
    gap: Spacing.two,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  cardHeaderText: {
    flex: 1,
    gap: Spacing.half,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    fontSize: 22,
    lineHeight: 28,
  },
  locked: {
    opacity: 0.6,
  },
  thumbRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  statRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stat: {
    flex: 1,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    gap: Spacing.half,
  },
  cta: {
    marginTop: Spacing.two,
  },
});
