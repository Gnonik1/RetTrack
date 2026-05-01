import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import {
  getMockPurchaseById,
  mockPurchases,
  type MockPurchase,
  type PurchaseStatus,
} from '../data/mockPurchases';

export type ResolvedPurchaseStatus = Extract<
  PurchaseStatus,
  'kept' | 'returned'
>;

export type AddPurchaseInput = {
  comment?: string;
  itemName: string;
  price?: string;
  productLink?: string;
  purchased?: string;
  returnBy: string;
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

function getResolvedStatusText(status: ResolvedPurchaseStatus) {
  return status === 'returned' ? 'Returned today' : 'Kept today';
}

function compactText(value?: string) {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : undefined;
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

function getCompactReturnDate(returnBy: string) {
  return returnBy.split(',')[0].trim();
}

export function PurchasesProvider({ children }: { children: ReactNode }) {
  const [purchases, setPurchases] = useState<MockPurchase[]>(mockPurchases);

  const addPurchase = useCallback((input: AddPurchaseInput) => {
    const createdAt = Date.now();
    const itemName = input.itemName.trim();
    const store = compactText(input.store) ?? 'Online purchase';
    const productLink = compactText(input.productLink);
    const newPurchase: MockPurchase = {
      comment: compactText(input.comment),
      createdAt,
      days: 'Due later',
      id: getLocalPurchaseId(itemName, createdAt),
      itemName,
      price: compactText(input.price),
      productLink,
      purchased: compactText(input.purchased),
      returnBy: getCompactReturnDate(input.returnBy),
      returnByDetail: input.returnBy,
      status: 'active',
      store,
    };

    setPurchases((currentPurchases) => [newPurchase, ...currentPurchases]);

    return newPurchase;
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
      const completedText = getResolvedStatusText(status);

      setPurchases((currentPurchases) =>
        currentPurchases.map((purchase) => {
          if (purchase.id !== itemId) {
            return purchase;
          }

          return {
            ...purchase,
            completedText,
            days: completedText,
            resolvedAt: Date.now(),
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

    setPurchases((currentPurchases) =>
      currentPurchases.map((purchase) => {
        if (purchase.id !== itemId) {
          return purchase;
        }

        return {
          ...purchase,
          comment: compactText(input.comment),
          itemName,
          price: compactText(input.price),
          productLink,
          purchased: compactText(input.purchased),
          returnBy: getCompactReturnDate(input.returnBy),
          returnByDetail: input.returnBy,
          store,
        };
      }),
    );
  }, []);

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
