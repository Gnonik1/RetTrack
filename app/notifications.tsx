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

  const handleEnableNotifications = async () => {
    await requestNotificationPermissions();
    router.push('/add-first-purchase');
  };

  return (
    <NotificationPermissionScreen
      onBack={handleBack}
      onEnableNotifications={handleEnableNotifications}
      onNotNow={() => router.push('/add-first-purchase')}
    />
  );
}
