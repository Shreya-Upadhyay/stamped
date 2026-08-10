import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
};

/** Brown app-bar with a serif title and gold subtitle, per the Stamped brand. */
export function ScreenHeader({ title, subtitle, onBack }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <ThemedView type="brand" style={[styles.header, { paddingTop: insets.top + Spacing.four }]}>
      {onBack && (
        <Pressable onPress={onBack} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <ThemedText type="small" themeColor="accent">
            ← Back
          </ThemedText>
        </Pressable>
      )}
      <ThemedText type="screenTitle" themeColor="onBrand">
        {title}
      </ThemedText>
      {subtitle && (
        <ThemedText type="small" themeColor="accent" style={styles.subtitle}>
          {subtitle}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  back: {
    paddingBottom: Spacing.two,
    alignSelf: 'flex-start',
  },
  subtitle: {
    marginTop: Spacing.half,
  },
  pressed: {
    opacity: 0.7,
  },
});
