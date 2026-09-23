import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SessionProvider, useSession } from '@/features/auth/session';
import { TripArchiveProvider } from '@/features/trips/archive';
import { OnboardingFlow } from '@/features/onboarding/onboarding-flow';

SplashScreen.preventAutoHideAsync();

/**
 * Onboarding renders *over* the tab navigator rather than instead of it.
 *
 * Two things forced this shape, both found the hard way on Android:
 *
 * 1. The tab navigator has to stay mounted at the root. Replacing it — with a
 *    `Stack`, a `Slot`, or a plain component — left the app blank on a cold
 *    start (with a native `Stack`, react-native-screens also fails its Fabric
 *    setup outright). Covering it costs nothing, since the tabs aren't meant
 *    to be visible during onboarding anyway.
 * 2. Onboarding is a linear wizard, so it's local step state, not routes.
 *    Routing it meant route groups and redirect guards, which looped.
 */
function OnboardingGate() {
  const { status, onboarded } = useSession();

  // Firebase replays a stored sign-in asynchronously, and the splash animates
  // away on its own schedule. Holding a branded screen over the gap keeps a
  // returning user from seeing an empty Home, or a flash of onboarding they
  // finished months ago.
  if (status === 'loading') {
    return (
      <ThemedView type="brand" style={[StyleSheet.absoluteFill, styles.holding]}>
        <ThemedText type="wordmark" themeColor="onBrand">
          STAMPED
        </ThemedText>
      </ThemedView>
    );
  }

  if (status === 'signed-in' && onboarded) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <OnboardingFlow />
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SessionProvider>
      <TripArchiveProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AnimatedSplashOverlay />
          <AppTabs />
          <OnboardingGate />
        </ThemeProvider>
      </TripArchiveProvider>
    </SessionProvider>
  );
}

const styles = StyleSheet.create({
  holding: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
