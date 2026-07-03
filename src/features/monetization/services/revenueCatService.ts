import Purchases, { type CustomerInfo } from 'react-native-purchases';

export { type CustomerInfo };

export const PRO_ENTITLEMENT_ID = 'pro';

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

export async function fetchRevenueCatCustomerInfo(): Promise<CustomerInfo | null> {
  if (!hasConfiguredRevenueCat || configuredUserId === null) {
    return null;
  }

  try {
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
