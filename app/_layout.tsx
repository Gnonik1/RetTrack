import { Stack } from 'expo-router';

import { configureNotificationHandler } from '../src/features/notifications/notifications';
import { PurchasesProvider } from '../src/features/purchases/state/PurchasesState';

configureNotificationHandler();

export default function RootLayout() {
  return (
    <PurchasesProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </PurchasesProvider>
  );
}
