import {
  buildStop,
  buildTrip,
  dominantValue,
  formatTripDateRange,
  segmentPhotosIntoTrips,
  segmentTripIntoStops,
} from '@stamped/shared';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GhostButton, IconButton, PrimaryButton } from '@/components/ui/buttons';
import { PhoneFrame } from '@/components/ui/phone-frame';
import { ScreenHeader } from '@/components/ui/screen-header';
import { StepProgress } from '@/components/ui/step-progress';
import { Card, Chip, InfoStrip, Pill, SectionLabel } from '@/components/ui/surfaces';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { useTripArchive } from './archive';
import type {
  CandidatePhoto,
  PhotoResult,
  PhotoSource,
  StopGroup,
  TripDetails,
  TripGroup,
} from './types';

// No auth system yet this milestone (see CLAUDE.md) — placeholder until real user ids exist.
const LOCAL_USER_ID = 'local-device-user';

const CATEGORIES = ['Couple', 'Solo', 'Family', 'Group', 'Business', 'Other'];

type Step = 'select' | 'reading' | 'trips' | 'validate' | 'itinerary' | 'done';

/** Progress-bar position for each step of the flow. */
const STEP_INDEX: Record<Step, number> = {
  select: 0,
  reading: 0,
  trips: 1,
  validate: 1,
  itinerary: 1,
  done: 2,
};

/** "Sat 30 May" from a YYYY-MM-DD day key. */
function formatDayHeading(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** One figure from the celebration stat row. */
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

/** Square thumbnail; falls back to a solid tile when the source has no image. */
function Thumb({ photo, size = 56 }: { photo: { uri: string | null; color?: string }; size?: number }) {
  const theme = useTheme();
  const style = { width: size, height: size, borderRadius: Radius.small };

  if (!photo.uri) {
    return <View style={[style, { backgroundColor: photo.color ?? theme.accentLight }]} />;
  }
  return <Image source={{ uri: photo.uri }} style={style} contentFit="cover" />;
}

export function TripFlow({ source, onExit }: { source: PhotoSource; onExit?: () => void }) {
  const theme = useTheme();
  const { stamp } = useTripArchive();

  const [step, setStep] = useState<Step>('select');
  const [candidates, setCandidates] = useState<CandidatePhoto[] | null>(null);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [tripGroups, setTripGroups] = useState<TripGroup[]>([]);
  const [details, setDetails] = useState<Record<string, TripDetails>>({});
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  /** Names the user has accepted or typed, keyed by stop id. */
  const [stopNames, setStopNames] = useState<Record<string, string>>({});
  /** Why place lookup produced nothing, when it produced nothing. */
  const [geocodeDiagnosis, setGeocodeDiagnosis] = useState<string | null>(null);
  /**
   * Which screen opened the itinerary, so its back button returns there.
   * It's reachable both from a trip card and from the details step; sending
   * everyone to details drops you on a screen you never visited.
   */
  const [itineraryOrigin, setItineraryOrigin] = useState<'trips' | 'validate'>('validate');
  /**
   * Trips the user has deselected on the detection screen. Tracking the
   * excluded set rather than the included one means newly detected trips are
   * selected by default, which is what the prototype shows.
   */
  const [excludedTripIds, setExcludedTripIds] = useState<Set<string>>(new Set());

  const granted = source.permission?.granted ?? false;

  useEffect(() => {
    if (!granted || candidates !== null || loadingCandidates) return;
    setLoadingCandidates(true);
    source
      .loadCandidates()
      .then(setCandidates)
      .finally(() => setLoadingCandidates(false));
  }, [granted, candidates, loadingCandidates, source]);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set((candidates ?? []).map((c) => c.id)));
  }, [candidates]);

  /** Read metadata for the selection, then cluster + geocode into trips. */
  const analyse = useCallback(async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    setStep('reading');
    setProgress({ completed: 0, total: ids.length });
    setGeocodeDiagnosis(null);

    // First reason place lookup came back empty, kept so the itinerary can
    // explain itself instead of showing a screen of blank fields.
    let diagnosis: string | null = null;

    const results = await source.readMeta(ids, (completed, total) =>
      setProgress({ completed, total }),
    );

    const groups = segmentPhotosIntoTrips(results.map((r) => r.meta));
    const byAssetId = new Map(results.map((r) => [r.meta.assetId, r]));

    const built = await Promise.all(
      groups.map(async (group, index): Promise<TripGroup> => {
        const tripId = `${LOCAL_USER_ID}-trip-${group[0].capturedAt}-${index}`;

        // Geocode once per stop rather than once per photo: a place visited
        // is what the itinerary lists, and the OS geocoder is slow enough
        // that the difference is very noticeable on a real trip.
        const stops: StopGroup[] = await Promise.all(
          segmentTripIntoStops(group).map(async (stopPhotos, stopIndex) => {
            const stop = buildStop(stopPhotos, {
              tripId,
              stopId: `${tripId}-stop-${stopIndex}`,
              order: stopIndex,
            });

            if (stop.lat != null && stop.lng != null) {
              try {
                const place = await source.reverseGeocode({ lat: stop.lat, lng: stop.lng });
                stop.suggestedName = place.name ?? place.city;
                stop.city = place.city;
                stop.country = place.country;
                if (stop.suggestedName == null) {
                  // The lookup succeeded but had nothing to say about this
                  // point — distinct from it failing outright.
                  diagnosis ??= 'the geocoder returned no match for these coordinates';
                }
              } catch (error) {
                // Offline, or no working geocoder. Leave the stop unnamed so
                // the user can type one, rather than failing the whole run —
                // but keep why, so the UI isn't left guessing.
                diagnosis ??= error instanceof Error ? error.message : String(error);
              }
            }

            return {
              stop,
              photos: stopPhotos
                .map((p) => byAssetId.get(p.assetId))
                .filter((r): r is PhotoResult => r != null),
            };
          }),
        );

        // The trip takes its name from wherever most of it happened.
        const country = dominantValue(stops.map((s) => s.stop.country));
        const city = dominantValue(stops.map((s) => s.stop.city));

        const trip = buildTrip(group, { userId: LOCAL_USER_ID, tripId, city, country });
        const ids = new Set(group.map((p) => p.assetId));
        return { trip, photos: results.filter((r) => ids.has(r.meta.assetId)), stops };
      }),
    );

    setGeocodeDiagnosis(diagnosis);
    setTripGroups(built);
    setDetails(
      Object.fromEntries(built.map((g) => [g.trip.id, { title: g.trip.title, category: 'Group' }])),
    );
    setStep('trips');
  }, [selectedIds, source]);

  const toggleTripIncluded = useCallback((tripId: string) => {
    setExcludedTripIds((previous) => {
      const next = new Set(previous);
      if (next.has(tripId)) next.delete(tripId);
      else next.add(tripId);
      return next;
    });
  }, []);

  const restart = useCallback(() => {
    setSelectedIds(new Set());
    setExcludedTripIds(new Set());
    setTripGroups([]);
    setDetails({});
    setStopNames({});
    setGeocodeDiagnosis(null);
    setEditingTripId(null);
    setStep('select');
  }, []);

  const editingGroup = useMemo(
    () => tripGroups.find((g) => g.trip.id === editingTripId) ?? null,
    [tripGroups, editingTripId],
  );

  // ── Permission gate ────────────────────────────────────────────────
  if (source.permission === null) {
    return (
      <PhoneFrame>
        <ScreenHeader title="Your trips" subtitle="checking permissions" />
        <ThemedView style={styles.centered}>
          <ThemedText type="small" themeColor="textSecondary">
            Checking photo permission…
          </ThemedText>
        </ThemedView>
      </PhoneFrame>
    );
  }

  if (!granted) {
    return (
      <PhoneFrame>
        <ScreenHeader title="Your trips" subtitle="a quick permission" />
        <ThemedView style={styles.centered}>
          <ThemedText style={styles.bigEmoji}>📸</ThemedText>
          <ThemedText type="cardTitle" style={styles.centerText}>
            Photo access needed
          </ThemedText>
          <InfoStrip>
            We&apos;ll find your past trips automatically from your camera roll. Everything is read
            on your device — nothing is uploaded.
          </InfoStrip>
          <PrimaryButton
            label={source.permission.canAskAgain ? 'Allow photos' : 'Open Settings'}
            onPress={source.permission.canAskAgain ? source.requestPermission : source.openSettings}
          />
        </ThemedView>
      </PhoneFrame>
    );
  }

  // ── Step: reading GPS (progress) ───────────────────────────────────
  if (step === 'reading') {
    const pct = progress.total ? Math.round((progress.completed / progress.total) * 100) : 0;
    return (
      <PhoneFrame>
        <ScreenHeader title="Reading photos" subtitle="finding where you were" />
        <StepProgress steps={3} current={STEP_INDEX.reading} />
        <ThemedView style={styles.centered}>
          <ThemedText type="title" themeColor="brand">
            {pct}%
          </ThemedText>
          <ThemedView style={[styles.progressTrack, { backgroundColor: theme.borderMid }]}>
            <ThemedView
              style={[styles.progressFill, { backgroundColor: theme.brand, width: `${pct}%` }]}
            />
          </ThemedView>
          <ThemedText type="small" themeColor="textSecondary">
            Reading photo {progress.completed} of {progress.total}
          </ThemedText>
          <InfoStrip>Reading location and time from each photo, on your device.</InfoStrip>
        </ThemedView>
      </PhoneFrame>
    );
  }

  // ── Step: validate one trip ────────────────────────────────────────
  if (step === 'validate' && editingGroup) {
    const current = details[editingGroup.trip.id];
    const withGps = editingGroup.photos.filter((p) => p.meta.hasGps).length;

    return (
      <PhoneFrame>
        <ScreenHeader
          title="Add trip details"
          subtitle={`${editingGroup.trip.photoCount} photos detected`}
          onBack={() => setStep('trips')}
        />
        <StepProgress steps={3} current={STEP_INDEX.validate} />
        <ScrollView contentContainerStyle={styles.body}>
          <ThemedText type="small" themeColor="textSecondary">
            Step 2 of 3
          </ThemedText>
          <ThemedText type="cardTitle">Where did you go?</ThemedText>

          <SectionLabel>Place</SectionLabel>
          <ThemedView type="backgroundElement" style={[styles.field, { borderColor: theme.accent }]}>
            <TextInput
              value={current?.title ?? ''}
              onChangeText={(text) =>
                setDetails((d) => ({
                  ...d,
                  [editingGroup.trip.id]: { ...d[editingGroup.trip.id], title: text },
                }))
              }
              placeholder="Name this trip"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text }]}
            />
            {editingGroup.trip.primaryCity && <Pill label="auto" />}
          </ThemedView>

          <SectionLabel>Dates</SectionLabel>
          <ThemedView type="backgroundElement" style={[styles.field, { borderColor: theme.accent }]}>
            <ThemedText type="small">
              {formatTripDateRange(editingGroup.trip.startAt, editingGroup.trip.endAt)}
            </ThemedText>
            <Pill label="auto" />
          </ThemedView>

          <SectionLabel>Trip category</SectionLabel>
          <View style={styles.chipRow}>
            {CATEGORIES.map((c) => (
              <Chip
                key={c}
                label={c}
                selected={current?.category === c}
                onPress={() =>
                  setDetails((d) => ({
                    ...d,
                    [editingGroup.trip.id]: { ...d[editingGroup.trip.id], category: c },
                  }))
                }
              />
            ))}
          </View>

          <SectionLabel>Photos in this trip</SectionLabel>
          <View style={styles.thumbRow}>
            {editingGroup.photos.slice(0, 5).map((p) => (
              <Thumb key={p.meta.assetId} photo={p} />
            ))}
            {editingGroup.photos.length > 5 && (
              <ThemedView type="accentLight" style={styles.moreTile}>
                <ThemedText type="small" themeColor="brand">
                  +{editingGroup.photos.length - 5}
                </ThemedText>
              </ThemedView>
            )}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {withGps} of {editingGroup.trip.photoCount} have location data
          </ThemedText>

          <PrimaryButton
            label="Next — review places"
            onPress={() => {
              setItineraryOrigin('validate');
              setStep('itinerary');
            }}
            style={styles.cta}
          />
        </ScrollView>
      </PhoneFrame>
    );
  }

  // ── Step: itinerary — approve the suggested places ─────────────────
  if (step === 'itinerary' && editingGroup) {
    const days = [...new Set(editingGroup.stops.map((s) => s.stop.day))].sort();

    return (
      <PhoneFrame>
        <ScreenHeader
          title="Where you went"
          subtitle={`${editingGroup.stops.length} stops · ${days.length} day${days.length === 1 ? '' : 's'}`}
          onBack={() => setStep(itineraryOrigin)}
        />
        <StepProgress steps={3} current={STEP_INDEX.itinerary} />
        <ScrollView contentContainerStyle={styles.body}>
          <ThemedText type="small" themeColor="textSecondary">
            Step 3 of 3
          </ThemedText>
          <ThemedText type="cardTitle">Check the places</ThemedText>
          <InfoStrip>
            Suggested from each photo&apos;s location, on your device. Tap a name to change it.
          </InfoStrip>

          {/*
            Every stop has coordinates but none got a name back — the device's
            geocoder isn't answering. Say so, otherwise a screen full of empty
            fields reads as a bug in the app. This is the normal state on an
            Android emulator, which has no working geocoder backend.
          */}
          {editingGroup.stops.length > 0 &&
            editingGroup.stops.every((s) => s.stop.lat != null && s.stop.suggestedName == null) && (
              <InfoStrip>
                <ThemedText type="small">
                  Place lookup isn&apos;t available on this device, so nothing could be suggested.
                  Your photos&apos; locations were still read — you can name each stop yourself.
                  {geocodeDiagnosis ? ` (${geocodeDiagnosis})` : ''}
                </ThemedText>
              </InfoStrip>
            )}

          {days.map((day) => (
            <View key={day}>
              <SectionLabel>{formatDayHeading(day)}</SectionLabel>
              {editingGroup.stops
                .filter((s) => s.stop.day === day)
                .map(({ stop, photos }) => {
                  const value = stopNames[stop.id] ?? stop.suggestedName ?? '';
                  const approved = stopNames[stop.id] != null;
                  return (
                    <Card key={stop.id}>
                      <View style={styles.stopRow}>
                        <ThemedText type="small" themeColor="textSecondary" style={styles.stopTime}>
                          {formatTime(stop.startAt)}
                        </ThemedText>
                        <View style={styles.stopBody}>
                          <ThemedView
                            type="backgroundElement"
                            style={[styles.field, { borderColor: theme.accent }]}>
                            <TextInput
                              value={value}
                              onChangeText={(text) =>
                                setStopNames((n) => ({ ...n, [stop.id]: text }))
                              }
                              placeholder={
                                stop.needsManualPlace
                                  ? 'No location — name it'
                                  : stop.suggestedName == null
                                    ? 'Not found — name it'
                                    : 'Name this place'
                              }
                              placeholderTextColor={theme.textSecondary}
                              style={[styles.input, { color: theme.text }]}
                            />
                            {approved ? (
                              <Pill label="✓" />
                            ) : stop.suggestedName ? (
                              <Pill label="suggested" />
                            ) : null}
                          </ThemedView>

                          <ThemedText type="small" themeColor="textSecondary">
                            {[stop.city, stop.country].filter(Boolean).join(', ') ||
                              (stop.lat != null
                                ? `${stop.lat.toFixed(4)}, ${stop.lng!.toFixed(4)}`
                                : 'No location data')}
                            {' · '}
                            {stop.photoCount} photo{stop.photoCount === 1 ? '' : 's'}
                          </ThemedText>

                          <View style={styles.thumbRow}>
                            {photos.slice(0, 4).map((p) => (
                              <Thumb key={p.meta.assetId} photo={p} size={44} />
                            ))}
                          </View>

                          {!approved && (
                            <GhostButton
                              label={stop.suggestedName ? 'Approve' : 'Save name'}
                              onPress={() =>
                                setStopNames((n) => ({ ...n, [stop.id]: value }))
                              }
                            />
                          )}
                        </View>
                      </View>
                    </Card>
                  );
                })}
            </View>
          ))}

          {/*
            Always forward to the trip list — never back to `itineraryOrigin`.
            Coming from the details step, returning there means its "Next"
            button lands you straight back on the itinerary, and the two
            screens bounce off each other with no way out. Only the header's
            back arrow retraces where you came from.
          */}
          <PrimaryButton label="Done" onPress={() => setStep('trips')} style={styles.cta} />
        </ScrollView>
      </PhoneFrame>
    );
  }

  // ── Step: detected trips ───────────────────────────────────────────
  if (step === 'trips') {
    const totalPhotos = tripGroups.reduce((n, g) => n + g.trip.photoCount, 0);
    const included = tripGroups.filter((g) => !excludedTripIds.has(g.trip.id));
    return (
      <PhoneFrame>
        <ScreenHeader title="We found your trips" subtitle={`${tripGroups.length} trips detected`} />
        <StepProgress steps={3} current={STEP_INDEX.trips} />
        <ScrollView contentContainerStyle={styles.body}>
          <InfoStrip>
            We grouped {totalPhotos} photos into {tripGroups.length} trips by where and when they
            were taken. Tap ✎ to add details.
          </InfoStrip>

          {tripGroups.map(({ trip, photos, stops }) => {
            const detail = details[trip.id];
            const noGps = photos.filter((p) => !p.meta.hasGps).length;
            const isIncluded = !excludedTripIds.has(trip.id);
            return (
              <Card key={trip.id} style={isIncluded ? undefined : styles.excluded}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderText}>
                    <ThemedText type="cardTitle">{detail?.title || trip.title}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatTripDateRange(trip.startAt, trip.endAt)} · {trip.photoCount} photos
                    </ThemedText>
                    {trip.country && (
                      <ThemedText type="small" themeColor="textSecondary">
                        📍 {trip.primaryCity ? `${trip.primaryCity}, ${trip.country}` : trip.country}
                      </ThemedText>
                    )}
                  </View>
                  <View style={styles.cardActions}>
                    <IconButton
                      glyph={isIncluded ? '✓' : '＋'}
                      accessibilityLabel={
                        isIncluded
                          ? `Don't stamp ${detail?.title || trip.title}`
                          : `Stamp ${detail?.title || trip.title}`
                      }
                      onPress={() => toggleTripIncluded(trip.id)}
                    />
                    <IconButton
                      glyph="✎"
                      accessibilityLabel={`Edit details for ${detail?.title || trip.title}`}
                      onPress={() => {
                        setEditingTripId(trip.id);
                        setStep('validate');
                      }}
                    />
                  </View>
                </View>

                <View style={styles.thumbRow}>
                  {photos.slice(0, 4).map((p) => (
                    <Thumb key={p.meta.assetId} photo={p} size={52} />
                  ))}
                  {photos.length > 4 && (
                    <ThemedView type="accentLight" style={[styles.moreTile, styles.moreTileSmall]}>
                      <ThemedText type="small" themeColor="brand">
                        +{photos.length - 4}
                      </ThemedText>
                    </ThemedView>
                  )}
                </View>

                <View style={styles.pillRow}>
                  {detail?.category && <Pill label={detail.category} />}
                  {noGps > 0 && <Pill label={`${noGps} without GPS`} />}
                </View>

                {/*
                  The itinerary was previously only reachable by going through
                  the details step, which made it feel like part of editing
                  rather than something you can just look at.
                */}
                {stops.length > 0 && (
                  <GhostButton
                    label={`View itinerary — ${stops.length} stop${stops.length === 1 ? '' : 's'}`}
                    onPress={() => {
                      setEditingTripId(trip.id);
                      setItineraryOrigin('trips');
                      setStep('itinerary');
                    }}
                  />
                )}
              </Card>
            );
          })}

          <PrimaryButton
            label={`✦ Stamp ${included.length} ${included.length === 1 ? 'trip' : 'trips'}`}
            disabled={included.length === 0}
            onPress={() => {
              stamp(included, details, stopNames);
              setStep('done');
            }}
            style={styles.cta}
          />
          <GhostButton label="Start over" onPress={restart} />
        </ScrollView>
      </PhoneFrame>
    );
  }

  // ── Step: done / stamped ───────────────────────────────────────────
  if (step === 'done') {
    // Only what was actually stamped — a deselected trip must not appear on
    // the celebration screen.
    const stamped = tripGroups.filter((g) => !excludedTripIds.has(g.trip.id));
    const stampedPhotos = stamped.reduce((n, g) => n + g.trip.photoCount, 0);
    const stampedStops = stamped.reduce((n, g) => n + g.stops.length, 0);
    return (
      <PhoneFrame>
        <ScreenHeader
          title={stamped.length === 1 ? 'Trip stamped!' : `${stamped.length} trips stamped!`}
          subtitle="added to your archive"
          onBack={() => setStep('trips')}
        />
        <StepProgress steps={3} current={STEP_INDEX.done} />
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.statRow}>
            <Stat value={String(stamped.length)} label={stamped.length === 1 ? 'trip' : 'trips'} />
            <Stat value={String(stampedPhotos)} label="photos" />
            <Stat value={String(stampedStops)} label="stops" />
          </View>

          {stamped.map(({ trip }) => {
            const detail = details[trip.id];
            return (
              <ThemedView key={trip.id} style={styles.stampWrapper}>
                <ThemedView style={[styles.stamp, { borderColor: theme.brand }]}>
                  <ThemedText type="cardTitle" themeColor="brand" style={styles.stampTitle}>
                    {(detail?.title || trip.title).toUpperCase()}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatTripDateRange(trip.startAt, trip.endAt)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {trip.photoCount} photos
                  </ThemedText>
                </ThemedView>
              </ThemedView>
            );
          })}
          <InfoStrip>
            These trips live only on this device for now — saving to your account comes in a later
            milestone.
          </InfoStrip>
          {onExit && <PrimaryButton label="View my archive" onPress={onExit} style={styles.cta} />}
          <GhostButton label="Stamp more trips" onPress={restart} />
          <GhostButton label="Back to detected trips" onPress={() => setStep('trips')} />
        </ScrollView>
      </PhoneFrame>
    );
  }

  // ── Step: select photos ────────────────────────────────────────────
  return (
    <PhoneFrame>
      <ScreenHeader
        title="Select photos"
        subtitle={loadingCandidates ? 'loading your library…' : `${selectedIds.size} selected`}
      />
      <StepProgress steps={3} current={STEP_INDEX.select} />
      <ScrollView contentContainerStyle={styles.body}>
        <InfoStrip>
          Pick the photos you want grouped into trips. We read each photo&apos;s time and location
          on your device — nothing is uploaded.
        </InfoStrip>

        {/*
          Limited access looks exactly like an empty library from in here, so
          say so plainly and offer the way out rather than leaving the user
          staring at photos that "should" be there.
        */}
        {source.permission?.accessPrivileges === 'limited' && (
          <InfoStrip>
            <ThemedText type="small">
              Only the photos you specifically shared are visible to Stamped
              {candidates ? ` (${candidates.length})` : ''}. Tap below to share more.
            </ThemedText>
          </InfoStrip>
        )}
        {source.permission?.accessPrivileges === 'limited' && source.presentPicker && (
          <GhostButton label="Select more photos" onPress={source.presentPicker} />
        )}

        {candidates && candidates.length > 0 && (
          <>
            <View style={styles.selectAllRow}>
              <SectionLabel>{`${candidates.length} photos visible`}</SectionLabel>
              <GhostButton label="Select all" onPress={selectAll} style={styles.selectAll} />
            </View>
            <View style={styles.grid}>
              {candidates.map((photo) => {
                const selected = selectedIds.has(photo.id);
                return (
                  <View key={photo.id} style={styles.gridItem}>
                    <Card
                      selected={selected}
                      onPress={() => toggleSelected(photo.id)}
                      style={styles.gridCard}>
                      <Thumb photo={photo} size={96} />
                      {selected && (
                        <ThemedView type="brand" style={styles.check}>
                          <ThemedText type="smallBold" themeColor="onBrand">
                            ✓
                          </ThemedText>
                        </ThemedView>
                      )}
                    </Card>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {candidates && candidates.length === 0 && !loadingCandidates && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
            No photos found in your library.
          </ThemedText>
        )}

        <PrimaryButton
          label={`Find trips in ${selectedIds.size} photo${selectedIds.size === 1 ? '' : 's'}`}
          disabled={selectedIds.size === 0}
          onPress={analyse}
          style={styles.cta}
        />
      </ScrollView>
    </PhoneFrame>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.six,
    gap: Spacing.two,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  centerText: {
    textAlign: 'center',
  },
  bigEmoji: {
    fontSize: 48,
    lineHeight: 56,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: Radius.small,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.small,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  cardHeaderText: {
    flex: 1,
    gap: Spacing.half,
  },
  thumbRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  moreTile: {
    width: 56,
    height: 56,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreTileSmall: {
    width: 52,
    height: 52,
  },
  pillRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: Spacing.one,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectAll: {
    alignSelf: 'flex-end',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  gridItem: {
    width: '31%',
  },
  gridCard: {
    padding: Spacing.one,
    alignItems: 'center',
  },
  check: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.one,
  },
  cta: {
    marginTop: Spacing.three,
  },
  cardActions: {
    flexDirection: 'row',
    gap: Spacing.one,
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
  // Deselected trips stay visible but recede — they're skipped, not deleted.
  excluded: {
    opacity: 0.5,
  },
  stopRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stopTime: {
    // Wide enough for a 12-hour time with AM/PM on one line ("11:35 AM");
    // at 52 it wrapped mid-meridiem.
    width: 72,
    paddingTop: Spacing.three,
  },
  stopBody: {
    flex: 1,
    gap: Spacing.two,
  },
  stampWrapper: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  stamp: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
    padding: Spacing.three,
  },
  stampTitle: {
    letterSpacing: 2,
    textAlign: 'center',
  },
});
