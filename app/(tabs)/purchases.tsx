import {
  useFocusEffect,
  usePathname,
  useRouter,
} from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState, InteractionManager } from 'react-native';

import { PurchasesHomeScreen } from '../../src/features/purchases/screens/PurchasesHomeScreen';

export default function PurchasesRoute() {
  const pathname = usePathname();
  const router = useRouter();
  const [hasSettledHomeFocus, setHasSettledHomeFocus] = useState(false);
  const isHomeRouteSettled =
    hasSettledHomeFocus &&
    pathname === '/purchases' &&
    AppState.currentState === 'active';

  useFocusEffect(
    useCallback(() => {
      let isFocusActive = true;
      let pendingInteractionTask: ReturnType<
        typeof InteractionManager.runAfterInteractions
      > | null = null;

      const cancelPendingInteractionTask = () => {
        pendingInteractionTask?.cancel();
        pendingInteractionTask = null;
      };

      const settleHomeRoute = () => {
        cancelPendingInteractionTask();
        setHasSettledHomeFocus(false);

        if (
          !isFocusActive ||
          pathname !== '/purchases' ||
          AppState.currentState !== 'active'
        ) {
          return;
        }

        pendingInteractionTask = InteractionManager.runAfterInteractions(() => {
          pendingInteractionTask = null;

          if (
            isFocusActive &&
            pathname === '/purchases' &&
            AppState.currentState === 'active'
          ) {
            setHasSettledHomeFocus(true);
          }
        });
      };

      const appStateSubscription = AppState.addEventListener(
        'change',
        (nextAppState) => {
          if (nextAppState !== 'active') {
            cancelPendingInteractionTask();
            setHasSettledHomeFocus(false);
            return;
          }

          settleHomeRoute();
        },
      );

      settleHomeRoute();

      return () => {
        isFocusActive = false;
        cancelPendingInteractionTask();
        appStateSubscription.remove();
        setHasSettledHomeFocus(false);
      };
    }, [pathname]),
  );

  return (
    <PurchasesHomeScreen
      isHomeRouteSettled={isHomeRouteSettled}
      onAddItem={() => router.push('/add-purchase')}
      onPurchasePress={(itemId) =>
        router.push({
          pathname: '/purchase-details',
          params: {
            itemId,
          },
        })
      }
    />
  );
}
