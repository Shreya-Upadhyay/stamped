import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PrimaryButton } from '@/components/ui/buttons';
import { Avatar, LogoHeader } from '@/components/ui/onboarding';
import { PhoneFrame } from '@/components/ui/phone-frame';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useDraftProfile, useSession } from '@/features/auth/session';
import { HomeCityField } from '@/features/home/home-city-field';

/** "MR" from "Meera Rao"; a single initial is fine too. */
function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const PROVIDER_LABEL: Record<string, string> = {
  email: 'signed in with email',
};

type Props = { onNext: () => void };

export default function ProfileStep({ onNext }: Props) {
  const theme = useTheme();
  const profile = useDraftProfile();
  const { homeBase } = useSession();

  const subtitle = [profile.email ?? profile.phone, PROVIDER_LABEL[profile.provider]]
    .filter(Boolean)
    .join(' · ');

  return (
    <PhoneFrame>
      <LogoHeader subtitle="one last thing" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <ThemedText type="cardTitle" style={styles.center}>
            Almost there!
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            Just confirm your home city and you&apos;re in.
          </ThemedText>
        </View>

        <ThemedView
          type="accentLight"
          style={[styles.identityCard, { borderColor: theme.accent }]}>
          <Avatar initials={initialsOf(profile.name)} />
          <View style={styles.identityText}>
            <ThemedText type="smallBold">{profile.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {subtitle}
            </ThemedText>
          </View>
          <ThemedText type="smallBold" themeColor="success">
            ✓
          </ThemedText>
        </ThemedView>

        <View style={styles.fieldGroup}>
          <ThemedText type="small" themeColor="textSecondary">
            Home city
          </ThemedText>

          <HomeCityField autoDetect />

          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            {homeBase
              ? 'Photos taken around here are skipped, so everyday life at home doesn’t turn into trips.'
              : 'Without this, everyday photos at home get grouped into trips of their own.'}
          </ThemedText>
        </View>

        <PrimaryButton label="Let's go" onPress={onNext} />
      </ScrollView>
    </PhoneFrame>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  intro: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  center: {
    textAlign: 'center',
  },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.large,
    padding: Spacing.three,
  },
  identityText: {
    flex: 1,
    gap: Spacing.half,
  },
  fieldGroup: {
    gap: Spacing.one,
  },
  hint: {
    fontSize: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: Spacing.one,
  },
  editRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  editBtn: {
    flex: 1,
  },
});
