/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Warm brown/cream/gold palette — matches the Stamped brand prototype.
export const Colors = {
  light: {
    text: '#2C1A0E',
    background: '#FAF6F0',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#F5ECD7',
    textSecondary: '#A08060',
    brand: '#6B4220',
    brandDark: '#4A2E15',
    onBrand: '#FAF6F0',
    accent: '#D4A96A',
    accentLight: '#F5ECD7',
    accentBorder: '#C4956A',
    border: '#F0E4D0',
    borderMid: '#E8D5C0',
    success: '#2D8A4E',
  },
  dark: {
    text: '#FAF6F0',
    background: '#2C1A0E',
    backgroundElement: '#3A2818',
    backgroundSelected: '#4A3020',
    textSecondary: '#C0A080',
    // Lightened vs. light mode's brand so it doesn't disappear into the near-black background.
    brand: '#8A5A32',
    brandDark: '#6B4220',
    onBrand: '#FAF6F0',
    accent: '#D4A96A',
    accentLight: '#4A3020',
    accentBorder: '#8A5A32',
    border: '#4A3020',
    borderMid: '#5A3518',
    success: '#4EBE7C',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Radius = {
  small: 8,
  medium: 10,
  large: 14,
  pill: 999,
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
