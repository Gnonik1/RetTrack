import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '../../../state/AuthState';
import {
  getPlanAccessSubject,
  getProFeatureAccess,
  type ProFeatureKey,
} from '../access/planAccess';
import { usePlan } from './PlanState';

type UseProFeatureGateOptions = {
  // Analytics `source` tag carried into the sign-in route, so each caller keeps its
  // own attribution (Profile → '/sign-in?source=profile'). Omitted → plain
  // '/sign-in', which is what a screen with no sign-in prop wants by default.
  signInSource?: string;
};

// Shared gate for locked Pro surfaces, lifted out of ProfileScreen so a second
// screen (e.g. a Home Pro entry point) can reuse the exact routing without copying
// it. The hook reads auth + plan state itself, so callers pass nothing but their
// own sign-in `source` — no isAuthenticated/isPro plumbing at the call site.
//
// The guest/Free split lives HERE only: guest → sign-in first (RevenueCat's App
// User ID is the Supabase user id, so a Guest has no account for an entitlement to
// attach to — they must sign in before any purchase flow), signed-in Free → the
// paywall integration point. A Pro subject yields recommendedAction 'allow', so
// neither branch fires (no-op); callers that need the export gate check `allowed`
// themselves via planAccess.
export function useProFeatureGate({
  signInSource,
}: UseProFeatureGateOptions = {}) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { isPro } = usePlan();

  return useCallback(
    (feature: ProFeatureKey) => {
      const subject = getPlanAccessSubject({ isAuthenticated, isPro });
      const access = getProFeatureAccess({ feature, subject });

      if (access.recommendedAction === 'showSignInRequired') {
        // Direct navigation (not a caller-supplied onSignIn prop) so a screen with
        // no such prop can use this gate as-is. `source` preserves each caller's tag.
        router.push(
          signInSource ? `/sign-in?source=${signInSource}` : '/sign-in',
        );
      } else if (access.recommendedAction === 'showPaywall') {
        // Single integration point for the Pro paywall, shared by every Pro-gated
        // surface. The paywall screen isn't built yet, so this surfaces a
        // lightweight "coming soon" notice; replace this body with paywall
        // navigation (e.g. router.push('/paywall')) once that screen exists.
        Alert.alert(
          'RetTrack Pro',
          'Spending insights and more are coming soon.',
        );
      }
    },
    [isAuthenticated, isPro, router, signInSource],
  );
}
