import { useRouter } from 'expo-router';

import { requestNotificationPermissions } from '../src/features/notifications/notifications';
import { NotificationPermissionScreen } from '../src/features/onboarding/screens/NotificationPermissionScreen';

export default function NotificationsRoute() {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  };

  const continueAfterDecision = () => {
    router.push('/add-first-purchase');
  };

  const handleEnableNotifications = async () => {
    await requestNotificationPermissions();
    continueAfterDecision();
  };

  return (
    <NotificationPermissionScreen
      onBack={handleBack}
      onEnableNotifications={handleEnableNotifications}
      onNotNow={continueAfterDecision}
    />
  );
}
