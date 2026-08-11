import { useCallback, useState } from 'react';

import { useSession, type AuthProvider } from '@/features/auth/session';

import ConsentStep from './steps/consent';
import OtpStep from './steps/otp';
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
type Step = 'welcome' | 'signup' | 'signin' | 'otp' | 'profile' | 'permissions' | 'consent';

export function OnboardingFlow() {
  const { signInWith } = useSession();
  const [step, setStep] = useState<Step>('welcome');

  // Chose a provider: remember it, then confirm the details it "returned".
  const chooseProvider = useCallback(
    (provider: AuthProvider, next: Step) => {
      signInWith(provider);
      setStep(next);
    },
    [signInWith],
  );

  switch (step) {
    case 'signup':
      return (
        <SignUpStep
          onProvider={(p) => chooseProvider(p, 'profile')}
          onPhone={() => chooseProvider('phone', 'otp')}
          onSignIn={() => setStep('signin')}
        />
      );
    case 'signin':
      return (
        <SignInStep
          onProvider={(p) => chooseProvider(p, 'profile')}
          onPhone={() => chooseProvider('phone', 'otp')}
          onSignUp={() => setStep('signup')}
        />
      );
    case 'otp':
      return <OtpStep onVerified={() => setStep('profile')} />;
    case 'profile':
      return <ProfileStep onNext={() => setStep('permissions')} />;
    case 'permissions':
      return <PermissionsStep onNext={() => setStep('consent')} />;
    case 'consent':
      // Completing the session is what swaps this whole tree for the app.
      return <ConsentStep />;
    case 'welcome':
    default:
      return <WelcomeStep onSignUp={() => setStep('signup')} onSignIn={() => setStep('signin')} />;
  }
}
