import { useRouter } from 'expo-router';
import { useCallback } from 'react';

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
// paywall integration point. A Pro subject yields recommendedAction 'allow' and
// is routed to the Manage Pro screen; callers that need the export gate still
// check `allowed` themselves via planAccess.
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
        // surface: a signed-in Free user is routed to the paywall, which presents
        // the plans and the purchase/restore flow. (Guests never reach here — they
        // hit 'showSignInRequired' above and go to sign-in first.)
        router.push('/paywall');
      } else if (access.recommendedAction === 'allow') {
        // A Pro subject: the same gate now opens the Manage Pro screen (current
        // plan, benefits, and manage/cancel via Apple) instead of doing nothing.
        // Guests and Free never reach here — they resolve to showSignInRequired /
        // showPaywall above, so their routing is unchanged.
        router.push('/manage-pro');
      }
    },
    [isAuthenticated, isPro, router, signInSource],
  );
}
