import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PhoneFrame } from '@/components/ui/phone-frame';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Card, InfoStrip, Pill, SectionLabel } from '@/components/ui/surfaces';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { stopLabel, useTripArchive } from './archive';
import { Thumb } from './thumb';

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

/**
 * The itinerary of a trip that's already been stamped.
 *
 * The prototype paginates by day tabs, which suits a real trip far better than
 * one long scroll — five days of stops is a lot to thumb past.
 */
export function TripItineraryScreen({ tripId, onBack }: { tripId: string; onBack: () => void }) {
  const theme = useTheme();
  const { getTrip, renameStop } = useTripArchive();
  const trip = getTrip(tripId);

  const days = useMemo(
    () => (trip ? [...new Set(trip.group.stops.map((s) => s.stop.day))].sort() : []),
    [trip],
  );
  const [activeDay, setActiveDay] = useState<string | null>(null);

  if (!trip) {
    return (
      <PhoneFrame>
        <ScreenHeader title="Itinerary" subtitle="not found" onBack={onBack} />
        <ScrollView contentContainerStyle={styles.body}>
          <InfoStrip>This trip is no longer in the archive.</InfoStrip>
        </ScrollView>
      </PhoneFrame>
    );
  }

  const day = activeDay ?? days[0];
  const stopsForDay = trip.group.stops.filter((s) => s.stop.day === day);

  return (
    <PhoneFrame>
      <ScreenHeader
        title="Itinerary"
        subtitle={`${trip.group.stops.length} stops · ${days.length} ${days.length === 1 ? 'day' : 'days'}`}
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={styles.body}>
        {days.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayTabs}>
            {days.map((d, index) => {
              const selected = d === day;
              return (
                <ThemedView
                  key={d}
                  type={selected ? 'brand' : 'backgroundElement'}
                  style={[styles.dayTab, { borderColor: theme.accentBorder }]}>
                  <ThemedText
                    type="small"
                    themeColor={selected ? 'onBrand' : 'textSecondary'}
                    onPress={() => setActiveDay(d)}>
                    {`Day ${index + 1}`}
                  </ThemedText>
                </ThemedView>
              );
            })}
          </ScrollView>
        )}

        <SectionLabel>{formatDayHeading(day)}</SectionLabel>

        {stopsForDay.map((stopGroup) => {
          const { stop, photos } = stopGroup;
          const confirmed = trip.stopNames[stop.id];
          const value = confirmed ?? stop.suggestedName ?? '';
          const label = stopLabel(trip, stopGroup);

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
                      onChangeText={(text) => renameStop(trip.id, stop.id, text)}
                      placeholder={
                        stop.needsManualPlace ? 'No location — name it' : 'Name this place'
                      }
                      placeholderTextColor={theme.textSecondary}
                      style={[styles.input, { color: theme.text }]}
                    />
                    {confirmed != null && <Pill label="✓" />}
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

                  {label == null && (
                    <ThemedText type="small" themeColor="textSecondary">
                      Unnamed — type a name above to keep it.
                    </ThemedText>
                  )}
                </View>
              </View>
            </Card>
          );
        })}

        <InfoStrip>
          Edits here are kept for this session only — saving to your account arrives with the
          backend milestone.
        </InfoStrip>
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
  dayTabs: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  dayTab: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  stopRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stopTime: {
    width: 72,
    paddingTop: Spacing.three,
  },
  stopBody: {
    flex: 1,
    gap: Spacing.two,
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
  thumbRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
});
