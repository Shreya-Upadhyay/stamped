import { StyleSheet, View } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type StepProgressProps = {
  /** Total number of steps in the flow. */
  steps: number;
  /** Zero-based index of the step currently in progress. */
  current: number;
};

/** Segmented progress indicator across the top of a multi-step flow. */
export function StepProgress({ steps, current }: StepProgressProps) {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      {Array.from({ length: steps }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.segment,
            {
              backgroundColor:
                i < current ? theme.brand : i === current ? theme.accentBorder : theme.borderMid,
            },
          ]}
        />
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: Radius.small,
  },
});
