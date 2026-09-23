import { formatTripDateRange } from '@stamped/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PrimaryButton } from '@/components/ui/buttons';
import { PhoneFrame } from '@/components/ui/phone-frame';
import { Card, InfoStrip, Pill, SectionLabel } from '@/components/ui/surfaces';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session';
import { SettingsScreen } from '@/features/settings/settings-screen';
import { archiveSummary, useTripArchive } from '@/features/trips/archive';
import { MoreTile, Thumb } from '@/features/trips/thumb';

/** First name only — "Meera Rao" → "Meera". */
function firstName(name: string): string {
  return name.split(' ')[0];
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const { trips, requestTrip, loading, saveError } = useTripArchive();
  const summary = archiveSummary(trips);
  const hasTrips = trips.length > 0;

  // Settings is a mode of this tab, not a route — same reasoning as the trip
  // detail inside the Trips tab (see features/trips/trips-experience.tsx).
  const [showSettings, setShowSettings] = useState(false);
  if (showSettings) return <SettingsScreen onClose={() => setShowSettings(false)} />;

  // Tapping a trip opens it in the Trips tab, which owns the detail screen.
  const openTrip = (id: string) => {
    requestTrip(id);
    router.push('/photo-gps');
  };

  return (
    <PhoneFrame>
      <ThemedView type="brand" style={[styles.header, { paddingTop: insets.top + Spacing.three }]}>
        <ThemedText type="wordmark" themeColor="onBrand">
          STAMPED
        </ThemedText>
        <ThemedText type="small" themeColor="accent" style={styles.headerSub}>
          {hasTrips
            ? `${summary.tripCount} stamped · ${summary.countries} ${summary.countries === 1 ? 'country' : 'countries'} · ${summary.photoCount} photos`
            : profile
              ? `${firstName(profile.name)} · ${profile.homeCity}`
              : 'your travel archive'}
        </ThemedText>

        {/* The only way into settings, so it sits where a profile usually does. */}
        <Pressable
          onPress={() => setShowSettings(true)}
          accessibilityRole="button"
          accessibilityLabel="Your account and settings"
          hitSlop={Spacing.two}
          style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}>
          <ThemedText type="small" themeColor="accent">
            ⚙
          </ThemedText>
        </Pressable>
      </ThemedView>

      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + BottomTabInset + Spacing.four },
        ]}>
        {saveError && <InfoStrip>{saveError}</InfoStrip>}

        {hasTrips ? (
          <>
            <ThemedText type="heroTitle">Your travel archive</ThemedText>
            <SectionLabel>Stamped trips</SectionLabel>
            {trips.map((t) => (
              <Card key={t.id} onPress={() => openTrip(t.id)}>
                <View style={styles.tripHeader}>
                  <View style={styles.tripHeaderText}>
                    <ThemedText type="cardTitle">
                      {t.details.title || t.group.trip.title}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatTripDateRange(t.group.trip.startAt, t.group.trip.endAt)} ·{' '}
                      {t.group.trip.photoCount} photos · {t.group.stops.length} stops
                    </ThemedText>
                    {t.group.trip.primaryCity && (
                      <ThemedText type="small" themeColor="textSecondary">
                        📍 {t.group.trip.primaryCity}
                        {t.group.trip.country ? `, ${t.group.trip.country}` : ''}
                      </ThemedText>
                    )}
                  </View>
                  <Pill label="✦ Stamped" tone="brand" />
                </View>
                <View style={styles.thumbRow}>
                  {t.group.photos.slice(0, 4).map((p) => (
                    <Thumb key={p.meta.assetId} photo={p} size={52} />
                  ))}
                  {t.group.photos.length > 4 && (
                    <MoreTile count={t.group.photos.length - 4} size={52} />
                  )}
                </View>
              </Card>
            ))}

            <PrimaryButton
              label="Find more trips"
              onPress={() => router.push('/photo-gps')}
              style={styles.cta}
            />
            <InfoStrip>
              Stamped trips are saved to your account, so they&apos;re here next time. The photos
              themselves stay on this phone — only what was read from them is stored.
            </InfoStrip>
          </>
        ) : (
          <>
            <ThemedText type="heroTitle">Let&apos;s find your trips</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Stamped reads the time and place from photos already on your phone and groups them
              into trips. Nothing is uploaded.
            </ThemedText>

            <PrimaryButton
              label="Find my trips"
              onPress={() => router.push('/photo-gps')}
              style={styles.cta}
            />

            {loading && (
              <ThemedText type="small" themeColor="textSecondary">
                Checking your account for trips you&apos;ve already stamped…
              </ThemedText>
            )}

            <SectionLabel>How it works</SectionLabel>
            {[
              { step: '1', title: 'Pick photos', body: 'Choose the photos you want grouped.' },
              { step: '2', title: 'Read location', body: 'GPS and timestamps are read on-device.' },
              { step: '3', title: 'Group into trips', body: 'Photos cluster by where and when.' },
            ].map((item) => (
              <Card key={item.step}>
                <View style={styles.stepRow}>
                  <ThemedView type="accentLight" style={styles.stepBadge}>
                    <ThemedText type="smallBold" themeColor="brand">
                      {item.step}
                    </ThemedText>
                  </ThemedView>
                  <View style={styles.stepText}>
                    <ThemedText type="smallBold">{item.title}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {item.body}
                    </ThemedText>
                  </View>
                </View>
              </Card>
            ))}

            <InfoStrip>
              Stamped trips will collect here once you&apos;ve found some.
            </InfoStrip>
          </>
        )}
      </ScrollView>
    </PhoneFrame>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingBottom: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  settingsButton: {
    position: 'absolute',
    right: Spacing.three,
    bottom: Spacing.three,
    padding: Spacing.one,
  },
  pressed: {
    opacity: 0.6,
  },
  headerSub: {
    marginTop: Spacing.half,
  },
  body: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cta: {
    marginVertical: Spacing.three,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
    gap: Spacing.half,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  tripHeaderText: {
    flex: 1,
    gap: Spacing.half,
  },
  thumbRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
});
