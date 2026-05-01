import { Stack } from 'expo-router';

import { PurchasesProvider } from '../src/features/purchases/state/PurchasesState';

export default function RootLayout() {
  return (
    <PurchasesProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </PurchasesProvider>
  );
}
