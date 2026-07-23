// Single source of truth for the Pro benefit copy, shown on both the paywall
// (PaywallScreen) and the upcoming Manage Pro screen. Keep the two in sync by
// importing this constant rather than duplicating the lines.
//
// Product copy (not prices) — safe to author here. Nothing money-related is hard
// coded; every price and currency comes from the SDK's priceString. Each line
// maps to real PlanFeatures keys (see access/planAccess.ts PRO_FEATURE_KEYS):
// unlimitedPurchases, smartReminders, advancedSearch + advancedFilters +
// advancedSorting, spendingInsights, proPhotos (PRO_PHOTO_LIMIT = 3), csvExport.
// Do not list a benefit the plan model does not gate.
export const PRO_BENEFITS = [
  'Unlimited saved purchases',
  'Smart reminders on your schedule',
  'Search and sort across everything',
  'Spending insights and trends',
  'Up to 3 photos per item',
  'Export your history to CSV',
] as const;
