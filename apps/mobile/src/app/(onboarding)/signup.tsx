import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PrimaryButton } from '@/components/ui/buttons';
import { Divider, Field, LogoHeader, SocialButton } from '@/components/ui/onboarding';
import { PhoneFrame } from '@/components/ui/phone-frame';
import { Spacing } from '@/constants/theme';
import { useSession, type AuthProvider } from '@/features/auth/session';

const MOCK_PHONE = '🇮🇳 +91 98765 43210';

export default function SignUpScreen() {
  const router = useRouter();
  const { signInWith } = useSession();

  const chooseProvider = (provider: AuthProvider) => {
    signInWith(provider);
    router.push('/profile');
  };

  return (
    <PhoneFrame>
      <LogoHeader subtitle="your travel archive for life" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.intro}>
          <ThemedText type="cardTitle" style={styles.center}>
            Create your account
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            Choose how you&apos;d like to sign up
          </ThemedText>
        </View>

        <SocialButton icon="🅖" label="Continue with Google" onPress={() => chooseProvider('google')} />
        <SocialButton
          icon="📷"
          label="Continue with Instagram"
          onPress={() => chooseProvider('instagram')}
        />
        <SocialButton
          icon="f"
          label="Continue with Facebook"
          onPress={() => chooseProvider('facebook')}
        />

        <Divider label="or sign up with mobile" />

        <ThemedText type="small" themeColor="textSecondary">
          Mobile number
        </ThemedText>
        <View style={styles.phoneRow}>
          <View style={styles.phoneField}>
            <Field>
              <ThemedText type="small">{MOCK_PHONE}</ThemedText>
            </Field>
          </View>
          <PrimaryButton
            label="Send OTP"
            onPress={() => {
              signInWith('phone');
              router.push('/otp');
            }}
          />
        </View>

        <View style={styles.footer}>
          <ThemedText type="small" themeColor="textSecondary">
            Already have an account?{' '}
          </ThemedText>
          <Pressable onPress={() => router.replace('/signin')}>
            <ThemedText type="smallBold" themeColor="brand">
              Sign in
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </PhoneFrame>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  intro: {
    alignItems: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.three,
  },
  center: {
    textAlign: 'center',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  phoneField: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.four,
  },
});
