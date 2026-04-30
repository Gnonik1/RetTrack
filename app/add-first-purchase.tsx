import { useRouter } from 'expo-router';

import { AddFirstPurchaseScreen } from '../src/features/purchases/screens/AddFirstPurchaseScreen';

export default function AddFirstPurchaseRoute() {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  };

  return (
    <AddFirstPurchaseScreen
      onBack={handleBack}
      onSaveItem={() => router.replace('/purchases')}
    />
  );
}
