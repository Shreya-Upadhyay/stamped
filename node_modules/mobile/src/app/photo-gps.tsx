import { buildTrip, computeCentroid, PhotoMeta, segmentPhotosIntoTrips, Trip } from '@stamped/shared';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Linking, Platform, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const CANDIDATE_LIMIT = 60;

// No auth system yet this milestone (see CLAUDE.md) — placeholder until real user ids exist.
const LOCAL_USER_ID = 'local-device-user';

type CandidatePhoto = {
  asset: MediaLibrary.Asset;
  uri: string;
  filename: string;
};

// `filename` is a UI-only display convenience, not part of the PhotoMeta contract.
type PhotoResult = {
  meta: PhotoMeta;
  filename: string;
};

type TripGroup = {
  trip: Trip;
  photos: PhotoResult[];
};

export default function PhotoGpsScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };
  const theme = useTheme();

  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions({
    granularPermissions: ['photo'],
  });
  const [candidates, setCandidates] = useState<CandidatePhoto[] | null>(null);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<PhotoResult[] | null>(null);
  const [readingGps, setReadingGps] = useState(false);
  const [trips, setTrips] = useState<TripGroup[] | null>(null);
  const [groupingTrips, setGroupingTrips] = useState(false);

  const loadCandidates = useCallback(async () => {
    setLoadingCandidates(true);
    try {
      const assets = await new MediaLibrary.Query()
        .eq(MediaLibrary.AssetField.MEDIA_TYPE, MediaLibrary.MediaType.IMAGE)
        .orderBy({ key: MediaLibrary.AssetField.CREATION_TIME, ascending: false })
        .limit(CANDIDATE_LIMIT)
        .exe();

      const resolved = await Promise.all(
        assets.map(async (asset): Promise<CandidatePhoto> => {
          const [uri, filename] = await Promise.all([asset.getUri(), asset.getFilename()]);
          return { asset, uri, filename };
        }),
      );
      setCandidates(resolved);
    } finally {
      setLoadingCandidates(false);
    }
  }, []);

  useEffect(() => {
    if (permissionResponse?.granted && candidates === null && !loadingCandidates) {
      loadCandidates();
    }
  }, [permissionResponse?.granted, candidates, loadingCandidates, loadCandidates]);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const readSelectedGps = useCallback(async () => {
    if (!candidates) return;
    setReadingGps(true);
    setTrips(null);
    try {
      const selected = candidates.filter((candidate) => selectedIds.has(candidate.asset.id));
      const entries = await Promise.all(
        selected.map(async ({ asset, filename }): Promise<PhotoResult> => {
          const [location, creationTime] = await Promise.all([
            asset.getLocation(),
            asset.getCreationTime(),
          ]);
          const meta: PhotoMeta = {
            id: asset.id,
            userId: LOCAL_USER_ID,
            tripId: null,
            assetId: asset.id,
            storagePath: null,
            lat: location?.latitude ?? null,
            lng: location?.longitude ?? null,
            hasGps: location != null,
            capturedAt: creationTime ?? 0,
            city: null,
            region: null,
            country: null,
            source: 'camera_roll',
          };
          return { meta, filename };
        }),
      );
      setResults(entries);
    } finally {
      setReadingGps(false);
    }
  }, [candidates, selectedIds]);

  const groupIntoTrips = useCallback(async () => {
    if (!results || results.length === 0) return;
    setGroupingTrips(true);
    try {
      const groups = segmentPhotosIntoTrips(results.map((r) => r.meta));

      const tripGroups = await Promise.all(
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
              const [address] = await Location.reverseGeocodeAsync({
                latitude: centroid.lat,
                longitude: centroid.lng,
              });
              city = address?.city ?? null;
              country = address?.country ?? null;
            } catch {
              // No network or geocoder unavailable — degrade to null, don't crash the flow.
            }
          }

          const trip = buildTrip(group, { userId: LOCAL_USER_ID, tripId, city, country });
          const groupAssetIds = new Set(group.map((p) => p.assetId));
          const photos = results.filter((r) => groupAssetIds.has(r.meta.assetId));
          return { trip, photos };
        }),
      );

      setTrips(tripGroups);
    } finally {
      setGroupingTrips(false);
    }
  }, [results]);

  const contentPlatformStyle = Platform.select({
    android: {
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right,
      paddingBottom: insets.bottom,
    },
    web: {
      paddingTop: Spacing.six,
      paddingBottom: Spacing.four,
    },
  });

  if (!permissionResponse) {
    return (
      <ThemedView style={styles.centeredContainer}>
        <ThemedText type="small" themeColor="textSecondary">
          Checking photo permission…
        </ThemedText>
      </ThemedView>
    );
  }

  if (!permissionResponse.granted) {
    return (
      <ThemedView style={[styles.centeredContainer, { paddingBottom: insets.bottom }]}>
        <ThemedText type="subtitle" style={styles.centerText}>
          Photo Access Needed
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          Stamped reads each photo&apos;s location and timestamp on your device to group trips.
          Nothing is uploaded.
        </ThemedText>
        <Pressable
          style={({ pressed }) => pressed && styles.pressed}
          onPress={() =>
            permissionResponse.canAskAgain ? requestPermission() : Linking.openSettings()
          }>
          <ThemedView type="backgroundElement" style={styles.actionButton}>
            <ThemedText type="linkPrimary">
              {permissionResponse.canAskAgain ? 'Grant Photo Access' : 'Open Settings'}
            </ThemedText>
          </ThemedView>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <FlatList
      style={[styles.flatList, { backgroundColor: theme.background }]}
      contentInset={insets}
      contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}
      data={candidates ?? []}
      numColumns={3}
      columnWrapperStyle={styles.columnWrapper}
      keyExtractor={(item) => item.asset.id}
      ListHeaderComponent={
        <ThemedView style={styles.headerSection}>
          <ThemedText type="subtitle">Photo GPS</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {loadingCandidates
              ? 'Loading photos…'
              : `Tap photos to select them, then read their GPS data. ${selectedIds.size} selected.`}
          </ThemedText>
        </ThemedView>
      }
      renderItem={({ item }) => {
        const selected = selectedIds.has(item.asset.id);
        return (
          <Pressable
            onPress={() => toggleSelected(item.asset.id)}
            style={[styles.cell, selected && { borderColor: theme.text }]}>
            <Image source={{ uri: item.uri }} style={styles.cellImage} contentFit="cover" />
            {selected && (
              <ThemedView type="backgroundElement" style={styles.selectedBadge}>
                <ThemedText type="smallBold">✓</ThemedText>
              </ThemedView>
            )}
          </Pressable>
        );
      }}
      ListEmptyComponent={
        !loadingCandidates ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
            No photos found in your library.
          </ThemedText>
        ) : null
      }
      ListFooterComponent={
        <ThemedView style={styles.footerSection}>
          <Pressable
            disabled={selectedIds.size === 0 || readingGps}
            onPress={readSelectedGps}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView
              type="backgroundElement"
              style={[
                styles.actionButton,
                (selectedIds.size === 0 || readingGps) && styles.buttonDisabled,
              ]}>
              <ThemedText type="linkPrimary">
                {readingGps ? 'Reading GPS…' : `Read GPS for ${selectedIds.size} selected`}
              </ThemedText>
            </ThemedView>
          </Pressable>

          {results && (
            <ThemedView style={styles.resultsSection}>
              <ThemedText type="smallBold">Results</ThemedText>
              {results.map((entry) => (
                <ThemedView
                  key={entry.meta.assetId}
                  type="backgroundElement"
                  style={styles.resultCard}>
                  <ThemedText type="smallBold">{entry.filename}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {entry.meta.hasGps ? `lat ${entry.meta.lat}, lng ${entry.meta.lng}` : 'No GPS data'}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    hasGps: {String(entry.meta.hasGps)}
                  </ThemedText>
                </ThemedView>
              ))}

              <Pressable
                disabled={groupingTrips}
                onPress={groupIntoTrips}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView
                  type="backgroundElement"
                  style={[styles.actionButton, groupingTrips && styles.buttonDisabled]}>
                  <ThemedText type="linkPrimary">
                    {groupingTrips ? 'Grouping…' : 'Group into Trips'}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </ThemedView>
          )}

          {trips && (
            <ThemedView style={styles.resultsSection}>
              <ThemedText type="smallBold">Trips</ThemedText>
              {trips.map(({ trip, photos }) => (
                <ThemedView key={trip.id} type="backgroundElement" style={styles.tripCard}>
                  <ThemedText type="smallBold">{trip.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {new Date(trip.startAt).toLocaleDateString()} –{' '}
                    {new Date(trip.endAt).toLocaleDateString()} · {trip.photoCount} photo
                    {trip.photoCount === 1 ? '' : 's'}
                  </ThemedText>
                  {trip.country && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {trip.primaryCity ? `${trip.primaryCity}, ${trip.country}` : trip.country}
                    </ThemedText>
                  )}
                  {photos.map((entry) => (
                    <ThemedView key={entry.meta.assetId} type="backgroundSelected" style={styles.resultCard}>
                      <ThemedText type="small">{entry.filename}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {entry.meta.hasGps ? `lat ${entry.meta.lat}, lng ${entry.meta.lng}` : 'No GPS data'}
                      </ThemedText>
                    </ThemedView>
                  ))}
                </ThemedView>
              ))}
            </ThemedView>
          )}
        </ThemedView>
      }
    />
  );
}

const styles = StyleSheet.create({
  flatList: {
    flex: 1,
  },
  contentContainer: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  centerText: {
    textAlign: 'center',
  },
  headerSection: {
    gap: Spacing.one,
    paddingVertical: Spacing.three,
  },
  columnWrapper: {
    gap: Spacing.two,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: Spacing.two,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  cellImage: {
    width: '100%',
    height: '100%',
  },
  selectedBadge: {
    position: 'absolute',
    top: Spacing.one,
    right: Spacing.one,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  footerSection: {
    gap: Spacing.three,
    paddingVertical: Spacing.four,
  },
  actionButton: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
  resultsSection: {
    gap: Spacing.two,
  },
  resultCard: {
    gap: Spacing.half,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  tripCard: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
});
