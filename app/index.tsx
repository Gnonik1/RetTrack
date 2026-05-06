import { Redirect } from 'expo-router';

import { usePurchases } from '../src/features/purchases/state/PurchasesState';
import { useAppSettings } from '../src/features/settings/state/AppSettingsState';

export default function Index() {
  const {
    hasCompletedOnboarding,
    hasHydratedSettings,
  } = useAppSettings();
  const {
    guestPurchaseEntriesUsed,
    hasHydratedPurchases,
    purchases,
  } = usePurchases();

  if (!hasHydratedSettings || !hasHydratedPurchases) {
    return null;
  }

  if (
    hasCompletedOnboarding ||
    purchases.length > 0 ||
    guestPurchaseEntriesUsed > 0
  ) {
    return <Redirect href="/purchases" />;
  }

  return <Redirect href="/welcome" />;
}
