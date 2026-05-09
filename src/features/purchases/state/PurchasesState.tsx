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
  resolveRemotePurchase,
  softDeleteRemotePurchase,
  updateRemotePurchase,
} from '../../../services/purchaseSyncService';
import { useAuth } from '../../../state/AuthState';
import { GUEST_PHOTO_LIMIT } from '../constants';
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

function compactPhotoUris(photoUris?: string[]) {
  const compactUris = photoUris
    ?.map((photoUri) => photoUri.trim())
    .filter(Boolean)
    .slice(0, GUEST_PHOTO_LIMIT);

  return compactUris?.length ? compactUris : undefined;
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
  }, [purchaseScopeKey]);

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
      } catch {
        markPurchaseSyncMetadata(localPurchase.id, getSyncErrorMetadata());
      }
    },
    [markPurchaseSyncMetadata, signedInUserId],
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
      } catch {
        markPurchaseSyncMetadata(localPurchase.id, getSyncErrorMetadata());
      }
    },
    [markPurchaseSyncMetadata, signedInUserId],
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
    const newPurchase: MockPurchase = {
      comment: compactText(input.comment),
      createdAt,
      days: 'Due later',
      id: getLocalPurchaseId(itemName, createdAt),
      itemName,
      photoUris: compactPhotoUris(input.photoUris),
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

    const updatedPurchase = getPurchaseWithCurrentDateState(
      {
        ...purchaseToUpdate,
        comment: compactText(input.comment),
        itemName,
        photoUris: compactPhotoUris(input.photoUris),
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
