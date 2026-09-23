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

/** Firebase's own minimum. Stated up front rather than as an error later. */
const MIN_PASSWORD = 6;

type Props = {
  onSignIn: () => void;
};

export default function SignUpStep({ onSignIn }: Props) {
  const theme = useTheme();
  const { signUp, busy, error, clearError, status } = useSession();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const unconfigured = status === 'unconfigured';
  const ready =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= MIN_PASSWORD &&
    !busy &&
    !unconfigured;

  const submit = () => {
    if (ready) void signUp({ name, email, password });
  };

  // Typing is the user's answer to whatever the last error said.
  const edit = (setter: (value: string) => void) => (value: string) => {
    if (error) clearError();
    setter(value);
  };

  return (
    <PhoneFrame>
      <LogoHeader subtitle="your travel archive for life" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <ThemedText type="cardTitle" style={styles.center}>
            Create your account
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            Your trips are saved to this account, so they&apos;re still here next time.
          </ThemedText>
        </View>

        <View style={styles.fieldGroup}>
          <ThemedText type="small" themeColor="textSecondary">
            Name
          </ThemedText>
          <Field>
            <TextInput
              value={name}
              onChangeText={edit(setName)}
              placeholder="Your name"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="words"
              autoComplete="name"
              style={[styles.input, { color: theme.text }]}
            />
          </Field>
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
              placeholder={`At least ${MIN_PASSWORD} characters`}
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
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
          label={busy ? 'Creating account…' : 'Create account'}
          onPress={submit}
          disabled={!ready}
          style={styles.submit}
        />

        <View style={styles.footer}>
          <ThemedText type="small" themeColor="textSecondary">
            Already have an account?{' '}
          </ThemedText>
          <Pressable onPress={onSignIn}>
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
