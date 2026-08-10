import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    | 'link'
    | 'linkPrimary'
    | 'code'
    | 'screenTitle'
    | 'cardTitle'
    | 'wordmark'
    | 'heroTitle'
    | 'otpDigit';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        type === 'screenTitle' && styles.screenTitle,
        type === 'cardTitle' && styles.cardTitle,
        type === 'wordmark' && styles.wordmark,
        type === 'heroTitle' && styles.heroTitle,
        type === 'otpDigit' && styles.otpDigit,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  title: {
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 52,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: 600,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    color: '#3c87f7',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
  screenTitle: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
  },
  cardTitle: {
    fontFamily: Fonts.serif,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  wordmark: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 6,
  },
  heroTitle: {
    fontFamily: Fonts.serif,
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '700',
  },
  otpDigit: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
  },
});
