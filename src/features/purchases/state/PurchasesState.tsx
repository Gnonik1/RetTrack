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
import { GUEST_PHOTO_LIMIT } from '../constants';
import {
  getMockPurchaseById,
  mockPurchases,
  type MockPurchase,
  type PurchaseStatus,
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
  addPurchase: (input: AddPurchaseInput) => MockPurchase;
  getPurchaseById: (itemId?: string | string[]) => MockPurchase;
  purchases: MockPurchase[];
  resolvePurchase: (itemId: string, status: ResolvedPurchaseStatus) => void;
  updatePurchase: (itemId: string, input: AddPurchaseInput) => void;
};

const PurchasesStateContext = createContext<PurchasesStateValue | undefined>(
  undefined,
);

const PURCHASES_STORAGE_KEY = 'rettrack:purchases:v1';

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
    isOptionalNumber(value.createdAt) &&
    isOptionalNumber(value.resolvedAt)
  );
}

function isStoredPurchases(value: unknown): value is MockPurchase[] {
  return Array.isArray(value) && value.every(isStoredPurchase);
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

export function PurchasesProvider({ children }: { children: ReactNode }) {
  const [purchases, setPurchases] = useState<MockPurchase[]>(() =>
    getPurchasesWithCurrentDateState(mockPurchases),
  );
  const [hasHydratedPurchases, setHasHydratedPurchases] = useState(false);
  const hasSkippedInitialPersistRef = useRef(false);
  const lastReminderPurchasesRef = useRef<MockPurchase[] | null>(null);
  const reminderSyncQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    let isMounted = true;

    const hydratePurchases = async () => {
      try {
        const storedPurchases = await AsyncStorage.getItem(PURCHASES_STORAGE_KEY);

        if (!isMounted) {
          return;
        }

        if (!storedPurchases) {
          return;
        }

        const parsedPurchases: unknown = JSON.parse(storedPurchases);

        if (isStoredPurchases(parsedPurchases)) {
          setPurchases(getPurchasesWithCurrentDateState(parsedPurchases));
        }
      } catch {
        // Keep the mock fallback if persisted purchase data cannot be read.
      } finally {
        if (isMounted) {
          setHasHydratedPurchases(true);
        }
      }
    };

    hydratePurchases();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasHydratedPurchases) {
      return;
    }

    if (!hasSkippedInitialPersistRef.current) {
      hasSkippedInitialPersistRef.current = true;
      return;
    }

    AsyncStorage.setItem(PURCHASES_STORAGE_KEY, JSON.stringify(purchases)).catch(
      () => {
        // Local persistence is best-effort for the frontend-only mock state.
      },
    );
  }, [hasHydratedPurchases, purchases]);

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
      status: 'active',
      store,
    };

    const datedPurchase = getPurchaseWithCurrentDateState(
      newPurchase,
      new Date(createdAt),
    );

    setPurchases((currentPurchases) => [datedPurchase, ...currentPurchases]);

    return datedPurchase;
  }, []);

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

  const resolvePurchase = useCallback(
    (itemId: string, status: ResolvedPurchaseStatus) => {
      const resolvedDate = new Date();
      const completedText = getResolvedStatusText(status, resolvedDate);

      setPurchases((currentPurchases) =>
        currentPurchases.map((purchase) => {
          if (purchase.id !== itemId) {
            return purchase;
          }

          return {
            ...purchase,
            completedText,
            days: completedText,
            resolvedAt: resolvedDate.getTime(),
            status,
          };
        }),
      );
    },
    [],
  );

  const updatePurchase = useCallback((itemId: string, input: AddPurchaseInput) => {
    const itemName = input.itemName.trim();
    const store = compactText(input.store) ?? 'Online purchase';
    const productLink = compactText(input.productLink);
    const returnDateFields = getPurchaseDateFields(input);
    const updatedAt = new Date();

    setPurchases((currentPurchases) =>
      currentPurchases.map((purchase) => {
        if (purchase.id !== itemId) {
          return purchase;
        }

        return getPurchaseWithCurrentDateState(
          {
            ...purchase,
            comment: compactText(input.comment),
            itemName,
            photoUris: compactPhotoUris(input.photoUris),
            price: compactText(input.price),
            productLink,
            purchaseDateISO: input.purchaseDateISO,
            purchased: compactText(input.purchased),
            ...returnDateFields,
            store,
          },
          updatedAt,
        );
      }),
    );
  }, []);

  useEffect(() => {
    if (!hasHydratedPurchases) {
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
  }, [hasHydratedPurchases, purchases]);

  const value = useMemo(
    () => ({
      addPurchase,
      getPurchaseById,
      purchases,
      resolvePurchase,
      updatePurchase,
    }),
    [addPurchase, getPurchaseById, purchases, resolvePurchase, updatePurchase],
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
