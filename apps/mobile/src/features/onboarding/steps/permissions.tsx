import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PrimaryButton } from '@/components/ui/buttons';
import { LockedToggle, LogoHeader } from '@/components/ui/onboarding';
import { PhoneFrame } from '@/components/ui/phone-frame';
import { Card, InfoStrip } from '@/components/ui/surfaces';
import { Radius, Spacing } from '@/constants/theme';
import { StepProgress } from '@/components/ui/step-progress';

/**
 * These describe what the app will ask for. The real OS prompt for photos is
 * raised later, on the Photos screen, at the moment it's actually needed —
 * asking here would trigger a system dialog before the user has any context
 * for it.
 */
const PERMISSIONS = [
  {
    id: 'photos',
    icon: '📸',
    title: 'Photos',
    description:
      "We'll find your past trips automatically from your camera roll. Nothing uploads without your approval.",
    live: true,
  },
  {
    id: 'contacts',
    icon: '👥',
    title: 'Contacts',
    description:
      'Used to tag travel companions and send trip invites. We never store or share your contacts.',
    live: false,
  },
  {
    id: 'location',
    icon: '📍',
    title: 'Location',
    description: 'Used only while travelling to track your route. Never tracked at home.',
    live: false,
  },
] as const;

type Props = { onNext: () => void };

export default function PermissionsStep({ onNext }: Props) {

  return (
    <PhoneFrame>
      <LogoHeader subtitle="a few quick permissions" />
      <StepProgress steps={3} current={0} />
      <ScrollView contentContainerStyle={styles.body}>
        <ThemedText type="small" themeColor="textSecondary">
          Stamped works best with access to the following.
        </ThemedText>

        {PERMISSIONS.map((permission) => (
          <Card key={permission.id}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeading}>
                <ThemedView type="accentLight" style={styles.iconTile}>
                  <ThemedText style={styles.icon}>{permission.icon}</ThemedText>
                </ThemedView>
                <ThemedText type="smallBold">{permission.title}</ThemedText>
              </View>
              <LockedToggle on />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {permission.description}
            </ThemedText>
            {!permission.live && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                Not used yet — arrives with companion tagging and live trips.
              </ThemedText>
            )}
          </Card>
        ))}

        <InfoStrip>
          Photo access is requested on the Photos screen, when it&apos;s actually needed — so you
          can see why before you decide.
        </InfoStrip>

        <PrimaryButton label="Continue" onPress={onNext} />
      </ScrollView>
    </PhoneFrame>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 20,
    lineHeight: 26,
  },
  note: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});
