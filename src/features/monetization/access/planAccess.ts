import type {
  PlanFeatures,
  PurchaseLimit,
} from '../state/PlanState';

export type PlanAccessSubject = 'guest' | 'signedInFree' | 'pro';
export type ProFeatureKey = keyof PlanFeatures;

export type AccessDecisionReason =
  | 'allowed'
  | 'guestRequiresAccount'
  | 'signedInFreeRequiresPro'
  | 'planLimitReached';

export type RecommendedAccessAction =
  | 'allow'
  | 'showSignInRequired'
  | 'showPaywall'
  | 'block';

export type AccessDecision = {
  allowed: boolean;
  reason: AccessDecisionReason;
  recommendedAction: RecommendedAccessAction;
};

export type PlanAccessSubjectInput = {
  isAuthenticated: boolean;
  isPro: boolean;
};

export type ProFeatureAccessInput = {
  feature: ProFeatureKey;
  subject: PlanAccessSubject;
};

export type PurchaseLimitAccessInput = {
  currentCount: number;
  limit: PurchaseLimit;
  subject: PlanAccessSubject;
};

export type PhotoLimitAccessInput = {
  currentPhotoCount: number;
  photoLimit: number;
  subject: PlanAccessSubject;
};

export const PRO_FEATURE_KEYS = [
  'unlimitedPurchases',
  'proPhotos',
  'smartReminders',
  'advancedSearch',
  'advancedFilters',
  'advancedSorting',
  'csvExport',
  'spendingInsights',
] as const satisfies ReadonlyArray<ProFeatureKey>;

const allowedDecision: AccessDecision = {
  allowed: true,
  reason: 'allowed',
  recommendedAction: 'allow',
};

const guestRequiresAccountDecision: AccessDecision = {
  allowed: false,
  reason: 'guestRequiresAccount',
  recommendedAction: 'showSignInRequired',
};

const signedInFreeRequiresProDecision: AccessDecision = {
  allowed: false,
  reason: 'signedInFreeRequiresPro',
  recommendedAction: 'showPaywall',
};

const planLimitReachedDecision: AccessDecision = {
  allowed: false,
  reason: 'planLimitReached',
  recommendedAction: 'block',
};

export function getPlanAccessSubject({
  isAuthenticated,
  isPro,
}: PlanAccessSubjectInput): PlanAccessSubject {
  if (!isAuthenticated) {
    return 'guest';
  }

  return isPro ? 'pro' : 'signedInFree';
}

export function getProFeatureAccess({
  subject,
}: ProFeatureAccessInput): AccessDecision {
  return getSubjectGateDecision(subject);
}

export function getPurchaseLimitAccess({
  currentCount,
  limit,
  subject,
}: PurchaseLimitAccessInput): AccessDecision {
  if (hasCapacity(currentCount, limit)) {
    return allowedDecision;
  }

  return getBlockedLimitDecision(subject);
}

export function getPhotoLimitAccess({
  currentPhotoCount,
  photoLimit,
  subject,
}: PhotoLimitAccessInput): AccessDecision {
  if (hasCapacity(currentPhotoCount, photoLimit)) {
    return allowedDecision;
  }

  return getBlockedLimitDecision(subject);
}

function getSubjectGateDecision(subject: PlanAccessSubject): AccessDecision {
  if (subject === 'pro') {
    return allowedDecision;
  }

  // Approved UX contract: Guest users route account-first because Guest Pro
  // purchase is unsupported in v1. Signed-in Free users route to paywall later.
  return subject === 'guest'
    ? guestRequiresAccountDecision
    : signedInFreeRequiresProDecision;
}

function getBlockedLimitDecision(subject: PlanAccessSubject): AccessDecision {
  if (subject === 'pro') {
    // Pro unlocks are future behavior, but absolute plan caps still remain caps.
    return planLimitReachedDecision;
  }

  return getSubjectGateDecision(subject);
}

function hasCapacity(currentCount: number, limit: PurchaseLimit): boolean {
  return limit === 'unlimited' || currentCount < limit;
}
