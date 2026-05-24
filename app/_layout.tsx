import { Stack } from 'expo-router';
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from 'react-native-safe-area-context';

import { AuthDeepLinkHandler } from '../src/components/AuthDeepLinkHandler';
import { configureNotificationHandler } from '../src/features/notifications/notifications';
import { PurchasesProvider } from '../src/features/purchases/state/PurchasesState';
import { AppSettingsProvider } from '../src/features/settings/state/AppSettingsState';
import { AuthProvider } from '../src/state/AuthState';

configureNotificationHandler();

export default function RootLayout() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AuthProvider>
        <AuthDeepLinkHandler />
        <AppSettingsProvider>
          <PurchasesProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="welcome" options={{ animation: 'none' }} />
              <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
            </Stack>
          </PurchasesProvider>
        </AppSettingsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
