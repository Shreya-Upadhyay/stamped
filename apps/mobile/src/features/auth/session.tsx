import type { HomeBase } from '@stamped/shared';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { getFirebase } from '@/lib/firebase';

import { readCachedUserDoc, writeCachedUserDoc, type UserDoc } from './user-cache';

/**
 * The signed-in user, backed by Firebase Auth.
 *
 * Everything an account needs sits behind this one interface — the same seam
 * `PhotoSource` provides for the photo library — so screens never touch
 * Firebase directly.
 *
 * Email and password only, deliberately: Google and Apple sign-in each need
 * native client ids and per-build fingerprints, and phone OTP costs money per
 * message. See docs/adr/0003-firebase-backend-and-accounts.md.
 */
export type AuthProvider = 'email';

export type Profile = {
  name: string;
  email: string | null;
  phone: string | null;
  /** Where the user lives, as a label. Mirrors `homeBase.label`. */
  homeCity: string;
  provider: AuthProvider;
};

/**
 * Where the session is.
 *
 * `loading` covers the moment before Firebase has replayed a stored sign-in —
 * treating it as signed-out would flash onboarding at a returning user every
 * launch. `unconfigured` means this build has no Firebase keys at all, which
 * is a setup problem to state plainly rather than an error to throw.
 */
export type SessionStatus = 'loading' | 'unconfigured' | 'signed-out' | 'signed-in';

export type Session = {
  status: SessionStatus;
  /** Firebase uid, and the key everything of the user's is stored under. */
  uid: string | null;
  /** True once onboarding has been completed on any device. */
  onboarded: boolean;
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
  signUp: (params: { name: string; email: string; password: string }) => Promise<void>;
  signIn: (params: { email: string; password: string }) => Promise<void>;
  /** Completes onboarding — this is what unlocks the main app. */
  completeOnboarding: (profile: Profile) => Promise<void>;
  signOut: () => Promise<void>;
  /** Set while an auth call is in flight, so buttons can disable themselves. */
  busy: boolean;
  /** Last auth failure, in words a user can act on. Null when there is none. */
  error: string | null;
  clearError: () => void;
};

const HOME_NOT_SET = 'Home city not set';

/** Used when neither the account nor its document carries a name. */
const FALLBACK_NAME = 'Traveller';

/**
 * Turns a Firebase error code into something worth showing someone.
 *
 * Firebase's own messages read like "Firebase: Error (auth/invalid-credential)",
 * which tells a user nothing about what to do next.
 */
function authErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'That email already has an account. Try signing in instead.';
    case 'auth/invalid-email':
      return "That doesn't look like an email address.";
    case 'auth/weak-password':
      return 'Passwords need to be at least 6 characters.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return "That email and password don't match an account.";
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute and try again.';
    case 'auth/network-request-failed':
      return 'Couldn’t reach Stamped. Check your connection and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

function profileFrom(user: User, stored: UserDoc | null): Profile {
  return {
    name: stored?.displayName ?? user.displayName ?? user.email?.split('@')[0] ?? FALLBACK_NAME,
    email: user.email,
    phone: stored?.phone ?? null,
    homeCity: stored?.homeCity ?? stored?.homeBase?.label ?? HOME_NOT_SET,
    provider: 'email',
  };
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  // Initialised once, on first render. A build with no Firebase keys gets
  // null here and reports itself unconfigured — a fact about the build, so it
  // is derived below rather than pushed into state by an effect.
  const [firebase] = useState(getFirebase);
  const [authStatus, setAuthStatus] = useState<'loading' | 'signed-out' | 'signed-in'>('loading');
  const [uid, setUid] = useState<string | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [homeBase, setHomeBaseState] = useState<HomeBase | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Which user the async loads below belong to. Signing out while a profile
  // read is in flight would otherwise restore the previous user's details.
  const currentUid = useRef<string | null>(null);

  const status: SessionStatus = firebase === null ? 'unconfigured' : authStatus;

  useEffect(() => {
    if (!firebase) return;

    return onAuthStateChanged(firebase.auth, async (user) => {
      currentUid.current = user?.uid ?? null;

      if (!user) {
        setUid(null);
        setProfile(null);
        setHomeBaseState(null);
        setOnboarded(false);
        setAuthStatus('signed-out');
        return;
      }

      // A stored document can only ever ADD to what we know.
      //
      // This read races with the user: signing up and then confirming a home
      // city takes a few seconds, and a slow round trip can deliver the
      // document as it was *before* that — wiping the home city they just
      // set, and the account they just named. Whatever the server says is
      // therefore merged over local state, never allowed to blank it. Nothing
      // in the app clears these fields, so there is no legitimate null to
      // propagate.
      const apply = (stored: UserDoc | null) => {
        if (currentUid.current !== user.uid) return;
        setUid(user.uid);
        setProfile((previous) => {
          const next = profileFrom(user, stored);
          if (!previous) return next;
          return {
            ...next,
            name: next.name === FALLBACK_NAME ? previous.name : next.name,
            homeCity: next.homeCity === HOME_NOT_SET ? previous.homeCity : next.homeCity,
            phone: next.phone ?? previous.phone,
          };
        });
        setHomeBaseState((previous) => stored?.homeBase ?? previous);
        setOnboarded((previous) => previous || stored?.onboardingCompletedAt != null);
        setAuthStatus('signed-in');
      };

      // The local copy first, so a returning user is through to the app
      // without waiting on the network — and gets there at all when there
      // isn't one. Firestore then corrects it.
      const cached = await readCachedUserDoc(user.uid);
      if (currentUid.current !== user.uid) return;
      if (cached) apply(cached);

      try {
        const snapshot = await getDoc(doc(firebase.db, 'users', user.uid));
        const stored = snapshot.exists() ? (snapshot.data() as UserDoc) : null;
        if (currentUid.current !== user.uid) return;
        apply(stored);
        if (stored) void writeCachedUserDoc(user.uid, stored);
      } catch {
        // Offline, or the rules aren't deployed yet. The account is still
        // valid, so sign the user in on what we have rather than stranding
        // them on the sign-in screen.
        if (!cached) apply(null);
      }
    });
  }, [firebase]);

  /** Merges fields into `users/{uid}`, leaving the rest of the document alone. */
  const writeUserDoc = useCallback(
    async (update: UserDoc): Promise<void> => {
      const id = currentUid.current;
      if (!firebase || !id) return;
      // The local copy is updated first and unconditionally: a Firestore write
      // made offline stays pending indefinitely rather than failing, so
      // waiting on it would lose a home city set on a plane.
      await writeCachedUserDoc(id, update);
      await setDoc(doc(firebase.db, 'users', id), update, { merge: true });
    },
    [firebase],
  );

  const setHomeBase = useCallback(
    (home: HomeBase | null) => {
      // Local state first: the onboarding screen has to react immediately, and
      // the write is not worth waiting on.
      setHomeBaseState(home);
      setProfile((previous) =>
        previous ? { ...previous, homeCity: home?.label ?? HOME_NOT_SET } : previous,
      );
      void writeUserDoc({ homeBase: home, homeCity: home?.label ?? null }).catch(() => {
        // Nothing to tell the user: the home city is set again next launch if
        // this never lands.
      });
    },
    [writeUserDoc],
  );

  const signUp = useCallback(
    async ({ name, email, password }: { name: string; email: string; password: string }) => {
      if (!firebase) return;
      setBusy(true);
      setError(null);
      try {
        const credential = await createUserWithEmailAndPassword(
          firebase.auth,
          email.trim(),
          password,
        );
        const displayName = name.trim();
        if (displayName) await updateProfile(credential.user, { displayName });

        currentUid.current = credential.user.uid;
        const fresh: UserDoc = {
          displayName: displayName || null,
          email: credential.user.email,
          phone: null,
          homeCity: null,
          homeBase: null,
          onboardingCompletedAt: null,
          createdAt: Date.now(),
        };
        await writeCachedUserDoc(credential.user.uid, fresh);
        setProfile(profileFrom(credential.user, fresh));
        await setDoc(doc(firebase.db, 'users', credential.user.uid), fresh);
      } catch (cause) {
        setError(authErrorMessage(cause));
      } finally {
        setBusy(false);
      }
    },
    [firebase],
  );

  const signIn = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      if (!firebase) return;
      setBusy(true);
      setError(null);
      try {
        await signInWithEmailAndPassword(firebase.auth, email.trim(), password);
      } catch (cause) {
        setError(authErrorMessage(cause));
      } finally {
        setBusy(false);
      }
    },
    [firebase],
  );

  const completeOnboarding = useCallback(
    async (next: Profile) => {
      setProfile(next);
      setOnboarded(true);
      try {
        await writeUserDoc({
          displayName: next.name,
          phone: next.phone,
          homeCity: next.homeCity === HOME_NOT_SET ? null : next.homeCity,
          onboardingCompletedAt: Date.now(),
        });
      } catch {
        // The user is through to the app either way; onboarding simply runs
        // again next launch if this failed.
      }
    },
    [writeUserDoc],
  );

  const signOut = useCallback(async () => {
    if (!firebase) return;
    await firebaseSignOut(firebase.auth);
  }, [firebase]);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<Session>(
    () => ({
      status,
      uid,
      onboarded,
      profile,
      homeBase,
      setHomeBase,
      signUp,
      signIn,
      completeOnboarding,
      signOut,
      busy,
      error,
      clearError,
    }),
    [
      status,
      uid,
      onboarded,
      profile,
      homeBase,
      setHomeBase,
      signUp,
      signIn,
      completeOnboarding,
      signOut,
      busy,
      error,
      clearError,
    ],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): Session {
  const session = use(SessionContext);
  if (!session) throw new Error('useSession must be used inside a SessionProvider');
  return session;
}

/** The profile shown while onboarding, before it has been confirmed. */
export function useDraftProfile(): Profile {
  const { profile } = useSession();
  return (
    profile ?? { name: FALLBACK_NAME, email: null, phone: null, homeCity: HOME_NOT_SET, provider: 'email' }
  );
}
