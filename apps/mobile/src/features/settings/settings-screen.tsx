import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GhostButton } from '@/components/ui/buttons';
import { Avatar } from '@/components/ui/onboarding';
import { PhoneFrame } from '@/components/ui/phone-frame';
import { Card, InfoStrip, SectionLabel } from '@/components/ui/surfaces';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session';
import { HomeCityField } from '@/features/home/home-city-field';
import { archiveSummary, useTripArchive } from '@/features/trips/archive';
import { useTheme } from '@/hooks/use-theme';

/** "SR" from "Shreya Rao"; a single initial is fine too. */
function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Account and preferences.
 *
 * A mode of the Home tab rather than a route, matching how the trip detail
 * works — the tab navigator stays mounted and there is nothing to deep-link
 * into. It exists because the home city was only ever settable during
 * onboarding: guessed once from wherever the phone happened to be, with no
 * way back to it afterwards.
 */
export function SettingsScreen({ onClose }: { onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useSession();
  const { trips } = useTripArchive();
  const summary = archiveSummary(trips);

  return (
    <PhoneFrame>
      <ThemedView type="brand" style={[styles.header, { paddingTop: insets.top + Spacing.three }]}>
        <ThemedText type="wordmark" themeColor="onBrand">
          STAMPED
        </ThemedText>
        <ThemedText type="small" themeColor="accent" style={styles.headerSub}>
          your account
        </ThemedText>
      </ThemedView>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + BottomTabInset + Spacing.four },
        ]}>
        <GhostButton label="← Back" onPress={onClose} style={styles.back} />

        <ThemedView type="accentLight" style={[styles.identity, { borderColor: theme.accent }]}>
          <Avatar initials={initialsOf(profile?.name ?? '?')} size={54} />
          <View style={styles.identityText}>
            <ThemedText type="cardTitle">{profile?.name ?? 'Not signed in'}</ThemedText>
            {profile?.email && (
              <ThemedText type="small" themeColor="textSecondary">
                {profile.email}
              </ThemedText>
            )}
            <ThemedText type="small" themeColor="textSecondary">
              Signed in with email
            </ThemedText>
          </View>
        </ThemedView>

        <SectionLabel>Home city</SectionLabel>
        <HomeCityField />
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          Photos taken around here are skipped, so everyday life at home doesn&apos;t turn into
          trips. Changing it affects the next time you look for trips, not the ones you&apos;ve
          already stamped.
        </ThemedText>

        <SectionLabel>Your archive</SectionLabel>
        <Card>
          <View style={styles.stats}>
            <Stat value={summary.tripCount} label={summary.tripCount === 1 ? 'trip' : 'trips'} />
            <Stat value={summary.countries} label={summary.countries === 1 ? 'country' : 'countries'} />
            <Stat value={summary.photoCount} label="photos" />
            <Stat value={summary.stops} label={summary.stops === 1 ? 'stop' : 'stops'} />
          </View>
        </Card>

        <SectionLabel>Your data</SectionLabel>
        <InfoStrip>
          Your photos stay on this phone. Only what was read from them — dates, coordinates and
          the places you confirmed — is saved to your account, so your trips are still here on
          your next phone.
        </InfoStrip>

        <SectionLabel>Account</SectionLabel>
        <GhostButton label="Sign out" onPress={() => void signOut()} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          Signing out leaves your trips safely in your account. Sign back in with the same email
          and they return.
        </ThemedText>
      </ScrollView>
    </PhoneFrame>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="cardTitle">{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingBottom: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  headerSub: {
    marginTop: Spacing.half,
  },
  body: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  back: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.large,
    padding: Spacing.three,
    marginTop: Spacing.one,
  },
  identityText: {
    flex: 1,
    gap: Spacing.half,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    alignItems: 'center',
    gap: Spacing.half,
  },
  hint: {
    fontSize: 12,
  },
});
