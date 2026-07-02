import { createContext, type ReactNode, useContext } from 'react';

import {
  ACCOUNT_ITEM_LIMIT,
  FREE_PHOTO_LIMIT,
  GUEST_ITEM_LIMIT,
  PRO_PHOTO_LIMIT,
} from '../../purchases/constants';

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

const features: PlanFeatures = {
  unlimitedPurchases: false,
  proPhotos: false,
  smartReminders: false,
  advancedSearch: false,
  advancedFilters: false,
  advancedSorting: false,
  csvExport: false,
  spendingInsights: false,
};

const hardcodedFreePlanValue: PlanStateValue = {
  plan: 'free',
  isPro: false,
  isPlanLoading: false,
  isPlanReady: true,
  limits,
  photoLimit: FREE_PHOTO_LIMIT,
  features,
  requiresSignInForPurchase: true,
};

const PlanStateContext = createContext<PlanStateValue | undefined>(undefined);

export function PlanProvider({ children }: { children: ReactNode }) {
  // PlanProvider is currently hardcoded to Free. RevenueCat/Supabase
  // entitlement hydration will be added later; Guest Pro purchases are
  // intentionally unsupported, and Pro purchase will require a signed-in
  // Supabase user.
  return (
    <PlanStateContext.Provider value={hardcodedFreePlanValue}>
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
