import { useRouter } from 'expo-router';

import { ACCOUNT_ITEM_LIMIT } from '../src/features/purchases/constants';
import { AddFirstPurchaseScreen } from '../src/features/purchases/screens/AddFirstPurchaseScreen';
import { usePurchases } from '../src/features/purchases/state/PurchasesState';
import { useAuth } from '../src/state/AuthState';

export default function AddPurchaseRoute() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { accountPurchaseEntriesUsed, addPurchase, isGuestAddLimitReached } =
    usePurchases();
  const isGuestItemLimitReached =
    !isAuthenticated && isGuestAddLimitReached;
  const isAccountItemLimitReached =
    isAuthenticated && accountPurchaseEntriesUsed >= ACCOUNT_ITEM_LIMIT;

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
          accountPurchaseEntriesUsed >= ACCOUNT_ITEM_LIMIT
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
