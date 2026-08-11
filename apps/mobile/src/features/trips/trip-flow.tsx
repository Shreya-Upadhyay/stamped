import { buildTrip, computeCentroid, segmentPhotosIntoTrips } from '@stamped/shared';
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

import type { CandidatePhoto, PhotoResult, PhotoSource, TripDetails, TripGroup } from './types';

// No auth system yet this milestone (see CLAUDE.md) — placeholder until real user ids exist.
const LOCAL_USER_ID = 'local-device-user';

const CATEGORIES = ['Couple', 'Solo', 'Family', 'Group', 'Business', 'Other'];

type Step = 'select' | 'reading' | 'trips' | 'validate' | 'done';

/** Progress-bar position for each step of the flow. */
const STEP_INDEX: Record<Step, number> = {
  select: 0,
  reading: 0,
  trips: 1,
  validate: 1,
  done: 2,
};

function formatDateRange(startAt: number, endAt: number): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const start = new Date(startAt).toLocaleDateString(undefined, opts);
  const end = new Date(endAt).toLocaleDateString(undefined, opts);
  const year = new Date(endAt).getFullYear();
  return start === end ? `${start} ${year}` : `${start} – ${end} ${year}`;
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

export function TripFlow({ source }: { source: PhotoSource }) {
  const theme = useTheme();

  const [step, setStep] = useState<Step>('select');
  const [candidates, setCandidates] = useState<CandidatePhoto[] | null>(null);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [tripGroups, setTripGroups] = useState<TripGroup[]>([]);
  const [details, setDetails] = useState<Record<string, TripDetails>>({});
  const [editingTripId, setEditingTripId] = useState<string | null>(null);

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

    const results = await source.readMeta(ids, (completed, total) =>
      setProgress({ completed, total }),
    );

    const groups = segmentPhotosIntoTrips(results.map((r) => r.meta));
    const built = await Promise.all(
      groups.map(async (group, index): Promise<TripGroup> => {
        const tripId = `${LOCAL_USER_ID}-trip-${group[0].capturedAt}-${index}`;
        const centroid = computeCentroid(
          group
            .filter((p) => p.hasGps && p.lat != null && p.lng != null)
            .map((p) => ({ lat: p.lat!, lng: p.lng! })),
        );

        let city: string | null = null;
        let country: string | null = null;
        if (centroid) {
          try {
            const place = await source.reverseGeocode(centroid);
            city = place.city;
            country = place.country;
          } catch {
            // Geocoder unavailable/offline — degrade to no place name, don't fail the flow.
          }
        }

        const trip = buildTrip(group, { userId: LOCAL_USER_ID, tripId, city, country });
        const ids = new Set(group.map((p) => p.assetId));
        return { trip, photos: results.filter((r) => ids.has(r.meta.assetId)) };
      }),
    );

    setTripGroups(built);
    setDetails(
      Object.fromEntries(built.map((g) => [g.trip.id, { title: g.trip.title, category: 'Group' }])),
    );
    setStep('trips');
  }, [selectedIds, source]);

  const restart = useCallback(() => {
    setSelectedIds(new Set());
    setTripGroups([]);
    setDetails({});
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
              {formatDateRange(editingGroup.trip.startAt, editingGroup.trip.endAt)}
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

          <PrimaryButton label="Save details" onPress={() => setStep('trips')} style={styles.cta} />
        </ScrollView>
      </PhoneFrame>
    );
  }

  // ── Step: detected trips ───────────────────────────────────────────
  if (step === 'trips') {
    const totalPhotos = tripGroups.reduce((n, g) => n + g.trip.photoCount, 0);
    return (
      <PhoneFrame>
        <ScreenHeader title="We found your trips" subtitle={`${tripGroups.length} trips detected`} />
        <StepProgress steps={3} current={STEP_INDEX.trips} />
        <ScrollView contentContainerStyle={styles.body}>
          <InfoStrip>
            We grouped {totalPhotos} photos into {tripGroups.length} trips by where and when they
            were taken. Tap ✎ to add details.
          </InfoStrip>

          {tripGroups.map(({ trip, photos }) => {
            const detail = details[trip.id];
            const noGps = photos.filter((p) => !p.meta.hasGps).length;
            return (
              <Card key={trip.id}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderText}>
                    <ThemedText type="cardTitle">{detail?.title || trip.title}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatDateRange(trip.startAt, trip.endAt)} · {trip.photoCount} photos
                    </ThemedText>
                    {trip.country && (
                      <ThemedText type="small" themeColor="textSecondary">
                        📍 {trip.primaryCity ? `${trip.primaryCity}, ${trip.country}` : trip.country}
                      </ThemedText>
                    )}
                  </View>
                  <IconButton
                    glyph="✎"
                    accessibilityLabel={`Edit details for ${detail?.title || trip.title}`}
                    onPress={() => {
                      setEditingTripId(trip.id);
                      setStep('validate');
                    }}
                  />
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
              </Card>
            );
          })}

          <PrimaryButton
            label={`Stamp ${tripGroups.length} trip${tripGroups.length === 1 ? '' : 's'}`}
            onPress={() => setStep('done')}
            style={styles.cta}
          />
          <GhostButton label="Start over" onPress={restart} />
        </ScrollView>
      </PhoneFrame>
    );
  }

  // ── Step: done / stamped ───────────────────────────────────────────
  if (step === 'done') {
    return (
      <PhoneFrame>
        <ScreenHeader title="Trips stamped!" subtitle="added to your archive" />
        <StepProgress steps={3} current={STEP_INDEX.done} />
        <ScrollView contentContainerStyle={styles.body}>
          {tripGroups.map(({ trip }) => {
            const detail = details[trip.id];
            return (
              <ThemedView key={trip.id} style={styles.stampWrapper}>
                <ThemedView style={[styles.stamp, { borderColor: theme.brand }]}>
                  <ThemedText type="cardTitle" themeColor="brand" style={styles.stampTitle}>
                    {(detail?.title || trip.title).toUpperCase()}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatDateRange(trip.startAt, trip.endAt)}
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
          <PrimaryButton label="Done" onPress={restart} style={styles.cta} />
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
