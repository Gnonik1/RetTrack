import { useRouter } from 'expo-router';

import { usePlan } from '../src/features/monetization/state/PlanState';
import { AddFirstPurchaseScreen } from '../src/features/purchases/screens/AddFirstPurchaseScreen';
import { usePurchases } from '../src/features/purchases/state/PurchasesState';
import { useAuth } from '../src/state/AuthState';

export default function AddPurchaseRoute() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { limits } = usePlan();
  const { accountPurchaseEntriesUsed, addPurchase, isGuestAddLimitReached } =
    usePurchases();
  const signedInPurchaseLimit = limits.signedInFreePurchases;
  const isGuestItemLimitReached =
    !isAuthenticated && isGuestAddLimitReached;
  const isAccountItemLimitReached =
    isAuthenticated && accountPurchaseEntriesUsed >= signedInPurchaseLimit;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/purchases');
  };

  return (
    <AddFirstPurchaseScreen
      mode="addPurchase"
      isAccountItemLimitReached={isAccountItemLimitReached}
      isGuestItemLimitReached={isGuestItemLimitReached}
      isSignedIn={isAuthenticated}
      onBack={handleBack}
      onLimitSignUp={() => router.push('/sign-up?source=limit')}
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
        router.replace('/purchases');
        return true;
      }}
    />
  );
}
