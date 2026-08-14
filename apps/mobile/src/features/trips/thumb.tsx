import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Square photo thumbnail. Falls back to a solid tile when the source has no
 * real image — the web fixtures carry colours instead of files.
 */
export function Thumb({
  photo,
  size = 56,
}: {
  photo: { uri: string | null; color?: string };
  size?: number;
}) {
  const theme = useTheme();
  const style = { width: size, height: size, borderRadius: Radius.small };

  if (!photo.uri) {
    return <View style={[style, { backgroundColor: photo.color ?? theme.accentLight }]} />;
  }
  return <Image source={{ uri: photo.uri }} style={style} contentFit="cover" />;
}

/** "+3" tile closing a truncated row of thumbnails. */
export function MoreTile({ count, size = 56 }: { count: number; size?: number }) {
  return (
    <ThemedView type="accentLight" style={[styles.more, { width: size, height: size }]}>
      <ThemedText type="small" themeColor="brand">
        +{count}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  more: {
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
