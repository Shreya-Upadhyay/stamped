import type { HomeBase } from '@stamped/shared';
import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';

/**
 * Mock session state for the onboarding flow.
 *
 * There is deliberately no real authentication yet: the current milestone is
 * on-device trip grouping (see CLAUDE.md), and nothing in the photo → GPS →
 * clustering pipeline needs an account. Sign-in is presentational.
 *
 * Everything an auth backend would provide sits behind this one interface, so
 * swapping in Firebase Auth later means reimplementing `SessionProvider` —
 * no screen needs to change. Same seam idea as `PhotoSource` in
 * features/trips/types.ts.
 */
export type AuthProvider = 'google' | 'instagram' | 'facebook' | 'phone';

export type Profile = {
  name: string;
  email: string | null;
  phone: string | null;
  /** Where the user lives — later used to avoid treating local outings as trips. */
  homeCity: string;
  /** Which provider they signed in with, for the "via Google" line. */
  provider: AuthProvider;
};

export type Session = {
  signedIn: boolean;
  profile: Profile | null;
  /**
   * Where the user lives, as a point — detected from the device's current
   * position during onboarding, then confirmed or corrected by them.
   *
   * Null until it has been established. Clustering excludes photos taken
   * inside its radius so that everyday life at home doesn't read as travel;
   * null simply means nothing is excluded.
   */
  homeBase: HomeBase | null;
  setHomeBase: (home: HomeBase | null) => void;
  /** Records the chosen provider and moves to profile confirmation. */
  signInWith: (provider: AuthProvider) => void;
  /** Completes onboarding — this is what unlocks the main app. */
  completeOnboarding: (profile: Profile) => void;
  signOut: () => void;
};

/** Stand-in for what a real provider would return after OAuth. */
const MOCK_PROFILE: Record<AuthProvider, Omit<Profile, 'provider'>> = {
  google: {
    name: 'Meera Rao',
    email: 'meera@gmail.com',
    phone: null,
    homeCity: 'Mumbai, India',
  },
  instagram: { name: 'Meera Rao', email: null, phone: null, homeCity: 'Mumbai, India' },
  facebook: { name: 'Meera Rao', email: null, phone: null, homeCity: 'Mumbai, India' },
  phone: { name: 'Meera Rao', email: null, phone: '+91 98765 43210', homeCity: 'Mumbai, India' },
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [homeBase, setHomeBase] = useState<HomeBase | null>(null);

  const signInWith = useCallback((provider: AuthProvider) => {
    setProfile({ ...MOCK_PROFILE[provider], provider });
  }, []);

  const completeOnboarding = useCallback((next: Profile) => {
    setProfile(next);
    setSignedIn(true);
  }, []);

  const signOut = useCallback(() => {
    setSignedIn(false);
    setProfile(null);
    setHomeBase(null);
  }, []);

  const value = useMemo(
    () => ({ signedIn, profile, homeBase, setHomeBase, signInWith, completeOnboarding, signOut }),
    [signedIn, profile, homeBase, setHomeBase, signInWith, completeOnboarding, signOut],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): Session {
  const session = use(SessionContext);
  if (!session) throw new Error('useSession must be used inside a SessionProvider');
  return session;
}

/** Draft profile shown on the confirmation screen before onboarding completes. */
export function useDraftProfile(): Profile {
  const { profile } = useSession();
  return profile ?? { ...MOCK_PROFILE.google, provider: 'google' };
}
