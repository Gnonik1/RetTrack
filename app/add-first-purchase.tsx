import { useRouter } from 'expo-router';

import { GUEST_ITEM_LIMIT } from '../src/features/purchases/constants';
import { AddFirstPurchaseScreen } from '../src/features/purchases/screens/AddFirstPurchaseScreen';
import { usePurchases } from '../src/features/purchases/state/PurchasesState';
import { useAppSettings } from '../src/features/settings/state/AppSettingsState';

export default function AddFirstPurchaseRoute() {
  const router = useRouter();
  const { completeOnboarding } = useAppSettings();
  const { addPurchase, guestPurchaseEntriesUsed } = usePurchases();
  const isGuestItemLimitReached =
    guestPurchaseEntriesUsed >= GUEST_ITEM_LIMIT;

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
      isGuestItemLimitReached={isGuestItemLimitReached}
      onBack={handleBack}
      onLimitSignUp={() => router.push('/sign-up')}
      onSaveItem={(input) => {
        if (guestPurchaseEntriesUsed >= GUEST_ITEM_LIMIT) {
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
