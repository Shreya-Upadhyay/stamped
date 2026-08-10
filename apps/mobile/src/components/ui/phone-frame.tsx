import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';

/**
 * Constrains the flow to phone width and centres it. On a device this is a
 * no-op (the screen is already narrower); on web it keeps the preview looking
 * like a real mobile app instead of a stretched desktop page.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return <ThemedView style={styles.frame}>{children}</ThemedView>;
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
  },
});
