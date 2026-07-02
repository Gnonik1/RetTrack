import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';

import { AuthDeepLinkHandler } from '../src/components/AuthDeepLinkHandler';
import { PlanProvider } from '../src/features/monetization/state/PlanState';
import { configureNotificationHandler } from '../src/features/notifications/notifications';
import { PurchasesProvider } from '../src/features/purchases/state/PurchasesState';
import { AppSettingsProvider } from '../src/features/settings/state/AppSettingsState';
import { AuthProvider } from '../src/state/AuthState';

configureNotificationHandler();
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

let hasRequestedNativeSplashHide = false;

function hideNativeSplashAfterLayout() {
  if (hasRequestedNativeSplashHide) {
    return;
  }

  hasRequestedNativeSplashHide = true;
  void SplashScreen.hideAsync().catch(() => {
    hasRequestedNativeSplashHide = false;
  });
}

export default function RootLayout() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <View onLayout={hideNativeSplashAfterLayout} style={styles.root}>
        <AuthProvider>
          <AuthDeepLinkHandler />
          <AppSettingsProvider>
            <PlanProvider>
              <PurchasesProvider>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="welcome" options={{ animation: 'none' }} />
                  <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
                </Stack>
              </PurchasesProvider>
            </PlanProvider>
          </AppSettingsProvider>
        </AuthProvider>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
