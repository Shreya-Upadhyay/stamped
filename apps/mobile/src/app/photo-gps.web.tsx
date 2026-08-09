import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

// expo-media-library has no web implementation (its native binding is
// undefined on web), so this screen is native-only. Keep this file free of
// any expo-media-library import — Expo Router evaluates every route module
// to build the route table, so importing it here would crash web entirely.
export default function PhotoGpsScreenWeb() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle" style={styles.centerText}>
        Photo GPS
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
        Reading photo GPS data uses your device&apos;s photo library and isn&apos;t available on
        web. Open Stamped on iOS or Android to use this screen.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  centerText: {
    textAlign: 'center',
  },
});
