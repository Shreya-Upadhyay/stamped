import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/ui/buttons';
import { Field, LogoHeader } from '@/components/ui/onboarding';
import { PhoneFrame } from '@/components/ui/phone-frame';
import { InfoStrip } from '@/components/ui/surfaces';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session';
import { useTheme } from '@/hooks/use-theme';

/** Greeting that matches the time of day, like the prototype's "Good morning". */
function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

type Props = {
  onSignUp: () => void;
};

export default function SignInStep({ onSignUp }: Props) {
  const theme = useTheme();
  const { signIn, busy, error, clearError, status } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const unconfigured = status === 'unconfigured';
  const ready = email.trim().length > 0 && password.length > 0 && !busy && !unconfigured;

  const submit = () => {
    if (ready) void signIn({ email, password });
  };

  const edit = (setter: (value: string) => void) => (value: string) => {
    if (error) clearError();
    setter(value);
  };

  return (
    <PhoneFrame>
      <LogoHeader subtitle="welcome back" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <ThemedText style={styles.wave}>👋</ThemedText>
          <ThemedText type="cardTitle" style={styles.center}>
            {greeting()}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            Sign in to your account
          </ThemedText>
        </View>

        <View style={styles.fieldGroup}>
          <ThemedText type="small" themeColor="textSecondary">
            Email
          </ThemedText>
          <Field>
            <TextInput
              value={email}
              onChangeText={edit(setEmail)}
              placeholder="you@example.com"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              inputMode="email"
              style={[styles.input, { color: theme.text }]}
            />
          </Field>
        </View>

        <View style={styles.fieldGroup}>
          <ThemedText type="small" themeColor="textSecondary">
            Password
          </ThemedText>
          <Field>
            <TextInput
              value={password}
              onChangeText={edit(setPassword)}
              placeholder="Your password"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              onSubmitEditing={submit}
              style={[styles.input, { color: theme.text }]}
            />
          </Field>
        </View>

        {error && (
          <ThemedText type="small" themeColor="danger">
            {error}
          </ThemedText>
        )}

        {unconfigured && (
          <InfoStrip>
            This build has no Firebase keys, so accounts are switched off. Copy
            apps/mobile/.env.example to .env and fill it in.
          </InfoStrip>
        )}

        <PrimaryButton
          label={busy ? 'Signing in…' : 'Sign in'}
          onPress={submit}
          disabled={!ready}
          style={styles.submit}
        />

        <View style={styles.footer}>
          <ThemedText type="small" themeColor="textSecondary">
            New to Stamped?{' '}
          </ThemedText>
          <Pressable onPress={onSignUp}>
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
  fieldGroup: {
    gap: Spacing.one,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: Spacing.two,
  },
  submit: {
    marginTop: Spacing.two,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.four,
  },
});
