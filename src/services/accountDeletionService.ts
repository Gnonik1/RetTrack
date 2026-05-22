import AsyncStorage from '@react-native-async-storage/async-storage';

import { cancelAllScheduledAppReminders } from '../features/notifications/notifications';
import {
  deleteCopiedPurchasePhotoFiles,
  isCopiedPurchasePhotoUri,
} from '../features/purchases/utils/purchasePhotos';
import { supabase } from '../lib/supabase';

type DeleteAccountFunctionResponse = {
  error?: string;
  success: boolean;
};

export type DeleteCurrentAccountResult =
  | {
      success: true;
    }
  | {
      error: string;
      success: false;
    };

const DELETE_ACCOUNT_FUNCTION_NAME = 'delete-account';
const RETRYABLE_ACCOUNT_DELETION_ERROR =
  'We could not delete your account right now. Please try again.';
const SIGN_IN_REQUIRED_ERROR =
  'Please sign in again before deleting your account.';
const LOCAL_CLEANUP_ERROR =
  'Your account was deleted, but this device could not finish signing out. Please restart RetTrack.';

const PURCHASES_STORAGE_KEY_PREFIX = 'rettrack:purchases:v1';
const GUEST_PURCHASE_ENTRIES_USED_STORAGE_KEY_PREFIX =
  'rettrack:guestPurchaseEntriesUsed:v1';
const APP_SETTINGS_STORAGE_KEY = 'rettrack:app-settings:v1';
const ONBOARDING_COMPLETION_STORAGE_KEY_PREFIX =
  `${APP_SETTINGS_STORAGE_KEY}:hasCompletedOnboarding`;
const NOTIFICATION_PROMPT_STATUS_STORAGE_KEY_PREFIX =
  `${APP_SETTINGS_STORAGE_KEY}:notificationPromptStatus`;
const REMINDERS_ENABLED_STORAGE_KEY_PREFIX =
  `${APP_SETTINGS_STORAGE_KEY}:remindersEnabled`;
const GUEST_PURCHASE_SCOPE_KEY = 'guest';

function getAccountScopeKey(userId: string) {
  return `user:${encodeURIComponent(userId)}`;
}

function getPurchaseStorageKey(scopeKey: string) {
  return `${PURCHASES_STORAGE_KEY_PREFIX}:${scopeKey}`;
}

function getAccountScopedLocalStorageKeys(userId: string) {
  const scopeKey = getAccountScopeKey(userId);

  return [
    getPurchaseStorageKey(scopeKey),
    `${GUEST_PURCHASE_ENTRIES_USED_STORAGE_KEY_PREFIX}:${scopeKey}`,
    `${ONBOARDING_COMPLETION_STORAGE_KEY_PREFIX}:${scopeKey}`,
    `${NOTIFICATION_PROMPT_STATUS_STORAGE_KEY_PREFIX}:${scopeKey}`,
    `${REMINDERS_ENABLED_STORAGE_KEY_PREFIX}:${scopeKey}`,
  ];
}

async function clearAccountScopedLocalState(userId: string) {
  await AsyncStorage.multiRemove(getAccountScopedLocalStorageKeys(userId));
}

function getPurchasePhotoUris(purchase: unknown) {
  if (typeof purchase !== 'object' || purchase === null) {
    return [];
  }

  const photoUris = (purchase as { photoUris?: unknown }).photoUris;

  if (!Array.isArray(photoUris)) {
    return [];
  }

  return photoUris.filter(
    (photoUri): photoUri is string => typeof photoUri === 'string',
  );
}

function getPhotoUrisFromStoredPurchases(storedPurchases: string | null) {
  if (!storedPurchases) {
    return [];
  }

  try {
    const parsedPurchases: unknown = JSON.parse(storedPurchases);

    if (!Array.isArray(parsedPurchases)) {
      return [];
    }

    return parsedPurchases.flatMap(getPurchasePhotoUris);
  } catch {
    return [];
  }
}

async function clearUnreferencedAccountLocalPhotoFiles(userId: string) {
  const accountScopeKey = getAccountScopeKey(userId);
  const [storedAccountPurchases, storedGuestPurchases] = await Promise.all([
    AsyncStorage.getItem(getPurchaseStorageKey(accountScopeKey)),
    AsyncStorage.getItem(getPurchaseStorageKey(GUEST_PURCHASE_SCOPE_KEY)),
  ]);
  const accountPhotoUris =
    getPhotoUrisFromStoredPurchases(storedAccountPurchases);
  const guestCopiedPhotoUris = new Set(
    getPhotoUrisFromStoredPurchases(storedGuestPurchases)
      .map((photoUri) => photoUri.trim())
      .filter(isCopiedPurchasePhotoUri),
  );
  const unreferencedAccountPhotoUris = accountPhotoUris.filter((photoUri) => {
    const copiedPhotoUri = photoUri.trim();

    return (
      isCopiedPurchasePhotoUri(copiedPhotoUri) &&
      !guestCopiedPhotoUris.has(copiedPhotoUri)
    );
  });

  await deleteCopiedPurchasePhotoFiles(unreferencedAccountPhotoUris);
}

async function runBestEffortPostBackendLocalCleanup(userId: string) {
  await Promise.all([
    clearUnreferencedAccountLocalPhotoFiles(userId).catch(() => undefined),
    cancelAllScheduledAppReminders().catch(() => undefined),
  ]);
}

function getSafeErrorMessage(error?: string) {
  return error?.trim() ? error : RETRYABLE_ACCOUNT_DELETION_ERROR;
}

export async function deleteCurrentAccount(): Promise<DeleteCurrentAccountResult> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  if (userError || !userId) {
    return {
      error: SIGN_IN_REQUIRED_ERROR,
      success: false,
    };
  }

  const { data, error } =
    await supabase.functions.invoke<DeleteAccountFunctionResponse>(
      DELETE_ACCOUNT_FUNCTION_NAME,
    );

  if (error || !data?.success) {
    return {
      error: getSafeErrorMessage(data?.error),
      success: false,
    };
  }

  try {
    await runBestEffortPostBackendLocalCleanup(userId);
    await clearAccountScopedLocalState(userId);

    const { error: signOutError } = await supabase.auth.signOut({
      scope: 'local',
    });

    if (signOutError) {
      return {
        error: LOCAL_CLEANUP_ERROR,
        success: false,
      };
    }
  } catch {
    return {
      error: LOCAL_CLEANUP_ERROR,
      success: false,
    };
  }

  return {
    success: true,
  };
}
