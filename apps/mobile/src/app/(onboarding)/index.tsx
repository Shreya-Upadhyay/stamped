import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GhostButton, PrimaryButton } from '@/components/ui/buttons';
import { GlobeEmblem } from '@/components/ui/onboarding';
import { PhoneFrame } from '@/components/ui/phone-frame';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <PhoneFrame>
      <ThemedView type="brand" style={[styles.hero, { paddingTop: insets.top + Spacing.five }]}>
        <GlobeEmblem size={132} />
        <ThemedText type="wordmark" themeColor="onBrand" style={styles.wordmark}>
          STAMPED
        </ThemedText>
        <ThemedText type="small" themeColor="accent">
          your travel archive for life
        </ThemedText>
      </ThemedView>

      <ThemedView style={[styles.body, { paddingBottom: insets.bottom + Spacing.four }]}>
        <View style={styles.pitch}>
          <ThemedText type="heroTitle" style={styles.center}>
            Every trip. Forever.
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.center}>
            Your whole travel life in one beautiful place — automatically.
          </ThemedText>
        </View>

        <PrimaryButton label="Get started — it's free" onPress={() => router.push('/signup')} />
        <GhostButton label="Sign in" onPress={() => router.push('/signin')} />
      </ThemedView>
    </PhoneFrame>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingBottom: Spacing.five,
    gap: Spacing.two,
  },
  wordmark: {
    marginTop: Spacing.three,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  pitch: {
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.five,
  },
  center: {
    textAlign: 'center',
  },
});
