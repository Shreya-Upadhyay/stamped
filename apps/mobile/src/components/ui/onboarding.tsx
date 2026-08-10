import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
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

/** White pill button for a social provider. */
export function SocialButton({
  icon,
  label,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type="backgroundElement"
        style={[styles.socialButton, { borderColor: theme.borderMid }]}>
        <View style={styles.socialIcon}>
          {typeof icon === 'string' ? <ThemedText style={styles.socialEmoji}>{icon}</ThemedText> : icon}
        </View>
        <ThemedText type="smallBold" style={styles.socialLabel}>
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

/** "or sign up with mobile" divider. */
export function Divider({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.divider}>
      <View style={[styles.dividerLine, { backgroundColor: theme.borderMid }]} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={[styles.dividerLine, { backgroundColor: theme.borderMid }]} />
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

/** Six OTP entry boxes; `value` fills them left to right. */
export function OtpBoxes({ value, length = 6 }: { value: string; length?: number }) {
  const theme = useTheme();
  return (
    <View style={styles.otpRow}>
      {Array.from({ length }).map((_, i) => {
        const digit = value[i] ?? '';
        const isCursor = i === value.length;
        return (
          <ThemedView
            key={i}
            type={digit ? 'accentLight' : 'backgroundElement'}
            style={[
              styles.otpBox,
              {
                borderColor: digit || isCursor ? theme.brand : theme.borderMid,
                borderWidth: digit || isCursor ? 2 : 1.5,
              },
            ]}>
            <ThemedText type="otpDigit">{digit}</ThemedText>
          </ThemedView>
        );
      })}
    </View>
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
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    marginBottom: Spacing.two,
  },
  socialIcon: {
    width: 26,
    alignItems: 'center',
  },
  socialEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  socialLabel: {
    flex: 1,
    textAlign: 'center',
    marginRight: 26,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginVertical: Spacing.three,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
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
  otpRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'center',
  },
  otpBox: {
    width: 48,
    height: 58,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
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
  pressed: {
    opacity: 0.7,
  },
});
