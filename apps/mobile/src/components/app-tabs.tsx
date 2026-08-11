import { Image } from 'expo-image';
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { forwardRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * JS tabs (`expo-router/ui`) rather than `NativeTabs`.
 *
 * `NativeTabs` is backed by react-native-screens, whose native module fails to
 * initialise in this build (`ScreensModule.setupFabric` throws a
 * NullPointerException on FabricUIManager). That doesn't just break the tab
 * bar — it takes the whole render down, leaving a blank screen with no JS
 * error, which is a miserable thing to debug. These tabs are plain React
 * Native views, so they sidestep it entirely and look identical on every
 * platform.
 */
const TABS = [
  { name: 'index', href: '/', label: 'Home', icon: require('@/assets/images/tabIcons/home.png') },
  {
    name: 'explore',
    href: '/explore',
    label: 'Explore',
    icon: require('@/assets/images/tabIcons/explore.png'),
  },
  {
    name: 'photo-gps',
    href: '/photo-gps',
    label: 'Photos',
    icon: require('@/assets/images/tabIcons/photos.png'),
  },
] as const;

type TabButtonProps = TabTriggerSlotProps & {
  label: string;
  icon: number;
};

const TabButton = forwardRef<View, TabButtonProps>(({ isFocused, label, icon, ...props }, ref) => {
  const theme = useTheme();
  const tint = isFocused ? theme.brand : theme.textSecondary;

  return (
    <Pressable
      ref={ref}
      {...props}
      style={({ pressed }) => StyleSheet.flatten([styles.tabButton, pressed && styles.pressed])}>
      <Image source={icon} style={StyleSheet.flatten([styles.icon, { tintColor: tint }])} contentFit="contain" />
      <ThemedText type="small" style={StyleSheet.flatten([styles.tabLabel, { color: tint }])}>
        {label}
      </ThemedText>
    </Pressable>
  );
});
TabButton.displayName = 'TabButton';

export default function AppTabs() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <Tabs>
      <TabSlot />
      <TabList asChild>
        <ThemedView
          style={StyleSheet.flatten([
            styles.tabBar,
            { borderTopColor: theme.borderMid, paddingBottom: insets.bottom + Spacing.two },
          ])}>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton label={tab.label} icon={tab.icon} />
            </TabTrigger>
          ))}
        </ThemedView>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.one,
  },
  icon: {
    width: 24,
    height: 24,
  },
  tabLabel: {
    fontSize: 11,
  },
  pressed: {
    opacity: 0.6,
  },
});
