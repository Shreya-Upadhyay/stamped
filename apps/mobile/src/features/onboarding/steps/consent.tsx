import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/ui/buttons';
import { GroupLabel, LockedToggle, LogoHeader } from '@/components/ui/onboarding';
import { PhoneFrame } from '@/components/ui/phone-frame';
import { StepProgress } from '@/components/ui/step-progress';
import { InfoStrip } from '@/components/ui/surfaces';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useDraftProfile, useSession } from '@/features/auth/session';

const CONSENTS = [
  { label: 'Allow notifications from Stamped', group: 'Notifications' },
  { label: 'Store my travel photos securely', group: 'Data & privacy' },
  { label: 'Use my trips to personalise recommendations', group: null },
  { label: 'Share my travel stats with friends', group: null },
  { label: 'Receive personalised offers & promotions', group: null },
  { label: 'Allow anonymous analytics to improve the app', group: null },
] as const;

export default function ConsentStep() {
  const theme = useTheme();
  const profile = useDraftProfile();
  const { completeOnboarding } = useSession();

  // Marks onboarding complete, then hands off to the app. The gate in
  // app/_layout.tsx now passes, so the tabs show rather than this flow.
  // The write to the account is not worth waiting on: it only decides whether
  // onboarding runs again, and it retries on the next launch.
  const finish = () => {
    void completeOnboarding(profile);
  };

  return (
    <PhoneFrame>
      <LogoHeader subtitle="your data, your choices" />
      <StepProgress steps={3} current={1} />
      <ScrollView contentContainerStyle={styles.body}>
        <ThemedText type="small" themeColor="textSecondary">
          These are the defaults for this build.
        </ThemedText>

        {CONSENTS.map((item, index) => (
          <View key={item.label}>
            {item.group && <GroupLabel>{item.group.toUpperCase()}</GroupLabel>}
            <View
              style={[
                styles.row,
                { borderBottomColor: theme.border },
                index === CONSENTS.length - 1 && styles.lastRow,
              ]}>
              <ThemedText type="small" style={styles.rowLabel}>
                {item.label}
              </ThemedText>
              <LockedToggle on />
            </View>
          </View>
        ))}

        <InfoStrip>
          Your photos never leave your phone. Only the trips you stamp — their dates, places and
          what was read from each photo — are saved to your account, so they&apos;re still here
          next time. These switches are fixed for now.
        </InfoStrip>

        <PrimaryButton label="Save my preferences" onPress={finish} />
      </ScrollView>
    </PhoneFrame>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: Spacing.three,
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lastRow: {
    borderBottomWidth: 0,
    marginBottom: Spacing.two,
  },
  rowLabel: {
    flex: 1,
  },
});
