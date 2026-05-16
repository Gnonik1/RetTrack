import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { WelcomeScreen } from '../src/features/onboarding/screens/WelcomeScreen';
import { getStoredHasCompletedOnboardingForUser } from '../src/features/settings/state/AppSettingsState';
import { signInWithGoogle, signOut } from '../src/services/authService';
import { useAuth } from '../src/state/AuthState';

const GUEST_ONBOARDING_ROUTE = '/notifications?source=guest';

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
  const { isAuthenticated, isAuthLoading } = useAuth();
  const [googleError, setGoogleError] = useState('');
  const [pendingGuestNavigation, setPendingGuestNavigation] = useState(false);
  const [hasGuestSignOutCompleted, setHasGuestSignOutCompleted] =
    useState(false);
  const [isContinuingWithGoogle, setIsContinuingWithGoogle] = useState(false);
  const hasRequestedGuestSignOutRef = useRef(false);

  const signOutForGuestNavigation = useCallback(async () => {
    try {
      const { error } = await signOut();

      if (error) {
        throw error;
      }

      setHasGuestSignOutCompleted(true);
    } catch {
      hasRequestedGuestSignOutRef.current = false;
      setHasGuestSignOutCompleted(false);
      setPendingGuestNavigation(false);
      setGoogleError("We couldn't continue as guest. Please try again.");
    }
  }, []);

  useEffect(() => {
    if (!pendingGuestNavigation || isAuthLoading) {
      return;
    }

    if (!isAuthenticated) {
      if (!hasRequestedGuestSignOutRef.current) {
        setHasGuestSignOutCompleted(true);
      }

      return;
    }

    if (hasRequestedGuestSignOutRef.current) {
      return;
    }

    hasRequestedGuestSignOutRef.current = true;
    void signOutForGuestNavigation();
  }, [
    isAuthenticated,
    isAuthLoading,
    pendingGuestNavigation,
    signOutForGuestNavigation,
  ]);

  useEffect(() => {
    if (
      !pendingGuestNavigation ||
      !hasGuestSignOutCompleted ||
      isAuthLoading ||
      isAuthenticated
    ) {
      return;
    }

    hasRequestedGuestSignOutRef.current = false;
    setPendingGuestNavigation(false);
    setHasGuestSignOutCompleted(false);
    router.replace(GUEST_ONBOARDING_ROUTE);
  }, [
    hasGuestSignOutCompleted,
    isAuthenticated,
    isAuthLoading,
    pendingGuestNavigation,
    router,
  ]);

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

  const handleContinueAsGuest = () => {
    if (pendingGuestNavigation) {
      return;
    }

    setGoogleError('');
    setHasGuestSignOutCompleted(false);

    if (!isAuthLoading && !isAuthenticated) {
      router.replace(GUEST_ONBOARDING_ROUTE);
      return;
    }

    setPendingGuestNavigation(true);

    if (!isAuthLoading && isAuthenticated) {
      hasRequestedGuestSignOutRef.current = true;
      void signOutForGuestNavigation();
    }
  };

  return (
    <WelcomeScreen
      googleError={googleError}
      isContinuingAsGuest={pendingGuestNavigation}
      isContinuingWithGoogle={isContinuingWithGoogle}
      onContinueAsGuest={handleContinueAsGuest}
      onContinueWithEmail={() => router.push('/sign-up?source=onboarding')}
      onContinueWithGoogle={handleContinueWithGoogle}
      onSignIn={() => router.push('/sign-in?source=onboarding')}
    />
  );
}
