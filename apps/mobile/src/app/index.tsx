import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PrimaryButton } from '@/components/ui/buttons';
import { PhoneFrame } from '@/components/ui/phone-frame';
import { Card, InfoStrip, SectionLabel } from '@/components/ui/surfaces';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session';

/** First name only — "Meera Rao" → "Meera". */
function firstName(name: string): string {
  return name.split(' ')[0];
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();

  return (
    <PhoneFrame>
      <ThemedView type="brand" style={[styles.header, { paddingTop: insets.top + Spacing.three }]}>
        <ThemedText type="wordmark" themeColor="onBrand">
          STAMPED
        </ThemedText>
        <ThemedText type="small" themeColor="accent" style={styles.headerSub}>
          {profile ? `${firstName(profile.name)} · ${profile.homeCity}` : 'your travel archive'}
        </ThemedText>
      </ThemedView>

      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + BottomTabInset + Spacing.four },
        ]}>
        <ThemedText type="heroTitle">Let&apos;s find your trips</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Stamped reads the time and place from photos already on your phone and groups them into
          trips. Nothing is uploaded.
        </ThemedText>

        <PrimaryButton
          label="Find my trips"
          onPress={() => router.push('/photo-gps')}
          style={styles.cta}
        />

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
          Saved trips, sharing and your archive arrive in a later milestone — right now trips live
          only for the length of a session.
        </InfoStrip>
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
});
