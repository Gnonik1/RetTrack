import { useLocalSearchParams, useRouter } from 'expo-router';

import { usePlan } from '../src/features/monetization/state/PlanState';
import { AddFirstPurchaseScreen } from '../src/features/purchases/screens/AddFirstPurchaseScreen';
import { usePurchases } from '../src/features/purchases/state/PurchasesState';
import { useAppSettings } from '../src/features/settings/state/AppSettingsState';
import { useAuth } from '../src/state/AuthState';

export default function AddFirstPurchaseRoute() {
  const router = useRouter();
  const { source } = useLocalSearchParams<{ source?: string | string[] }>();
  const { isAuthenticated } = useAuth();
  const { limits, photoLimit } = usePlan();
  const { completeOnboarding } = useAppSettings();
  const { accountPurchaseEntriesUsed, addPurchase, isGuestAddLimitReached } =
    usePurchases();
  const signedInPurchaseLimit = limits.signedInFreePurchases;
  const resolvedSource = Array.isArray(source) ? source[0] : source;
  const isGuestSource = resolvedSource === 'guest';
  const isGuestItemLimitReached =
    !isAuthenticated && isGuestAddLimitReached;
  const isAccountItemLimitReached =
    isAuthenticated && accountPurchaseEntriesUsed >= signedInPurchaseLimit;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  };

  return (
    <AddFirstPurchaseScreen
      mode="firstPurchase"
      isAccountItemLimitReached={isAccountItemLimitReached}
      isGuestItemLimitReached={isGuestItemLimitReached}
      isSignedIn={isAuthenticated}
      onBack={handleBack}
      onLimitSignUp={() => router.push('/sign-up?source=limit')}
      photoLimitOverride={isGuestSource ? photoLimit : undefined}
      onSaveItem={(input) => {
        if (!isAuthenticated && isGuestAddLimitReached) {
          return false;
        }

        if (
          isAuthenticated &&
          accountPurchaseEntriesUsed >= signedInPurchaseLimit
        ) {
          return false;
        }

        addPurchase(input);
        completeOnboarding();
        router.replace('/purchases');
        return true;
      }}
      onSkip={() => {
        completeOnboarding();
        router.replace('/purchases');
      }}
    />
  );
}
