import { Redirect } from 'expo-router';

import { AppStartupSplash } from '../src/components/AppStartupSplash';
import { usePurchases } from '../src/features/purchases/state/PurchasesState';
import { useAppSettings } from '../src/features/settings/state/AppSettingsState';
import { useAuth } from '../src/state/AuthState';

export default function Index() {
  const {
    isAuthenticated,
    isAuthLoading,
  } = useAuth();
  const {
    hasCompletedOnboarding,
    hasHydratedSettings,
  } = useAppSettings();
  const {
    guestPurchaseEntriesUsed,
    hasHydratedPurchases,
    purchases,
  } = usePurchases();

  if (isAuthLoading || !hasHydratedSettings || !hasHydratedPurchases) {
    return <AppStartupSplash />;
  }

  if (
    hasCompletedOnboarding ||
    purchases.length > 0 ||
    guestPurchaseEntriesUsed > 0
  ) {
    return <Redirect href="/purchases" />;
  }

  if (isAuthenticated) {
    return <Redirect href="/notifications" />;
  }

  return <Redirect href="/welcome" />;
}
