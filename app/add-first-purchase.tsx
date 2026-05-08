import { useRouter } from 'expo-router';

import {
  ACCOUNT_ITEM_LIMIT,
  GUEST_ITEM_LIMIT,
} from '../src/features/purchases/constants';
import { AddFirstPurchaseScreen } from '../src/features/purchases/screens/AddFirstPurchaseScreen';
import { usePurchases } from '../src/features/purchases/state/PurchasesState';
import { useAppSettings } from '../src/features/settings/state/AppSettingsState';
import { useAuth } from '../src/state/AuthState';

export default function AddFirstPurchaseRoute() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { completeOnboarding } = useAppSettings();
  const { addPurchase, guestPurchaseEntriesUsed, purchases } = usePurchases();
  const isGuestItemLimitReached =
    !isAuthenticated && guestPurchaseEntriesUsed >= GUEST_ITEM_LIMIT;
  const isAccountItemLimitReached =
    isAuthenticated && purchases.length >= ACCOUNT_ITEM_LIMIT;

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
      onBack={handleBack}
      onLimitSignUp={() => router.push('/sign-up?source=limit')}
      onSaveItem={(input) => {
        if (!isAuthenticated && guestPurchaseEntriesUsed >= GUEST_ITEM_LIMIT) {
          return false;
        }

        if (isAuthenticated && purchases.length >= ACCOUNT_ITEM_LIMIT) {
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
