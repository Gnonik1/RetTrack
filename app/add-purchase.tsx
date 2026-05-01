import { useRouter } from 'expo-router';

import { AddFirstPurchaseScreen } from '../src/features/purchases/screens/AddFirstPurchaseScreen';
import { usePurchases } from '../src/features/purchases/state/PurchasesState';

export default function AddPurchaseRoute() {
  const router = useRouter();
  const { addPurchase } = usePurchases();

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
      onBack={handleBack}
      onSaveItem={(input) => {
        addPurchase(input);
        router.replace('/purchases');
      }}
    />
  );
}
