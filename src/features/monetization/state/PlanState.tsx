import {
  createContext,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
  useContext,
} from 'react';

import {
  ACCOUNT_ITEM_LIMIT,
  FREE_PHOTO_LIMIT,
  GUEST_ITEM_LIMIT,
  PRO_PHOTO_LIMIT,
} from '../../purchases/constants';
import { useAuth } from '../../../state/AuthState';
import {
  configureRevenueCatForUser,
  fetchRevenueCatCustomerInfo,
  getIsProFromCustomerInfo,
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

type PlanStateValue = {
  features: PlanFeatures;
  isPlanLoading: boolean;
  isPlanReady: boolean;
  isPro: boolean;
  limits: PlanLimits;
  photoLimit: number;
  plan: Plan;
  requiresSignInForPurchase: boolean;
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
}): PlanStateValue {
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

const signedInProPlanValue: PlanStateValue = {
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

export function PlanProvider({ children }: { children: ReactNode }) {
  const { isAuthLoading, user } = useAuth();
  const signedInUserId = user?.id ?? null;
  const [planValue, setPlanValue] = useState<PlanStateValue>(
    authLoadingPlanValue,
  );

  useEffect(() => {
    let isActive = true;

    const hydratePlan = async () => {
      if (isAuthLoading) {
        setPlanValue(authLoadingPlanValue);
        return;
      }

      if (!signedInUserId) {
        await resetRevenueCatForSignedOutUser();

        if (isActive) {
          setPlanValue(guestFreePlanValue);
        }

        return;
      }

      setPlanValue(
        getFreePlanValue({
          isPlanLoading: true,
          isPlanReady: false,
          requiresSignInForPurchase: false,
        }),
      );

      await configureRevenueCatForUser(signedInUserId);
      const customerInfo = await fetchRevenueCatCustomerInfo();

      if (!isActive) {
        return;
      }

      setPlanValue(
        getIsProFromCustomerInfo(customerInfo)
          ? signedInProPlanValue
          : signedInFreePlanValue,
      );
    };

    hydratePlan().catch(() => {
      if (isActive) {
        setPlanValue(signedInUserId ? signedInFreePlanValue : guestFreePlanValue);
      }
    });

    return () => {
      isActive = false;
    };
  }, [isAuthLoading, signedInUserId]);

  const value = useMemo(() => planValue, [planValue]);

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
