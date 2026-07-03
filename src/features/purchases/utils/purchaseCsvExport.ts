import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import {
  purchaseStatusLabels,
  type MockPurchase,
} from '../data/mockPurchases';

export type PurchaseCsvExportResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      reason: 'empty' | 'failed' | 'sharingUnavailable';
    };

const CSV_HEADERS = [
  'Item name',
  'Store',
  'Price',
  'Purchase date',
  'Return date',
  'Status',
  'Product link',
  'Notes',
  'Photo count',
  'Created date',
];

function escapeCsvCell(value: number | string | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value);
  const escapedText = text.replace(/"/g, '""');

  return /[",\n\r]/.test(escapedText) ? `"${escapedText}"` : escapedText;
}

function formatTimestampDate(value?: number) {
  if (value === undefined) {
    return '';
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function getReturnDate(purchase: MockPurchase) {
  return purchase.returnDateISO ?? purchase.returnByDetail ?? purchase.returnBy;
}

function getPurchaseCsvRow(purchase: MockPurchase) {
  return [
    purchase.itemName,
    purchase.store,
    purchase.price,
    purchase.purchaseDateISO ?? purchase.purchased,
    getReturnDate(purchase),
    purchaseStatusLabels[purchase.status],
    purchase.productLink,
    purchase.comment,
    purchase.photoUris?.length ?? 0,
    formatTimestampDate(purchase.createdAt),
  ];
}

function getCsvFileName(date = new Date()) {
  return `rettrack-purchases-${date.toISOString().slice(0, 10)}.csv`;
}

export function buildPurchasesCsv(purchases: MockPurchase[]): string {
  return [CSV_HEADERS, ...purchases.map(getPurchaseCsvRow)]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n');
}

export async function exportPurchasesCsv(
  purchases: MockPurchase[],
): Promise<PurchaseCsvExportResult> {
  if (purchases.length === 0) {
    return {
      ok: false,
      reason: 'empty',
    };
  }

  try {
    const isSharingAvailable = await Sharing.isAvailableAsync();

    if (!isSharingAvailable) {
      return {
        ok: false,
        reason: 'sharingUnavailable',
      };
    }

    const exportDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;

    if (!exportDirectory) {
      return {
        ok: false,
        reason: 'failed',
      };
    }

    const fileUri = `${exportDirectory}${getCsvFileName()}`;

    await FileSystem.writeAsStringAsync(fileUri, buildPurchasesCsv(purchases));
    await Sharing.shareAsync(fileUri, {
      dialogTitle: 'Export CSV',
      mimeType: 'text/csv',
      UTI: 'public.comma-separated-values-text',
    });

    return {
      ok: true,
    };
  } catch {
    return {
      ok: false,
      reason: 'failed',
    };
  }
}
