import { useRouter } from 'expo-router';
import { useState } from 'react';

import { WelcomeScreen } from '../src/features/onboarding/screens/WelcomeScreen';
import { getStoredHasCompletedOnboardingForUser } from '../src/features/settings/state/AppSettingsState';
import { signInWithGoogle } from '../src/services/authService';

function getGoogleWelcomeErrorMessage(
  status:
    | 'missingProviderUrl'
    | 'providerSetupRequired'
    | 'sessionExchangeFailed'
    | 'unknownError',
) {
  if (status === 'providerSetupRequired') {
    return "Google sign-in isn't fully set up yet. Please use email sign-up for now.";
  }

  if (status === 'missingProviderUrl') {
    return "Google couldn't start account setup. Please try again.";
  }

  if (status === 'sessionExchangeFailed') {
    return "Google sign-in couldn't finish. Please try again.";
  }

  return "We couldn't continue with Google. Please try again.";
}

async function getOnboardingGoogleSuccessRoute(userId?: string) {
  if (!userId) {
    return '/notifications';
  }

  const hasCompletedOnboarding =
    await getStoredHasCompletedOnboardingForUser(userId);

  return hasCompletedOnboarding ? '/purchases' : '/notifications';
}

export default function WelcomeRoute() {
  const router = useRouter();
  const [googleError, setGoogleError] = useState('');
  const [isContinuingWithGoogle, setIsContinuingWithGoogle] = useState(false);

  const handleContinueWithGoogle = async () => {
    setGoogleError('');
    setIsContinuingWithGoogle(true);

    try {
      const result = await signInWithGoogle();

      if (result.status === 'canceled') {
        return;
      }

      if (result.status !== 'success') {
        setGoogleError(getGoogleWelcomeErrorMessage(result.status));
        return;
      }

      router.replace(
        await getOnboardingGoogleSuccessRoute(result.data.session?.user.id),
      );
    } catch {
      setGoogleError("We couldn't continue with Google. Please try again.");
    } finally {
      setIsContinuingWithGoogle(false);
    }
  };

  return (
    <WelcomeScreen
      googleError={googleError}
      isContinuingWithGoogle={isContinuingWithGoogle}
      onContinueAsGuest={() => router.push('/notifications?source=guest')}
      onContinueWithEmail={() => router.push('/sign-up?source=onboarding')}
      onContinueWithGoogle={handleContinueWithGoogle}
      onSignIn={() => router.push('/sign-in?source=onboarding')}
    />
  );
}
