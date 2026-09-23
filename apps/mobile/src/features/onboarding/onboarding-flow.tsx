import { useState } from 'react';

import { useSession } from '@/features/auth/session';

import ConsentStep from './steps/consent';
import PermissionsStep from './steps/permissions';
import ProfileStep from './steps/profile';
import SignInStep from './steps/signin';
import SignUpStep from './steps/signup';
import WelcomeStep from './steps/welcome';

/**
 * Onboarding as a component, not a set of routes.
 *
 * It was routes first, which fought Expo Router in three separate ways on
 * Android: a native stack at the root blanked the screen (react-native-screens
 * Fabric init), `useSegments()` doesn't reliably report route-group names, and
 * a `Redirect`-based guard looped. None of that is incidental complexity worth
 * carrying — this is a linear wizard with a back button, which local step
 * state models exactly. Routes buy deep-linking into a half-finished signup,
 * which nobody wants anyway.
 */
type Step = 'welcome' | 'signup' | 'signin' | 'profile' | 'permissions' | 'consent';

/** The steps that are about proving who you are, rather than about this device. */
const AUTH_STEPS: Step[] = ['welcome', 'signup', 'signin'];

export function OnboardingFlow() {
  const { status } = useSession();
  const [chosen, setChosen] = useState<Step>('welcome');

  // Creating an account, or signing back into one that never finished
  // onboarding, moves the wizard on by itself. Derived rather than pushed
  // into state by an effect: signing in is not an event this component needs
  // to remember, it's a condition that makes the sign-in steps unreachable.
  // Once onboarding completes, the gate in app/_layout.tsx unmounts all this.
  const step = status === 'signed-in' && AUTH_STEPS.includes(chosen) ? 'profile' : chosen;
  const setStep = setChosen;

  switch (step) {
    case 'signup':
      return <SignUpStep onSignIn={() => setStep('signin')} />;
    case 'signin':
      return <SignInStep onSignUp={() => setStep('signup')} />;
    case 'profile':
      return <ProfileStep onNext={() => setStep('permissions')} />;
    case 'permissions':
      return <PermissionsStep onNext={() => setStep('consent')} />;
    case 'consent':
      // Completing onboarding is what swaps this whole tree for the app.
      return <ConsentStep />;
    case 'welcome':
    default:
      return <WelcomeStep onSignUp={() => setStep('signup')} onSignIn={() => setStep('signin')} />;
  }
}
