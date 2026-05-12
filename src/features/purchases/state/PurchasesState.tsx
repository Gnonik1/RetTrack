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
  fetchRemotePurchases,
  mapRemotePurchaseRowToLocalPurchase,
  resolveRemotePurchase,
  softDeleteRemotePurchase,
  updateRemotePurchase,
} from '../../../services/purchaseSyncService';
import {
  fetchPurchasePhotos,
  getSignedPhotoUrls,
  syncPurchasePhotos,
  type SupabasePurchasePhotoRow,
} from '../../../services/purchasePhotoSyncService';
import { useAuth } from '../../../state/AuthState';
import { ACCOUNT_PHOTO_LIMIT, GUEST_PHOTO_LIMIT } from '../constants';
import {
  getMockPurchaseById,
  mockPurchases,
  type MockPurchase,
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
  findPurchaseById: (itemId?: string | string[]) => MockPurchase | null;
  getPurchaseById: (itemId?: string | string[]) => MockPurchase;
  guestPurchaseEntriesUsed: number;
  hasHydratedPurchases: boolean;
  purchases: MockPurchase[];
  resolvePurchase: (itemId: string, status: ResolvedPurchaseStatus) => void;
  updatePurchase: (itemId: string, input: AddPurchaseInput) => void;
};

const PurchasesStateContext = createContext<PurchasesStateValue | undefined>(
  undefined,
);

const PURCHASES_STORAGE_KEY = 'rettrack:purchases:v1';
const GUEST_PURCHASE_ENTRIES_USED_STORAGE_KEY =
  'rettrack:guestPurchaseEntriesUsed:v1';
const GUEST_PURCHASE_SCOPE_KEY = 'guest';
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
    isOptionalNullableStringArray(value.photoRemotePaths) &&
    isOptionalPurchaseSyncStatus(value.photoSyncStatus) &&
    isOptionalStringArray(value.photoUris) &&
    isOptionalString(value.price) &&
    isOptionalString(value.productDomain) &&
    isOptionalString(value.productLink) &&
    isOptionalNumber(value.pendingAt) &&
    isOptionalString(value.purchaseDateISO) &&
    isOptionalString(value.purchased) &&
    isOptionalString(value.returnByDetail) &&
    isOptionalString(value.returnDateISO) &&
    isOptionalString(value.remoteId) &&
    isOptionalNumber(value.createdAt) &&
    isOptionalNumber(value.resolvedAt) &&
    isOptionalPurchaseSyncStatus(value.syncStatus) &&
    isOptionalString(value.lastPhotoSyncedAt) &&
    isOptionalString(value.lastSyncedAt)
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

function getPurchaseScopeKey(userId?: string | null) {
  return userId ? `user:${encodeURIComponent(userId)}` : GUEST_PURCHASE_SCOPE_KEY;
}

function getScopedPurchaseStorageKeys(scopeKey: string) {
  return {
    guestPurchaseEntriesUsedKey: `${GUEST_PURCHASE_ENTRIES_USED_STORAGE_KEY_PREFIX}:${scopeKey}`,
    purchasesKey: `${PURCHASES_STORAGE_KEY_PREFIX}:${scopeKey}`,
  };
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

function getPurchaseIdentityValues(purchase: MockPurchase) {
  return [purchase.id, purchase.remoteId].filter(
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

function getPurchaseWithLocalDeviceData(
  purchase: MockPurchase,
  localPurchases: MockPurchase[],
) {
  const localPurchase = findPurchaseBySharedIdentity(purchase, localPurchases);

  if (!localPurchase?.photoUris?.length) {
    return purchase;
  }

  const hasLocalDevicePhoto = localPurchase.photoUris.some(isLocalPhotoUri);

  if (!hasLocalDevicePhoto) {
    return purchase;
  }

  return {
    ...purchase,
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
    .map((purchase) => getPurchaseWithLocalDeviceData(purchase, localPurchases));

  return [...preservedLocalPurchases, ...remotePurchasesWithoutPreservedLocal];
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
  guestPurchases: MockPurchase[],
  accountPurchases: MockPurchase[],
) {
  const guestPurchasesForInsert: MockPurchase[] = [];
  const accountPurchaseReconciliations: MockPurchase[] = [];
  let nextAccountPurchases = accountPurchases;

  guestPurchases.forEach((guestPurchase) => {
    const matchingAccountPurchase =
      findMatchingAccountPurchaseForGuestMigration(
        guestPurchase,
        nextAccountPurchases,
      );

    if (!matchingAccountPurchase) {
      guestPurchasesForInsert.push(
        getGuestPurchaseForNewAccountInsert(guestPurchase),
      );
      return;
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

    accountPurchaseReconciliations.push(reconciledPurchase);
    nextAccountPurchases = nextAccountPurchases.map((accountPurchase) =>
      hasSharedPurchaseIdentity(
        accountPurchase,
        new Set(getPurchaseIdentityValues(reconciledPurchase)),
      )
        ? reconciledPurchase
        : accountPurchase,
    );
  });

  return {
    accountPurchaseReconciliations,
    accountPurchases: nextAccountPurchases,
    guestPurchasesForInsert,
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
) {
  return Promise.all(
    guestPurchases.map(async (purchase) => {
      try {
        const { data, error } = await createRemotePurchase(userId, purchase);

        if (error) {
          return {
            ...purchase,
            ...getSyncErrorMetadata(),
          };
        }

        const photoSyncSummary = await syncPurchasePhotos({
          photoUris: purchase.photoUris,
          purchaseId: data.id,
          userId,
        });

        return {
          ...purchase,
          ...getSyncedPurchaseMetadata(data.id),
          ...getPhotoSyncMetadata(
            photoSyncSummary.rows,
            photoSyncSummary.didError,
          ),
        };
      } catch {
        return {
          ...purchase,
          ...getSyncErrorMetadata(),
        };
      }
    }),
  );
}

async function syncGuestAccountPurchaseReconciliations(
  userId: string,
  accountPurchaseReconciliations: MockPurchase[],
) {
  return Promise.all(
    accountPurchaseReconciliations.map(async (purchase) => {
      try {
        const { data, error } = await updateRemotePurchase(userId, purchase);

        if (error) {
          return {
            ...purchase,
            ...getSyncErrorMetadata(),
          };
        }

        return {
          ...purchase,
          ...getSyncedPurchaseMetadata(data.id),
        };
      } catch {
        return {
          ...purchase,
          ...getSyncErrorMetadata(),
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
  const [hasHydratedPurchases, setHasHydratedPurchases] = useState(false);
  const [hydratedPurchaseScopeKey, setHydratedPurchaseScopeKey] = useState<
    string | null
  >(null);
  const hasSkippedInitialPersistRef = useRef(false);
  const lastReminderPurchasesRef = useRef<MockPurchase[] | null>(null);
  const reminderSyncQueueRef = useRef(Promise.resolve());
  const signedInUserId = user?.id;

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

    const hydratePurchases = async () => {
      try {
        const scopedPurchaseSnapshot =
          await hydratePurchaseStorageScope(purchaseScopeKey);

        if (!isMounted) {
          return;
        }

        setPurchases(scopedPurchaseSnapshot.purchases);
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
          const guestPurchaseSnapshot = await hydratePurchaseStorageScope(
            GUEST_PURCHASE_SCOPE_KEY,
          );
          const guestPurchaseMigrationPlan = getGuestPurchaseMigrationPlan(
            guestPurchaseSnapshot.purchases,
            mergedPurchases,
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
          const accountPurchases = [
            ...migratedGuestPurchases,
            ...guestPurchaseMigrationPlan.accountPurchases.map(
              (accountPurchase) =>
                findPurchaseBySharedIdentity(
                  accountPurchase,
                  reconciledAccountPurchases,
                ) ?? accountPurchase,
            ),
          ];
          const accountPurchasesWithSyncedPhotos =
            await syncAccountLocalPurchasePhotos(
              signedInUserId,
              accountPurchases,
            );
          const { data: remoteTotalEntryCount } =
            await fetchRemotePurchaseEntryCount(signedInUserId);
          const remoteHydratedSnapshot = {
            guestPurchaseEntriesUsed: getReconciledAccountPurchaseEntriesUsed({
              localKnownEntriesUsed: Math.max(
                scopedPurchaseSnapshot.purchases.length,
                accountPurchasesWithSyncedPhotos.length,
              ),
              remoteTotalEntryCount: remoteTotalEntryCount ?? remoteRows.length,
              storedEntriesUsed: scopedPurchaseSnapshot.guestPurchaseEntriesUsed,
            }),
            purchases: accountPurchasesWithSyncedPhotos,
          };

          setPurchases(remoteHydratedSnapshot.purchases);
          setGuestPurchaseEntriesUsed(
            remoteHydratedSnapshot.guestPurchaseEntriesUsed,
          );
          await persistPurchaseStorageSnapshot(
            purchaseScopeKey,
            remoteHydratedSnapshot,
          );
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
      purchaseScopeKey === null ||
      hydratedPurchaseScopeKey !== purchaseScopeKey
    ) {
      return;
    }

    if (!hasSkippedInitialPersistRef.current) {
      hasSkippedInitialPersistRef.current = true;
      return;
    }

    const storageKeys = getScopedPurchaseStorageKeys(purchaseScopeKey);

    AsyncStorage.setItem(
      storageKeys.purchasesKey,
      JSON.stringify(purchases),
    ).catch(() => {
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
    async (localPurchase: MockPurchase) => {
      if (!signedInUserId) {
        return;
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

    void syncCreatedPurchase(datedPurchase);

    return datedPurchase;
  }, [signedInUserId, syncCreatedPurchase]);

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

    setPurchases((currentPurchases) => {
      if (!currentPurchases.some((purchase) => purchase.id === itemId)) {
        return currentPurchases;
      }

      return currentPurchases.filter((purchase) => purchase.id !== itemId);
    });

    void syncDeletedPurchase(purchaseToDelete);

    return true;
  }, [purchases, syncDeletedPurchase]);

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

    void syncUpdatedPurchase(updatedPurchase);
  }, [purchases, signedInUserId, syncUpdatedPurchase]);

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
        }),
      )
      .then(() => undefined)
      .catch(() => undefined);
  }, [
    hasHydratedPurchases,
    hydratedPurchaseScopeKey,
    purchaseScopeKey,
    purchases,
  ]);

  const value = useMemo(
    () => ({
      accountPurchaseEntriesUsed: guestPurchaseEntriesUsed,
      addPurchase,
      deletePurchase,
      findPurchaseById,
      getPurchaseById,
      guestPurchaseEntriesUsed,
      hasHydratedPurchases,
      purchases,
      resolvePurchase,
      updatePurchase,
    }),
    [
      addPurchase,
      deletePurchase,
      findPurchaseById,
      getPurchaseById,
      guestPurchaseEntriesUsed,
      hasHydratedPurchases,
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
