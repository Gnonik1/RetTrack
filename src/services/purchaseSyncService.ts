import type { PostgrestError } from '@supabase/supabase-js';

import type { MockPurchase, PurchaseStatus } from '../features/purchases/data/mockPurchases';
import {
  formatCompactDate,
  formatFullDate,
  getReturnDateUrgency,
  parsePurchaseDate,
} from '../features/purchases/utils/purchaseDates';
import { supabase } from '../lib/supabase';

export type RemoteDecisionStatus = 'open' | 'returned' | 'kept';

export type SupabasePurchaseRow = {
  client_local_id: string | null;
  comments: string | null;
  created_at: string;
  currency: string | null;
  decision_status: RemoteDecisionStatus;
  deleted_at: string | null;
  id: string;
  item_name: string;
  last_modified_by_client_at: string | null;
  price_amount: number | null;
  product_link: string | null;
  purchase_date: string | null;
  resolved_at: string | null;
  return_date: string | null;
  store_name: string | null;
  updated_at: string;
  user_id: string;
};

export type SupabasePurchaseInsertPayload = {
  client_local_id: string;
  comments: string | null;
  currency: string | null;
  decision_status: RemoteDecisionStatus;
  item_name: string;
  last_modified_by_client_at: string;
  price_amount: number | null;
  product_link: string | null;
  purchase_date: string | null;
  resolved_at: string | null;
  return_date: string | null;
  store_name: string | null;
  user_id: string;
};

export type SupabasePurchaseUpdatePayload = Omit<
  SupabasePurchaseInsertPayload,
  'client_local_id' | 'user_id'
> & {
  deleted_at?: string | null;
};

export type PurchaseSyncResult<T> =
  | {
      data: T;
      error: null;
    }
  | {
      data: null;
      error: PostgrestError;
    };

type ResolvedLocalPurchaseStatus = Extract<PurchaseStatus, 'returned' | 'kept'>;

function compactText(value?: string | null) {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : null;
}

function getRemoteDecisionStatus(status: PurchaseStatus): RemoteDecisionStatus {
  if (status === 'returned' || status === 'kept') {
    return status;
  }

  return 'open';
}

function getLocalResolvedStatus(
  status: RemoteDecisionStatus,
): ResolvedLocalPurchaseStatus | null {
  if (status === 'returned' || status === 'kept') {
    return status;
  }

  return null;
}

function toIsoTimestamp(value?: number | string | null) {
  if (typeof value === 'number') {
    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  return null;
}

function getClientModifiedAt(localPurchase: MockPurchase) {
  return (
    toIsoTimestamp(localPurchase.resolvedAt) ??
    toIsoTimestamp(localPurchase.pendingAt) ??
    toIsoTimestamp(localPurchase.createdAt) ??
    new Date().toISOString()
  );
}

function getResolvedAt(localPurchase: MockPurchase) {
  if (localPurchase.status !== 'returned' && localPurchase.status !== 'kept') {
    return null;
  }

  return toIsoTimestamp(localPurchase.resolvedAt);
}

function parsePrice(value?: string) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return {
      currency: null,
      priceAmount: null,
    };
  }

  const match = trimmedValue.match(/^([A-Z]{3})\s+(.+)$/);
  const amountSource = match?.[2] ?? trimmedValue;
  const normalizedAmount = amountSource.replace(/,/g, '').trim();
  const priceAmount = Number(normalizedAmount);

  return {
    currency: match?.[1] ?? null,
    priceAmount: Number.isFinite(priceAmount) ? priceAmount : null,
  };
}

function formatPrice(priceAmount: number | null, currency: string | null) {
  if (priceAmount === null) {
    return undefined;
  }

  const amount = Number.isInteger(priceAmount)
    ? String(priceAmount)
    : String(priceAmount);

  return currency ? `${currency} ${amount}` : amount;
}

function formatLocalDateParts(dateISO: string | null) {
  const date = parsePurchaseDate({ dateISO: dateISO ?? undefined });

  if (!date) {
    return {
      compact: undefined,
      full: undefined,
    };
  }

  return {
    compact: formatCompactDate(date),
    full: formatFullDate(date),
  };
}

function getLocalOpenStatus(row: SupabasePurchaseRow) {
  const urgency = getReturnDateUrgency({
    returnDateISO: row.return_date ?? undefined,
  });

  return urgency.state === 'expired' ? 'pending' : 'active';
}

function getLocalDays(row: SupabasePurchaseRow) {
  const resolvedStatus = getLocalResolvedStatus(row.decision_status);

  if (resolvedStatus && row.resolved_at) {
    const resolvedDate = new Date(row.resolved_at);

    if (!Number.isNaN(resolvedDate.getTime())) {
      const label = resolvedStatus === 'returned' ? 'Returned' : 'Kept';

      return `${label} on ${formatCompactDate(resolvedDate)}`;
    }
  }

  if (row.decision_status === 'open') {
    const urgency = getReturnDateUrgency({
      returnDateISO: row.return_date ?? undefined,
    });

    return urgency.state === 'expired' ? 'Needs decision' : urgency.label;
  }

  return resolvedStatus === 'returned' ? 'Returned' : 'Kept';
}

function getLocalCompletedText(row: SupabasePurchaseRow) {
  const resolvedStatus = getLocalResolvedStatus(row.decision_status);

  if (!resolvedStatus || !row.resolved_at) {
    return undefined;
  }

  const resolvedDate = new Date(row.resolved_at);

  if (Number.isNaN(resolvedDate.getTime())) {
    return undefined;
  }

  const label = resolvedStatus === 'returned' ? 'Returned' : 'Kept';

  return `${label} on ${formatCompactDate(resolvedDate)}`;
}

function getResolvedAtMilliseconds(row: SupabasePurchaseRow) {
  if (!row.resolved_at) {
    return undefined;
  }

  const resolvedDate = new Date(row.resolved_at);

  return Number.isNaN(resolvedDate.getTime())
    ? undefined
    : resolvedDate.getTime();
}

function getCreatedAtMilliseconds(row: SupabasePurchaseRow) {
  const createdDate = new Date(row.created_at);

  return Number.isNaN(createdDate.getTime())
    ? undefined
    : createdDate.getTime();
}

export function mapLocalPurchaseToRemoteInsertPayload(
  userId: string,
  localPurchase: MockPurchase,
): SupabasePurchaseInsertPayload {
  const { currency, priceAmount } = parsePrice(localPurchase.price);

  return {
    client_local_id: localPurchase.id,
    comments: compactText(localPurchase.comment),
    currency,
    decision_status: getRemoteDecisionStatus(localPurchase.status),
    item_name: localPurchase.itemName.trim(),
    last_modified_by_client_at: getClientModifiedAt(localPurchase),
    price_amount: priceAmount,
    product_link: compactText(localPurchase.productLink),
    purchase_date: localPurchase.purchaseDateISO ?? null,
    resolved_at: getResolvedAt(localPurchase),
    return_date: localPurchase.returnDateISO ?? null,
    store_name: compactText(localPurchase.store),
    user_id: userId,
  };
}

export function mapLocalPurchaseToRemoteUpdatePayload(
  localPurchase: MockPurchase,
): SupabasePurchaseUpdatePayload {
  const { currency, priceAmount } = parsePrice(localPurchase.price);

  return {
    comments: compactText(localPurchase.comment),
    currency,
    decision_status: getRemoteDecisionStatus(localPurchase.status),
    item_name: localPurchase.itemName.trim(),
    last_modified_by_client_at: getClientModifiedAt(localPurchase),
    price_amount: priceAmount,
    product_link: compactText(localPurchase.productLink),
    purchase_date: localPurchase.purchaseDateISO ?? null,
    resolved_at: getResolvedAt(localPurchase),
    return_date: localPurchase.returnDateISO ?? null,
    store_name: compactText(localPurchase.store),
  };
}

export function mapRemotePurchaseRowToLocalPurchase(
  row: SupabasePurchaseRow,
): MockPurchase {
  const purchaseDate = formatLocalDateParts(row.purchase_date);
  const returnDate = formatLocalDateParts(row.return_date);
  const resolvedStatus = getLocalResolvedStatus(row.decision_status);
  const status = resolvedStatus ?? getLocalOpenStatus(row);
  const completedText = getLocalCompletedText(row);

  return {
    comment: row.comments ?? undefined,
    completedText,
    createdAt: getCreatedAtMilliseconds(row),
    days: getLocalDays(row),
    id: row.client_local_id ?? row.id,
    itemName: row.item_name,
    price: formatPrice(row.price_amount, row.currency),
    productLink: row.product_link ?? undefined,
    purchaseDateISO: row.purchase_date ?? undefined,
    purchased: purchaseDate.compact,
    returnBy: returnDate.compact ?? '',
    returnByDetail: returnDate.full,
    returnDateISO: row.return_date ?? undefined,
    remoteId: row.id,
    resolvedAt: getResolvedAtMilliseconds(row),
    status,
    store: row.store_name ?? 'Online purchase',
    syncStatus: 'synced',
    lastSyncedAt: row.updated_at,
  };
}

export async function fetchRemotePurchases(
  userId: string,
): Promise<PurchaseSyncResult<SupabasePurchaseRow[]>> {
  const { data, error } = await supabase
    .from('purchases')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) {
    return { data: null, error };
  }

  return {
    data: (data ?? []) as SupabasePurchaseRow[],
    error: null,
  };
}

export async function fetchRemotePurchaseEntryCount(
  userId: string,
): Promise<PurchaseSyncResult<number>> {
  const { count, error } = await supabase
    .from('purchases')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    return { data: null, error };
  }

  return {
    data: count ?? 0,
    error: null,
  };
}

export async function createRemotePurchase(
  userId: string,
  localPurchase: MockPurchase,
): Promise<PurchaseSyncResult<SupabasePurchaseRow>> {
  const payload = mapLocalPurchaseToRemoteInsertPayload(userId, localPurchase);
  const { data, error } = await supabase
    .from('purchases')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    return { data: null, error };
  }

  return {
    data: data as SupabasePurchaseRow,
    error: null,
  };
}

export async function updateRemotePurchase(
  userId: string,
  localPurchase: MockPurchase,
): Promise<PurchaseSyncResult<SupabasePurchaseRow>> {
  const payload = mapLocalPurchaseToRemoteUpdatePayload(localPurchase);
  const { data, error } = await supabase
    .from('purchases')
    .update(payload)
    .eq('user_id', userId)
    .eq('client_local_id', localPurchase.id)
    .is('deleted_at', null)
    .select('*')
    .single();

  if (error) {
    return { data: null, error };
  }

  return {
    data: data as SupabasePurchaseRow,
    error: null,
  };
}

export async function softDeleteRemotePurchase(
  userId: string,
  purchaseId: string,
): Promise<PurchaseSyncResult<SupabasePurchaseRow>> {
  const { data, error } = await supabase
    .from('purchases')
    .update({
      deleted_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .or(`id.eq.${purchaseId},client_local_id.eq.${purchaseId}`)
    .is('deleted_at', null)
    .select('*')
    .single();

  if (error) {
    return { data: null, error };
  }

  return {
    data: data as SupabasePurchaseRow,
    error: null,
  };
}

export async function resolveRemotePurchase(
  userId: string,
  purchaseId: string,
  decisionStatus: Extract<RemoteDecisionStatus, 'returned' | 'kept'>,
  resolvedAt: Date,
): Promise<PurchaseSyncResult<SupabasePurchaseRow>> {
  const resolvedAtISO = resolvedAt.toISOString();
  const { data, error } = await supabase
    .from('purchases')
    .update({
      decision_status: decisionStatus,
      last_modified_by_client_at: resolvedAtISO,
      resolved_at: resolvedAtISO,
    })
    .eq('user_id', userId)
    .or(`id.eq.${purchaseId},client_local_id.eq.${purchaseId}`)
    .is('deleted_at', null)
    .select('*')
    .single();

  if (error) {
    return { data: null, error };
  }

  return {
    data: data as SupabasePurchaseRow,
    error: null,
  };
}
