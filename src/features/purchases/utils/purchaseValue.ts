import type { MockPurchase } from '../data/mockPurchases';

// Money totals for the purchase value metrics, moved here verbatim from
// ProfileScreen so Profile's Pro-gated Spending Insights card and History's
// ungated recovered-value hero read from ONE source of truth. The numeric logic
// is unchanged; only its location moved. Nothing in this module is plan-aware —
// the isPro gate stays at the CARD level in ProfileScreen, so Free/Guest still
// see the teaser there while History can surface the returned bucket to everyone.

export type CurrencyTotals = Record<string, number>;

export type PurchaseValueTotals = {
  activeTotals: CurrencyTotals;
  isMultiCurrency: boolean;
  keptCount: number;
  keptTotals: CurrencyTotals;
  openCount: number;
  returnedCount: number;
  returnedTotals: CurrencyTotals;
};

export type ReturnedValueSummary = {
  isMultiCurrency: boolean;
  returnedCount: number;
  returnedTotals: CurrencyTotals;
};

// Prices are stored as `${CurrencyCode} ${amount}` (e.g. "USD 180"). Grouping the
// money metrics by currency needs both halves. PurchasesHomeScreen already parses
// the amount for price sorting, but that helper is file-local there and returns only
// the number (not the code), so the small numeric-normalization is duplicated here —
// adapted to also read the code — rather than extracted, which would mean editing the
// out-of-scope Home screen for no other shared caller.
const PRICE_NUMBER_PATTERN = /[.,]?\d[\d.,]*/;

function parsePurchaseAmount(priceText: string): number | null {
  const match = PRICE_NUMBER_PATTERN.exec(priceText);

  if (!match) {
    return null;
  }

  const digits = match[0].replace(/[.,]+$/, '');
  const separatorIndex = Math.max(
    digits.lastIndexOf(','),
    digits.lastIndexOf('.'),
  );
  const fraction =
    separatorIndex === -1 ? '' : digits.slice(separatorIndex + 1);
  // A trailing run of 1-2 digits is a decimal mark; anything longer ("1,299") is
  // thousands grouping.
  const hasDecimalMark = fraction.length > 0 && fraction.length <= 2;
  const normalized = hasDecimalMark
    ? `${digits.slice(0, separatorIndex).replace(/[.,]/g, '')}.${fraction}`
    : digits.replace(/[.,]/g, '');
  const value = Number(normalized);

  return Number.isFinite(value) ? value : null;
}

export function parsePurchasePrice(
  priceText?: string,
): { code: string; value: number } | null {
  const trimmed = priceText?.trim();

  if (!trimmed) {
    return null;
  }

  const value = parsePurchaseAmount(trimmed);

  if (value === null) {
    return null;
  }

  const codeMatch = /^[A-Za-z]{2,}/.exec(trimmed);

  return {
    code: codeMatch ? codeMatch[0].toUpperCase() : '',
    value,
  };
}

export function formatInsightAmount(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }

  // Sums of decimal-pad prices can be fractional; keep at most 2 decimals and drop
  // a trailing ".00" / ".50" zero so whole sums read as "450", not "450.00".
  return value.toFixed(2).replace(/\.?0+$/, '');
}

export function formatMoneyBucket(
  totals: CurrencyTotals,
  isMultiCurrency: boolean,
): string {
  const codes = Object.keys(totals)
    .filter((code) => totals[code] > 0)
    .sort();

  if (codes.length === 0) {
    return '0';
  }

  if (!isMultiCurrency) {
    const [code] = codes;

    // One currency across the whole card: show the ISO code with the amount. We
    // keep the code rather than mapping to a "$" glyph — the data stores codes and a
    // code→symbol table would be wrong for a non-USD single-currency user.
    return code
      ? `${code} ${formatInsightAmount(totals[code])}`
      : formatInsightAmount(totals[code]);
  }

  // Multiple currencies: list each separately, never summed across codes.
  return codes
    .map((code) => `${code} ${formatInsightAmount(totals[code])}`)
    .join(' · ');
}

// The bucket loop exactly as ProfileScreen ran it: 'returned' and 'kept' are their
// own tiles, everything else ('active' + 'pending') is the "Open" bucket, and
// isMultiCurrency is CARD-WIDE (every code seen across all three buckets), not
// per-bucket. Preserving that card-wide scope is what keeps Profile's rendered
// output identical — see getReturnedValueSummary for the per-bucket variant.
export function getPurchaseValueTotals(
  purchases: MockPurchase[],
): PurchaseValueTotals {
  const returnedTotals: CurrencyTotals = {};
  const activeTotals: CurrencyTotals = {};
  const keptTotals: CurrencyTotals = {};
  const currencyCodes = new Set<string>();
  let returnedCount = 0;
  let keptCount = 0;
  let openCount = 0;

  for (const purchase of purchases) {
    let bucket: CurrencyTotals;

    // Mirror the Purchase status card's buckets: 'returned' and 'kept' are their
    // own tiles, everything else ('active' + 'pending') is the "Open" bucket.
    if (purchase.status === 'returned') {
      bucket = returnedTotals;
      returnedCount += 1;
    } else if (purchase.status === 'kept') {
      bucket = keptTotals;
      keptCount += 1;
    } else {
      bucket = activeTotals;
      openCount += 1;
    }

    const parsedPrice = parsePurchasePrice(purchase.price);

    if (parsedPrice) {
      bucket[parsedPrice.code] =
        (bucket[parsedPrice.code] ?? 0) + parsedPrice.value;
      currencyCodes.add(parsedPrice.code);
    }
  }

  return {
    activeTotals,
    isMultiCurrency: currencyCodes.size > 1,
    keptCount,
    keptTotals,
    openCount,
    returnedCount,
    returnedTotals,
  };
}

// Hero-ready view of the returned bucket alone, for callers that show recovered
// value on its own rather than beside the Open/Kept tiles.
//
// Two deliberate differences from getPurchaseValueTotals, both scoped to this
// helper so Profile is unaffected:
//  - isMultiCurrency counts codes in the RETURNED bucket only, so a user whose
//    returns are all USD reads "USD 450" even when open items are in EUR.
//  - the empty-string code — parsePurchasePrice's fallback for a price with no
//    parseable currency prefix — is dropped, because formatMoneyBucket would
//    render it as an unlabelled bare number sitting next to real coded amounts.
//    Those purchases still count toward returnedCount; only their amount is
//    withheld, exactly as a purchase saved with no price at all already is.
export function getReturnedValueSummary(
  purchases: MockPurchase[],
): ReturnedValueSummary {
  const { returnedCount, returnedTotals } = getPurchaseValueTotals(purchases);
  const codedReturnedTotals: CurrencyTotals = {};

  for (const code of Object.keys(returnedTotals)) {
    if (code) {
      codedReturnedTotals[code] = returnedTotals[code];
    }
  }

  return {
    isMultiCurrency:
      Object.keys(codedReturnedTotals).filter(
        (code) => codedReturnedTotals[code] > 0,
      ).length > 1,
    returnedCount,
    returnedTotals: codedReturnedTotals,
  };
}
