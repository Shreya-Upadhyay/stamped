import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** White rounded card with a hairline warm border — the main content surface. */
export function Card({
  children,
  style,
  onPress,
  selected,
}: {
  children: ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  selected?: boolean;
}) {
  const theme = useTheme();
  const body = (
    <ThemedView
      type="backgroundElement"
      style={[
        styles.card,
        { borderColor: selected ? theme.brand : theme.border, borderWidth: selected ? 1.5 : 0.5 },
        style,
      ]}>
      {children}
    </ThemedView>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {body}
    </Pressable>
  );
}

/**
 * Soft gold strip for explanatory or contextual copy.
 *
 * Children are always wrapped in a `ThemedText`: JSX with interpolation
 * (`We grouped {n} photos`) arrives as an array of strings, which React
 * Native refuses to render directly inside a `View`.
 */
export function InfoStrip({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <ThemedView type="accentLight" style={[styles.infoStrip, style]}>
      <ThemedText type="small" themeColor="text">
        {children}
      </ThemedText>
    </ThemedView>
  );
}

/** Small uppercase label that introduces a group of content. */
export function SectionLabel({ children }: { children: string }) {
  return (
    <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
      {children.toUpperCase()}
    </ThemedText>
  );
}

/** Rounded tag used for counts, "auto" markers and stamped badges. */
export function Pill({ label, tone = 'accent' }: { label: string; tone?: 'accent' | 'brand' }) {
  return (
    <ThemedView type={tone === 'accent' ? 'accentLight' : 'backgroundSelected'} style={styles.pill}>
      <ThemedText type="small" themeColor="brand">
        {label}
      </ThemedText>
    </ThemedView>
  );
}

/** Selectable chip, used for the trip-category picker. */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        style={[
          styles.chip,
          {
            backgroundColor: selected ? theme.brand : theme.backgroundElement,
            borderColor: selected ? theme.brand : theme.borderMid,
          },
        ]}>
        <ThemedText type="small" themeColor={selected ? 'onBrand' : 'textSecondary'}>
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.large,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  infoStrip: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 0.8,
    fontWeight: '600',
    marginTop: Spacing.three,
  },
  pill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.small,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
