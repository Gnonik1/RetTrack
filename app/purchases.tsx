import { useRouter } from 'expo-router';

import { PurchasesHomeScreen } from '../src/features/purchases/screens/PurchasesHomeScreen';

export default function PurchasesRoute() {
  const router = useRouter();

  return (
    <PurchasesHomeScreen
      onAddItem={() => router.push('/add-purchase')}
      onPurchasePress={(itemId) =>
        router.push({
          pathname: '/purchase-details',
          params: {
            itemId,
          },
        })
      }
    />
  );
}
