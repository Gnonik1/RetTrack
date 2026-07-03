import {
  createContext,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useContext,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  ACCOUNT_ITEM_LIMIT,
  FREE_PHOTO_LIMIT,
  GUEST_ITEM_LIMIT,
  PRO_PHOTO_LIMIT,
} from '../../purchases/constants';
import { useAuth } from '../../../state/AuthState';
import {
  configureRevenueCatForUser,
  getIsProFromCustomerInfo,
  refreshRevenueCatCustomerInfo,
  resetRevenueCatForSignedOutUser,
} from '../services/revenueCatService';

export type Plan = 'free' | 'pro';
export type PurchaseLimit = number | 'unlimited';

export type PlanFeatures = {
  advancedFilters: boolean;
  advancedSearch: boolean;
  advancedSorting: boolean;
  csvExport: boolean;
  proPhotos: boolean;
  smartReminders: boolean;
  spendingInsights: boolean;
  unlimitedPurchases: boolean;
};

export type PlanLimits = {
  freePhotosPerItem: number;
  guestPurchases: number;
  proPhotosPerItem: number;
  proPurchases: PurchaseLimit;
  signedInFreePurchases: number;
};

type PlanStateSnapshot = {
  features: PlanFeatures;
  isPlanLoading: boolean;
  isPlanReady: boolean;
  isPro: boolean;
  limits: PlanLimits;
  photoLimit: number;
  plan: Plan;
  requiresSignInForPurchase: boolean;
};

type PlanStateValue = PlanStateSnapshot & {
  refreshPlan: () => Promise<void>;
};

const limits: PlanLimits = {
  guestPurchases: GUEST_ITEM_LIMIT,
  signedInFreePurchases: ACCOUNT_ITEM_LIMIT,
  proPurchases: 'unlimited',
  freePhotosPerItem: FREE_PHOTO_LIMIT,
  proPhotosPerItem: PRO_PHOTO_LIMIT,
};

const freeFeatures: PlanFeatures = {
  unlimitedPurchases: false,
  proPhotos: false,
  smartReminders: false,
  advancedSearch: false,
  advancedFilters: false,
  advancedSorting: false,
  csvExport: false,
  spendingInsights: false,
};

const proFeatures: PlanFeatures = {
  unlimitedPurchases: true,
  proPhotos: true,
  smartReminders: true,
  advancedSearch: true,
  advancedFilters: true,
  advancedSorting: true,
  csvExport: true,
  spendingInsights: true,
};

function getFreePlanValue({
  isPlanLoading,
  isPlanReady,
  requiresSignInForPurchase,
}: {
  isPlanLoading: boolean;
  isPlanReady: boolean;
  requiresSignInForPurchase: boolean;
}): PlanStateSnapshot {
  return {
    plan: 'free',
    isPro: false,
    isPlanLoading,
    isPlanReady,
    limits,
    photoLimit: FREE_PHOTO_LIMIT,
    features: freeFeatures,
    requiresSignInForPurchase,
  };
}

const authLoadingPlanValue = getFreePlanValue({
  isPlanLoading: true,
  isPlanReady: false,
  requiresSignInForPurchase: true,
});

const guestFreePlanValue = getFreePlanValue({
  isPlanLoading: false,
  isPlanReady: true,
  requiresSignInForPurchase: true,
});

const signedInFreePlanValue = getFreePlanValue({
  isPlanLoading: false,
  isPlanReady: true,
  requiresSignInForPurchase: false,
});

const signedInProPlanValue: PlanStateSnapshot = {
  plan: 'pro',
  isPro: true,
  isPlanLoading: false,
  isPlanReady: true,
  limits,
  photoLimit: PRO_PHOTO_LIMIT,
  features: proFeatures,
  requiresSignInForPurchase: false,
};

const PlanStateContext = createContext<PlanStateValue | undefined>(undefined);

type RefreshPlanOptions = {
  forceRefresh?: boolean;
  showLoadingState?: boolean;
};

export function PlanProvider({ children }: { children: ReactNode }) {
  const { isAuthLoading, user } = useAuth();
  const signedInUserId = user?.id ?? null;
  const activeSignedInUserIdRef = useRef<string | null>(signedInUserId);
  const refreshGenerationRef = useRef(0);
  const [planSnapshot, setPlanSnapshot] = useState<PlanStateSnapshot>(
    authLoadingPlanValue,
  );
  activeSignedInUserIdRef.current = signedInUserId;

  const refreshPlanFromRevenueCat = useCallback(
    async ({
      forceRefresh = false,
      showLoadingState = false,
    }: RefreshPlanOptions = {}) => {
      const refreshGeneration = refreshGenerationRef.current + 1;
      refreshGenerationRef.current = refreshGeneration;
      const refreshUserId = signedInUserId;
      const isCurrentRefresh = () =>
        refreshGenerationRef.current === refreshGeneration &&
        activeSignedInUserIdRef.current === refreshUserId;

      try {
        if (isAuthLoading) {
          if (isCurrentRefresh()) {
            setPlanSnapshot(authLoadingPlanValue);
          }

          return;
        }

        if (!refreshUserId) {
          await resetRevenueCatForSignedOutUser();

          if (isCurrentRefresh()) {
            setPlanSnapshot(guestFreePlanValue);
          }

          return;
        }

        if (showLoadingState && isCurrentRefresh()) {
          setPlanSnapshot(
            getFreePlanValue({
              isPlanLoading: true,
              isPlanReady: false,
              requiresSignInForPurchase: false,
            }),
          );
        }

        await configureRevenueCatForUser(refreshUserId);
        const customerInfo = await refreshRevenueCatCustomerInfo({
          forceRefresh,
        });
        const isProActive = getIsProFromCustomerInfo(customerInfo);

        if (isCurrentRefresh()) {
          setPlanSnapshot(
            isProActive ? signedInProPlanValue : signedInFreePlanValue,
          );
        }
      } catch {
        if (isCurrentRefresh()) {
          setPlanSnapshot(
            refreshUserId ? signedInFreePlanValue : guestFreePlanValue,
          );
        }
      }
    },
    [isAuthLoading, signedInUserId],
  );

  const refreshPlan = useCallback(
    () => refreshPlanFromRevenueCat({ forceRefresh: true }),
    [refreshPlanFromRevenueCat],
  );

  useEffect(() => {
    void refreshPlanFromRevenueCat({
      forceRefresh: true,
      showLoadingState: true,
    });
  }, [refreshPlanFromRevenueCat]);

  useEffect(() => {
    if (!signedInUserId) {
      return undefined;
    }

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        void refreshPlan();
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
    };
  }, [refreshPlan, signedInUserId]);

  const value = useMemo(
    () => ({
      ...planSnapshot,
      refreshPlan,
    }),
    [planSnapshot, refreshPlan],
  );

  return (
    <PlanStateContext.Provider value={value}>
      {children}
    </PlanStateContext.Provider>
  );
}

export function usePlan() {
  const context = useContext(PlanStateContext);

  if (!context) {
    throw new Error('usePlan must be used within PlanProvider');
  }

  return context;
}
