import { useRouter } from 'expo-router';

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

  return (
    <NotificationPermissionScreen
      onBack={handleBack}
      onEnableNotifications={() => router.push('/add-first-purchase')}
      onNotNow={() => router.push('/add-first-purchase')}
    />
  );
}
