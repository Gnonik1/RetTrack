import { useRouter } from 'expo-router';

import { PaywallScreen } from '../src/features/monetization/screens/PaywallScreen';

// Thin route controller, matching the app's convention (see notifications.tsx /
// purchase-details.tsx / add-purchase.tsx): the route owns only router wiring and
// delegates the UI to a feature screen. There is no `presentation: 'modal'` in
// this app — every dismissible secondary screen is a pushed route closed via
// router.back(), so the paywall matches that rather than inventing a new pattern.
export default function PaywallRoute() {
  const router = useRouter();

  const handleDismiss = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/purchases');
  };

  return <PaywallScreen onDismiss={handleDismiss} />;
}
