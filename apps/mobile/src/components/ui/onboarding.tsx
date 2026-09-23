import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Brown header with the wordmark, used across the onboarding flow. */
export function LogoHeader({ subtitle }: { subtitle?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <ThemedView type="brand" style={[styles.logoHeader, { paddingTop: insets.top + Spacing.three }]}>
      <ThemedText type="wordmark" themeColor="onBrand">
        STAMPED
      </ThemedText>
      {subtitle && (
        <ThemedText type="small" themeColor="accent" style={styles.logoSubtitle}>
          {subtitle}
        </ThemedText>
      )}
    </ThemedView>
  );
}

/**
 * Slowly rotating globe emblem for the welcome screen.
 *
 * The web prototype drew this on a <canvas>, which React Native has no
 * equivalent for. This keeps the spirit — a turning world ringed in gold —
 * using the Animated API, which works on every platform without a new
 * dependency.
 */
export function GlobeEmblem({ size = 132 }: { size?: number }) {
  const theme = useTheme();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 18000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={[
          styles.globeRing,
          { width: size, height: size, borderRadius: size / 2, borderColor: theme.accent },
        ]}
      />
      <Animated.View style={[styles.globeInner, { transform: [{ rotate }] }]}>
        <ThemedText style={{ fontSize: size * 0.52, lineHeight: size * 0.62 }}>🌍</ThemedText>
      </Animated.View>
    </View>
  );
}

/** Read-only field with an optional trailing element (e.g. an "auto" pill). */
export function Field({
  children,
  trailing,
  highlighted,
}: {
  children: ReactNode;
  trailing?: ReactNode;
  highlighted?: boolean;
}) {
  const theme = useTheme();
  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.field, { borderColor: highlighted ? theme.accent : theme.borderMid }]}>
      <View style={styles.fieldContent}>{children}</View>
      {trailing}
    </ThemedView>
  );
}

/** Circular initials badge. */
export function Avatar({ initials, size = 46 }: { initials: string; size?: number }) {
  const theme = useTheme();
  return (
    <ThemedView
      type="accentLight"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: theme.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <ThemedText type="smallBold" themeColor="brand" style={{ fontSize: size * 0.34 }}>
        {initials}
      </ThemedText>
    </ThemedView>
  );
}

/**
 * Switch shown in a fixed state.
 *
 * Permission and consent choices are locked on for this milestone: nothing is
 * uploaded or shared yet, so offering toggles would imply control over data
 * flows that don't exist. Real controls arrive with the backend.
 */
export function LockedToggle({ on = true }: { on?: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={[styles.toggleTrack, { backgroundColor: on ? theme.brand : theme.borderMid }]}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled: true }}>
      <View style={[styles.toggleKnob, on ? styles.toggleKnobOn : styles.toggleKnobOff]} />
    </View>
  );
}

/** Small uppercase group heading used on the consent screen. */
export function GroupLabel({ children }: { children: string }) {
  return (
    <ThemedText type="small" themeColor="textSecondary" style={styles.groupLabel}>
      {children}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  logoHeader: {
    alignItems: 'center',
    paddingBottom: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  logoSubtitle: {
    marginTop: Spacing.half,
  },
  globeRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  globeInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    minHeight: 48,
  },
  fieldContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flex: 1,
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
  },
  toggleKnobOn: {
    left: 22,
  },
  toggleKnobOff: {
    left: 3,
  },
  groupLabel: {
    fontSize: 11,
    letterSpacing: 0.8,
    fontWeight: '600',
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
  },
});
