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
import { useAuth } from '../src/state/AuthState';

export default function NotificationsRoute() {
  const router = useRouter();
  const { source } = useLocalSearchParams<{ source?: string | string[] }>();
  const {
    hasCompletedOnboarding,
    hasHydratedSettings,
    isSettingsScopeReady,
    notificationPromptStatus,
    persistNotificationPreference,
  } = useAppSettings();
  const { isAuthenticated, isAuthLoading } = useAuth();
  const { guestPurchaseEntriesUsed, hasHydratedPurchases, purchases } =
    usePurchases();
  const [isDecisionPending, setIsDecisionPending] = useState(false);
  const decisionPendingRef = useRef(false);
  const resolvedSource = Array.isArray(source) ? source[0] : source;
  const isAuthSource = resolvedSource === 'auth';
  const isGuestSource = resolvedSource === 'guest';
  const canUseNotificationPreferences =
    hasHydratedSettings &&
    isSettingsScopeReady &&
    (!isAuthSource || (!isAuthLoading && isAuthenticated));

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
      !canUseNotificationPreferences ||
      !hasHydratedPurchases ||
      notificationPromptStatus === 'undecided' ||
      decisionPendingRef.current
    ) {
      return;
    }

    continueAfterDecision();
  }, [
    canUseNotificationPreferences,
    continueAfterDecision,
    hasHydratedPurchases,
    hasHydratedSettings,
    notificationPromptStatus,
  ]);

  const runNotificationDecision = async (
    applyDecision: () => Promise<void>,
  ) => {
    if (decisionPendingRef.current || !canUseNotificationPreferences) {
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
    !canUseNotificationPreferences ||
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
