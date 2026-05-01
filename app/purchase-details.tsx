import { useLocalSearchParams, useRouter } from 'expo-router';

import { PurchaseDetailsScreen } from '../src/features/purchases/screens/PurchaseDetailsScreen';

export default function PurchaseDetailsRoute() {
  const router = useRouter();
  const { itemId } = useLocalSearchParams<{ itemId?: string }>();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/purchases');
  };

  return (
    <PurchaseDetailsScreen
      itemId={itemId}
      onBack={handleBack}
      onEdit={(selectedItemId) =>
        router.push({
          pathname: '/edit-purchase',
          params: {
            itemId: selectedItemId,
          },
        })
      }
    />
  );
}
