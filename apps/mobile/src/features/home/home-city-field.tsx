import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { GhostButton } from '@/components/ui/buttons';
import { Field } from '@/components/ui/onboarding';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session';
import { useTheme } from '@/hooks/use-theme';

import { detectHomeBase, geocodeHomeBase } from './detect-home';

/**
 * The home city control, shared by onboarding and settings.
 *
 * Both places need the same three things — show where the user lives, let
 * them type somewhere else, or ask the device — and the setting is one a
 * person revisits: it's guessed from wherever they happened to be at signup,
 * and people move.
 *
 * `autoDetect` belongs to onboarding only. Detecting on mount is right when
 * there is nothing set yet and wrong everywhere else: reopening settings
 * would quietly overwrite a correction with the phone's current position,
 * which is exactly wrong for someone reading this screen while travelling.
 */
export function HomeCityField({ autoDetect = false }: { autoDetect?: boolean }) {
  const theme = useTheme();
  const { homeBase, setHomeBase } = useSession();

  const [detecting, setDetecting] = useState(autoDetect);
  // A lookup can take a few seconds. Without a visible busy state the button
  // looks broken and people tap it again, which is how this was found.
  const [looking, setLooking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [lookupFailed, setLookupFailed] = useState(false);

  useEffect(() => {
    if (!autoDetect) return;
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
    if (looking) return;
    setLookupFailed(false);
    setLooking(true);
    try {
      const resolved = await geocodeHomeBase(draft);
      if (resolved) {
        setHomeBase(resolved);
        setEditing(false);
      } else {
        setLookupFailed(true);
      }
    } finally {
      setLooking(false);
    }
  };

  /** Asks the device where it is now — for the user who has actually moved. */
  const detectNow = async () => {
    setDetecting(true);
    setLookupFailed(false);
    try {
      const detected = await detectHomeBase();
      if (detected) setHomeBase(detected);
      else setLookupFailed(true);
    } finally {
      setDetecting(false);
    }
  };

  const homeLabel = homeBase?.label ?? (homeBase ? 'Location detected' : null);

  if (editing) {
    return (
      <View style={styles.group}>
        <Field highlighted>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => void applyTypedHome()}
            placeholder="Type a city, e.g. Mumbai, India"
            placeholderTextColor={theme.textSecondary}
            autoFocus
            style={[styles.input, { color: theme.text }]}
          />
        </Field>
        <View style={styles.row}>
          <GhostButton
            label={looking ? 'Looking it up…' : 'Use this city'}
            onPress={() => void applyTypedHome()}
            disabled={looking}
            style={styles.rowButton}
          />
          <GhostButton
            label="Cancel"
            onPress={() => {
              setEditing(false);
              setLookupFailed(false);
            }}
            style={styles.rowButton}
          />
        </View>
        {lookupFailed && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            Couldn&apos;t find that place. Try a city and country.
          </ThemedText>
        )}
      </View>
    );
  }

  return (
    <View style={styles.group}>
      <Field highlighted>
        <ThemedText type="small">
          {detecting ? '📍 Detecting your location…' : homeLabel ? `📍 ${homeLabel}` : '📍 Not set'}
        </ThemedText>
      </Field>

      <View style={styles.row}>
        <GhostButton
          label={homeBase ? 'Change it' : 'Set it manually'}
          onPress={() => {
            // Starts empty rather than pre-filled: the cursor lands at the end
            // of a pre-filled field, so typing a new city appends to the old
            // one — "Mumbai, IndiaPune, India".
            setDraft('');
            setEditing(true);
          }}
          style={styles.rowButton}
        />
        {!autoDetect && (
          <GhostButton
            label="Use my location"
            onPress={() => void detectNow()}
            disabled={detecting}
            style={styles.rowButton}
          />
        )}
      </View>

      {lookupFailed && !editing && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          Couldn&apos;t work out where you are. Type the city instead.
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  rowButton: {
    flex: 1,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: Spacing.one,
  },
  hint: {
    fontSize: 12,
  },
});
