import { useLocalSearchParams, useRouter } from 'expo-router';

import { AddFirstPurchaseScreen } from '../src/features/purchases/screens/AddFirstPurchaseScreen';
import { usePurchases } from '../src/features/purchases/state/PurchasesState';

export default function EditPurchaseRoute() {
  const router = useRouter();
  const { itemId } = useLocalSearchParams<{ itemId?: string }>();
  const { getPurchaseById, updatePurchase } = usePurchases();
  const purchaseDetails = getPurchaseById(itemId);

  const detailsRoute = {
    pathname: '/purchase-details',
    params: {
      itemId: purchaseDetails.id,
    },
  } as const;

  const returnToDetails = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(detailsRoute);
  };

  return (
    <AddFirstPurchaseScreen
      initialValues={purchaseDetails}
      key={purchaseDetails.id}
      mode="editPurchase"
      onBack={returnToDetails}
      onSaveItem={(input) => {
        updatePurchase(purchaseDetails.id, input);
        returnToDetails();
      }}
    />
  );
}
