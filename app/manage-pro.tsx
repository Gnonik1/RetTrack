import { useRouter } from 'expo-router';

import { ManageProScreen } from '../src/features/monetization/screens/ManageProScreen';

// Thin route controller, matching the app's convention (see paywall.tsx /
// notifications.tsx): the route owns only router wiring and delegates the UI to a
// feature screen. Like the paywall, this is a pushed route closed via
// router.back() — there is no `presentation: 'modal'` in this app.
export default function ManageProRoute() {
  const router = useRouter();

  const handleDismiss = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/purchases');
  };

  return <ManageProScreen onDismiss={handleDismiss} />;
}
