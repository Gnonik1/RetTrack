import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  cancelAllScheduledAppReminders,
  requestNotificationPermissions,
} from '../src/features/notifications/notifications';
import { NotificationPermissionScreen } from '../src/features/onboarding/screens/NotificationPermissionScreen';
import { usePurchases } from '../src/features/purchases/state/PurchasesState';
import { useAppSettings } from '../src/features/settings/state/AppSettingsState';

export default function NotificationsRoute() {
  const router = useRouter();
  const { source } = useLocalSearchParams<{ source?: string | string[] }>();
  const {
    hasCompletedOnboarding,
    setNotificationPromptStatus,
    setRemindersEnabled,
  } = useAppSettings();
  const { guestPurchaseEntriesUsed, purchases } = usePurchases();
  const resolvedSource = Array.isArray(source) ? source[0] : source;
  const isGuestSource = resolvedSource === 'guest';

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  };

  const continueAfterDecision = () => {
    if (
      hasCompletedOnboarding ||
      purchases.length > 0 ||
      guestPurchaseEntriesUsed > 0
    ) {
      router.replace('/purchases');
      return;
    }

    router.push(
      isGuestSource
        ? '/add-first-purchase?source=guest'
        : '/add-first-purchase',
    );
  };

  const handleEnableNotifications = async () => {
    const isGranted = await requestNotificationPermissions();

    setRemindersEnabled(isGranted);
    setNotificationPromptStatus(isGranted ? 'enabled' : 'dismissed');

    if (!isGranted) {
      await cancelAllScheduledAppReminders();
    }

    continueAfterDecision();
  };

  const handleNotNow = async () => {
    setRemindersEnabled(false);
    setNotificationPromptStatus('dismissed');
    await cancelAllScheduledAppReminders();
    continueAfterDecision();
  };

  return (
    <NotificationPermissionScreen
      onBack={handleBack}
      onEnableNotifications={handleEnableNotifications}
      onNotNow={handleNotNow}
    />
  );
}
