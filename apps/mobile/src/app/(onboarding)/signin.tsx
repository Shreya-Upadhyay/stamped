import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/ui/buttons';
import { Divider, Field, LogoHeader, SocialButton } from '@/components/ui/onboarding';
import { PhoneFrame } from '@/components/ui/phone-frame';
import { Spacing } from '@/constants/theme';
import { useSession, type AuthProvider } from '@/features/auth/session';

const MOCK_PHONE = '🇮🇳 +91 98765 43210';

/** Greeting that matches the time of day, like the prototype's "Good morning". */
function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function SignInScreen() {
  const router = useRouter();
  const { signInWith } = useSession();

  const chooseProvider = (provider: AuthProvider) => {
    signInWith(provider);
    router.push('/profile');
  };

  return (
    <PhoneFrame>
      <LogoHeader subtitle="welcome back" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.intro}>
          <ThemedText style={styles.wave}>👋</ThemedText>
          <ThemedText type="cardTitle" style={styles.center}>
            {greeting()}, Meera
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            Sign in to your account
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

        <Divider label="or sign in with mobile OTP" />

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
            New to Stamped?{' '}
          </ThemedText>
          <Pressable onPress={() => router.replace('/signup')}>
            <ThemedText type="smallBold" themeColor="brand">
              Create account
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
  wave: {
    fontSize: 32,
    lineHeight: 40,
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
