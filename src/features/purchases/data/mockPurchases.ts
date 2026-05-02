export type PurchaseStatus = 'active' | 'returned' | 'kept' | 'pending';

export type MockPurchase = {
  comment?: string;
  completedText?: string;
  createdAt?: number;
  days: string;
  id: string;
  itemName: string;
  pendingAt?: number;
  price?: string;
  productDomain?: string;
  productLink?: string;
  purchaseDateISO?: string;
  purchased?: string;
  returnBy: string;
  returnByDetail?: string;
  returnDateISO?: string;
  resolvedAt?: number;
  status: PurchaseStatus;
  store: string;
};

export const purchaseStatusLabels: Record<PurchaseStatus, string> = {
  active: 'Active',
  kept: 'Kept',
  pending: 'Pending',
  returned: 'Returned',
};

export const mockPurchases: MockPurchase[] = [
  {
    days: 'Tomorrow',
    id: 'leather-loafers',
    itemName: 'Leather Loafers',
    price: 'USD 180',
    purchaseDateISO: '2026-04-12',
    purchased: 'Apr 12',
    returnBy: 'Apr 27',
    returnByDetail: 'Apr 27, 2026',
    returnDateISO: '2026-04-27',
    status: 'active',
    store: 'Massimo Dutti',
  },
  {
    comment: 'Wrong size — may return',
    days: '3 days left',
    id: 'cashmere-coat',
    itemName: 'Cashmere Coat',
    price: 'USD 290',
    purchaseDateISO: '2026-04-10',
    purchased: 'Apr 10',
    returnBy: 'Apr 30',
    returnByDetail: 'Apr 30, 2026',
    returnDateISO: '2026-04-30',
    status: 'active',
    store: 'COS',
  },
  {
    days: '9 days left',
    id: 'wool-blazer',
    itemName: 'Wool Blazer',
    price: 'USD 119',
    purchaseDateISO: '2026-04-20',
    purchased: 'Apr 20',
    returnBy: 'May 6',
    returnByDetail: 'May 6, 2026',
    returnDateISO: '2026-05-06',
    status: 'active',
    store: 'Zara',
  },
  {
    completedText: 'Returned Apr 18',
    days: 'Returned Apr 18',
    id: 'silk-scarf',
    itemName: 'Silk Scarf',
    price: 'USD 79',
    purchaseDateISO: '2026-04-04',
    purchased: 'Apr 4',
    returnBy: 'Apr 22',
    returnByDetail: 'Apr 22, 2026',
    returnDateISO: '2026-04-22',
    resolvedAt: 20260418,
    status: 'returned',
    store: 'Arket',
  },
  {
    completedText: 'Returned Apr 16',
    days: 'Returned Apr 16',
    id: 'suede-boots',
    itemName: 'Suede Boots',
    price: 'USD 160',
    purchaseDateISO: '2026-04-02',
    purchased: 'Apr 2',
    returnBy: 'Apr 19',
    returnByDetail: 'Apr 19, 2026',
    returnDateISO: '2026-04-19',
    resolvedAt: 20260416,
    status: 'returned',
    store: 'Mango',
  },
  {
    completedText: 'Kept Apr 21',
    days: 'Kept Apr 21',
    id: 'linen-shirt',
    itemName: 'Linen Shirt',
    price: 'USD 69',
    purchaseDateISO: '2026-04-08',
    purchased: 'Apr 8',
    returnBy: 'Apr 25',
    returnByDetail: 'Apr 25, 2026',
    returnDateISO: '2026-04-25',
    resolvedAt: 20260421,
    status: 'kept',
    store: 'Massimo Dutti',
  },
  {
    completedText: 'Kept Apr 24',
    days: 'Kept Apr 24',
    id: 'denim-trousers',
    itemName: 'Denim Trousers',
    price: 'USD 98',
    purchaseDateISO: '2026-04-09',
    purchased: 'Apr 9',
    returnBy: 'Apr 29',
    returnByDetail: 'Apr 29, 2026',
    returnDateISO: '2026-04-29',
    resolvedAt: 20260424,
    status: 'kept',
    store: 'COS',
  },
  {
    comment: 'Return date passed',
    days: 'Needs decision',
    id: 'leather-belt',
    itemName: 'Leather Belt',
    price: 'USD 49',
    purchaseDateISO: '2026-04-06',
    purchased: 'Apr 6',
    returnBy: 'Apr 26',
    returnByDetail: 'Apr 26, 2026',
    returnDateISO: '2026-04-26',
    status: 'pending',
    store: 'Zara',
  },
  {
    days: 'Needs decision',
    id: 'knit-dress',
    itemName: 'Knit Dress',
    price: 'USD 168',
    purchaseDateISO: '2026-04-05',
    purchased: 'Apr 5',
    returnBy: 'Apr 24',
    returnByDetail: 'Apr 24, 2026',
    returnDateISO: '2026-04-24',
    status: 'pending',
    store: 'Reformation',
  },
];

const fallbackPurchase =
  mockPurchases.find((purchase) => purchase.id === 'cashmere-coat') ??
  (mockPurchases[0] as MockPurchase);

export function getMockPurchaseById(itemId?: string | string[]) {
  const resolvedItemId = Array.isArray(itemId) ? itemId[0] : itemId;

  return (
    mockPurchases.find((purchase) => purchase.id === resolvedItemId) ??
    fallbackPurchase
  );
}
