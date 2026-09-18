import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PrimaryButton } from '@/components/ui/buttons';
import { Avatar, Field, LogoHeader } from '@/components/ui/onboarding';
import { PhoneFrame } from '@/components/ui/phone-frame';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useDraftProfile, useSession } from '@/features/auth/session';
import { detectHomeBase, geocodeHomeBase } from '@/features/home/detect-home';
import { GhostButton } from '@/components/ui/buttons';

/** "MR" from "Meera Rao". */
function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const PROVIDER_LABEL: Record<string, string> = {
  google: 'via Google',
  instagram: 'via Instagram',
  facebook: 'via Facebook',
  phone: 'via mobile',
};

type Props = { onNext: () => void };

export default function ProfileStep({ onNext }: Props) {
  const theme = useTheme();
  const profile = useDraftProfile();
  const { homeBase, setHomeBase } = useSession();

  const [detecting, setDetecting] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [lookupFailed, setLookupFailed] = useState(false);

  // Detect once on mount. A first launch happens wherever the user is, which
  // is usually home — but they get to correct it, so this is a suggestion.
  useEffect(() => {
    let cancelled = false;
    detectHomeBase()
      .then((detected) => {
        if (cancelled) return;
        if (detected) setHomeBase(detected);
      })
      .finally(() => {
        if (!cancelled) setDetecting(false);
      });
    return () => {
      cancelled = true;
    };
    // Runs once: re-detecting would overwrite a correction the user just made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyTypedHome = async () => {
    setLookupFailed(false);
    const resolved = await geocodeHomeBase(draft);
    if (resolved) {
      setHomeBase(resolved);
      setEditing(false);
    } else {
      setLookupFailed(true);
    }
  };

  const homeLabel = homeBase?.label ?? (homeBase ? 'Location detected' : null);

  const subtitle = [profile.email ?? profile.phone, PROVIDER_LABEL[profile.provider]]
    .filter(Boolean)
    .join(' · ');

  return (
    <PhoneFrame>
      <LogoHeader subtitle="one last thing" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.intro}>
          <ThemedText type="cardTitle" style={styles.center}>
            Almost there!
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            We pulled your details across. Just confirm your home city and you&apos;re in.
          </ThemedText>
        </View>

        <ThemedView
          type="accentLight"
          style={[styles.identityCard, { borderColor: theme.accent }]}>
          <Avatar initials={initialsOf(profile.name)} />
          <View style={styles.identityText}>
            <ThemedText type="smallBold">{profile.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {subtitle}
            </ThemedText>
          </View>
          <ThemedText type="smallBold" themeColor="success">
            ✓
          </ThemedText>
        </ThemedView>

        <View style={styles.fieldGroup}>
          <ThemedText type="small" themeColor="textSecondary">
            Home city
          </ThemedText>

          {editing ? (
            <>
              <Field highlighted>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  onSubmitEditing={applyTypedHome}
                  placeholder="Type a city, e.g. Mumbai, India"
                  placeholderTextColor={theme.textSecondary}
                  autoFocus
                  style={[styles.input, { color: theme.text }]}
                />
              </Field>
              <View style={styles.editRow}>
                <GhostButton label="Use this city" onPress={applyTypedHome} style={styles.editBtn} />
                <GhostButton
                  label="Cancel"
                  onPress={() => {
                    setEditing(false);
                    setLookupFailed(false);
                  }}
                  style={styles.editBtn}
                />
              </View>
              {lookupFailed && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                  Couldn&apos;t find that place. Try a city and country.
                </ThemedText>
              )}
            </>
          ) : (
            <>
              <Field highlighted>
                <ThemedText type="small">
                  {detecting
                    ? '📍 Detecting your location…'
                    : homeLabel
                      ? `📍 ${homeLabel}`
                      : '📍 Not set'}
                </ThemedText>
              </Field>
              <GhostButton
                label={homeBase ? 'Not right? Change it' : 'Set it manually'}
                onPress={() => {
                  setDraft(homeBase?.label ?? '');
                  setEditing(true);
                }}
              />
            </>
          )}

          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            {homeBase
              ? 'Photos taken around here are skipped, so everyday life at home doesn’t turn into trips.'
              : 'Without this, everyday photos at home get grouped into trips of their own.'}
          </ThemedText>
        </View>

        <View style={styles.fieldGroup}>
          <ThemedText type="small" themeColor="textSecondary">
            Mobile number (optional)
          </ThemedText>
          <Field>
            <ThemedText type="small" themeColor="textSecondary">
              🇮🇳 {profile.phone ?? '+91 Add mobile number'}
            </ThemedText>
          </Field>
        </View>

        <PrimaryButton label="Let's go" onPress={onNext} />
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
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.large,
    padding: Spacing.three,
  },
  identityText: {
    flex: 1,
    gap: Spacing.half,
  },
  fieldGroup: {
    gap: Spacing.one,
  },
  hint: {
    fontSize: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: Spacing.one,
  },
  editRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  editBtn: {
    flex: 1,
  },
});
