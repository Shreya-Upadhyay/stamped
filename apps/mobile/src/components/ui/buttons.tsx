import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
};

type IconButtonProps = {
  glyph: string;
  onPress: () => void;
  accessibilityLabel: string;
};

/** Filled pill button — the primary call to action on every screen. */
export function PrimaryButton({ label, onPress, disabled, style }: ButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed, style]}>
      <ThemedView
        style={[styles.button, { backgroundColor: theme.brand }, disabled && styles.disabled]}>
        <ThemedText type="smallBold" themeColor="onBrand">
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

/** Outlined pill button for secondary actions. */
export function GhostButton({ label, onPress, disabled, style }: ButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed, style]}>
      <ThemedView
        style={[
          styles.button,
          styles.ghost,
          { borderColor: theme.accentBorder },
          disabled && styles.disabled,
        ]}>
        <ThemedText type="smallBold" themeColor="brand">
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

/**
 * Square outlined button for a single glyph (e.g. the ✎ edit affordance).
 * Separate from GhostButton because the pill's wide horizontal padding
 * would squeeze a fixed-width icon button's content to nothing.
 */
export function IconButton({ glyph, onPress, accessibilityLabel }: IconButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type="accentLight"
        style={[styles.iconButton, { borderColor: theme.accentBorder }]}>
        <ThemedText type="smallBold" themeColor="brand">
          {glyph}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.medium,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
