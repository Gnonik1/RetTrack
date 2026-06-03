import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { rescheduleAllPurchaseReminders } from '../../notifications/notifications';
import {
  createRemotePurchase,
  fetchRemotePurchaseEntryCount,
  fetchRemotePurchaseMigrationIdentities,
  fetchRemotePurchases,
  mapRemotePurchaseRowToLocalPurchase,
  resolveRemotePurchase,
  softDeleteRemotePurchase,
  updateRemotePurchase,
  type SupabasePurchaseMigrationIdentityRow,
} from '../../../services/purchaseSyncService';
import {
  fetchPurchasePhotos,
  getSignedPhotoUrls,
  syncPurchasePhotos,
  type SupabasePurchasePhotoRow,
} from '../../../services/purchasePhotoSyncService';
import { useAuth } from '../../../state/AuthState';
import { useAppSettings } from '../../settings/state/AppSettingsState';
import {
  ACCOUNT_ITEM_LIMIT,
  ACCOUNT_PHOTO_LIMIT,
  GUEST_ITEM_LIMIT,
  GUEST_PHOTO_LIMIT,
} from '../constants';
import {
  getMockPurchaseById,
  mockPurchases,
  type MockPurchase,
  type PurchaseOrigin,
  type PurchaseStatus,
  type PurchaseSyncStatus,
} from '../data/mockPurchases';
import {
  formatCompactDate,
  getCompactReturnDate,
  getFullReturnDate,
  getPurchaseReturnDateISO,
  getReturnDateUrgency,
} from '../utils/purchaseDates';
import {
  deleteCopiedPurchasePhotoFiles,
  isCopiedPurchasePhotoUri,
} from '../utils/purchasePhotos';

export type ResolvedPurchaseStatus = Extract<
  PurchaseStatus,
  'kept' | 'returned'
>;

export type AddPurchaseInput = {
  comment?: string;
  itemName: string;
  photoRemotePaths?: Array<string | null>;
  photoUris?: string[];
  price?: string;
  purchaseDateISO?: string;
  productLink?: string;
  purchased?: string;
  returnBy: string;
  returnDateISO?: string;
  store?: string;
};

type PurchasesStateValue = {
  accountPurchaseEntriesUsed: number;
  addPurchase: (input: AddPurchaseInput) => MockPurchase;
  deletePurchase: (itemId: string) => boolean;
  effectiveGuestRemaining: number;
  findPurchaseById: (itemId?: string | string[]) => MockPurchase | null;
  getPurchaseById: (itemId?: string | string[]) => MockPurchase;
  guestPurchaseEntriesUsed: number;
  hasHydratedPurchases: boolean;
  isGuestAddLimitReached: boolean;
  purchases: MockPurchase[];
  resolvePurchase: (itemId: string, status: ResolvedPurchaseStatus) => void;
  updatePurchase: (itemId: string, input: AddPurchaseInput) => void;
};

type LastKnownAccountCapacitySnapshot = {
  accountEntriesUsed: number;
  accountUserId: string;
  guestEntriesUsedAtSnapshot: number;
  updatedAt: string;
};

const PurchasesStateContext = createContext<PurchasesStateValue | undefined>(
  undefined,
);

const PURCHASES_STORAGE_KEY = 'rettrack:purchases:v1';
const GUEST_PURCHASE_ENTRIES_USED_STORAGE_KEY =
  'rettrack:guestPurchaseEntriesUsed:v1';
const GUEST_PURCHASE_SCOPE_KEY = 'guest';
const LAST_KNOWN_ACCOUNT_CAPACITY_STORAGE_KEY =
  'rettrack:lastKnownAccountCapacity:v1';
const COUNTED_GUEST_ORIGIN_ENTRIES_STORAGE_KEY =
  'rettrack:countedGuestOriginEntries:v1';
const PURCHASES_STORAGE_KEY_PREFIX = PURCHASES_STORAGE_KEY;
const GUEST_PURCHASE_ENTRIES_USED_STORAGE_KEY_PREFIX =
  GUEST_PURCHASE_ENTRIES_USED_STORAGE_KEY;
const USE_MOCK_PURCHASES_ON_EMPTY_STORAGE = false;

function getResolvedStatusText(status: ResolvedPurchaseStatus, date: Date) {
  const statusLabel = status === 'returned' ? 'Returned' : 'Kept';

  return `${statusLabel} on ${formatCompactDate(date)}`;
}

function isPurchaseStatus(value: unknown): value is PurchaseStatus {
  return (
    value === 'active' ||
    value === 'returned' ||
    value === 'kept' ||
    value === 'pending'
  );
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown) {
  return value === undefined || typeof value === 'string';
}

function isOptionalPurchaseSyncStatus(
  value: unknown,
): value is PurchaseSyncStatus | undefined {
  return (
    value === undefined ||
    value === 'local' ||
    value === 'synced' ||
    value === 'error'
  );
}

function isOptionalPurchaseOrigin(
  value: unknown,
): value is PurchaseOrigin | undefined {
  return value === undefined || value === 'account' || value === 'guest';
}

function isOptionalNumber(value: unknown) {
  return value === undefined || typeof value === 'number';
}

function isOptionalStringArray(value: unknown) {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every((item) => typeof item === 'string'))
  );
}

function isOptionalNullableStringArray(value: unknown) {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.every((item) => item === null || typeof item === 'string'))
  );
}

function isLocalPhotoUri(value: string) {
  return value.startsWith('file:') || value.startsWith('content:');
}

function isStoredPurchase(value: unknown): value is MockPurchase {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.itemName === 'string' &&
    typeof value.days === 'string' &&
    typeof value.returnBy === 'string' &&
    typeof value.store === 'string' &&
    isPurchaseStatus(value.status) &&
    isOptionalString(value.comment) &&
    isOptionalString(value.completedText) &&
    isOptionalString(value.deletedFromGuestAt) &&
    isOptionalString(value.deletedFromLinkedAccountAt) &&
    isOptionalNullableStringArray(value.photoRemotePaths) &&
    isOptionalPurchaseSyncStatus(value.photoSyncStatus) &&
    isOptionalStringArray(value.photoUris) &&
    isOptionalString(value.price) &&
    isOptionalString(value.productDomain) &&
    isOptionalString(value.productLink) &&
    isOptionalNumber(value.pendingAt) &&
    isOptionalString(value.purchaseDateISO) &&
    isOptionalString(value.purchased) &&
    isOptionalString(value.pendingLinkedAccountDeleteAt) &&
    isOptionalString(value.returnByDetail) &&
    isOptionalString(value.returnDateISO) &&
    isOptionalString(value.remoteId) &&
    isOptionalNumber(value.createdAt) &&
    isOptionalNumber(value.resolvedAt) &&
    isOptionalPurchaseSyncStatus(value.syncStatus) &&
    isOptionalString(value.lastPhotoSyncedAt) &&
    isOptionalString(value.lastSyncedAt) &&
    isOptionalString(value.linkedAccountUserId) &&
    isOptionalString(value.linkedClientLocalId) &&
    isOptionalString(value.linkedRemoteId) &&
    isOptionalPurchaseOrigin(value.origin)
  );
}

function isStoredPurchases(value: unknown): value is MockPurchase[] {
  return Array.isArray(value) && value.every(isStoredPurchase);
}

function parseStoredGuestPurchaseEntriesUsed(value: string | null) {
  if (value === null) {
    return null;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) && parsedValue >= 0
    ? Math.floor(parsedValue)
    : null;
}

function parseStoredPurchases(value: string | null) {
  if (value === null) {
    return null;
  }

  try {
    const parsedPurchases: unknown = JSON.parse(value);

    return isStoredPurchases(parsedPurchases)
      ? getPurchasesWithCurrentDateState(parsedPurchases)
      : null;
  } catch {
    return null;
  }
}

function isLastKnownAccountCapacitySnapshot(
  value: unknown,
): value is LastKnownAccountCapacitySnapshot {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    typeof value.accountUserId === 'string' &&
    typeof value.updatedAt === 'string' &&
    typeof value.accountEntriesUsed === 'number' &&
    Number.isFinite(value.accountEntriesUsed) &&
    value.accountEntriesUsed >= 0 &&
    typeof value.guestEntriesUsedAtSnapshot === 'number' &&
    Number.isFinite(value.guestEntriesUsedAtSnapshot) &&
    value.guestEntriesUsedAtSnapshot >= 0
  );
}

function parseLastKnownAccountCapacitySnapshot(value: string | null) {
  if (value === null) {
    return null;
  }

  try {
    const parsedValue: unknown = JSON.parse(value);

    return isLastKnownAccountCapacitySnapshot(parsedValue)
      ? {
          accountEntriesUsed: Math.floor(parsedValue.accountEntriesUsed),
          accountUserId: parsedValue.accountUserId,
          guestEntriesUsedAtSnapshot: Math.floor(
            parsedValue.guestEntriesUsedAtSnapshot,
          ),
          updatedAt: parsedValue.updatedAt,
        }
      : null;
  } catch {
    return null;
  }
}

function getPurchaseScopeKey(userId?: string | null) {
  return userId ? `user:${encodeURIComponent(userId)}` : GUEST_PURCHASE_SCOPE_KEY;
}

function getScopedPurchaseStorageKeys(scopeKey: string) {
  return {
    guestPurchaseEntriesUsedKey: `${GUEST_PURCHASE_ENTRIES_USED_STORAGE_KEY_PREFIX}:${scopeKey}`,
    purchasesKey: `${PURCHASES_STORAGE_KEY_PREFIX}:${scopeKey}`,
  };
}

function getCountedGuestOriginEntriesStorageKey(userId: string) {
  return `${COUNTED_GUEST_ORIGIN_ENTRIES_STORAGE_KEY}:${getPurchaseScopeKey(
    userId,
  )}`;
}

function getPurchaseStorageSnapshot(
  storedPurchases: string | null,
  storedGuestPurchaseEntriesUsed: string | null,
) {
  const nextPurchases =
    parseStoredPurchases(storedPurchases) ?? getPurchasesForEmptyStorage();
  const storedEntriesUsed = parseStoredGuestPurchaseEntriesUsed(
    storedGuestPurchaseEntriesUsed,
  );
  const nextGuestPurchaseEntriesUsed = Math.max(
    storedEntriesUsed ?? nextPurchases.length,
    nextPurchases.length,
  );

  return {
    guestPurchaseEntriesUsed: nextGuestPurchaseEntriesUsed,
    purchases: nextPurchases,
  };
}

function isUnsyncedLocalPurchase(purchase: MockPurchase) {
  return purchase.syncStatus === 'local' || purchase.syncStatus === 'error';
}

function isSignedInHydrationBackfillCandidate(purchase: MockPurchase) {
  return (
    isUnsyncedLocalPurchase(purchase) &&
    !purchase.remoteId &&
    !isTombstonedPurchase(purchase)
  );
}

function isTombstonedPurchase(purchase: MockPurchase) {
  return Boolean(
    purchase.deletedFromGuestAt || purchase.deletedFromLinkedAccountAt,
  );
}

function getVisiblePurchases(purchases: MockPurchase[]) {
  return purchases.filter((purchase) => !isTombstonedPurchase(purchase));
}

function getPurchaseIdentityValues(purchase: MockPurchase) {
  return [
    purchase.id,
    purchase.remoteId,
    purchase.linkedRemoteId,
    purchase.linkedClientLocalId,
  ].filter((value): value is string => Boolean(value));
}

function getRemotePurchaseMigrationIdentityValues(
  remotePurchase: SupabasePurchaseMigrationIdentityRow,
) {
  return [remotePurchase.id, remotePurchase.client_local_id].filter(
    (value): value is string => Boolean(value),
  );
}

function hasSharedPurchaseIdentity(
  purchase: MockPurchase,
  identityValues: Set<string>,
) {
  return getPurchaseIdentityValues(purchase).some((value) =>
    identityValues.has(value),
  );
}

function getPurchaseIdentitySet(purchases: MockPurchase[]) {
  return new Set(purchases.flatMap(getPurchaseIdentityValues));
}

function getGuestOriginAccountEntryCount(purchases: MockPurchase[]) {
  const countedPurchaseIdentities = new Set<string>();

  return purchases.reduce((count, purchase) => {
    if (purchase.origin !== 'guest' || isTombstonedPurchase(purchase)) {
      return count;
    }

    const purchaseIdentity =
      purchase.remoteId ??
      purchase.linkedRemoteId ??
      purchase.linkedClientLocalId ??
      purchase.id;

    if (countedPurchaseIdentities.has(purchaseIdentity)) {
      return count;
    }

    countedPurchaseIdentities.add(purchaseIdentity);
    return count + 1;
  }, 0);
}

function findPurchaseBySharedIdentity(
  purchase: MockPurchase,
  purchases: MockPurchase[],
) {
  const identityValues = new Set(getPurchaseIdentityValues(purchase));

  return (
    purchases.find((candidatePurchase) =>
      hasSharedPurchaseIdentity(candidatePurchase, identityValues),
    ) ?? null
  );
}

function findMatchingAccountPurchaseForGuestMigration(
  guestPurchase: MockPurchase,
  accountPurchases: MockPurchase[],
) {
  return findPurchaseBySharedIdentity(guestPurchase, accountPurchases);
}

function findMatchingRemotePurchaseIdentityForGuestMigration(
  guestPurchase: MockPurchase,
  remotePurchaseIdentities: SupabasePurchaseMigrationIdentityRow[],
) {
  const guestIdentityValues = new Set(getPurchaseIdentityValues(guestPurchase));

  return (
    remotePurchaseIdentities.find((remotePurchaseIdentity) =>
      getRemotePurchaseMigrationIdentityValues(remotePurchaseIdentity).some(
        (value) => guestIdentityValues.has(value),
      ),
    ) ?? null
  );
}

type GuestPurchaseAccountLink = {
  clientLocalId: string;
  guestPurchaseId: string;
  lastSyncedAt?: string;
  remoteId?: string;
  userId: string;
};

type GuestAccountPurchaseReconciliation = {
  accountPurchase: MockPurchase;
  guestPurchase: MockPurchase;
};

type GuestPurchaseMigrationSyncResult = {
  accountPurchase: MockPurchase;
  guestPurchase: MockPurchase;
  link: GuestPurchaseAccountLink | null;
};

type SignedInLocalPurchaseBackfillMatch = {
  lastSyncedAt?: string;
  remoteId: string;
};

type GuestLinkedAccountDelete = {
  deletedAt: string;
  guestPurchase: MockPurchase;
  purchaseId: string;
};

type PendingLinkedGuestDeleteFromAccount = {
  accountPurchase: MockPurchase;
  deletedAt: string;
  userId: string;
};

function getExistingGuestPurchaseAccountLink(
  userId: string,
  guestPurchase: MockPurchase,
) {
  const remoteId = guestPurchase.linkedRemoteId ?? guestPurchase.remoteId;

  if (
    guestPurchase.linkedAccountUserId !== userId ||
    (!remoteId && !guestPurchase.linkedClientLocalId)
  ) {
    return null;
  }

  return {
    clientLocalId: guestPurchase.linkedClientLocalId ?? guestPurchase.id,
    guestPurchaseId: guestPurchase.id,
    lastSyncedAt: guestPurchase.lastSyncedAt,
    remoteId,
    userId,
  };
}

function getGuestPurchaseAccountLinkFromAccountPurchase(
  userId: string,
  guestPurchase: MockPurchase,
  accountPurchase: MockPurchase,
) {
  const remoteId = accountPurchase.remoteId ?? accountPurchase.linkedRemoteId;
  const clientLocalId =
    accountPurchase.linkedClientLocalId ?? accountPurchase.id;

  if (!remoteId && accountPurchase.origin !== 'guest') {
    return null;
  }

  return {
    clientLocalId,
    guestPurchaseId: guestPurchase.id,
    lastSyncedAt: accountPurchase.lastSyncedAt,
    remoteId,
    userId,
  };
}

function getGuestPurchaseLocalAccountLink(
  userId: string,
  guestPurchase: MockPurchase,
): GuestPurchaseAccountLink {
  return {
    clientLocalId: guestPurchase.id,
    guestPurchaseId: guestPurchase.id,
    userId,
  };
}

function getAccountPurchaseWithGuestLink(
  accountPurchase: MockPurchase,
  link: GuestPurchaseAccountLink,
) {
  return {
    ...accountPurchase,
    linkedAccountUserId: link.userId,
    linkedClientLocalId: link.clientLocalId,
    ...(link.remoteId
      ? {
          linkedRemoteId: link.remoteId,
          remoteId: link.remoteId,
        }
      : {}),
    origin: 'guest' as const,
  };
}

function getGuestPurchaseAccountLinkFromRemoteIdentity(
  userId: string,
  guestPurchase: MockPurchase,
  remotePurchaseIdentity: SupabasePurchaseMigrationIdentityRow,
) {
  return {
    clientLocalId:
      remotePurchaseIdentity.client_local_id ??
      guestPurchase.linkedClientLocalId ??
      guestPurchase.id,
    guestPurchaseId: guestPurchase.id,
    remoteId: remotePurchaseIdentity.id,
    userId,
  };
}

function getGuestPurchaseWithAccountLink(
  guestPurchase: MockPurchase,
  link: GuestPurchaseAccountLink,
  syncedAt = new Date(),
) {
  const lastSyncedAt =
    link.lastSyncedAt ?? guestPurchase.lastSyncedAt ?? syncedAt.toISOString();
  const remoteMetadata = link.remoteId
    ? {
        lastSyncedAt,
        linkedRemoteId: link.remoteId,
        remoteId: link.remoteId,
        syncStatus: 'synced' as const,
      }
    : {};

  if (
    guestPurchase.origin === 'guest' &&
    guestPurchase.linkedAccountUserId === link.userId &&
    guestPurchase.linkedClientLocalId === link.clientLocalId &&
    (!link.remoteId ||
      (guestPurchase.linkedRemoteId === link.remoteId &&
        guestPurchase.remoteId === link.remoteId &&
        guestPurchase.syncStatus === 'synced' &&
        guestPurchase.lastSyncedAt === lastSyncedAt))
  ) {
    return guestPurchase;
  }

  return {
    ...guestPurchase,
    linkedAccountUserId: link.userId,
    linkedClientLocalId: link.clientLocalId,
    origin: 'guest' as const,
    ...remoteMetadata,
  };
}

function getGuestPurchasesWithAccountLinks(
  guestPurchases: MockPurchase[],
  links: GuestPurchaseAccountLink[],
) {
  if (!links.length) {
    return guestPurchases;
  }

  const linkByGuestPurchaseId = new Map(
    links.map((link) => [link.guestPurchaseId, link]),
  );
  const syncedAt = new Date();
  let didChangePurchase = false;
  const nextGuestPurchases = guestPurchases.map((guestPurchase) => {
    const link = linkByGuestPurchaseId.get(guestPurchase.id);

    if (!link) {
      return guestPurchase;
    }

    const nextGuestPurchase = getGuestPurchaseWithAccountLink(
      guestPurchase,
      link,
      syncedAt,
    );

    if (nextGuestPurchase !== guestPurchase) {
      didChangePurchase = true;
    }

    return nextGuestPurchase;
  });

  return didChangePurchase ? nextGuestPurchases : guestPurchases;
}

function getGuestPurchaseDeletedFromGuest(
  guestPurchase: MockPurchase,
  deletedAt: string,
) {
  const hasLinkedAccountIdentity = Boolean(
    guestPurchase.linkedAccountUserId &&
      (guestPurchase.linkedRemoteId ||
        guestPurchase.remoteId ||
        guestPurchase.linkedClientLocalId),
  );

  return {
    ...guestPurchase,
    deletedFromGuestAt: guestPurchase.deletedFromGuestAt ?? deletedAt,
    pendingLinkedAccountDeleteAt:
      hasLinkedAccountIdentity
        ? (guestPurchase.pendingLinkedAccountDeleteAt ?? deletedAt)
        : guestPurchase.pendingLinkedAccountDeleteAt,
  };
}

function getGuestPurchaseDeletedFromLinkedAccount(
  guestPurchase: MockPurchase,
  deletedAt: string,
) {
  return {
    ...guestPurchase,
    deletedFromLinkedAccountAt:
      guestPurchase.deletedFromLinkedAccountAt ?? deletedAt,
    pendingLinkedAccountDeleteAt: undefined,
  };
}

function getGuestLinkedAccountDelete(
  userId: string,
  guestPurchase: MockPurchase,
) {
  const purchaseId =
    guestPurchase.linkedRemoteId ??
    guestPurchase.remoteId ??
    guestPurchase.linkedClientLocalId ??
    guestPurchase.id;

  if (
    guestPurchase.linkedAccountUserId !== userId ||
    !purchaseId ||
    !guestPurchase.pendingLinkedAccountDeleteAt
  ) {
    return null;
  }

  return {
    deletedAt: guestPurchase.pendingLinkedAccountDeleteAt,
    guestPurchase,
    purchaseId,
  };
}

function getPurchasesWithoutSharedIdentity(
  purchases: MockPurchase[],
  purchaseToRemove: MockPurchase,
) {
  const identityValues = new Set(getPurchaseIdentityValues(purchaseToRemove));

  return purchases.filter(
    (purchase) => !hasSharedPurchaseIdentity(purchase, identityValues),
  );
}

function isLocalGuestAccountPurchaseForLinkedDelete(
  accountPurchase: MockPurchase,
  linkedAccountDelete: GuestLinkedAccountDelete,
) {
  const linkedClientLocalId =
    linkedAccountDelete.guestPurchase.linkedClientLocalId;
  const originalGuestId = linkedAccountDelete.guestPurchase.id;

  if (accountPurchase.origin !== 'guest') {
    return false;
  }

  return Boolean(
    accountPurchase.id === originalGuestId ||
      (linkedClientLocalId &&
        (accountPurchase.id === linkedClientLocalId ||
          accountPurchase.linkedClientLocalId === linkedClientLocalId)),
  );
}

function getAccountPurchasesWithoutLinkedAccountDelete(
  accountPurchases: MockPurchase[],
  linkedAccountDelete: GuestLinkedAccountDelete,
) {
  const identityValues = new Set(
    getPurchaseIdentityValues(linkedAccountDelete.guestPurchase),
  );

  return accountPurchases.filter(
    (accountPurchase) =>
      !isLocalGuestAccountPurchaseForLinkedDelete(
        accountPurchase,
        linkedAccountDelete,
      ) && !hasSharedPurchaseIdentity(accountPurchase, identityValues),
  );
}

function isGuestPurchaseLinkedToAccountPurchase(
  userId: string,
  guestPurchase: MockPurchase,
  accountPurchase: MockPurchase,
) {
  if (
    guestPurchase.linkedAccountUserId &&
    guestPurchase.linkedAccountUserId !== userId
  ) {
    return false;
  }

  const accountRemoteId =
    accountPurchase.remoteId ?? accountPurchase.linkedRemoteId;
  const accountClientLocalId =
    accountPurchase.linkedClientLocalId ?? accountPurchase.id;

  if (
    accountRemoteId &&
    (guestPurchase.linkedRemoteId === accountRemoteId ||
      guestPurchase.remoteId === accountRemoteId)
  ) {
    return true;
  }

  if (
    accountClientLocalId &&
    (guestPurchase.linkedClientLocalId === accountClientLocalId ||
      guestPurchase.id === accountClientLocalId)
  ) {
    return true;
  }

  return hasSharedPurchaseIdentity(
    guestPurchase,
    new Set(getPurchaseIdentityValues(accountPurchase)),
  );
}

function getAccountPurchasesWithoutLinkedGuestTombstones(
  userId: string,
  accountPurchases: MockPurchase[],
  guestPurchases: MockPurchase[],
) {
  return guestPurchases
    .filter(
      (guestPurchase) =>
        guestPurchase.linkedAccountUserId === userId &&
        isTombstonedPurchase(guestPurchase),
    )
    .reduce(
      (nextAccountPurchases, guestPurchase) =>
        getPurchasesWithoutSharedIdentity(nextAccountPurchases, guestPurchase),
      accountPurchases,
    );
}

function getGuestPurchasesWithoutPendingLinkedAccountDeletes(
  guestPurchases: MockPurchase[],
  pendingDeletes: PendingLinkedGuestDeleteFromAccount[],
) {
  return pendingDeletes.reduce(
    (nextGuestPurchases, pendingDelete) =>
      nextGuestPurchases.filter(
        (guestPurchase) =>
          !isGuestPurchaseLinkedToAccountPurchase(
            pendingDelete.userId,
            guestPurchase,
            pendingDelete.accountPurchase,
          ),
      ),
    guestPurchases,
  );
}

function getPurchasesWithUpdatedPurchases(
  purchases: MockPurchase[],
  updatedPurchases: MockPurchase[],
) {
  if (!updatedPurchases.length) {
    return purchases;
  }

  let didChangePurchase = false;
  const unmatchedPurchases = [...updatedPurchases];
  const nextPurchases = purchases.map((purchase) => {
    const matchingPurchaseIndex = unmatchedPurchases.findIndex(
      (updatedPurchase) =>
        hasSharedPurchaseIdentity(
          purchase,
          new Set(getPurchaseIdentityValues(updatedPurchase)),
        ),
    );

    if (matchingPurchaseIndex === -1) {
      return purchase;
    }

    const [updatedPurchase] = unmatchedPurchases.splice(
      matchingPurchaseIndex,
      1,
    );

    if (updatedPurchase !== purchase) {
      didChangePurchase = true;
    }

    return updatedPurchase;
  });

  if (unmatchedPurchases.length) {
    didChangePurchase = true;
  }

  return didChangePurchase
    ? [...unmatchedPurchases, ...nextPurchases]
    : purchases;
}

function getPurchaseWithLocalHydrationData(
  purchase: MockPurchase,
  localPurchases: MockPurchase[],
) {
  const localPurchase = findPurchaseBySharedIdentity(purchase, localPurchases);
  const origin = !purchase.origin ? localPurchase?.origin : undefined;
  const purchaseWithLocalOrigin = origin ? { ...purchase, origin } : purchase;

  if (!localPurchase?.photoUris?.length) {
    return purchaseWithLocalOrigin;
  }

  const hasLocalDevicePhoto = localPurchase.photoUris.some(isLocalPhotoUri);

  if (!hasLocalDevicePhoto) {
    return purchaseWithLocalOrigin;
  }

  return {
    ...purchaseWithLocalOrigin,
    photoRemotePaths: localPurchase.photoRemotePaths ?? purchase.photoRemotePaths,
    photoUris: localPurchase.photoUris,
  };
}

function mergeRemotePurchasesWithLocalUnsynced(
  remotePurchases: MockPurchase[],
  localPurchases: MockPurchase[],
) {
  const preservedLocalPurchases = localPurchases.filter(isUnsyncedLocalPurchase);
  const preservedIdentityValues = getPurchaseIdentitySet(
    preservedLocalPurchases,
  );
  const remotePurchasesWithoutPreservedLocal = remotePurchases
    .filter(
      (purchase) => !hasSharedPurchaseIdentity(purchase, preservedIdentityValues),
    )
    .map((purchase) =>
      getPurchaseWithLocalHydrationData(purchase, localPurchases),
    );

  return [...preservedLocalPurchases, ...remotePurchasesWithoutPreservedLocal];
}

function getSyncedLocalPurchaseFromRemoteMatch(
  purchase: MockPurchase,
  remoteMatch: SignedInLocalPurchaseBackfillMatch,
) {
  return {
    ...purchase,
    lastSyncedAt: remoteMatch.lastSyncedAt ?? new Date().toISOString(),
    remoteId: remoteMatch.remoteId,
    syncStatus: 'synced' as const,
  };
}

function findSignedInLocalPurchaseBackfillMatch(
  localPurchase: MockPurchase,
  remotePurchases: MockPurchase[],
  remotePurchaseIdentities: SupabasePurchaseMigrationIdentityRow[],
): SignedInLocalPurchaseBackfillMatch | null {
  const localIdentityValues = new Set(getPurchaseIdentityValues(localPurchase));
  const matchingRemotePurchase = remotePurchases.find(
    (remotePurchase) =>
      remotePurchase.remoteId &&
      hasSharedPurchaseIdentity(remotePurchase, localIdentityValues),
  );

  if (matchingRemotePurchase?.remoteId) {
    return {
      lastSyncedAt: matchingRemotePurchase.lastSyncedAt,
      remoteId: matchingRemotePurchase.remoteId,
    };
  }

  const matchingRemoteIdentity = remotePurchaseIdentities.find(
    (remotePurchaseIdentity) =>
      getRemotePurchaseMigrationIdentityValues(remotePurchaseIdentity).some(
        (value) => localIdentityValues.has(value),
      ),
  );

  return matchingRemoteIdentity
    ? { remoteId: matchingRemoteIdentity.id }
    : null;
}

async function backfillSignedInLocalPurchases(
  userId: string,
  accountPurchases: MockPurchase[],
  remotePurchases: MockPurchase[],
  remotePurchaseIdentities: SupabasePurchaseMigrationIdentityRow[],
  options: { canCreateMissingRemotePurchases?: boolean } = {},
) {
  if (!accountPurchases.some(isSignedInHydrationBackfillCandidate)) {
    return accountPurchases;
  }

  const canCreateMissingRemotePurchases =
    options.canCreateMissingRemotePurchases ?? true;

  return Promise.all(
    accountPurchases.map(async (purchase) => {
      if (!isSignedInHydrationBackfillCandidate(purchase)) {
        return purchase;
      }

      const remoteMatch = findSignedInLocalPurchaseBackfillMatch(
        purchase,
        remotePurchases,
        remotePurchaseIdentities,
      );

      if (remoteMatch) {
        return getSyncedLocalPurchaseFromRemoteMatch(purchase, remoteMatch);
      }

      if (!canCreateMissingRemotePurchases) {
        return purchase;
      }

      try {
        const { data, error } = await createRemotePurchase(userId, purchase);

        if (error) {
          return {
            ...purchase,
            ...getSyncErrorMetadata(),
          };
        }

        return getSyncedLocalPurchaseFromRemoteMatch(purchase, {
          lastSyncedAt: data.updated_at,
          remoteId: data.id,
        });
      } catch {
        return {
          ...purchase,
          ...getSyncErrorMetadata(),
        };
      }
    }),
  );
}

function getGuestPurchaseForNewAccountInsert(purchase: MockPurchase) {
  return {
    ...purchase,
    lastSyncedAt: undefined,
    remoteId: undefined,
    syncStatus: 'local' as const,
  };
}

function isResolvedPurchaseStatus(
  status: PurchaseStatus,
): status is ResolvedPurchaseStatus {
  return status === 'returned' || status === 'kept';
}

function getPurchaseDecisionTime(purchase: MockPurchase) {
  if (isResolvedPurchaseStatus(purchase.status)) {
    return purchase.resolvedAt;
  }

  if (purchase.status === 'pending') {
    return purchase.pendingAt ?? purchase.createdAt;
  }

  return undefined;
}

function isRepresentablePendingDecision(purchase: MockPurchase) {
  return (
    purchase.status === 'pending' &&
    getReturnDateUrgency(purchase).state === 'expired'
  );
}

function shouldGuestDecisionUpdateAccountPurchase(
  guestPurchase: MockPurchase,
  accountPurchase: MockPurchase,
) {
  if (guestPurchase.status === 'active') {
    return false;
  }

  if (isResolvedPurchaseStatus(guestPurchase.status)) {
    if (
      accountPurchase.status === 'active' ||
      accountPurchase.status === 'pending'
    ) {
      return true;
    }

    if (isResolvedPurchaseStatus(accountPurchase.status)) {
      const guestDecisionTime = getPurchaseDecisionTime(guestPurchase);
      const accountDecisionTime = getPurchaseDecisionTime(accountPurchase);

      if (guestDecisionTime && !accountDecisionTime) {
        return true;
      }

      return Boolean(
        guestDecisionTime &&
          accountDecisionTime &&
          guestDecisionTime > accountDecisionTime,
      );
    }
  }

  return (
    isRepresentablePendingDecision(guestPurchase) &&
    accountPurchase.status === 'active'
  );
}

function getResolvedPurchaseCompletedText(
  purchase: MockPurchase & { status: ResolvedPurchaseStatus },
) {
  if (purchase.resolvedAt) {
    return getResolvedStatusText(purchase.status, new Date(purchase.resolvedAt));
  }

  return purchase.completedText ?? purchase.days;
}

function reconcileGuestPurchaseIntoAccountPurchase(
  guestPurchase: MockPurchase,
  accountPurchase: MockPurchase,
) {
  if (isResolvedPurchaseStatus(guestPurchase.status)) {
    const completedText = getResolvedPurchaseCompletedText({
      ...guestPurchase,
      status: guestPurchase.status,
    });

    return {
      ...accountPurchase,
      completedText,
      days: completedText,
      pendingAt: undefined,
      resolvedAt: guestPurchase.resolvedAt ?? accountPurchase.resolvedAt,
      status: guestPurchase.status,
      syncStatus: 'local' as const,
    };
  }

  return {
    ...accountPurchase,
    completedText: undefined,
    days: 'Needs decision',
    pendingAt: guestPurchase.pendingAt ?? accountPurchase.pendingAt,
    resolvedAt: undefined,
    returnBy: guestPurchase.returnBy,
    returnByDetail: guestPurchase.returnByDetail,
    returnDateISO: guestPurchase.returnDateISO,
    status: 'pending' as const,
    syncStatus: 'local' as const,
  };
}

function getGuestPurchaseMigrationPlan(
  userId: string,
  guestPurchases: MockPurchase[],
  accountPurchases: MockPurchase[],
  remotePurchaseIdentities: SupabasePurchaseMigrationIdentityRow[],
) {
  const guestPurchasesForInsert: MockPurchase[] = [];
  const accountPurchaseReconciliations: GuestAccountPurchaseReconciliation[] =
    [];
  const guestPurchaseAccountLinks: GuestPurchaseAccountLink[] = [];
  const guestPurchaseTombstoneUpdates: MockPurchase[] = [];
  const pendingLinkedAccountDeletes: GuestLinkedAccountDelete[] = [];
  let nextAccountPurchases = accountPurchases;

  guestPurchases.forEach((guestPurchase) => {
    const matchingRemotePurchaseIdentity =
      findMatchingRemotePurchaseIdentityForGuestMigration(
        guestPurchase,
        remotePurchaseIdentities,
      );
    const pendingLinkedAccountDelete = getGuestLinkedAccountDelete(
      userId,
      guestPurchase,
    );

    if (isTombstonedPurchase(guestPurchase)) {
      if (pendingLinkedAccountDelete) {
        nextAccountPurchases = getAccountPurchasesWithoutLinkedAccountDelete(
          nextAccountPurchases,
          pendingLinkedAccountDelete,
        );
      } else if (guestPurchase.linkedAccountUserId === userId) {
        nextAccountPurchases = getPurchasesWithoutSharedIdentity(
          nextAccountPurchases,
          guestPurchase,
        );
      }

      if (pendingLinkedAccountDelete) {
        if (matchingRemotePurchaseIdentity?.deleted_at) {
          guestPurchaseTombstoneUpdates.push(
            getGuestPurchaseDeletedFromLinkedAccount(
              guestPurchase,
              matchingRemotePurchaseIdentity.deleted_at,
            ),
          );
        } else {
          pendingLinkedAccountDeletes.push(pendingLinkedAccountDelete);
        }
      }

      return;
    }

    const matchingAccountPurchase =
      findMatchingAccountPurchaseForGuestMigration(
        guestPurchase,
        nextAccountPurchases,
      );

    if (matchingAccountPurchase) {
      const accountLink = getGuestPurchaseAccountLinkFromAccountPurchase(
        userId,
        guestPurchase,
        matchingAccountPurchase,
      );

      if (accountLink) {
        guestPurchaseAccountLinks.push(accountLink);
      }

      if (
        !shouldGuestDecisionUpdateAccountPurchase(
          guestPurchase,
          matchingAccountPurchase,
        )
      ) {
        return;
      }

      const reconciledPurchase = reconcileGuestPurchaseIntoAccountPurchase(
        guestPurchase,
        matchingAccountPurchase,
      );

      accountPurchaseReconciliations.push({
        accountPurchase: reconciledPurchase,
        guestPurchase,
      });
      nextAccountPurchases = nextAccountPurchases.map((accountPurchase) =>
        hasSharedPurchaseIdentity(
          accountPurchase,
          new Set(getPurchaseIdentityValues(reconciledPurchase)),
        )
          ? reconciledPurchase
          : accountPurchase,
      );
      return;
    }

    if (matchingRemotePurchaseIdentity) {
      if (matchingRemotePurchaseIdentity.deleted_at) {
        guestPurchaseTombstoneUpdates.push(
          getGuestPurchaseDeletedFromLinkedAccount(
            guestPurchase,
            matchingRemotePurchaseIdentity.deleted_at,
          ),
        );
        nextAccountPurchases = getPurchasesWithoutSharedIdentity(
          nextAccountPurchases,
          guestPurchase,
        );
        return;
      }

      guestPurchaseAccountLinks.push(
        getGuestPurchaseAccountLinkFromRemoteIdentity(
          userId,
          guestPurchase,
          matchingRemotePurchaseIdentity,
        ),
      );
      return;
    }

    const existingGuestAccountLink = getExistingGuestPurchaseAccountLink(
      userId,
      guestPurchase,
    );

    if (existingGuestAccountLink) {
      guestPurchaseAccountLinks.push(existingGuestAccountLink);
      return;
    }

    guestPurchasesForInsert.push(
      getGuestPurchaseForNewAccountInsert(guestPurchase),
    );
  });

  return {
    accountPurchaseReconciliations,
    accountPurchases: nextAccountPurchases,
    guestPurchaseAccountLinks,
    guestPurchaseTombstoneUpdates,
    guestPurchasesForInsert,
    pendingLinkedAccountDeletes,
  };
}

function getEmptyGuestPurchaseMigrationPlan(accountPurchases: MockPurchase[]) {
  return {
    accountPurchaseReconciliations: [] as GuestAccountPurchaseReconciliation[],
    accountPurchases,
    guestPurchaseAccountLinks: [] as GuestPurchaseAccountLink[],
    guestPurchaseTombstoneUpdates: [] as MockPurchase[],
    guestPurchasesForInsert: [] as MockPurchase[],
    pendingLinkedAccountDeletes: [] as GuestLinkedAccountDelete[],
  };
}

function getReconciledAccountPurchaseEntriesUsed({
  localKnownEntriesUsed,
  remoteTotalEntryCount,
  storedEntriesUsed,
}: {
  localKnownEntriesUsed: number;
  remoteTotalEntryCount: number;
  storedEntriesUsed: number;
}) {
  return Math.max(
    storedEntriesUsed,
    remoteTotalEntryCount,
    localKnownEntriesUsed,
  );
}

function getLastKnownAccountCapacitySnapshot({
  accountEntriesUsed,
  accountUserId,
  guestEntriesUsedAtSnapshot,
}: {
  accountEntriesUsed: number;
  accountUserId: string;
  guestEntriesUsedAtSnapshot: number;
}): LastKnownAccountCapacitySnapshot {
  return {
    accountEntriesUsed: Math.max(0, Math.floor(accountEntriesUsed)),
    accountUserId,
    guestEntriesUsedAtSnapshot: Math.max(
      0,
      Math.floor(guestEntriesUsedAtSnapshot),
    ),
    updatedAt: new Date().toISOString(),
  };
}

function getEffectiveGuestRemaining({
  lastKnownAccountCapacitySnapshot,
  rawGuestEntriesUsed,
}: {
  lastKnownAccountCapacitySnapshot: LastKnownAccountCapacitySnapshot | null;
  rawGuestEntriesUsed: number;
}) {
  const guestTrialRemaining = Math.max(
    GUEST_ITEM_LIMIT - rawGuestEntriesUsed,
    0,
  );

  if (!lastKnownAccountCapacitySnapshot) {
    return guestTrialRemaining;
  }

  const guestUsedSinceAccountSnapshot = Math.max(
    rawGuestEntriesUsed -
      lastKnownAccountCapacitySnapshot.guestEntriesUsedAtSnapshot,
    0,
  );
  const accountRemainingForGuest = Math.max(
    ACCOUNT_ITEM_LIMIT -
      lastKnownAccountCapacitySnapshot.accountEntriesUsed -
      guestUsedSinceAccountSnapshot,
    0,
  );

  return Math.min(guestTrialRemaining, accountRemainingForGuest);
}

async function hydrateLastKnownAccountCapacitySnapshot() {
  const storedSnapshot = await AsyncStorage.getItem(
    LAST_KNOWN_ACCOUNT_CAPACITY_STORAGE_KEY,
  ).catch(() => null);

  return parseLastKnownAccountCapacitySnapshot(storedSnapshot);
}

async function persistLastKnownAccountCapacitySnapshot(
  snapshot: LastKnownAccountCapacitySnapshot,
) {
  await AsyncStorage.setItem(
    LAST_KNOWN_ACCOUNT_CAPACITY_STORAGE_KEY,
    JSON.stringify(snapshot),
  ).catch(() => undefined);
}

async function hydrateCountedGuestOriginEntries(userId: string) {
  const storedCount = await AsyncStorage.getItem(
    getCountedGuestOriginEntriesStorageKey(userId),
  ).catch(() => null);

  return parseStoredGuestPurchaseEntriesUsed(storedCount) ?? 0;
}

async function persistCountedGuestOriginEntries(
  userId: string,
  countedGuestOriginEntries: number,
) {
  await AsyncStorage.setItem(
    getCountedGuestOriginEntriesStorageKey(userId),
    String(Math.max(0, Math.floor(countedGuestOriginEntries))),
  ).catch(() => undefined);
}

async function persistPurchaseStorageSnapshot(
  scopeKey: string,
  snapshot: ReturnType<typeof getPurchaseStorageSnapshot>,
) {
  const storageKeys = getScopedPurchaseStorageKeys(scopeKey);

  await Promise.all([
    AsyncStorage.setItem(
      storageKeys.purchasesKey,
      JSON.stringify(snapshot.purchases),
    ).catch(() => undefined),
    AsyncStorage.setItem(
      storageKeys.guestPurchaseEntriesUsedKey,
      String(snapshot.guestPurchaseEntriesUsed),
    ).catch(() => undefined),
  ]);
}

async function persistVisiblePurchases(
  scopeKey: string,
  purchases: MockPurchase[],
  pendingTombstonedPurchases: MockPurchase[] = [],
) {
  const storageKeys = getScopedPurchaseStorageKeys(scopeKey);
  const storedPurchases = await AsyncStorage.getItem(
    storageKeys.purchasesKey,
  ).catch(() => null);
  const hiddenStoredPurchases =
    parseStoredPurchases(storedPurchases)?.filter(isTombstonedPurchase) ?? [];
  const hiddenPurchases = getPurchasesWithUpdatedPurchases(
    hiddenStoredPurchases,
    pendingTombstonedPurchases.filter(isTombstonedPurchase),
  );
  const visiblePurchaseIdentities = getPurchaseIdentitySet(purchases);
  const preservedHiddenPurchases = hiddenPurchases.filter(
    (purchase) => !hasSharedPurchaseIdentity(purchase, visiblePurchaseIdentities),
  );

  await AsyncStorage.setItem(
    storageKeys.purchasesKey,
    JSON.stringify([...purchases, ...preservedHiddenPurchases]),
  );
}

function compactText(value?: string) {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : undefined;
}

function getPhotoLimit(userId?: string | null) {
  return userId ? ACCOUNT_PHOTO_LIMIT : GUEST_PHOTO_LIMIT;
}

function compactPhotoUris(photoUris: string[] | undefined, photoLimit: number) {
  const compactUris = photoUris
    ?.map((photoUri) => photoUri.trim())
    .filter(Boolean)
    .slice(0, photoLimit);

  return compactUris?.length ? compactUris : undefined;
}

function getCopiedPurchasePhotoUris(photoUris: string[] | undefined) {
  return (photoUris ?? [])
    .map((photoUri) => photoUri.trim())
    .filter(isCopiedPurchasePhotoUri);
}

function getReferencedCopiedPurchasePhotoUris(purchases: MockPurchase[]) {
  return new Set(
    purchases.flatMap((purchase) =>
      getCopiedPurchasePhotoUris(purchase.photoUris),
    ),
  );
}

function getUnreferencedCopiedPurchasePhotoUris(
  photoUris: string[],
  remainingPurchases: MockPurchase[],
) {
  const referencedPhotoUris =
    getReferencedCopiedPurchasePhotoUris(remainingPurchases);

  return Array.from(
    new Set(
      getCopiedPurchasePhotoUris(photoUris).filter(
        (photoUri) => !referencedPhotoUris.has(photoUri),
      ),
    ),
  );
}

function getRemovedCopiedPurchasePhotoUris(
  previousPhotoUris: string[] | undefined,
  nextPhotoUris: string[] | undefined,
) {
  const nextCopiedPhotoUris = new Set(getCopiedPurchasePhotoUris(nextPhotoUris));

  return getCopiedPurchasePhotoUris(previousPhotoUris).filter(
    (photoUri) => !nextCopiedPhotoUris.has(photoUri),
  );
}

function getAlignedPhotoRemotePaths(
  photoRemotePaths: Array<string | null | undefined> | undefined,
  photoCount: number,
) {
  return Array.from(
    { length: photoCount },
    (_, index) => photoRemotePaths?.[index] ?? null,
  );
}

function areStringArraysEqual(firstValues?: string[], secondValues?: string[]) {
  const first = firstValues ?? [];
  const second = secondValues ?? [];

  return (
    first.length === second.length &&
    first.every((value, index) => value === second[index])
  );
}

function areNullableStringArraysEqual(
  firstValues?: Array<string | null>,
  secondValues?: Array<string | null>,
) {
  const first = firstValues ?? [];
  const second = secondValues ?? [];

  return (
    first.length === second.length &&
    first.every((value, index) => value === second[index])
  );
}

function compactPhotoRemotePaths(
  photoRemotePaths: Array<string | null | undefined> | undefined,
  photoCount: number,
  shouldKeepNullPaths = false,
) {
  if (!photoCount) {
    return undefined;
  }

  const compactRemotePaths = getAlignedPhotoRemotePaths(
    photoRemotePaths,
    photoCount,
  );

  return shouldKeepNullPaths || compactRemotePaths.some(Boolean)
    ? compactRemotePaths
    : undefined;
}

function getPreservedPhotoRemotePaths(
  previousPurchase: MockPurchase,
  nextPhotoUris?: string[],
  submittedPhotoRemotePaths?: Array<string | null>,
) {
  const previousPhotoUris = previousPurchase.photoUris ?? [];
  const previousRemotePaths = previousPurchase.photoRemotePaths ?? [];
  const nextRemotePaths = nextPhotoUris?.map((photoUri) => {
    const matchingPreviousIndex = previousPhotoUris.findIndex(
      (previousPhotoUri) => previousPhotoUri === photoUri,
    );

    return matchingPreviousIndex >= 0
      ? previousRemotePaths[matchingPreviousIndex]
      : null;
  });

  if (!nextPhotoUris?.length) {
    return undefined;
  }

  const preservedRemotePaths = nextPhotoUris.map((_, index) => {
    const submittedRemotePath = submittedPhotoRemotePaths?.[index];

    if (submittedRemotePath) {
      return submittedRemotePath;
    }

    if (submittedPhotoRemotePaths && submittedRemotePath === null) {
      return null;
    }

    return nextRemotePaths?.[index] ?? null;
  });

  return submittedPhotoRemotePaths || preservedRemotePaths.some(Boolean)
    ? preservedRemotePaths
    : undefined;
}

function getPhotoRowsByPurchaseId(photoRows: SupabasePurchasePhotoRow[]) {
  const rowsByPurchaseId = new Map<string, SupabasePurchasePhotoRow[]>();

  photoRows.forEach((photoRow) => {
    const currentRows = rowsByPurchaseId.get(photoRow.purchase_id) ?? [];

    rowsByPurchaseId.set(photoRow.purchase_id, [...currentRows, photoRow]);
  });

  return rowsByPurchaseId;
}

function getCurrentAccountPhotoRows(photoRows: SupabasePurchasePhotoRow[]) {
  const usedPositions = new Set<number>();
  const currentRows: SupabasePurchasePhotoRow[] = [];
  const sortedPhotoRows = [...photoRows].sort((firstRow, secondRow) => {
    if (firstRow.position !== secondRow.position) {
      return firstRow.position - secondRow.position;
    }

    return firstRow.storage_path.localeCompare(secondRow.storage_path);
  });

  for (const photoRow of sortedPhotoRows) {
    if (currentRows.length >= ACCOUNT_PHOTO_LIMIT) {
      break;
    }

    if (usedPositions.has(photoRow.position)) {
      continue;
    }

    usedPositions.add(photoRow.position);
    currentRows.push(photoRow);
  }

  return currentRows;
}

function getPurchaseWithRemotePhotoData(
  purchase: MockPurchase,
  photoRows: SupabasePurchasePhotoRow[] | undefined,
  signedUrlByPath: Map<string, string>,
) {
  if (!photoRows?.length) {
    return purchase;
  }

  const currentPhotoRows = getCurrentAccountPhotoRows(photoRows);
  const hasStaleRemotePhotoRows = currentPhotoRows.length < photoRows.length;
  const photoRemotePaths = currentPhotoRows.map(
    (photoRow) => photoRow.storage_path,
  );
  const photoUris = photoRemotePaths
    .map((storagePath) => signedUrlByPath.get(storagePath))
    .filter((value): value is string => Boolean(value));
  const hasCompleteCurrentPhotoUris =
    photoUris.length === photoRemotePaths.length;

  return {
    ...purchase,
    photoRemotePaths,
    photoUris: photoUris.length ? photoUris : purchase.photoUris,
    photoSyncStatus: hasStaleRemotePhotoRows && hasCompleteCurrentPhotoUris
      ? ('error' as const)
      : ('synced' as const),
  };
}

function getLocalPurchaseId(itemName: string, createdAt: number) {
  const slug =
    itemName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 34) || 'purchase';

  return `local-${slug}-${createdAt}`;
}

function getPurchaseDateFields(input: AddPurchaseInput) {
  const returnDateISO = input.returnDateISO ?? getPurchaseReturnDateISO(input);
  const returnDateSource = {
    returnBy: input.returnBy,
    returnByDetail: input.returnBy,
    returnDateISO,
  };

  return {
    returnBy: getCompactReturnDate(returnDateSource),
    returnByDetail: getFullReturnDate(returnDateSource),
    returnDateISO,
  };
}

function getPurchaseWithCurrentDateState(
  purchase: MockPurchase,
  today = new Date(),
): MockPurchase {
  if (purchase.status === 'pending' && !purchase.pendingAt) {
    return {
      ...purchase,
      pendingAt: today.getTime(),
    };
  }

  if (purchase.status !== 'active') {
    return purchase;
  }

  const urgency = getReturnDateUrgency(purchase, today);

  if (urgency.state === 'unknown') {
    return purchase;
  }

  const status = urgency.state === 'expired' ? 'pending' : purchase.status;
  const days = urgency.state === 'expired' ? 'Needs decision' : urgency.label;

  if (status === purchase.status && days === purchase.days) {
    return purchase;
  }

  return {
    ...purchase,
    days,
    pendingAt:
      status === 'pending' ? (purchase.pendingAt ?? today.getTime()) : undefined,
    status,
  };
}

function getPurchasesWithCurrentDateState(purchases: MockPurchase[]) {
  let didChangePurchase = false;
  const today = new Date();
  const nextPurchases = purchases.map((purchase) => {
    const nextPurchase = getPurchaseWithCurrentDateState(purchase, today);

    if (nextPurchase !== purchase) {
      didChangePurchase = true;
    }

    return nextPurchase;
  });

  return didChangePurchase ? nextPurchases : purchases;
}

function getPurchasesForEmptyStorage() {
  return USE_MOCK_PURCHASES_ON_EMPTY_STORAGE
    ? getPurchasesWithCurrentDateState(mockPurchases)
    : [];
}

async function hydratePurchaseStorageScope(scopeKey: string) {
  const scopedStorageKeys = getScopedPurchaseStorageKeys(scopeKey);
  const [storedScopedPurchases, storedScopedGuestPurchaseEntriesUsed] =
    await Promise.all([
      AsyncStorage.getItem(scopedStorageKeys.purchasesKey),
      AsyncStorage.getItem(scopedStorageKeys.guestPurchaseEntriesUsedKey),
    ]);

  if (
    storedScopedPurchases !== null ||
    storedScopedGuestPurchaseEntriesUsed !== null
  ) {
    return getPurchaseStorageSnapshot(
      storedScopedPurchases,
      storedScopedGuestPurchaseEntriesUsed,
    );
  }

  if (scopeKey === GUEST_PURCHASE_SCOPE_KEY) {
    const [storedLegacyPurchases, storedLegacyGuestPurchaseEntriesUsed] =
      await Promise.all([
        AsyncStorage.getItem(PURCHASES_STORAGE_KEY),
        AsyncStorage.getItem(GUEST_PURCHASE_ENTRIES_USED_STORAGE_KEY),
      ]);

    if (
      storedLegacyPurchases !== null ||
      storedLegacyGuestPurchaseEntriesUsed !== null
    ) {
      const migratedSnapshot = getPurchaseStorageSnapshot(
        storedLegacyPurchases,
        storedLegacyGuestPurchaseEntriesUsed,
      );

      await persistPurchaseStorageSnapshot(scopeKey, migratedSnapshot);

      return migratedSnapshot;
    }
  }

  const emptyPurchases = getPurchasesForEmptyStorage();

  return {
    guestPurchaseEntriesUsed: emptyPurchases.length,
    purchases: emptyPurchases,
  };
}

async function persistGuestPurchaseTombstone(tombstonedPurchase: MockPurchase) {
  const guestPurchaseSnapshot = await hydratePurchaseStorageScope(
    GUEST_PURCHASE_SCOPE_KEY,
  );
  const nextGuestPurchases = getPurchasesWithUpdatedPurchases(
    guestPurchaseSnapshot.purchases,
    [tombstonedPurchase],
  );

  if (nextGuestPurchases === guestPurchaseSnapshot.purchases) {
    return;
  }

  await persistPurchaseStorageSnapshot(GUEST_PURCHASE_SCOPE_KEY, {
    ...guestPurchaseSnapshot,
    purchases: nextGuestPurchases,
  });
}

async function persistGuestPurchaseLinkAndTombstoneUpdates(
  links: GuestPurchaseAccountLink[],
  updatedPurchases: MockPurchase[],
) {
  if (!links.length && !updatedPurchases.length) {
    return;
  }

  const guestPurchaseSnapshot = await hydratePurchaseStorageScope(
    GUEST_PURCHASE_SCOPE_KEY,
  );
  const linkedGuestPurchases = getGuestPurchasesWithAccountLinks(
    guestPurchaseSnapshot.purchases,
    links,
  );
  const nextGuestPurchases = getPurchasesWithUpdatedPurchases(
    linkedGuestPurchases,
    updatedPurchases,
  );

  if (nextGuestPurchases === guestPurchaseSnapshot.purchases) {
    return;
  }

  await persistPurchaseStorageSnapshot(GUEST_PURCHASE_SCOPE_KEY, {
    ...guestPurchaseSnapshot,
    purchases: nextGuestPurchases,
  });
}

async function markLinkedGuestPurchaseDeletedFromAccount(
  userId: string,
  accountPurchase: MockPurchase,
  deletedAt: string,
) {
  const guestPurchaseSnapshot = await hydratePurchaseStorageScope(
    GUEST_PURCHASE_SCOPE_KEY,
  );
  const updatedGuestPurchases = guestPurchaseSnapshot.purchases
    .filter(
      (guestPurchase) =>
        isGuestPurchaseLinkedToAccountPurchase(
          userId,
          guestPurchase,
          accountPurchase,
        ),
    )
    .map((guestPurchase) =>
      getGuestPurchaseDeletedFromLinkedAccount(guestPurchase, deletedAt),
    );

  if (!updatedGuestPurchases.length) {
    return;
  }

  const nextGuestPurchases = getPurchasesWithUpdatedPurchases(
    guestPurchaseSnapshot.purchases,
    updatedGuestPurchases,
  );

  if (nextGuestPurchases === guestPurchaseSnapshot.purchases) {
    return;
  }

  await persistPurchaseStorageSnapshot(GUEST_PURCHASE_SCOPE_KEY, {
    ...guestPurchaseSnapshot,
    purchases: nextGuestPurchases,
  });
}

async function syncPendingLinkedAccountDeletes(
  userId: string,
  pendingLinkedAccountDeletes: GuestLinkedAccountDelete[],
) {
  return Promise.all(
    pendingLinkedAccountDeletes.map(async (linkedAccountDelete) => {
      try {
        const { data, error } = await softDeleteRemotePurchase(
          userId,
          linkedAccountDelete.purchaseId,
        );

        if (error) {
          return linkedAccountDelete.guestPurchase;
        }

        return getGuestPurchaseDeletedFromLinkedAccount(
          linkedAccountDelete.guestPurchase,
          data.deleted_at ?? linkedAccountDelete.deletedAt,
        );
      } catch {
        return linkedAccountDelete.guestPurchase;
      }
    }),
  );
}

function getActiveToPendingPurchaseIds(
  previousPurchases: MockPurchase[],
  nextPurchases: MockPurchase[],
) {
  const previousStatusById = new Map(
    previousPurchases.map((purchase) => [purchase.id, purchase.status]),
  );

  return nextPurchases
    .filter(
      (purchase) =>
        purchase.status === 'pending' &&
        previousStatusById.get(purchase.id) === 'active',
    )
    .map((purchase) => purchase.id);
}

function getSyncedPurchaseMetadata(remoteId: string, syncedAt = new Date()) {
  return {
    lastSyncedAt: syncedAt.toISOString(),
    remoteId,
    syncStatus: 'synced' as const,
  };
}

function getSyncErrorMetadata() {
  return {
    syncStatus: 'error' as const,
  };
}

function getPhotoSyncMetadata(
  photoRows: SupabasePurchasePhotoRow[],
  didError: boolean,
) {
  return {
    lastPhotoSyncedAt: didError ? undefined : new Date().toISOString(),
    photoRemotePaths: photoRows.length
      ? photoRows.map((photoRow) => photoRow.storage_path)
      : undefined,
    photoSyncStatus: didError ? ('error' as const) : ('synced' as const),
  };
}

function hasLocalPhotoUris(purchase: MockPurchase) {
  return Boolean(purchase.photoUris?.some(isLocalPhotoUri));
}

function shouldSyncLocalPurchasePhotos(purchase: MockPurchase) {
  if (!purchase.remoteId) {
    return false;
  }

  const photoUriCount = purchase.photoUris?.length ?? 0;
  const remotePathCount =
    purchase.photoRemotePaths?.filter((storagePath) => Boolean(storagePath))
      .length ?? 0;

  if (
    purchase.photoSyncStatus === 'error' ||
    purchase.photoSyncStatus === 'local'
  ) {
    return true;
  }

  if (!hasLocalPhotoUris(purchase)) {
    return false;
  }

  return (
    purchase.photoSyncStatus !== 'synced' || remotePathCount < photoUriCount
  );
}

async function syncGuestMigrationPurchases(
  userId: string,
  guestPurchases: MockPurchase[],
): Promise<GuestPurchaseMigrationSyncResult[]> {
  return Promise.all(
    guestPurchases.map(async (purchase) => {
      const localLink = getGuestPurchaseLocalAccountLink(userId, purchase);

      try {
        const { data, error } = await createRemotePurchase(userId, purchase);

        if (error) {
          return {
            accountPurchase: {
              ...getAccountPurchaseWithGuestLink(purchase, localLink),
              ...getSyncErrorMetadata(),
            },
            guestPurchase: purchase,
            link: localLink,
          };
        }

        const photoSyncSummary = await syncPurchasePhotos({
          photoUris: purchase.photoUris,
          purchaseId: data.id,
          userId,
        });
        const link = getGuestPurchaseAccountLinkFromRemoteIdentity(
          userId,
          purchase,
          data,
        );

        return {
          accountPurchase: {
            ...purchase,
            ...getGuestPurchaseWithAccountLink(purchase, {
              ...link,
              lastSyncedAt: data.updated_at,
            }),
            ...getPhotoSyncMetadata(
              photoSyncSummary.rows,
              photoSyncSummary.didError,
            ),
          },
          guestPurchase: purchase,
          link: {
            ...link,
            lastSyncedAt: data.updated_at,
          },
        };
      } catch {
        return {
          accountPurchase: {
            ...getAccountPurchaseWithGuestLink(purchase, localLink),
            ...getSyncErrorMetadata(),
          },
          guestPurchase: purchase,
          link: localLink,
        };
      }
    }),
  );
}

async function syncGuestAccountPurchaseReconciliations(
  userId: string,
  accountPurchaseReconciliations: GuestAccountPurchaseReconciliation[],
): Promise<GuestPurchaseMigrationSyncResult[]> {
  return Promise.all(
    accountPurchaseReconciliations.map(async ({ accountPurchase, guestPurchase }) => {
      const fallbackLink = getGuestPurchaseLocalAccountLink(
        userId,
        guestPurchase,
      );
      const accountLink =
        getGuestPurchaseAccountLinkFromAccountPurchase(
          userId,
          guestPurchase,
          accountPurchase,
        ) ?? fallbackLink;

      try {
        const { data, error } = await updateRemotePurchase(
          userId,
          accountPurchase,
        );

        if (error) {
          return {
            accountPurchase: {
              ...getAccountPurchaseWithGuestLink(accountPurchase, accountLink),
              ...getSyncErrorMetadata(),
            },
            guestPurchase,
            link: accountLink,
          };
        }
        const link = getGuestPurchaseAccountLinkFromRemoteIdentity(
          userId,
          guestPurchase,
          data,
        );

        return {
          accountPurchase: {
            ...accountPurchase,
            ...getSyncedPurchaseMetadata(data.id),
            linkedAccountUserId: userId,
            linkedClientLocalId: data.client_local_id ?? guestPurchase.id,
            linkedRemoteId: data.id,
            origin: 'guest' as const,
          },
          guestPurchase,
          link: {
            ...link,
            lastSyncedAt: data.updated_at,
          },
        };
      } catch {
        return {
          accountPurchase: {
            ...getAccountPurchaseWithGuestLink(accountPurchase, accountLink),
            ...getSyncErrorMetadata(),
          },
          guestPurchase,
          link: accountLink,
        };
      }
    }),
  );
}

async function syncAccountLocalPurchasePhotos(
  userId: string,
  accountPurchases: MockPurchase[],
) {
  return Promise.all(
    accountPurchases.map(async (purchase) => {
      if (!shouldSyncLocalPurchasePhotos(purchase) || !purchase.remoteId) {
        return purchase;
      }

      try {
        const photoSyncSummary = await syncPurchasePhotos({
          existingStoragePaths: purchase.photoRemotePaths,
          photoUris: purchase.photoUris,
          purchaseId: purchase.remoteId,
          userId,
        });

        return {
          ...purchase,
          ...getPhotoSyncMetadata(
            photoSyncSummary.rows,
            photoSyncSummary.didError,
          ),
        };
      } catch {
        return {
          ...purchase,
          photoSyncStatus: 'error' as const,
        };
      }
    }),
  );
}

export function PurchasesProvider({ children }: { children: ReactNode }) {
  const { isAuthLoading, user } = useAuth();
  const { hasHydratedSettings, remindersEnabled } = useAppSettings();
  const purchaseScopeKey = useMemo(
    () => (isAuthLoading ? null : getPurchaseScopeKey(user?.id)),
    [isAuthLoading, user?.id],
  );
  const [purchases, setPurchases] = useState<MockPurchase[]>(() =>
    getPurchasesForEmptyStorage(),
  );
  const [guestPurchaseEntriesUsed, setGuestPurchaseEntriesUsed] = useState(
    () => getPurchasesForEmptyStorage().length,
  );
  const [
    lastKnownAccountCapacitySnapshot,
    setLastKnownAccountCapacitySnapshot,
  ] = useState<LastKnownAccountCapacitySnapshot | null>(null);
  const [hasHydratedPurchases, setHasHydratedPurchases] = useState(false);
  const [hydratedPurchaseScopeKey, setHydratedPurchaseScopeKey] = useState<
    string | null
  >(null);
  const hasSkippedInitialPersistRef = useRef(false);
  const lastReminderPurchasesRef = useRef<MockPurchase[] | null>(null);
  const pendingLocalTombstonesRef = useRef<MockPurchase[]>([]);
  const pendingLinkedGuestDeletesFromAccountRef = useRef<
    PendingLinkedGuestDeleteFromAccount[]
  >([]);
  const pendingCopiedPhotoCleanupUrisRef = useRef<string[]>([]);
  const copiedPhotoCleanupVersionRef = useRef(0);
  const purchasePersistenceVersionRef = useRef(0);
  const reminderSyncQueueRef = useRef(Promise.resolve());
  const signedInUserId = user?.id;

  const queueCopiedPhotoCleanup = useCallback(
    (photoUris: string[] | undefined) => {
      const copiedPhotoUris = getCopiedPurchasePhotoUris(photoUris);

      if (!copiedPhotoUris.length) {
        return;
      }

      pendingCopiedPhotoCleanupUrisRef.current = Array.from(
        new Set([
          ...pendingCopiedPhotoCleanupUrisRef.current,
          ...copiedPhotoUris,
        ]),
      );
      copiedPhotoCleanupVersionRef.current += 1;
    },
    [],
  );

  useEffect(() => {
    if (purchaseScopeKey === null) {
      setHasHydratedPurchases(false);
      setHydratedPurchaseScopeKey(null);
      return;
    }

    let isMounted = true;
    const fallbackPurchases = getPurchasesForEmptyStorage();

    setHasHydratedPurchases(false);
    setHydratedPurchaseScopeKey(null);
    setPurchases(fallbackPurchases);
    setGuestPurchaseEntriesUsed(fallbackPurchases.length);
    hasSkippedInitialPersistRef.current = false;
    lastReminderPurchasesRef.current = null;
    pendingCopiedPhotoCleanupUrisRef.current = [];
    copiedPhotoCleanupVersionRef.current += 1;
    purchasePersistenceVersionRef.current += 1;
    if (purchaseScopeKey === GUEST_PURCHASE_SCOPE_KEY) {
      pendingLocalTombstonesRef.current = [];
    }

    const hydratePurchases = async () => {
      try {
        const scopedPurchaseSnapshot =
          await hydratePurchaseStorageScope(purchaseScopeKey);
        const storedLastKnownAccountCapacitySnapshot =
          await hydrateLastKnownAccountCapacitySnapshot();
        let linkedGuestPurchaseSnapshot: Awaited<
          ReturnType<typeof hydratePurchaseStorageScope>
        > | null = null;

        if (signedInUserId) {
          linkedGuestPurchaseSnapshot = await hydratePurchaseStorageScope(
            GUEST_PURCHASE_SCOPE_KEY,
          ).catch(() => null);
        }
        const linkedGuestPurchasesForScope = signedInUserId
          ? getPurchasesWithUpdatedPurchases(
              linkedGuestPurchaseSnapshot?.purchases ?? [],
              pendingLocalTombstonesRef.current,
            )
          : [];
        const visibleScopedPurchases = signedInUserId
          ? getAccountPurchasesWithoutLinkedGuestTombstones(
              signedInUserId,
              getVisiblePurchases(scopedPurchaseSnapshot.purchases),
              linkedGuestPurchasesForScope,
            )
          : getGuestPurchasesWithoutPendingLinkedAccountDeletes(
              getVisiblePurchases(scopedPurchaseSnapshot.purchases),
              pendingLinkedGuestDeletesFromAccountRef.current,
            );

        if (!isMounted) {
          return;
        }

        setLastKnownAccountCapacitySnapshot(
          storedLastKnownAccountCapacitySnapshot,
        );
        setPurchases(visibleScopedPurchases);
        setGuestPurchaseEntriesUsed(
          scopedPurchaseSnapshot.guestPurchaseEntriesUsed,
        );

        if (!signedInUserId) {
          return;
        }

        try {
          const { data: remoteRows, error } =
            await fetchRemotePurchases(signedInUserId);

          if (!isMounted || error) {
            return;
          }

          const purchaseIds = remoteRows.map((remoteRow) => remoteRow.id);
          const { data: remotePhotoRows } = await fetchPurchasePhotos(
            signedInUserId,
            purchaseIds,
          );
          const signedUrlByPath = await getSignedPhotoUrls(
            (remotePhotoRows ?? []).map((photoRow) => photoRow.storage_path),
          );
          const photoRowsByPurchaseId = getPhotoRowsByPurchaseId(
            remotePhotoRows ?? [],
          );
          const remotePurchases = remoteRows.map((remoteRow) =>
            getPurchaseWithRemotePhotoData(
              mapRemotePurchaseRowToLocalPurchase(remoteRow),
              photoRowsByPurchaseId.get(remoteRow.id),
              signedUrlByPath,
            ),
          );
          const mergedPurchases = mergeRemotePurchasesWithLocalUnsynced(
            remotePurchases,
            scopedPurchaseSnapshot.purchases,
          );
          const guestPurchaseSnapshot =
            linkedGuestPurchaseSnapshot ??
            (await hydratePurchaseStorageScope(GUEST_PURCHASE_SCOPE_KEY));
          const pendingLocalTombstones = pendingLocalTombstonesRef.current;
          const guestPurchasesForMigration = pendingLocalTombstones.length
            ? getPurchasesWithUpdatedPurchases(
                guestPurchaseSnapshot.purchases,
                pendingLocalTombstones,
              )
            : guestPurchaseSnapshot.purchases;
          const {
            data: remotePurchaseMigrationIdentities,
            error: remotePurchaseMigrationIdentitiesError,
          } = await fetchRemotePurchaseMigrationIdentities(signedInUserId);
          const backfilledAccountPurchases =
            await backfillSignedInLocalPurchases(
              signedInUserId,
              mergedPurchases,
              remotePurchases,
              remotePurchaseMigrationIdentities ?? [],
              {
                canCreateMissingRemotePurchases:
                  !remotePurchaseMigrationIdentitiesError,
              },
            );
          const guestPurchaseMigrationPlan =
            remotePurchaseMigrationIdentitiesError
              ? getEmptyGuestPurchaseMigrationPlan(backfilledAccountPurchases)
              : getGuestPurchaseMigrationPlan(
                  signedInUserId,
                  guestPurchasesForMigration,
                  backfilledAccountPurchases,
                  remotePurchaseMigrationIdentities ?? [],
                );
          const reconciledAccountPurchases =
            guestPurchaseMigrationPlan.accountPurchaseReconciliations.length > 0
              ? await syncGuestAccountPurchaseReconciliations(
                  signedInUserId,
                  guestPurchaseMigrationPlan.accountPurchaseReconciliations,
                )
              : [];
          const migratedGuestPurchases =
            guestPurchaseMigrationPlan.guestPurchasesForInsert.length > 0
              ? await syncGuestMigrationPurchases(
                  signedInUserId,
                  guestPurchaseMigrationPlan.guestPurchasesForInsert,
                )
              : [];
          const linkedAccountDeleteUpdates =
            guestPurchaseMigrationPlan.pendingLinkedAccountDeletes.length > 0
              ? await syncPendingLinkedAccountDeletes(
                  signedInUserId,
                  guestPurchaseMigrationPlan.pendingLinkedAccountDeletes,
                )
              : [];
          const guestPurchaseAccountLinks = [
            ...guestPurchaseMigrationPlan.guestPurchaseAccountLinks,
            ...reconciledAccountPurchases
              .map((migrationResult) => migrationResult.link)
              .filter(
                (link): link is GuestPurchaseAccountLink => link !== null,
              ),
            ...migratedGuestPurchases
              .map((migrationResult) => migrationResult.link)
              .filter(
                (link): link is GuestPurchaseAccountLink => link !== null,
              ),
          ];
          const guestPurchaseUpdates = [
            ...pendingLocalTombstones,
            ...guestPurchaseMigrationPlan.guestPurchaseTombstoneUpdates,
            ...linkedAccountDeleteUpdates,
          ];
          const accountPurchases = [
            ...migratedGuestPurchases.map(
              (migrationResult) => migrationResult.accountPurchase,
            ),
            ...guestPurchaseMigrationPlan.accountPurchases.map(
              (accountPurchase) =>
                findPurchaseBySharedIdentity(
                  accountPurchase,
                  reconciledAccountPurchases.map(
                    (migrationResult) => migrationResult.accountPurchase,
                  ),
                ) ?? accountPurchase,
            ),
          ];
          const accountPurchasesWithSyncedPhotos =
            await syncAccountLocalPurchasePhotos(
              signedInUserId,
              accountPurchases,
            );
          const visibleAccountPurchasesWithSyncedPhotos = getVisiblePurchases(
            accountPurchasesWithSyncedPhotos,
          );
          const currentGuestOriginAccountEntryCount =
            getGuestOriginAccountEntryCount(accountPurchasesWithSyncedPhotos);
          const countedGuestOriginEntries =
            await hydrateCountedGuestOriginEntries(signedInUserId);
          const guestEntriesUsedForAccountTransfer = Math.max(
            guestPurchaseSnapshot.guestPurchaseEntriesUsed,
            currentGuestOriginAccountEntryCount,
          );
          const newlyUncountedGuestEntriesUsed = Math.max(
            0,
            guestEntriesUsedForAccountTransfer - countedGuestOriginEntries,
          );
          const newlyUncountedGuestOriginEntries = Math.max(
            0,
            currentGuestOriginAccountEntryCount - countedGuestOriginEntries,
          );
          const successfulMigratedGuestPurchaseCount =
            migratedGuestPurchases.filter((migrationResult) =>
              Boolean(migrationResult.link?.remoteId),
            ).length;
          const entriesToChargeToAccountUsage = Math.max(
            newlyUncountedGuestEntriesUsed,
            newlyUncountedGuestOriginEntries,
            successfulMigratedGuestPurchaseCount,
          );
          const migrationUsageFloor =
            scopedPurchaseSnapshot.guestPurchaseEntriesUsed +
            entriesToChargeToAccountUsage;
          const { data: remoteTotalEntryCount } =
            await fetchRemotePurchaseEntryCount(signedInUserId);
          const reconciledAccountPurchaseEntriesUsed =
            getReconciledAccountPurchaseEntriesUsed({
              localKnownEntriesUsed: Math.max(
                scopedPurchaseSnapshot.purchases.length,
                visibleAccountPurchasesWithSyncedPhotos.length,
                migrationUsageFloor,
              ),
              remoteTotalEntryCount: remoteTotalEntryCount ?? remoteRows.length,
              storedEntriesUsed: scopedPurchaseSnapshot.guestPurchaseEntriesUsed,
            });
          const remoteHydratedSnapshot = {
            guestPurchaseEntriesUsed: reconciledAccountPurchaseEntriesUsed,
            purchases: visibleAccountPurchasesWithSyncedPhotos,
          };
          const nextLastKnownAccountCapacitySnapshot =
            getLastKnownAccountCapacitySnapshot({
              accountEntriesUsed: reconciledAccountPurchaseEntriesUsed,
              accountUserId: signedInUserId,
              guestEntriesUsedAtSnapshot:
                guestPurchaseSnapshot.guestPurchaseEntriesUsed,
            });

          setPurchases(remoteHydratedSnapshot.purchases);
          setGuestPurchaseEntriesUsed(
            remoteHydratedSnapshot.guestPurchaseEntriesUsed,
          );
          setLastKnownAccountCapacitySnapshot(
            nextLastKnownAccountCapacitySnapshot,
          );
          await persistPurchaseStorageSnapshot(
            purchaseScopeKey,
            remoteHydratedSnapshot,
          );
          await persistLastKnownAccountCapacitySnapshot(
            nextLastKnownAccountCapacitySnapshot,
          );
          await persistCountedGuestOriginEntries(
            signedInUserId,
            Math.max(
              countedGuestOriginEntries,
              guestEntriesUsedForAccountTransfer,
              currentGuestOriginAccountEntryCount,
            ),
          );
          await persistGuestPurchaseLinkAndTombstoneUpdates(
            guestPurchaseAccountLinks,
            guestPurchaseUpdates,
          );
          pendingLocalTombstonesRef.current = [];
        } catch {
          // Keep the scoped local cache visible if remote hydration fails.
        }
      } catch {
        if (isMounted) {
          const emptyPurchases = getPurchasesForEmptyStorage();

          setPurchases(emptyPurchases);
          setGuestPurchaseEntriesUsed(emptyPurchases.length);
        }
      } finally {
        if (isMounted) {
          setHydratedPurchaseScopeKey(purchaseScopeKey);
          setHasHydratedPurchases(true);
        }
      }
    };

    hydratePurchases();

    return () => {
      isMounted = false;
    };
  }, [purchaseScopeKey, signedInUserId]);

  useEffect(() => {
    if (
      !hasHydratedPurchases ||
      !hasHydratedSettings ||
      purchaseScopeKey === null ||
      hydratedPurchaseScopeKey !== purchaseScopeKey
    ) {
      return;
    }

    if (!hasSkippedInitialPersistRef.current) {
      hasSkippedInitialPersistRef.current = true;
      return;
    }

    const persistenceVersion = purchasePersistenceVersionRef.current + 1;
    const cleanupVersion = copiedPhotoCleanupVersionRef.current;
    const purchasesSnapshot = purchases;
    const pendingTombstonedPurchases =
      purchaseScopeKey === GUEST_PURCHASE_SCOPE_KEY
        ? pendingLocalTombstonesRef.current
        : [];

    purchasePersistenceVersionRef.current = persistenceVersion;

    persistVisiblePurchases(
      purchaseScopeKey,
      purchasesSnapshot,
      pendingTombstonedPurchases,
    )
      .then(() => {
        const pendingPhotoUris = pendingCopiedPhotoCleanupUrisRef.current;

        if (!pendingPhotoUris.length) {
          return undefined;
        }

        const unreferencedPhotoUris = getUnreferencedCopiedPurchasePhotoUris(
          pendingPhotoUris,
          purchasesSnapshot,
        );
        const canDrainPreservedPhotoUris =
          purchasePersistenceVersionRef.current === persistenceVersion &&
          copiedPhotoCleanupVersionRef.current === cleanupVersion;
        const processedPhotoUris = canDrainPreservedPhotoUris
          ? pendingPhotoUris
          : unreferencedPhotoUris;

        if (processedPhotoUris.length) {
          const processedPhotoUriSet = new Set(processedPhotoUris);

          pendingCopiedPhotoCleanupUrisRef.current =
            pendingCopiedPhotoCleanupUrisRef.current.filter(
              (photoUri) => !processedPhotoUriSet.has(photoUri),
            );
        }

        if (!unreferencedPhotoUris.length) {
          return undefined;
        }

        return deleteCopiedPurchasePhotoFiles(unreferencedPhotoUris).catch(
          () => undefined,
        );
      })
      .catch(() => {
        // Local persistence is best-effort for the frontend-only purchase state.
      });
  }, [
    hasHydratedPurchases,
    hydratedPurchaseScopeKey,
    purchaseScopeKey,
    purchases,
  ]);

  useEffect(() => {
    if (
      !hasHydratedPurchases ||
      purchaseScopeKey === null ||
      hydratedPurchaseScopeKey !== purchaseScopeKey
    ) {
      return;
    }

    const storageKeys = getScopedPurchaseStorageKeys(purchaseScopeKey);

    AsyncStorage.setItem(
      storageKeys.guestPurchaseEntriesUsedKey,
      String(guestPurchaseEntriesUsed),
    ).catch(() => {
      // Local quota persistence is best-effort for the frontend-only guest state.
    });
  }, [
    guestPurchaseEntriesUsed,
    hasHydratedPurchases,
    hydratedPurchaseScopeKey,
    purchaseScopeKey,
  ]);

  const markPurchaseSyncMetadata = useCallback(
    (
      itemId: string,
      metadata: Partial<
        Pick<MockPurchase, 'lastSyncedAt' | 'remoteId' | 'syncStatus'>
      >,
    ) => {
      setPurchases((currentPurchases) =>
        currentPurchases.map((purchase) =>
          purchase.id === itemId
            ? {
                ...purchase,
                ...metadata,
              }
            : purchase,
        ),
      );
    },
    [],
  );

  const markPurchasePhotoSyncMetadata = useCallback(
    (
      itemId: string,
      metadata: Partial<
        Pick<
          MockPurchase,
          'lastPhotoSyncedAt' | 'photoRemotePaths' | 'photoSyncStatus'
        >
      >,
    ) => {
      setPurchases((currentPurchases) =>
        currentPurchases.map((purchase) =>
          purchase.id === itemId
            ? {
                ...purchase,
                ...metadata,
              }
            : purchase,
        ),
      );
    },
    [],
  );

  const syncCreatedPurchase = useCallback(
    async (localPurchase: MockPurchase) => {
      if (!signedInUserId) {
        return;
      }

      try {
        const { data, error } = await createRemotePurchase(
          signedInUserId,
          localPurchase,
        );

        if (error) {
          markPurchaseSyncMetadata(localPurchase.id, getSyncErrorMetadata());
          return;
        }

        markPurchaseSyncMetadata(
          localPurchase.id,
          getSyncedPurchaseMetadata(data.id),
        );

        const photoSyncSummary = await syncPurchasePhotos({
          existingStoragePaths: localPurchase.photoRemotePaths,
          photoUris: localPurchase.photoUris,
          purchaseId: data.id,
          userId: signedInUserId,
        });

        markPurchasePhotoSyncMetadata(
          localPurchase.id,
          getPhotoSyncMetadata(
            photoSyncSummary.rows,
            photoSyncSummary.didError,
          ),
        );
      } catch {
        markPurchaseSyncMetadata(localPurchase.id, getSyncErrorMetadata());
      }
    },
    [markPurchasePhotoSyncMetadata, markPurchaseSyncMetadata, signedInUserId],
  );

  const syncUpdatedPurchase = useCallback(
    async (localPurchase: MockPurchase) => {
      if (!signedInUserId) {
        return;
      }

      try {
        const { data, error } = await updateRemotePurchase(
          signedInUserId,
          localPurchase,
        );

        if (error) {
          markPurchaseSyncMetadata(localPurchase.id, getSyncErrorMetadata());
          return;
        }

        markPurchaseSyncMetadata(
          localPurchase.id,
          getSyncedPurchaseMetadata(data.id),
        );

        const photoSyncSummary = await syncPurchasePhotos({
          existingStoragePaths: localPurchase.photoRemotePaths,
          photoUris: localPurchase.photoUris,
          purchaseId: data.id,
          userId: signedInUserId,
        });

        markPurchasePhotoSyncMetadata(
          localPurchase.id,
          getPhotoSyncMetadata(
            photoSyncSummary.rows,
            photoSyncSummary.didError,
          ),
        );
      } catch {
        markPurchaseSyncMetadata(localPurchase.id, getSyncErrorMetadata());
      }
    },
    [markPurchasePhotoSyncMetadata, markPurchaseSyncMetadata, signedInUserId],
  );

  const syncDeletedPurchase = useCallback(
    async (localPurchase: MockPurchase, deletedAt: string) => {
      if (!signedInUserId) {
        return;
      }

      const pendingLinkedGuestDelete = {
        accountPurchase: localPurchase,
        deletedAt,
        userId: signedInUserId,
      };
      pendingLinkedGuestDeletesFromAccountRef.current = [
        ...pendingLinkedGuestDeletesFromAccountRef.current,
        pendingLinkedGuestDelete,
      ];

      try {
        await markLinkedGuestPurchaseDeletedFromAccount(
          signedInUserId,
          localPurchase,
          deletedAt,
        );
        pendingLinkedGuestDeletesFromAccountRef.current =
          pendingLinkedGuestDeletesFromAccountRef.current.filter(
            (pendingDelete) =>
              pendingDelete !== pendingLinkedGuestDelete &&
              !hasSharedPurchaseIdentity(
                pendingDelete.accountPurchase,
                new Set(getPurchaseIdentityValues(localPurchase)),
              ),
          );
      } catch {
        // Guest-side linked tombstones are best-effort local persistence.
      }

      try {
        await softDeleteRemotePurchase(
          signedInUserId,
          localPurchase.remoteId ?? localPurchase.id,
        );
      } catch {
        // Local deletion remains authoritative until a future retry queue exists.
      }
    },
    [signedInUserId],
  );

  const syncResolvedPurchase = useCallback(
    async (localPurchase: MockPurchase, status: ResolvedPurchaseStatus) => {
      if (!signedInUserId || !localPurchase.resolvedAt) {
        return;
      }

      try {
        const { data, error } = await resolveRemotePurchase(
          signedInUserId,
          localPurchase.remoteId ?? localPurchase.id,
          status,
          new Date(localPurchase.resolvedAt),
        );

        if (error) {
          markPurchaseSyncMetadata(localPurchase.id, getSyncErrorMetadata());
          return;
        }

        markPurchaseSyncMetadata(
          localPurchase.id,
          getSyncedPurchaseMetadata(data.id),
        );
      } catch {
        markPurchaseSyncMetadata(localPurchase.id, getSyncErrorMetadata());
      }
    },
    [markPurchaseSyncMetadata, signedInUserId],
  );

  const updateLastKnownAccountCapacityAfterAccountAdd = useCallback(
    async (accountEntriesUsed: number) => {
      if (!signedInUserId) {
        return;
      }

      const existingGuestEntriesUsedAtSnapshot =
        lastKnownAccountCapacitySnapshot?.accountUserId === signedInUserId
          ? lastKnownAccountCapacitySnapshot.guestEntriesUsedAtSnapshot
          : null;
      const guestPurchaseSnapshot =
        existingGuestEntriesUsedAtSnapshot === null
          ? await hydratePurchaseStorageScope(GUEST_PURCHASE_SCOPE_KEY).catch(
              () => null,
            )
          : null;
      const nextSnapshot = getLastKnownAccountCapacitySnapshot({
        accountEntriesUsed,
        accountUserId: signedInUserId,
        guestEntriesUsedAtSnapshot:
          existingGuestEntriesUsedAtSnapshot ??
          guestPurchaseSnapshot?.guestPurchaseEntriesUsed ??
          0,
      });

      setLastKnownAccountCapacitySnapshot(nextSnapshot);
      await persistLastKnownAccountCapacitySnapshot(nextSnapshot);
    },
    [lastKnownAccountCapacitySnapshot, signedInUserId],
  );

  const addPurchase = useCallback((input: AddPurchaseInput) => {
    const createdAt = Date.now();
    const itemName = input.itemName.trim();
    const store = compactText(input.store) ?? 'Online purchase';
    const productLink = compactText(input.productLink);
    const returnDateFields = getPurchaseDateFields(input);
    const photoUris = compactPhotoUris(
      input.photoUris,
      getPhotoLimit(signedInUserId),
    );
    const photoRemotePaths = compactPhotoRemotePaths(
      input.photoRemotePaths,
      photoUris?.length ?? 0,
      Boolean(signedInUserId),
    );
    const newPurchase: MockPurchase = {
      comment: compactText(input.comment),
      createdAt,
      days: 'Due later',
      id: getLocalPurchaseId(itemName, createdAt),
      itemName,
      origin: signedInUserId ? 'account' : 'guest',
      photoRemotePaths,
      photoUris,
      price: compactText(input.price),
      productLink,
      purchaseDateISO: input.purchaseDateISO,
      purchased: compactText(input.purchased),
      ...returnDateFields,
      ...(signedInUserId ? { syncStatus: 'local' as const } : {}),
      status: 'active',
      store,
    };

    const datedPurchase = getPurchaseWithCurrentDateState(
      newPurchase,
      new Date(createdAt),
    );

    setPurchases((currentPurchases) => [datedPurchase, ...currentPurchases]);
    setGuestPurchaseEntriesUsed((currentEntriesUsed) => currentEntriesUsed + 1);

    if (signedInUserId) {
      void updateLastKnownAccountCapacityAfterAccountAdd(
        guestPurchaseEntriesUsed + 1,
      );
    }

    void syncCreatedPurchase(datedPurchase);

    return datedPurchase;
  }, [
    guestPurchaseEntriesUsed,
    signedInUserId,
    syncCreatedPurchase,
    updateLastKnownAccountCapacityAfterAccountAdd,
  ]);

  const findPurchaseById = useCallback(
    (itemId?: string | string[]) => {
      const resolvedItemId = Array.isArray(itemId) ? itemId[0] : itemId;

      if (!resolvedItemId) {
        return null;
      }

      return (
        purchases.find((purchase) => purchase.id === resolvedItemId) ?? null
      );
    },
    [purchases],
  );

  const getPurchaseById = useCallback(
    (itemId?: string | string[]) => {
      const resolvedItemId = Array.isArray(itemId) ? itemId[0] : itemId;
      const fallbackPurchase =
        purchases.find((purchase) => purchase.id === 'cashmere-coat') ??
        purchases[0] ??
        getMockPurchaseById(itemId);

      return (
        purchases.find((purchase) => purchase.id === resolvedItemId) ??
        fallbackPurchase
      );
    },
    [purchases],
  );

  const deletePurchase = useCallback((itemId: string) => {
    const purchaseToDelete =
      purchases.find((purchase) => purchase.id === itemId) ?? null;

    if (!purchaseToDelete) {
      return false;
    }

    const deletedAt = new Date().toISOString();

    setPurchases((currentPurchases) => {
      if (!currentPurchases.some((purchase) => purchase.id === itemId)) {
        return currentPurchases;
      }

      return currentPurchases.filter((purchase) => purchase.id !== itemId);
    });
    queueCopiedPhotoCleanup(purchaseToDelete.photoUris);

    if (!signedInUserId) {
      if (
        purchaseToDelete.linkedAccountUserId &&
        (purchaseToDelete.linkedRemoteId ||
          purchaseToDelete.remoteId ||
          purchaseToDelete.linkedClientLocalId)
      ) {
        const tombstonedPurchase = getGuestPurchaseDeletedFromGuest(
          purchaseToDelete,
          deletedAt,
        );

        pendingLocalTombstonesRef.current = getPurchasesWithUpdatedPurchases(
          pendingLocalTombstonesRef.current,
          [tombstonedPurchase],
        );

        void persistGuestPurchaseTombstone(tombstonedPurchase)
          .then(() => {
            pendingLocalTombstonesRef.current = getPurchasesWithoutSharedIdentity(
              pendingLocalTombstonesRef.current,
              tombstonedPurchase,
            );
          })
          .catch(() => undefined);
      }

      return true;
    }

    void syncDeletedPurchase(purchaseToDelete, deletedAt);

    return true;
  }, [purchases, queueCopiedPhotoCleanup, signedInUserId, syncDeletedPurchase]);

  const resolvePurchase = useCallback(
    (itemId: string, status: ResolvedPurchaseStatus) => {
      const resolvedDate = new Date();
      const completedText = getResolvedStatusText(status, resolvedDate);
      const purchaseToResolve =
        purchases.find((purchase) => purchase.id === itemId) ?? null;

      if (!purchaseToResolve) {
        return;
      }

      const resolvedPurchase: MockPurchase = {
        ...purchaseToResolve,
        completedText,
        days: completedText,
        resolvedAt: resolvedDate.getTime(),
        status,
        ...(signedInUserId
          ? { syncStatus: 'local' as const }
          : purchaseToResolve.syncStatus
            ? { syncStatus: purchaseToResolve.syncStatus }
            : {}),
      };

      setPurchases((currentPurchases) =>
        currentPurchases.map((purchase) => {
          if (purchase.id !== itemId) {
            return purchase;
          }

          return resolvedPurchase;
        }),
      );

      void syncResolvedPurchase(resolvedPurchase, status);
    },
    [purchases, signedInUserId, syncResolvedPurchase],
  );

  const updatePurchase = useCallback((itemId: string, input: AddPurchaseInput) => {
    const itemName = input.itemName.trim();
    const store = compactText(input.store) ?? 'Online purchase';
    const productLink = compactText(input.productLink);
    const returnDateFields = getPurchaseDateFields(input);
    const updatedAt = new Date();
    const purchaseToUpdate =
      purchases.find((purchase) => purchase.id === itemId) ?? null;

    if (!purchaseToUpdate) {
      return;
    }

    const nextPhotoUris = compactPhotoUris(
      input.photoUris,
      getPhotoLimit(signedInUserId),
    );
    const submittedPhotoRemotePaths =
      input.photoRemotePaths === undefined
        ? undefined
        : compactPhotoRemotePaths(
            input.photoRemotePaths,
            nextPhotoUris?.length ?? 0,
            true,
          );
    const nextPhotoRemotePaths = signedInUserId
      ? getPreservedPhotoRemotePaths(
          purchaseToUpdate,
          nextPhotoUris,
          submittedPhotoRemotePaths,
        )
      : undefined;
    const didPhotoStateChange =
      !areStringArraysEqual(purchaseToUpdate.photoUris, nextPhotoUris) ||
      !areNullableStringArraysEqual(
        purchaseToUpdate.photoRemotePaths,
        nextPhotoRemotePaths,
      );
    const removedCopiedPhotoUris = getRemovedCopiedPurchasePhotoUris(
      purchaseToUpdate.photoUris,
      nextPhotoUris,
    );

    const updatedPurchase = getPurchaseWithCurrentDateState(
      {
        ...purchaseToUpdate,
        comment: compactText(input.comment),
        itemName,
        photoRemotePaths: nextPhotoRemotePaths,
        photoUris: nextPhotoUris,
        price: compactText(input.price),
        productLink,
        purchaseDateISO: input.purchaseDateISO,
        purchased: compactText(input.purchased),
        ...returnDateFields,
        store,
        ...(signedInUserId
          ? { syncStatus: 'local' as const }
          : purchaseToUpdate.syncStatus
            ? { syncStatus: purchaseToUpdate.syncStatus }
            : {}),
        ...(signedInUserId && didPhotoStateChange
          ? { photoSyncStatus: 'local' as const }
          : {}),
      },
      updatedAt,
    );

    setPurchases((currentPurchases) =>
      currentPurchases.map((purchase) => {
        if (purchase.id !== itemId) {
          return purchase;
        }

        return updatedPurchase;
      }),
    );
    queueCopiedPhotoCleanup(removedCopiedPhotoUris);

    void syncUpdatedPurchase(updatedPurchase);
  }, [purchases, queueCopiedPhotoCleanup, signedInUserId, syncUpdatedPurchase]);

  useEffect(() => {
    if (
      !hasHydratedPurchases ||
      purchaseScopeKey === null ||
      hydratedPurchaseScopeKey !== purchaseScopeKey
    ) {
      return;
    }

    const previousPurchases = lastReminderPurchasesRef.current;
    const purchasesSnapshot = purchases;
    const immediatePendingPurchaseIds = previousPurchases
      ? getActiveToPendingPurchaseIds(previousPurchases, purchasesSnapshot)
      : [];

    lastReminderPurchasesRef.current = purchasesSnapshot;

    reminderSyncQueueRef.current = reminderSyncQueueRef.current
      .catch(() => undefined)
      .then(() =>
        rescheduleAllPurchaseReminders(purchasesSnapshot, {
          immediatePendingPurchaseIds,
          remindersEnabled,
        }),
      )
      .then(() => undefined)
      .catch(() => undefined);
  }, [
    hasHydratedPurchases,
    hasHydratedSettings,
    hydratedPurchaseScopeKey,
    purchaseScopeKey,
    purchases,
    remindersEnabled,
  ]);

  const effectiveGuestRemaining = useMemo(
    () =>
      getEffectiveGuestRemaining({
        lastKnownAccountCapacitySnapshot,
        rawGuestEntriesUsed: guestPurchaseEntriesUsed,
      }),
    [guestPurchaseEntriesUsed, lastKnownAccountCapacitySnapshot],
  );
  const isGuestAddLimitReached = effectiveGuestRemaining <= 0;

  const value = useMemo(
    () => ({
      accountPurchaseEntriesUsed: guestPurchaseEntriesUsed,
      addPurchase,
      deletePurchase,
      effectiveGuestRemaining,
      findPurchaseById,
      getPurchaseById,
      guestPurchaseEntriesUsed,
      hasHydratedPurchases,
      isGuestAddLimitReached,
      purchases,
      resolvePurchase,
      updatePurchase,
    }),
    [
      addPurchase,
      deletePurchase,
      effectiveGuestRemaining,
      findPurchaseById,
      getPurchaseById,
      guestPurchaseEntriesUsed,
      hasHydratedPurchases,
      isGuestAddLimitReached,
      purchases,
      resolvePurchase,
      updatePurchase,
    ],
  );

  return (
    <PurchasesStateContext.Provider value={value}>
      {children}
    </PurchasesStateContext.Provider>
  );
}

export function usePurchases() {
  const context = useContext(PurchasesStateContext);

  if (!context) {
    throw new Error('usePurchases must be used within PurchasesProvider');
  }

  return context;
}
