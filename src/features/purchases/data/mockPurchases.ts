export type PurchaseStatus = 'active' | 'returned' | 'kept' | 'pending';

export type MockPurchase = {
  comment?: string;
  completedText?: string;
  days: string;
  id: string;
  itemName: string;
  price?: string;
  productDomain?: string;
  purchased?: string;
  returnBy: string;
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
    purchased: 'Apr 12',
    returnBy: 'Apr 27',
    status: 'active',
    store: 'Massimo Dutti',
  },
  {
    comment: 'Wrong size — may return',
    days: '3 days left',
    id: 'cashmere-coat',
    itemName: 'Cashmere Coat',
    price: 'USD 290',
    purchased: 'Apr 10',
    returnBy: 'Apr 30',
    status: 'active',
    store: 'COS',
  },
  {
    days: '9 days left',
    id: 'wool-blazer',
    itemName: 'Wool Blazer',
    price: 'USD 119',
    purchased: 'Apr 20',
    returnBy: 'May 6',
    status: 'active',
    store: 'Zara',
  },
  {
    completedText: 'Returned Apr 18',
    days: 'Returned Apr 18',
    id: 'silk-scarf',
    itemName: 'Silk Scarf',
    price: 'USD 79',
    purchased: 'Apr 4',
    returnBy: 'Apr 22',
    status: 'returned',
    store: 'Arket',
  },
  {
    completedText: 'Returned Apr 16',
    days: 'Returned Apr 16',
    id: 'suede-boots',
    itemName: 'Suede Boots',
    price: 'USD 160',
    purchased: 'Apr 2',
    returnBy: 'Apr 19',
    status: 'returned',
    store: 'Mango',
  },
  {
    completedText: 'Kept Apr 21',
    days: 'Kept Apr 21',
    id: 'linen-shirt',
    itemName: 'Linen Shirt',
    price: 'USD 69',
    purchased: 'Apr 8',
    returnBy: 'Apr 25',
    status: 'kept',
    store: 'Massimo Dutti',
  },
  {
    completedText: 'Kept Apr 24',
    days: 'Kept Apr 24',
    id: 'denim-trousers',
    itemName: 'Denim Trousers',
    price: 'USD 98',
    purchased: 'Apr 9',
    returnBy: 'Apr 29',
    status: 'kept',
    store: 'COS',
  },
  {
    comment: 'Return date passed',
    days: 'Needs decision',
    id: 'leather-belt',
    itemName: 'Leather Belt',
    price: 'USD 49',
    purchased: 'Apr 6',
    returnBy: 'Apr 26',
    status: 'pending',
    store: 'Zara',
  },
  {
    days: 'Needs decision',
    id: 'knit-dress',
    itemName: 'Knit Dress',
    price: 'USD 168',
    purchased: 'Apr 5',
    returnBy: 'Apr 24',
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
