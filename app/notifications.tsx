import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { AppStartupSplash } from '../src/components/AppStartupSplash';
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
    hasHydratedSettings,
    notificationPromptStatus,
    persistNotificationPreference,
  } = useAppSettings();
  const { guestPurchaseEntriesUsed, hasHydratedPurchases, purchases } =
    usePurchases();
  const [isDecisionPending, setIsDecisionPending] = useState(false);
  const decisionPendingRef = useRef(false);
  const resolvedSource = Array.isArray(source) ? source[0] : source;
  const isGuestSource = resolvedSource === 'guest';

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  };

  const continueAfterDecision = useCallback(() => {
    if (
      hasCompletedOnboarding ||
      purchases.length > 0 ||
      guestPurchaseEntriesUsed > 0
    ) {
      router.replace('/purchases');
      return;
    }

    router.replace(
      isGuestSource
        ? '/add-first-purchase?source=guest'
        : '/add-first-purchase',
    );
  }, [
    guestPurchaseEntriesUsed,
    hasCompletedOnboarding,
    isGuestSource,
    purchases.length,
    router,
  ]);

  useEffect(() => {
    if (
      !hasHydratedSettings ||
      !hasHydratedPurchases ||
      notificationPromptStatus === 'undecided' ||
      decisionPendingRef.current
    ) {
      return;
    }

    continueAfterDecision();
  }, [
    continueAfterDecision,
    hasHydratedPurchases,
    hasHydratedSettings,
    notificationPromptStatus,
  ]);

  const runNotificationDecision = async (
    applyDecision: () => Promise<void>,
  ) => {
    if (decisionPendingRef.current) {
      return;
    }

    decisionPendingRef.current = true;
    setIsDecisionPending(true);

    try {
      await applyDecision();
      continueAfterDecision();
    } catch {
      decisionPendingRef.current = false;
      setIsDecisionPending(false);
    }
  };

  const handleEnableNotifications = async () => {
    await runNotificationDecision(async () => {
      const isGranted = await requestNotificationPermissions();

      await persistNotificationPreference({
        notificationPromptStatus: isGranted ? 'enabled' : 'dismissed',
        remindersEnabled: isGranted,
      });

      if (!isGranted) {
        await cancelAllScheduledAppReminders();
      }
    });
  };

  const handleNotNow = async () => {
    await runNotificationDecision(async () => {
      await persistNotificationPreference({
        notificationPromptStatus: 'dismissed',
        remindersEnabled: false,
      });
      await cancelAllScheduledAppReminders();
    });
  };

  if (
    !hasHydratedSettings ||
    !hasHydratedPurchases ||
    notificationPromptStatus !== 'undecided'
  ) {
    return <AppStartupSplash />;
  }

  return (
    <NotificationPermissionScreen
      isDecisionPending={isDecisionPending}
      onBack={handleBack}
      onEnableNotifications={handleEnableNotifications}
      onNotNow={handleNotNow}
    />
  );
}
