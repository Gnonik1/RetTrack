import { Stack } from 'expo-router';

import { configureNotificationHandler } from '../src/features/notifications/notifications';
import { PurchasesProvider } from '../src/features/purchases/state/PurchasesState';
import { AppSettingsProvider } from '../src/features/settings/state/AppSettingsState';

configureNotificationHandler();

export default function RootLayout() {
  return (
    <AppSettingsProvider>
      <PurchasesProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="welcome" options={{ animation: 'none' }} />
          <Stack.Screen name="purchases" options={{ animation: 'none' }} />
          <Stack.Screen name="history" options={{ animation: 'none' }} />
          <Stack.Screen name="profile" options={{ animation: 'none' }} />
          <Stack.Screen name="settings" options={{ animation: 'none' }} />
        </Stack>
      </PurchasesProvider>
    </AppSettingsProvider>
  );
}
