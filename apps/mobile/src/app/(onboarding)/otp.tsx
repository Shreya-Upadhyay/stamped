import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/ui/buttons';
import { LogoHeader, OtpBoxes } from '@/components/ui/onboarding';
import { PhoneFrame } from '@/components/ui/phone-frame';
import { InfoStrip } from '@/components/ui/surfaces';
import { Spacing } from '@/constants/theme';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 42;

export default function OtpScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  // Simulates the SMS auto-fill the real flow would get from the OS.
  useEffect(() => {
    if (code.length >= CODE_LENGTH) return;
    const timer = setTimeout(() => setCode((c) => c + String((c.length * 3 + 8) % 10)), 450);
    return () => clearTimeout(timer);
  }, [code]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const complete = code.length >= CODE_LENGTH;

  return (
    <PhoneFrame>
      <LogoHeader subtitle="verify your number" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.intro}>
          <ThemedText type="cardTitle" style={styles.center}>
            Enter your OTP
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            We sent a 6-digit code to
          </ThemedText>
          <ThemedText type="smallBold">+91 98765 43210</ThemedText>
        </View>

        <OtpBoxes value={code} length={CODE_LENGTH} />

        <InfoStrip>The OTP auto-fills when you allow SMS access.</InfoStrip>

        <PrimaryButton
          label={complete ? 'Verify & continue' : 'Waiting for code…'}
          disabled={!complete}
          onPress={() => router.push('/profile')}
        />

        <View style={styles.resendRow}>
          <ThemedText type="small" themeColor="textSecondary">
            Didn&apos;t get it?{' '}
          </ThemedText>
          <Pressable disabled={secondsLeft > 0} onPress={() => setSecondsLeft(RESEND_SECONDS)}>
            <ThemedText type="smallBold" themeColor={secondsLeft > 0 ? 'textSecondary' : 'brand'}>
              Resend OTP
            </ThemedText>
          </Pressable>
          {secondsLeft > 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              {' '}
              · 00:{String(secondsLeft).padStart(2, '0')}
            </ThemedText>
          )}
        </View>
      </ScrollView>
    </PhoneFrame>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  intro: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  center: {
    textAlign: 'center',
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
