import Purchases, {
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';

export { type CustomerInfo };

export const PRO_ENTITLEMENT_ID = 'pro';
export const supportsRevenueCatCustomerInfoCacheInvalidation =
  typeof Purchases.invalidateCustomerInfoCache === 'function';

export type RefreshRevenueCatCustomerInfoOptions = {
  forceRefresh?: boolean;
};

let hasConfiguredRevenueCat = false;
let configuredUserId: string | null = null;

function compactEnvValue(value?: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getRevenueCatApiKey() {
  const testStoreApiKey = compactEnvValue(
    process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY,
  );
  const iosApiKey = compactEnvValue(
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
  );

  if (__DEV__ && testStoreApiKey) {
    return testStoreApiKey;
  }

  return iosApiKey;
}

export async function configureRevenueCatForUser(
  userId: string,
): Promise<void> {
  const revenueCatApiKey = getRevenueCatApiKey();

  if (!revenueCatApiKey) {
    configuredUserId = null;
    return;
  }

  if (configuredUserId === userId) {
    return;
  }

  try {
    if (!hasConfiguredRevenueCat) {
      Purchases.configure({
        apiKey: revenueCatApiKey,
        appUserID: userId,
      });
      hasConfiguredRevenueCat = true;
    } else {
      await Purchases.logIn(userId);
    }

    configuredUserId = userId;
  } catch {
    configuredUserId = null;
  }
}

export async function refreshRevenueCatCustomerInfo({
  forceRefresh = false,
}: RefreshRevenueCatCustomerInfoOptions = {}): Promise<CustomerInfo | null> {
  if (!hasConfiguredRevenueCat || configuredUserId === null) {
    return null;
  }

  try {
    if (forceRefresh && supportsRevenueCatCustomerInfoCacheInvalidation) {
      await Purchases.invalidateCustomerInfoCache();
    }

    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

export function getIsProFromCustomerInfo(
  customerInfo: CustomerInfo | null,
): boolean {
  return (
    customerInfo?.entitlements.active[PRO_ENTITLEMENT_ID]?.isActive === true
  );
}

export async function resetRevenueCatForSignedOutUser(): Promise<void> {
  // RevenueCat logOut creates an anonymous app user. RetTrack v1 keeps guests
  // out of purchase flows, so sign-out only clears this service's active user.
  configuredUserId = null;
}

// --- Pro purchase flow -----------------------------------------------------
// These commerce entry points never throw: callers get a value to branch on.
// Every entitlement decision routes through getIsProFromCustomerInfo /
// PRO_ENTITLEMENT_ID, so "is Pro" has a single source of truth.

function isRevenueCatReady(): boolean {
  return hasConfiguredRevenueCat && configuredUserId !== null;
}

function readPurchaseErrorCode(error: unknown): string {
  // The RN SDK attaches `code` (a PURCHASES_ERROR_CODE) to the thrown error.
  // Fall back to 'unknown' for non-SDK errors rather than inventing a real code.
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code: unknown }).code);
  }

  return 'unknown';
}

function readPurchaseErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }

  return String(error);
}

function isUserCancellation(error: unknown): boolean {
  // Non-deprecated check: react-native-purchases derives its deprecated
  // `userCancelled` boolean from exactly this comparison.
  return (
    readPurchaseErrorCode(error) ===
    PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
  );
}

export async function getProOfferings(): Promise<PurchasesPackage[] | null> {
  if (!isRevenueCatReady()) {
    return null;
  }

  try {
    const offerings = await Purchases.getOfferings();

    // Hand back packages as configured; presentation and order are the UI's call.
    return offerings.current?.availablePackages ?? null;
  } catch {
    return null;
  }
}

export type PurchaseProResult =
  | { status: 'purchased'; isPro: boolean; customerInfo: CustomerInfo }
  | { status: 'cancelled' }
  | { status: 'notConfigured' }
  | { status: 'failed'; code: string; message: string };

export async function purchaseProPackage(
  pkg: PurchasesPackage,
): Promise<PurchaseProResult> {
  if (!isRevenueCatReady()) {
    return { status: 'notConfigured' };
  }

  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);

    return {
      status: 'purchased',
      isPro: getIsProFromCustomerInfo(customerInfo),
      customerInfo,
    };
  } catch (error) {
    // Cancellation is a normal outcome, not a failure — the UI can stay silent.
    if (isUserCancellation(error)) {
      return { status: 'cancelled' };
    }

    return {
      status: 'failed',
      code: readPurchaseErrorCode(error),
      message: readPurchaseErrorMessage(error),
    };
  }
}

export type RestoreProResult =
  | { status: 'restoredPro'; customerInfo: CustomerInfo }
  | { status: 'noEntitlement'; customerInfo: CustomerInfo }
  | { status: 'notConfigured' }
  | { status: 'failed'; code: string; message: string };

export async function restoreProPurchases(): Promise<RestoreProResult> {
  if (!isRevenueCatReady()) {
    return { status: 'notConfigured' };
  }

  try {
    const customerInfo = await Purchases.restorePurchases();

    // Restore can succeed yet carry no Pro entitlement; keep the two apart so
    // the UI can be honest instead of implying the restore granted Pro.
    return getIsProFromCustomerInfo(customerInfo)
      ? { status: 'restoredPro', customerInfo }
      : { status: 'noEntitlement', customerInfo };
  } catch (error) {
    return {
      status: 'failed',
      code: readPurchaseErrorCode(error),
      message: readPurchaseErrorMessage(error),
    };
  }
}
