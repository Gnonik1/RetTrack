import { useRouter } from 'expo-router';

import { GUEST_ITEM_LIMIT } from '../src/features/purchases/constants';
import { AddFirstPurchaseScreen } from '../src/features/purchases/screens/AddFirstPurchaseScreen';
import { usePurchases } from '../src/features/purchases/state/PurchasesState';

export default function AddPurchaseRoute() {
  const router = useRouter();
  const { addPurchase, purchases } = usePurchases();
  const isGuestItemLimitReached = purchases.length >= GUEST_ITEM_LIMIT;

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
      isGuestItemLimitReached={isGuestItemLimitReached}
      onBack={handleBack}
      onLimitSignUp={() => router.push('/sign-up')}
      onSaveItem={(input) => {
        if (purchases.length >= GUEST_ITEM_LIMIT) {
          return false;
        }

        addPurchase(input);
        router.replace('/purchases');
        return true;
      }}
    />
  );
}
