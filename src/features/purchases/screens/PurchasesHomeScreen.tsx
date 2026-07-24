import { LinearGradient } from 'expo-linear-gradient';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Alert,
  Animated,
  AppState,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppScreen } from '../../../components/AppScreen';
import { AppText } from '../../../components/AppText';
import { ProBadge } from '../../../components/ProBadge';
import { theme } from '../../../constants/theme';
import { useAuth } from '../../../state/AuthState';
import { getDelayUntilNextLocalHomeDay } from '../../notifications/homeReminderNudge';
import {
  cancelAllScheduledAppReminders,
  getNotificationPermissionsStatus,
  requestNotificationPermissions,
} from '../../notifications/notifications';
import { usePlan } from '../../monetization/state/PlanState';
import { useProFeatureGate } from '../../monetization/state/useProFeatureGate';
import { useAppSettings } from '../../settings/state/AppSettingsState';
import {
  purchaseStatusLabels,
  type MockPurchase,
  type PurchaseStatus,
} from '../data/mockPurchases';
import {
  usePurchases,
  type ResolvedPurchaseStatus,
} from '../state/PurchasesState';
import {
  formatCompactDate,
  getCompactReturnDate,
  getDateSortValue,
  getPurchaseReturnDate,
  getReturnDateUrgency,
  parsePurchaseDate,
} from '../utils/purchaseDates';

type PurchasesHomeScreenProps = {
  isHomeRouteSettled: boolean;
  onAddItem?: () => void;
  onPurchasePress?: (itemId: string) => void;
};

const filterItems = [
  {
    key: 'active',
    label: 'Active',
  },
  {
    key: 'returned',
    label: 'Returned',
  },
  {
    key: 'kept',
    label: 'Kept',
  },
  {
    key: 'pending',
    label: 'Pending',
  },
] as const;

type FilterKey = (typeof filterItems)[number]['key'];

type GestureLock = 'horizontal' | 'undecided' | 'vertical';

const GESTURE_LOCK_DISTANCE = 14;
const HORIZONTAL_LOCK_RATIO = 1.5;
const SEARCH_DEBOUNCE_MS = 180;
const SORT_CHEVRON_COLOR = '#858B80';
const SORT_MENU_ANCHOR_GAP = 8;
const SORT_MENU_FADE_DURATION = 160;
const SWIPE_COMPLETION_DISTANCE = 58;
const TAB_TRANSITION_DISTANCE = 12;
const TAB_TRANSITION_DURATION = 170;
const VERTICAL_LOCK_RATIO = 1.2;

const sectionHeadings: Record<
  FilterKey,
  {
    meta: string;
    title: string;
  }
> = {
  active: {
    meta: 'NEAREST FIRST',
    title: 'Due soon',
  },
  kept: {
    meta: 'RECENT FIRST',
    title: 'Kept',
  },
  pending: {
    meta: 'ACTION NEEDED',
    title: 'Needs decision',
  },
  returned: {
    meta: 'RECENT FIRST',
    title: 'Returned',
  },
};

const GLOBAL_SEARCH_SECTION_HEADING = {
  meta: 'RECENT FIRST',
  title: 'All purchases',
} as const;

type SortKey = 'priceHighToLow' | 'priceLowToHigh' | 'recent' | 'storeAZ';

type AlternativeSortKey = Exclude<SortKey, 'recent'>;

const alternativeSortOptions = [
  {
    key: 'priceHighToLow',
    label: 'Price: High to Low',
  },
  {
    key: 'priceLowToHigh',
    label: 'Price: Low to High',
  },
  {
    key: 'storeAZ',
    label: 'Store: A-Z',
  },
] as const satisfies ReadonlyArray<{ key: AlternativeSortKey; label: string }>;

// Meta labels for the alternative sorts only. 'recent' deliberately has no
// entry: it keeps the tab's own meta ("NEAREST FIRST" on Active), which is what
// that tab's existing order actually is.
const sortMetaLabels: Record<AlternativeSortKey, string> = {
  priceHighToLow: 'PRICE: HIGH TO LOW',
  priceLowToHigh: 'PRICE: LOW TO HIGH',
  storeAZ: 'STORE: A-Z',
};

// 'pending' is the one tab whose meta describes urgency rather than an order —
// it has no sort at all, it is insertion order — so its meta cannot be reused
// as a menu label the way "NEAREST FIRST" / "RECENT FIRST" can.
const PENDING_DEFAULT_SORT_LABEL = 'Default order';

function toSentenceCase(metaLabel: string) {
  const lowerCased = metaLabel.toLowerCase();

  return `${lowerCased.charAt(0).toUpperCase()}${lowerCased.slice(1)}`;
}

function getDefaultSortOptionLabel(selectedFilter: FilterKey) {
  if (selectedFilter === 'pending') {
    return PENDING_DEFAULT_SORT_LABEL;
  }

  return toSentenceCase(sectionHeadings[selectedFilter].meta);
}

const emptyStateContent: Record<
  FilterKey,
  {
    body: string;
    title: string;
  }
> = {
  active: {
    body: "You're all caught up. Add a purchase to track its return window.",
    title: 'No active returns',
  },
  kept: {
    body: 'Items you decide to keep will appear here.',
    title: 'No kept items yet',
  },
  pending: {
    body: 'Items past their return date will appear here.',
    title: 'No pending decisions',
  },
  returned: {
    body: 'Items you mark as returned will appear here.',
    title: 'No returned items yet',
  },
};

type UrgentActiveSummaryLabel = 'Due today' | 'Due tomorrow' | 'Due soon';

type ActiveAttentionSummary = {
  item: MockPurchase;
  label: UrgentActiveSummaryLabel;
  rank: number;
};

type AttentionSummary = {
  countText: string;
  summaries: {
    label: string;
    value: string;
  }[];
};

function getItemCountText(count: number) {
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}

function getPurchaseCountText(count: number) {
  return count === 0
    ? 'All clear'
    : `${count} ${count === 1 ? 'Purchase' : 'Purchases'}`;
}

function getTimeAwareGreeting(firstName?: string, date = new Date()) {
  const hour = date.getHours();
  const greeting =
    hour >= 5 && hour < 12
      ? 'Good morning'
      : hour >= 12 && hour < 18
        ? 'Good afternoon'
        : 'Good evening';
  const trimmedFirstName = firstName?.trim();

  return trimmedFirstName ? `${greeting}, ${trimmedFirstName}` : greeting;
}

function getActiveAttentionSummary(
  item: MockPurchase,
): ActiveAttentionSummary | null {
  if (item.status !== 'active') {
    return null;
  }

  const urgency = getReturnDateUrgency(item);

  if (urgency.state === 'today') {
    return {
      item,
      label: 'Due today',
      rank: 0,
    };
  }

  if (urgency.state === 'tomorrow') {
    return {
      item,
      label: 'Due tomorrow',
      rank: 1,
    };
  }

  if (urgency.state === 'future') {
    return {
      item,
      label: 'Due soon',
      rank: 2 + (urgency.daysUntil ?? 0),
    };
  }

  return null;
}

function getGroupedActiveSummary(
  activeAttentionItems: ActiveAttentionSummary[],
) {
  const dueTodayItems = activeAttentionItems.filter(
    (summary) => summary.label === 'Due today',
  );

  if (dueTodayItems.length > 0) {
    return {
      label: 'Due today',
      value:
        dueTodayItems.length === 1
          ? dueTodayItems[0].item.itemName
          : `${dueTodayItems.length} purchases`,
    };
  }

  const dueTomorrowItems = activeAttentionItems.filter(
    (summary) => summary.label === 'Due tomorrow',
  );

  if (dueTomorrowItems.length > 0) {
    return {
      label: 'Due tomorrow',
      value:
        dueTomorrowItems.length === 1
          ? dueTomorrowItems[0].item.itemName
          : `${dueTomorrowItems.length} purchases`,
    };
  }

  const futureItems = activeAttentionItems.filter(
    (summary) => summary.label === 'Due soon',
  );

  if (futureItems.length > 0) {
    return {
      label: 'Due soon',
      value:
        futureItems.length === 1
          ? futureItems[0].item.itemName
          : `${futureItems.length} purchases`,
    };
  }

  return null;
}

function getAttentionSummary(purchases: MockPurchase[]): AttentionSummary {
  const activeAttentionItems = purchases
    .map(getActiveAttentionSummary)
    .filter((summary): summary is ActiveAttentionSummary => Boolean(summary))
    .sort((firstItem, secondItem) => firstItem.rank - secondItem.rank);
  const activeCount = purchases.filter(
    (purchase) => purchase.status === 'active',
  ).length;
  const pendingCount = purchases.filter(
    (purchase) => purchase.status === 'pending',
  ).length;
  const attentionCount = activeCount + pendingCount;
  const activeSummary = getGroupedActiveSummary(activeAttentionItems);
  const pendingSummary = getItemCountText(pendingCount);

  return {
    countText: getPurchaseCountText(attentionCount),
    summaries: [
      activeSummary
        ? {
            label: activeSummary.label,
            value: activeSummary.value,
          }
        : pendingCount > 0
          ? {
              label: 'Needs decision',
              value: pendingSummary,
            }
        : {
            label: 'All clear',
            value: 'No urgent returns',
          },
      {
        label: 'Pending',
        value: pendingSummary,
      },
    ],
  };
}

function getResolvedSortValue(item: MockPurchase) {
  return item.resolvedAt ?? 0;
}

function getResolvedDateFromValue(value?: number) {
  if (!value) {
    return null;
  }

  if (value > 100000000000) {
    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  const valueText = String(value);

  if (!/^\d{8}$/.test(valueText)) {
    return null;
  }

  const year = Number(valueText.slice(0, 4));
  const month = Number(valueText.slice(4, 6)) - 1;
  const day = Number(valueText.slice(6, 8));
  const date = new Date(year, month, day);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getResolvedPurchaseSubtitle(item: MockPurchase) {
  const statusLabel = purchaseStatusLabels[item.status];
  const resolvedDate = getResolvedDateFromValue(item.resolvedAt);

  if (resolvedDate) {
    return `${statusLabel} on ${formatCompactDate(resolvedDate)}`;
  }

  return item.completedText ?? statusLabel;
}

function getCardSubtitleText(item: MockPurchase) {
  if (item.status === 'returned' || item.status === 'kept') {
    return getResolvedPurchaseSubtitle(item);
  }

  return `Return by ${getCompactReturnDate(item)}`;
}

function getVisiblePurchaseItems(
  purchases: MockPurchase[],
  selectedFilter: FilterKey,
) {
  const filteredItems = purchases.filter(
    (item) => item.status === selectedFilter,
  );

  if (selectedFilter === 'returned' || selectedFilter === 'kept') {
    return [...filteredItems].sort(
      (firstItem, secondItem) =>
        getResolvedSortValue(secondItem) - getResolvedSortValue(firstItem),
    );
  }

  if (selectedFilter === 'active') {
    return [...filteredItems].sort(
      (firstItem, secondItem) =>
        getDateSortValue(firstItem) - getDateSortValue(secondItem),
    );
  }

  return filteredItems;
}

// Prices are written as `${CurrencyCode} ${amount}` (e.g. "USD 180"), but the
// amount half is free text from a decimal-pad input, so it can carry grouping
// separators ("USD 1,299.50"), a comma decimal mark ("USD 1299,50"), a bare
// decimal ("USD .50"), or a stray symbol the form re-prefixes ("USD $180").
// Take the first numeric run and infer the separators from its own shape.
const PRICE_NUMBER_PATTERN = /[.,]?\d[\d.,]*/;

function getPriceSortValue(item: MockPurchase) {
  const priceText = item.price?.trim();

  if (!priceText) {
    return null;
  }

  const match = PRICE_NUMBER_PATTERN.exec(priceText);

  if (!match) {
    return null;
  }

  const digits = match[0].replace(/[.,]+$/, '');
  const separatorIndex = Math.max(
    digits.lastIndexOf(','),
    digits.lastIndexOf('.'),
  );
  const fraction = separatorIndex === -1 ? '' : digits.slice(separatorIndex + 1);
  // A trailing run of 1-2 digits is a decimal mark; anything longer ("1,299")
  // is thousands grouping.
  const hasDecimalMark = fraction.length > 0 && fraction.length <= 2;
  const normalized = hasDecimalMark
    ? `${digits.slice(0, separatorIndex).replace(/[.,]/g, '')}.${fraction}`
    : digits.replace(/[.,]/g, '');
  const value = Number(normalized);

  return Number.isFinite(value) ? value : null;
}

// The leading letters of a price string are its currency code ("USD 180" -> "USD"),
// used only by the currency-grouped price view below. Returns null when the price has
// no parseable amount at all (those items sink to a trailing "No price" group, matching
// comparePricesByDirection's sink-to-end rule) and '' when there is an amount but no
// recognizable code (bucketed into a neutral "Other" group).
function getPriceCurrencyCode(item: MockPurchase): string | null {
  if (getPriceSortValue(item) === null) {
    return null;
  }

  const codeMatch = /^[A-Za-z]{2,}/.exec(item.price?.trim() ?? '');

  return codeMatch ? codeMatch[0].toUpperCase() : '';
}

function comparePricesByDirection(
  firstItem: MockPurchase,
  secondItem: MockPurchase,
  isDescending: boolean,
) {
  const firstValue = getPriceSortValue(firstItem);
  const secondValue = getPriceSortValue(secondItem);

  // Missing/unparseable prices sink to the bottom in both directions, so the
  // direction flip below never applies to them.
  if (firstValue === null || secondValue === null) {
    if (firstValue === secondValue) {
      return 0;
    }

    return firstValue === null ? 1 : -1;
  }

  return isDescending ? secondValue - firstValue : firstValue - secondValue;
}

// Layered on top of getVisiblePurchaseItems, never in place of it: 'recent'
// returns that list untouched, and Array.sort is stable, so ties in the other
// sorts still fall back to the tab's existing order.
function getSortedPurchaseItems(items: MockPurchase[], sortKey: SortKey) {
  if (sortKey === 'recent') {
    return items;
  }

  if (sortKey === 'storeAZ') {
    return [...items].sort((firstItem, secondItem) =>
      firstItem.store.localeCompare(secondItem.store, undefined, {
        sensitivity: 'base',
      }),
    );
  }

  const isDescending = sortKey === 'priceHighToLow';

  return [...items].sort((firstItem, secondItem) =>
    comparePricesByDirection(firstItem, secondItem, isDescending),
  );
}

// Neutral section keys/labels for the two non-currency buckets the grouped view can
// produce: a price with no recognizable currency code, and no parseable price at all
// (the latter always sinks to the very end).
const CODELESS_CURRENCY_GROUP_KEY = ' codeless';
const CODELESS_CURRENCY_GROUP_LABEL = 'Other';
const NO_PRICE_GROUP_KEY = ' no-price';
const NO_PRICE_GROUP_LABEL = 'No price';

// Approximate, fixed FX priority for the supported currencies, most-valuable to least
// (GBP > EUR > USD > GEL). Used ONLY to order currency GROUPS whose leading price AND
// total are exactly tied — it is a hardcoded ordinal, never a live exchange rate, and
// never takes part in any actual price comparison within a group or across groups.
// Lower index = more valuable; a code absent from this list sinks below every ranked one.
const CURRENCY_TIE_PRIORITY: readonly string[] = ['GBP', 'EUR', 'USD', 'GEL'];

type CurrencyGroup = {
  items: MockPurchase[];
  key: string;
  label: string;
};

// One rendered row of the grouped price view: a quiet currency header or a purchase
// card. Flattened from CurrencyGroup[] so the existing item list can render a single
// interleaved array (headers + cards) with one map, leaving the flat non-grouped render
// path untouched.
type PurchaseListRow =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'item'; item: MockPurchase; key: string };

// The grouped counterpart to the flat price sort above, used only when a price sort is
// active and the visible set spans more than one currency (see the render gate). Raw
// amounts in different currencies are not comparable, so the list is split into one
// section per currency instead of interleaving them. Sections are ordered by their own
// leading price in the active direction; if two share that leading value they fall back
// to the section's summed total, and if they are fully tied on both they fall back to a
// fixed FX-priority ranking (GBP > EUR > USD > GEL) mirrored by direction (High→Low
// leads with the more valuable currency, Low→High with the less valuable) — never an
// alphabetical reshuffle. Within a section the existing comparePricesByDirection does the ordering —
// every item shares a code, so it reduces to a plain by-amount sort. Items with no
// parseable price collect into a single trailing section.
function getCurrencyGroups(
  items: MockPurchase[],
  isDescending: boolean,
): CurrencyGroup[] {
  const itemsByCode = new Map<string, MockPurchase[]>();
  const codeEncounterOrder: string[] = [];
  const noPriceItems: MockPurchase[] = [];

  for (const item of items) {
    const code = getPriceCurrencyCode(item);

    if (code === null) {
      noPriceItems.push(item);
      continue;
    }

    const existing = itemsByCode.get(code);

    if (existing) {
      existing.push(item);
    } else {
      itemsByCode.set(code, [item]);
      codeEncounterOrder.push(code);
    }
  }

  const rankedGroups = codeEncounterOrder.map((code, encounterIndex) => {
    const groupItems = itemsByCode.get(code) ?? [];
    const sortedItems = [...groupItems].sort((firstItem, secondItem) =>
      comparePricesByDirection(firstItem, secondItem, isDescending),
    );

    return {
      code,
      encounterIndex,
      // Same-currency amounts are directly comparable, so the leading price is the
      // first item after the in-direction sort, and the total sums the group.
      leading: getPriceSortValue(sortedItems[0]) ?? 0,
      sortedItems,
      total: groupItems.reduce(
        (sum, groupItem) => sum + (getPriceSortValue(groupItem) ?? 0),
        0,
      ),
    };
  });

  rankedGroups.sort((firstGroup, secondGroup) => {
    if (firstGroup.leading !== secondGroup.leading) {
      return isDescending
        ? secondGroup.leading - firstGroup.leading
        : firstGroup.leading - secondGroup.leading;
    }

    if (firstGroup.total !== secondGroup.total) {
      return isDescending
        ? secondGroup.total - firstGroup.total
        : firstGroup.total - secondGroup.total;
    }

    // Fully tied on both real price signals (equal leading price AND equal total):
    // there is no cross-currency value signal left, so fall back to the fixed FX
    // priority ranking. The more valuable currency's group leads on High→Low; Low→High
    // mirrors it so the less valuable currency leads. This ordinal is a display-only
    // tie-break and never claims a real converted value.
    const firstRank = CURRENCY_TIE_PRIORITY.indexOf(firstGroup.code);
    const secondRank = CURRENCY_TIE_PRIORITY.indexOf(secondGroup.code);
    const firstRanked = firstRank !== -1;
    const secondRanked = secondRank !== -1;

    // Defensive: a code outside the ranking (shouldn't happen with the 4 supported)
    // sinks below every ranked currency in both directions, and unranked groups keep
    // their encounter order relative to each other.
    if (firstRanked !== secondRanked) {
      return firstRanked ? -1 : 1;
    }

    if (!firstRanked) {
      return firstGroup.encounterIndex - secondGroup.encounterIndex;
    }

    return isDescending ? firstRank - secondRank : secondRank - firstRank;
  });

  const groups: CurrencyGroup[] = rankedGroups.map((group) => ({
    items: group.sortedItems,
    key: group.code === '' ? CODELESS_CURRENCY_GROUP_KEY : group.code,
    label: group.code === '' ? CODELESS_CURRENCY_GROUP_LABEL : group.code,
  }));

  if (noPriceItems.length > 0) {
    groups.push({
      items: noPriceItems,
      key: NO_PRICE_GROUP_KEY,
      label: NO_PRICE_GROUP_LABEL,
    });
  }

  return groups;
}

function matchesSearchQuery(
  item: MockPurchase,
  normalizedQuery: string,
  includeComment: boolean,
) {
  if (!normalizedQuery) {
    return true;
  }

  const searchableValues = [item.itemName, item.store];

  if (includeComment) {
    searchableValues.push(item.comment ?? '');
  }

  return searchableValues.some((value) =>
    value.toLowerCase().includes(normalizedQuery),
  );
}

// Advanced (Pro) global-search recency key. Prefer resolvedAt when present,
// then fall back to purchaseDateISO, then returnDateISO — most-recent-first.
function getRecencySortValue(item: MockPurchase) {
  const resolvedDate = getResolvedDateFromValue(item.resolvedAt);

  if (resolvedDate) {
    return resolvedDate.getTime();
  }

  const purchaseDate = parsePurchaseDate({ dateISO: item.purchaseDateISO });

  if (purchaseDate) {
    return purchaseDate.getTime();
  }

  const returnDate =
    parsePurchaseDate({ dateISO: item.returnDateISO }) ??
    getPurchaseReturnDate(item);

  if (returnDate) {
    return returnDate.getTime();
  }

  return 0;
}

function getGlobalSearchResults(
  purchases: MockPurchase[],
  normalizedQuery: string,
) {
  return purchases
    .filter((item) => matchesSearchQuery(item, normalizedQuery, true))
    .sort(
      (firstItem, secondItem) =>
        getRecencySortValue(secondItem) - getRecencySortValue(firstItem),
    );
}

function getHighlightedContent(text: string, query?: string): ReactNode {
  const normalizedQuery = query?.trim().toLowerCase();

  if (!normalizedQuery) {
    return text;
  }

  const segments: ReactNode[] = [];
  let remainingText = text;
  let segmentIndex = 0;

  while (remainingText.length > 0) {
    const matchIndex = remainingText.toLowerCase().indexOf(normalizedQuery);

    if (matchIndex === -1) {
      segments.push(remainingText);
      break;
    }

    if (matchIndex > 0) {
      segments.push(remainingText.slice(0, matchIndex));
    }

    const matchText = remainingText.slice(
      matchIndex,
      matchIndex + normalizedQuery.length,
    );

    segments.push(
      <Text key={`search-match-${segmentIndex}`} style={styles.searchMatchHighlight}>
        {matchText}
      </Text>,
    );

    segmentIndex += 1;
    remainingText = remainingText.slice(matchIndex + normalizedQuery.length);
  }

  return segments;
}

// Drawn rather than typeset: the previous "▾" is U+25BE, a Geometric Shapes
// glyph that resolves through a fallback symbol font, so its size and weight
// rendered inconsistently across platforms. A Path has none of that risk.
function SortChevronIcon() {
  return (
    <Svg
      accessibilityElementsHidden
      focusable={false}
      height={5}
      viewBox="0 0 8 5"
      width={8}
    >
      <Path d="M0 0 8 0 4 5Z" fill={SORT_CHEVRON_COLOR} />
    </Svg>
  );
}

function NotificationBell() {
  return (
    <View style={styles.bellIcon} accessibilityElementsHidden>
      <View style={styles.bellGlyph}>
        <View style={styles.bellStem} />
        <View style={styles.bellDome} />
        <View style={styles.bellRim} />
        <View style={styles.bellClapper} />
      </View>
      <View style={styles.bellDot} />
    </View>
  );
}

function ProductIcon({ photoUri }: { photoUri?: string }) {
  if (photoUri) {
    return (
      <View style={styles.productThumbnail} accessibilityElementsHidden>
        <Image
          resizeMode="cover"
          source={{ uri: photoUri }}
          style={styles.productThumbnailImage}
        />
      </View>
    );
  }

  return (
    <View style={styles.productIcon} accessibilityElementsHidden>
      <View style={styles.bagHandle} />
      <View style={styles.bagBody}>
        <View style={styles.bagFold} />
      </View>
    </View>
  );
}

function PurchaseEmptyState({
  onAddItem,
  selectedFilter,
}: {
  onAddItem?: () => void;
  selectedFilter: FilterKey;
}) {
  const copy = emptyStateContent[selectedFilter];
  const showAddAction = selectedFilter === 'active' && onAddItem;

  return (
    <View style={styles.emptyStateCard}>
      <ProductIcon />
      <AppText style={styles.emptyStateTitle} variant="body">
        {copy.title}
      </AppText>
      <AppText style={styles.emptyStateBody} variant="caption">
        {copy.body}
      </AppText>

      {showAddAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAddItem}
          style={({ pressed }) => [
            styles.emptyStateAction,
            pressed && styles.emptyStateActionPressed,
          ]}
        >
          <AppText style={styles.emptyStateActionText} variant="button">
            Add item
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

function getStatusPillStyle(status: PurchaseStatus) {
  if (status === 'pending') {
    return styles.pendingPill;
  }

  if (status === 'returned') {
    return styles.returnedPill;
  }

  if (status === 'kept') {
    return styles.keptPill;
  }

  return styles.activePill;
}

function getStatusPillTextStyle(status: PurchaseStatus) {
  if (status === 'pending') {
    return styles.pendingPillText;
  }

  if (status === 'returned') {
    return styles.returnedPillText;
  }

  if (status === 'kept') {
    return styles.keptPillText;
  }

  return styles.activePillText;
}

function getItemCardStyle(status: PurchaseStatus) {
  if (status === 'pending') {
    return styles.pendingItemCard;
  }

  if (status === 'returned') {
    return styles.returnedItemCard;
  }

  if (status === 'kept') {
    return styles.keptItemCard;
  }

  return null;
}

function getCardTrailingText(item: MockPurchase) {
  if (item.status === 'pending') {
    return 'Needs decision';
  }

  if (item.status === 'active') {
    return getReturnDateUrgency(item).label;
  }

  return null;
}

function getUrgencyTextStyle(item: MockPurchase, urgencyText: string) {
  if (item.status === 'pending') {
    return styles.pendingDaysText;
  }

  if (item.status === 'kept') {
    return styles.keptDaysText;
  }

  if (urgencyText === 'Today' || urgencyText === 'Return date passed') {
    return styles.alertDaysText;
  }

  if (urgencyText === 'Tomorrow') {
    return styles.soonDaysText;
  }

  if (item.status === 'active') {
    return styles.calmDaysText;
  }

  if (item.status === 'returned') {
    return styles.returnedDaysText;
  }

  return styles.neutralDaysText;
}

function getGestureLock(dx: number, dy: number): GestureLock {
  const horizontalMove = Math.abs(dx);
  const verticalMove = Math.abs(dy);

  if (
    horizontalMove >= GESTURE_LOCK_DISTANCE &&
    horizontalMove > verticalMove * HORIZONTAL_LOCK_RATIO
  ) {
    return 'horizontal';
  }

  if (
    verticalMove >= GESTURE_LOCK_DISTANCE &&
    verticalMove > horizontalMove * VERTICAL_LOCK_RATIO
  ) {
    return 'vertical';
  }

  return 'undecided';
}

function PurchaseCard({
  highlightQuery,
  item,
  onPress,
  onResolveItem,
}: {
  highlightQuery?: string;
  item: MockPurchase;
  onPress?: () => void;
  onResolveItem?: (itemId: string, status: ResolvedPurchaseStatus) => void;
}) {
  const canResolveItem = item.status === 'active' || item.status === 'pending';
  const isResolvedCard = item.status === 'returned' || item.status === 'kept';
  const showActions = canResolveItem && onResolveItem;
  const subtitleText = getCardSubtitleText(item);
  const trailingText = getCardTrailingText(item);

  return (
    <View
      style={[
        styles.itemCard,
        isResolvedCard && styles.resolvedItemCard,
        getItemCardStyle(item.status),
      ]}
    >
      <Pressable
        accessibilityRole="button"
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [
          styles.cardTapArea,
          pressed && onPress ? styles.cardTapAreaPressed : null,
        ]}
      >
        <View style={styles.itemTopRow}>
          <ProductIcon photoUri={item.photoUris?.[0]} />

          <View style={styles.itemCopy}>
            <View style={styles.itemNameRow}>
              <AppText style={styles.itemName} variant="body">
                {getHighlightedContent(item.itemName, highlightQuery)}
              </AppText>

              <View style={[styles.statusPill, getStatusPillStyle(item.status)]}>
                <AppText
                  style={[
                    styles.statusPillText,
                    getStatusPillTextStyle(item.status),
                ]}
                  variant="caption"
                >
                  {purchaseStatusLabels[item.status]}
                </AppText>
              </View>
            </View>

            <AppText style={styles.storeName} variant="caption">
              {getHighlightedContent(item.store, highlightQuery)}
            </AppText>

            {isResolvedCard ? (
              <AppText
                style={[
                  styles.resolvedLineText,
                  item.status === 'kept'
                    ? styles.keptResolvedLineText
                    : styles.returnedResolvedLineText,
                ]}
                variant="caption"
              >
                {subtitleText}
              </AppText>
            ) : null}
          </View>
        </View>

        {!isResolvedCard ? (
          <View style={styles.returnInfoRow}>
            <AppText style={styles.returnByText} variant="caption">
              {subtitleText}
            </AppText>
            {trailingText ? (
              <AppText
                style={[styles.daysText, getUrgencyTextStyle(item, trailingText)]}
                variant="caption"
              >
                {trailingText}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </Pressable>

      {showActions ? (
        <View style={styles.cardActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onResolveItem?.(item.id, 'returned')}
            style={({ pressed }) => [
              styles.cardActionButton,
              styles.returnedActionButton,
              pressed && styles.cardActionButtonPressed,
            ]}
          >
            <AppText
              style={[styles.cardActionText, styles.returnedActionText]}
              variant="button"
            >
              Returned
            </AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => onResolveItem?.(item.id, 'kept')}
            style={({ pressed }) => [
              styles.cardActionButton,
              styles.keepActionButton,
              pressed && styles.cardActionButtonPressed,
            ]}
          >
            <AppText style={styles.cardActionText} variant="button">
              Keep
            </AppText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function PurchasesHomeScreen({
  isHomeRouteSettled,
  onAddItem,
  onPurchasePress,
}: PurchasesHomeScreenProps) {
  const { isAuthLoading } = useAuth();
  const { isPurchasesScopeReady, purchases, resolvePurchase } = usePurchases();
  const {
    appSettingsScopeKey,
    hasCompletedOnboarding,
    hasHydratedSettings,
    isHomeReminderNudgeScopeReady,
    isSettingsScopeReady,
    notificationPromptStatus,
    recordEligibleHomeReminderDay,
    remindersEnabled,
    resetHomeReminderNudge,
    setNotificationPromptStatus,
    setRemindersEnabled,
  } = useAppSettings();
  const { features, isPro } = usePlan();
  const openProGate = useProFeatureGate({ signInSource: 'home' });
  const isAdvancedSearchEnabled = features.advancedSearch;
  const isAdvancedSortingEnabled = features.advancedSorting;
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [isSortMenuMounted, setIsSortMenuMounted] = useState(false);
  const [sortMenuAnchor, setSortMenuAnchor] = useState({ right: 0, top: 0 });
  const [automaticNudgeEvaluationVersion, setAutomaticNudgeEvaluationVersion] =
    useState(0);
  const selectedFilterIndex = filterItems.findIndex(
    (filterItem) => filterItem.key === selectedFilter,
  );

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(debounceTimer);
    };
  }, [searchQuery]);

  const trimmedSearchQuery = debouncedSearchQuery.trim();
  const normalizedSearchQuery = trimmedSearchQuery.toLowerCase();
  const hasActiveSearchQuery = normalizedSearchQuery.length > 0;
  // Advanced tier only: an active query switches to cross-status global search.
  // Baseline (Free/Guest) never sets this true, so it stays tab-scoped.
  const isGlobalSearchActive = isAdvancedSearchEnabled && hasActiveSearchQuery;
  const searchHighlightQuery = isGlobalSearchActive
    ? trimmedSearchQuery
    : undefined;
  const searchPlaceholder = isAdvancedSearchEnabled
    ? 'Search all purchases'
    : 'Search name or store';
  // Baseline (Free/Guest) is pinned to 'recent', so the tab-scoped list keeps
  // exactly its existing order. The picker is additionally hidden during Pro
  // global search, which carries its own cross-status recency order.
  const activeSortKey: SortKey = isAdvancedSortingEnabled ? sortKey : 'recent';
  const isSortPickerEnabled = isAdvancedSortingEnabled && !isGlobalSearchActive;
  const defaultSortOptionLabel = getDefaultSortOptionLabel(selectedFilter);
  const sortMenuOptions = useMemo(
    () => [
      {
        key: 'recent' as const,
        label: defaultSortOptionLabel,
      },
      ...alternativeSortOptions,
    ],
    [defaultSortOptionLabel],
  );

  useEffect(() => {
    if (!isSortPickerEnabled) {
      setIsSortMenuOpen(false);
    }
  }, [isSortPickerEnabled]);

  const automaticNudgeEvaluationGenerationRef = useRef(0);
  const automaticNudgeEvaluationQueuedRef = useRef(false);
  const isAutomaticNudgeEvaluationRunningRef = useRef(false);
  const isAutomaticNudgeEvaluatorMountedRef = useRef(true);
  const hasPresentedAutomaticNudgeThisForegroundRef = useRef(false);
  const previousAppStateRef = useRef(AppState.currentState);
  const gestureLock = useRef<GestureLock>('undecided');
  const tabTransition = useRef(new Animated.Value(1)).current;
  const sortMenuFade = useRef(new Animated.Value(0)).current;
  const sortMenuOverlayRef = useRef<View | null>(null);
  const sortTriggerRef = useRef<View | null>(null);
  const transitionDirection = useRef(1);
  const attentionSummary = useMemo(
    () => getAttentionSummary(purchases),
    [purchases],
  );
  const greeting = getTimeAwareGreeting();
  const visiblePurchaseItems = useMemo(() => {
    // Advanced tier: while a query is active, ignore the selected tab and match
    // across every status, sorted by the shared recency rule.
    if (isAdvancedSearchEnabled && normalizedSearchQuery) {
      return getGlobalSearchResults(purchases, normalizedSearchQuery);
    }

    // Baseline tier: keep the tab-scoped list, then narrow within the tab by
    // name/store only (no comment, no cross-tab behavior).
    const tabScopedItems = getVisiblePurchaseItems(purchases, selectedFilter);

    if (!normalizedSearchQuery) {
      return getSortedPurchaseItems(tabScopedItems, activeSortKey);
    }

    return getSortedPurchaseItems(
      tabScopedItems.filter((item) =>
        matchesSearchQuery(item, normalizedSearchQuery, false),
      ),
      activeSortKey,
    );
  }, [
    activeSortKey,
    isAdvancedSearchEnabled,
    normalizedSearchQuery,
    purchases,
    selectedFilter,
  ]);
  // Currency-grouped rows for the visible list, non-null ONLY when a price sort is
  // active AND the visible set spans more than one distinct currency code. In every
  // other case (Recent, Store, single-currency, active search) this stays null and the
  // list renders flat, byte-identical to before.
  const groupedPurchaseRows = useMemo<PurchaseListRow[] | null>(() => {
    if (
      isGlobalSearchActive ||
      (activeSortKey !== 'priceHighToLow' && activeSortKey !== 'priceLowToHigh')
    ) {
      return null;
    }

    const distinctCurrencyCodes = new Set<string>();

    for (const item of visiblePurchaseItems) {
      const code = getPriceCurrencyCode(item);

      if (code) {
        distinctCurrencyCodes.add(code);
      }
    }

    if (distinctCurrencyCodes.size <= 1) {
      return null;
    }

    const rows: PurchaseListRow[] = [];

    for (const group of getCurrencyGroups(
      visiblePurchaseItems,
      activeSortKey === 'priceHighToLow',
    )) {
      rows.push({
        key: `currency-${group.key}`,
        kind: 'header',
        label: group.label,
      });

      for (const item of group.items) {
        rows.push({ item, key: item.id, kind: 'item' });
      }
    }

    return rows;
  }, [activeSortKey, isGlobalSearchActive, visiblePurchaseItems]);
  const hasReminderEligiblePurchase = useMemo(
    () =>
      purchases.some(
        (purchase) =>
          (purchase.status === 'active' || purchase.status === 'pending') &&
          getPurchaseReturnDate(purchase) !== null,
      ),
    [purchases],
  );
  const sectionHeading = isGlobalSearchActive
    ? GLOBAL_SEARCH_SECTION_HEADING
    : sectionHeadings[selectedFilter];
  // The meta label is the active-sort indicator. 'recent' falls through to the
  // heading's own meta, so Free/Guest and global search read exactly as before.
  const sectionMetaLabel =
    isGlobalSearchActive || activeSortKey === 'recent'
      ? sectionHeading.meta
      : sortMetaLabels[activeSortKey];
  const automaticNudgeContextRef = useRef({
    appSettingsScopeKey,
    hasCompletedOnboarding,
    hasHydratedSettings,
    hasReminderEligiblePurchase,
    isAuthLoading,
    isHomeReminderNudgeScopeReady,
    isHomeRouteSettled,
    isPurchasesScopeReady,
    isSettingsScopeReady,
    notificationPromptStatus,
    remindersEnabled,
  });

  automaticNudgeContextRef.current = {
    appSettingsScopeKey,
    hasCompletedOnboarding,
    hasHydratedSettings,
    hasReminderEligiblePurchase,
    isAuthLoading,
    isHomeReminderNudgeScopeReady,
    isHomeRouteSettled,
    isPurchasesScopeReady,
    isSettingsScopeReady,
    notificationPromptStatus,
    remindersEnabled,
  };
  const selectFilter = useCallback(
    (nextFilter: FilterKey) => {
      // Tabs are inert during Pro global search (press disabled + swipe ignored).
      if (isGlobalSearchActive || nextFilter === selectedFilter) {
        return;
      }

      const nextFilterIndex = filterItems.findIndex(
        (filterItem) => filterItem.key === nextFilter,
      );

      transitionDirection.current =
        nextFilterIndex > selectedFilterIndex ? 1 : -1;
      tabTransition.stopAnimation();
      tabTransition.setValue(0);
      setSelectedFilter(nextFilter);
      // Every tab change (press and swipe) lands here, so a Price/Store sort is
      // never carried silently into a tab the user did not choose it for.
      setSortKey('recent');
    },
    [isGlobalSearchActive, selectedFilter, selectedFilterIndex, tabTransition],
  );

  const turnOffReminders = useCallback(() => {
    setRemindersEnabled(false);
    setNotificationPromptStatus('dismissed');
    cancelAllScheduledAppReminders().catch(() => undefined);
  }, [setNotificationPromptStatus, setRemindersEnabled]);

  const turnOnReminders = useCallback(async () => {
    const isGranted = await requestNotificationPermissions();

    setRemindersEnabled(isGranted);
    setNotificationPromptStatus(isGranted ? 'enabled' : 'dismissed');

    if (!isGranted) {
      await cancelAllScheduledAppReminders();
    }

    return isGranted;
  }, [setNotificationPromptStatus, setRemindersEnabled]);

  const silentlyResetHomeReminderNudge = useCallback(async () => {
    try {
      await resetHomeReminderNudge();
    } catch {
      // Automatic nudge cleanup must never surface an error in Home.
    }
  }, [resetHomeReminderNudge]);

  const showAutomaticReminderNudge = useCallback(() => {
    Alert.alert(
      'Reminders are off',
      'Turn on reminders before return dates and pending decisions',
      [
        {
          onPress: () => {
            turnOnReminders()
              .then((isGranted) => {
                if (!isGranted) {
                  return silentlyResetHomeReminderNudge();
                }

                return undefined;
              })
              .catch(() => undefined);
          },
          text: 'Turn on reminders',
        },
        {
          onPress: () => {
            turnOffReminders();
            void silentlyResetHomeReminderNudge();
          },
          style: 'cancel',
          text: 'Not now',
        },
      ],
    );
  }, [
    silentlyResetHomeReminderNudge,
    turnOffReminders,
    turnOnReminders,
  ]);

  const showNotificationStatus = useCallback(async () => {
    const status = await getNotificationPermissionsStatus();

    if (remindersEnabled && status?.granted) {
      Alert.alert(
        'Reminders are on',
        'We\u2019ll notify you before return dates and pending decisions',
        [
          {
            onPress: turnOffReminders,
            style: 'destructive',
            text: 'Turn off reminders',
          },
          {
            text: 'OK',
          },
        ],
      );
      return;
    }

    Alert.alert(
      'Reminders are off',
      'Turn on reminders before return dates and pending decisions',
      [
        {
          onPress: () => {
            turnOnReminders().catch(() => undefined);
          },
          text: 'Turn on reminders',
        },
        {
          onPress: turnOffReminders,
          style: 'cancel',
          text: 'Not now',
        },
      ],
    );
  }, [remindersEnabled, turnOffReminders, turnOnReminders]);

  const isAutomaticNudgeContextEligible = useCallback(
    (expectedScopeKey?: string) => {
      const context = automaticNudgeContextRef.current;

      return (
        AppState.currentState === 'active' &&
        context.isHomeRouteSettled &&
        !context.isAuthLoading &&
        context.hasHydratedSettings &&
        context.isSettingsScopeReady &&
        context.appSettingsScopeKey !== null &&
        (expectedScopeKey === undefined ||
          context.appSettingsScopeKey === expectedScopeKey) &&
        context.isHomeReminderNudgeScopeReady &&
        context.isPurchasesScopeReady &&
        context.hasCompletedOnboarding &&
        context.notificationPromptStatus !== 'undecided' &&
        context.hasReminderEligiblePurchase &&
        !hasPresentedAutomaticNudgeThisForegroundRef.current
      );
    },
    [],
  );

  useEffect(() => {
    isAutomaticNudgeEvaluatorMountedRef.current = true;
    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState) => {
        const previousAppState = previousAppStateRef.current;

        previousAppStateRef.current = nextAppState;
        automaticNudgeEvaluationGenerationRef.current += 1;

        if (previousAppState !== 'active' && nextAppState === 'active') {
          hasPresentedAutomaticNudgeThisForegroundRef.current = false;
          setAutomaticNudgeEvaluationVersion((version) => version + 1);
        }
      },
    );

    return () => {
      isAutomaticNudgeEvaluatorMountedRef.current = false;
      automaticNudgeEvaluationGenerationRef.current += 1;
      appStateSubscription.remove();
    };
  }, []);

  useEffect(() => {
    automaticNudgeEvaluationGenerationRef.current += 1;
    const evaluationGeneration =
      automaticNudgeEvaluationGenerationRef.current;
    let midnightTimer: ReturnType<typeof setTimeout> | null = null;

    const runAutomaticNudgeEvaluation = async () => {
      if (!isAutomaticNudgeContextEligible()) {
        return;
      }

      if (isAutomaticNudgeEvaluationRunningRef.current) {
        automaticNudgeEvaluationQueuedRef.current = true;
        return;
      }

      isAutomaticNudgeEvaluationRunningRef.current = true;
      const scopeKey =
        automaticNudgeContextRef.current.appSettingsScopeKey;

      if (scopeKey === null) {
        isAutomaticNudgeEvaluationRunningRef.current = false;
        return;
      }

      try {
        const permissionStatus = await getNotificationPermissionsStatus();

        if (
          automaticNudgeEvaluationGenerationRef.current !==
            evaluationGeneration ||
          permissionStatus === null ||
          !isAutomaticNudgeContextEligible(scopeKey)
        ) {
          return;
        }

        const contextAfterPermission = automaticNudgeContextRef.current;
        const remindersEffectivelyOn =
          contextAfterPermission.remindersEnabled &&
          permissionStatus.granted === true;

        if (remindersEffectivelyOn) {
          return;
        }

        const shouldPresent = await recordEligibleHomeReminderDay();

        if (
          !shouldPresent ||
          automaticNudgeEvaluationGenerationRef.current !==
            evaluationGeneration ||
          !isAutomaticNudgeContextEligible(scopeKey)
        ) {
          return;
        }

        const revalidatedPermissionStatus =
          await getNotificationPermissionsStatus();

        if (
          automaticNudgeEvaluationGenerationRef.current !==
            evaluationGeneration ||
          revalidatedPermissionStatus === null ||
          !isAutomaticNudgeContextEligible(scopeKey)
        ) {
          return;
        }

        const revalidatedContext = automaticNudgeContextRef.current;
        const remindersBecameEffectivelyOn =
          revalidatedContext.remindersEnabled &&
          revalidatedPermissionStatus.granted === true;

        if (
          remindersBecameEffectivelyOn ||
          !revalidatedContext.hasReminderEligiblePurchase
        ) {
          return;
        }

        hasPresentedAutomaticNudgeThisForegroundRef.current = true;
        showAutomaticReminderNudge();
      } catch {
        // Any evaluator uncertainty fails closed without affecting Home.
      } finally {
        isAutomaticNudgeEvaluationRunningRef.current = false;

        if (automaticNudgeEvaluationQueuedRef.current) {
          automaticNudgeEvaluationQueuedRef.current = false;

          if (isAutomaticNudgeEvaluatorMountedRef.current) {
            setAutomaticNudgeEvaluationVersion((version) => version + 1);
          }
        }
      }
    };

    if (isAutomaticNudgeContextEligible()) {
      void runAutomaticNudgeEvaluation();
      midnightTimer = setTimeout(
        () =>
          setAutomaticNudgeEvaluationVersion((version) => version + 1),
        getDelayUntilNextLocalHomeDay() + 50,
      );
    }

    return () => {
      automaticNudgeEvaluationGenerationRef.current += 1;

      if (midnightTimer !== null) {
        clearTimeout(midnightTimer);
      }
    };
  }, [
    appSettingsScopeKey,
    automaticNudgeEvaluationVersion,
    hasCompletedOnboarding,
    hasHydratedSettings,
    hasReminderEligiblePurchase,
    isAuthLoading,
    isAutomaticNudgeContextEligible,
    isHomeReminderNudgeScopeReady,
    isHomeRouteSettled,
    isPurchasesScopeReady,
    isSettingsScopeReady,
    notificationPromptStatus,
    recordEligibleHomeReminderDay,
    remindersEnabled,
    showAutomaticReminderNudge,
  ]);

  useEffect(() => {
    const transitionAnimation = Animated.timing(tabTransition, {
      duration: TAB_TRANSITION_DURATION,
      toValue: 1,
      useNativeDriver: true,
    });

    transitionAnimation.start();

    return () => {
      transitionAnimation.stop();
    };
  }, [selectedFilter, tabTransition]);

  useEffect(() => {
    if (!isSortMenuMounted) {
      return;
    }

    // Same Animated.timing pattern as the tab transition above, run in both
    // directions: the menu stays mounted until the fade-out actually finishes.
    const fadeAnimation = Animated.timing(sortMenuFade, {
      duration: SORT_MENU_FADE_DURATION,
      toValue: isSortMenuOpen ? 1 : 0,
      useNativeDriver: true,
    });

    fadeAnimation.start(({ finished }) => {
      if (finished && !isSortMenuOpen) {
        setIsSortMenuMounted(false);
      }
    });

    return () => {
      fadeAnimation.stop();
    };
  }, [isSortMenuMounted, isSortMenuOpen, sortMenuFade]);

  const openSortMenu = useCallback(() => {
    const triggerNode = sortTriggerRef.current;
    const overlayNode = sortMenuOverlayRef.current;

    if (!triggerNode || !overlayNode) {
      return;
    }

    // Both measurements are in window space, so subtracting one from the other
    // converts the trigger's position into the overlay's own coordinates —
    // no assumptions about AppScreen's safe-area inset or horizontal padding.
    overlayNode.measureInWindow((overlayX, overlayY, overlayWidth) => {
      triggerNode.measureInWindow(
        (triggerX, triggerY, triggerWidth, triggerHeight) => {
          setSortMenuAnchor({
            right: Math.max(overlayX + overlayWidth - (triggerX + triggerWidth), 0),
            top: Math.max(
              triggerY - overlayY + triggerHeight + SORT_MENU_ANCHOR_GAP,
              0,
            ),
          });
          setIsSortMenuMounted(true);
          setIsSortMenuOpen(true);
        },
      );
    });
  }, []);

  const closeSortMenu = useCallback(() => {
    setIsSortMenuOpen(false);
  }, []);

  const sortChevronAnimatedStyle = {
    transform: [
      {
        rotate: sortMenuFade.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '180deg'],
        }),
      },
    ],
  };

  const tabContentAnimatedStyle = {
    opacity: tabTransition.interpolate({
      inputRange: [0, 1],
      outputRange: [0.22, 1],
    }),
    transform: [
      {
        translateX: tabTransition.interpolate({
          inputRange: [0, 1],
          outputRange: [
            transitionDirection.current * TAB_TRANSITION_DISTANCE,
            0,
          ],
        }),
      },
    ],
  };

  const resetGestureLock = useCallback(() => {
    gestureLock.current = 'undecided';
    setIsScrollEnabled(true);
  }, []);

  const lockGesture = useCallback((nextGestureLock: GestureLock) => {
    if (
      gestureLock.current !== 'undecided' ||
      nextGestureLock === 'undecided'
    ) {
      return gestureLock.current;
    }

    gestureLock.current = nextGestureLock;

    if (nextGestureLock === 'horizontal') {
      setIsScrollEnabled(false);
    }

    return gestureLock.current;
  }, []);

  const shouldUseHorizontalResponder = useCallback(
    (dx: number, dy: number) => {
      if (gestureLock.current === 'horizontal') {
        return true;
      }

      if (gestureLock.current === 'vertical') {
        return false;
      }

      return lockGesture(getGestureLock(dx, dy)) === 'horizontal';
    },
    [lockGesture],
  );

  const contentPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => {
          resetGestureLock();

          return false;
        },
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          shouldUseHorizontalResponder(gestureState.dx, gestureState.dy),
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return shouldUseHorizontalResponder(
            gestureState.dx,
            gestureState.dy,
          );
        },
        onPanResponderGrant: () => {
          lockGesture('horizontal');
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureLock.current === 'horizontal') {
            if (gestureState.dx <= -SWIPE_COMPLETION_DISTANCE) {
              const nextFilter = filterItems[selectedFilterIndex + 1];

              if (nextFilter) {
                selectFilter(nextFilter.key);
              }
            }

            if (gestureState.dx >= SWIPE_COMPLETION_DISTANCE) {
              const previousFilter = filterItems[selectedFilterIndex - 1];

              if (previousFilter) {
                selectFilter(previousFilter.key);
              }
            }
          }

          resetGestureLock();
        },
        onPanResponderTerminate: resetGestureLock,
        onPanResponderTerminationRequest: () => false,
      }),
    [
      lockGesture,
      resetGestureLock,
      selectFilter,
      selectedFilterIndex,
      shouldUseHorizontalResponder,
    ],
  );

  return (
    <AppScreen stableTopInset style={styles.screen}>
      <LinearGradient
        colors={['#FBFAF3', '#F4F7EF', '#FFF8EC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
        style={styles.backgroundBase}
      />
      <View pointerEvents="none" style={styles.backgroundSageGlow} />
      <View pointerEvents="none" style={styles.backgroundDashboardGlow} />
      <View pointerEvents="none" style={styles.backgroundWarmGlow} />
      <View pointerEvents="none" style={styles.backgroundLowerSageWash} />
      <LinearGradient
        colors={[
          'rgba(255, 250, 238, 0)',
          'rgba(247, 239, 218, 0.28)',
          'rgba(238, 245, 231, 0.2)',
        ]}
        pointerEvents="none"
        style={styles.backgroundLowerBlend}
      />
      <View pointerEvents="none" style={styles.backgroundPaperWash} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        scrollEnabled={isScrollEnabled}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <View style={styles.greetingRow}>
              <AppText style={styles.greeting} variant="caption">
                {greeting}
              </AppText>
              {/* Pro users get the quiet STATUS badge on the attention card
                  below, so the greeting row stays clean — no badge and no flex
                  spacers (rendering the spacers alone would leave stray empty
                  flex children). Non-Pro users keep the ACTION badge and its
                  spacers here, where the upgrade entry point is seen first. */}
              {isPro ? null : (
                <>
                  <View style={styles.greetingSpacerLeft} />
                  <ProBadge
                    accessibilityLabel="Get RetTrack Pro"
                    onPress={() => openProGate('unlimitedPurchases')}
                    variant="action"
                  />
                  <View style={styles.greetingSpacerRight} />
                </>
              )}
            </View>
            <AppText style={styles.title} variant="title">
              Your purchases
            </AppText>
          </View>

          <Pressable
            accessibilityLabel="Notifications"
            accessibilityRole="button"
            onPress={showNotificationStatus}
            style={({ pressed }) => [
              styles.notificationButton,
              pressed && styles.notificationButtonPressed,
            ]}
          >
            <NotificationBell />
          </Pressable>
        </View>

        <LinearGradient
          colors={['#2F442F', '#415C3D', '#314832']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.attentionCard}
        >
          <View pointerEvents="none" style={styles.attentionCardGlow} />
          <View style={styles.attentionTopRow}>
            <AppText style={styles.attentionLabel} variant="caption">
              Needs attention
            </AppText>
            <AppText style={styles.attentionCount} variant="title">
              {attentionSummary.countText}
            </AppText>
          </View>

          <View style={styles.attentionMiniCards}>
            {attentionSummary.summaries.map((summary) => (
              <View style={styles.attentionMiniCard} key={summary.label}>
                <AppText style={styles.attentionMiniLabel} variant="caption">
                  {summary.label}
                </AppText>
                <AppText style={styles.attentionMiniValue} variant="body">
                  {summary.value}
                </AppText>
              </View>
            ))}
          </View>
          {/* Pro users: the quiet STATUS badge lives on this premium surface,
              parked in the top-right corner (the label and count are stacked and
              left-aligned, so the corner is clear). Non-Pro users see nothing
              here — their entry point is the ACTION badge in the greeting row. */}
          {isPro ? (
            <View style={styles.attentionProBadge}>
              <ProBadge
                accessibilityLabel="Manage RetTrack Pro"
                onDark
                onPress={() => openProGate('unlimitedPurchases')}
                variant="status"
              />
            </View>
          ) : null}
        </LinearGradient>

        <View style={styles.searchField}>
          <View accessibilityElementsHidden style={styles.searchIcon}>
            <View style={styles.searchIconGlass} />
            <View style={styles.searchIconHandle} />
          </View>
          <TextInput
            accessibilityLabel="Search purchases"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setSearchQuery}
            placeholder={searchPlaceholder}
            placeholderTextColor="#8A9082"
            returnKeyType="search"
            selectionColor={theme.colors.green}
            style={styles.searchInput}
            value={searchQuery}
          />
          {searchQuery.length > 0 ? (
            <Pressable
              accessibilityLabel="Clear search"
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => setSearchQuery('')}
              style={({ pressed }) => [
                styles.searchClear,
                pressed && styles.searchClearPressed,
              ]}
            >
              <AppText style={styles.searchClearText} variant="caption">
                ×
              </AppText>
            </Pressable>
          ) : null}
        </View>

        <View
          style={[
            styles.segmentedFilter,
            isGlobalSearchActive && styles.segmentedFilterDimmed,
          ]}
        >
          {filterItems.map((filterItem) => {
            const isSelected = filterItem.key === selectedFilter;

            return (
              <Pressable
                accessibilityRole="button"
                disabled={isGlobalSearchActive}
                key={filterItem.key}
                onPress={() => selectFilter(filterItem.key)}
                style={({ pressed }) => [
                  styles.filterItem,
                  isSelected && styles.filterItemSelected,
                  pressed && styles.filterItemPressed,
                ]}
              >
                <AppText
                  style={[
                    styles.filterText,
                    isSelected && styles.filterTextSelected,
                  ]}
                  variant="caption"
                >
                  {filterItem.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <View
          collapsable={false}
          style={styles.swipeContent}
          {...contentPanResponder.panHandlers}
        >
          <Animated.View style={tabContentAnimatedStyle}>
            <View style={styles.sectionRow}>
              <AppText style={styles.sectionTitle} variant="caption">
                {sectionHeading.title}
              </AppText>
              {isSortPickerEnabled ? (
                <Pressable
                  accessibilityHint="Choose how purchases are sorted"
                  accessibilityLabel={`Sort: ${sectionMetaLabel}`}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isSortMenuOpen }}
                  hitSlop={12}
                  onPress={openSortMenu}
                  ref={sortTriggerRef}
                  style={({ pressed }) => [
                    styles.sectionMetaTrigger,
                    pressed && styles.sectionMetaTriggerPressed,
                  ]}
                >
                  <AppText style={styles.sectionMeta} variant="caption">
                    {sectionMetaLabel}
                  </AppText>
                  <Animated.View style={sortChevronAnimatedStyle}>
                    <SortChevronIcon />
                  </Animated.View>
                </Pressable>
              ) : (
                <AppText style={styles.sectionMeta} variant="caption">
                  {sectionHeading.meta}
                </AppText>
              )}
            </View>

            <View style={styles.itemList}>
              {visiblePurchaseItems.length === 0 ? (
                hasActiveSearchQuery ? (
                  <View style={styles.emptyStateCard}>
                    <AppText style={styles.searchEmptyText} variant="body">
                      No matches for “{trimmedSearchQuery}”
                    </AppText>
                  </View>
                ) : (
                  <PurchaseEmptyState
                    onAddItem={onAddItem}
                    selectedFilter={selectedFilter}
                  />
                )
              ) : groupedPurchaseRows ? (
                groupedPurchaseRows.map((row) =>
                  row.kind === 'header' ? (
                    <AppText
                      key={row.key}
                      style={[styles.sectionMeta, styles.currencyGroupHeader]}
                      variant="caption"
                    >
                      {row.label}
                    </AppText>
                  ) : (
                    <PurchaseCard
                      highlightQuery={searchHighlightQuery}
                      item={row.item}
                      key={row.key}
                      onResolveItem={resolvePurchase}
                      onPress={() => onPurchasePress?.(row.item.id)}
                    />
                  ),
                )
              ) : (
                visiblePurchaseItems.map((item) => (
                  <PurchaseCard
                    highlightQuery={searchHighlightQuery}
                    item={item}
                    key={item.id}
                    onResolveItem={resolvePurchase}
                    onPress={() => onPurchasePress?.(item.id)}
                  />
                ))
              )}
            </View>
          </Animated.View>
        </View>
      </ScrollView>

      {/* Always mounted so the popover can measure against it; box-none keeps
          it inert (and the screen undimmed) whenever the menu is closed. */}
      <View
        pointerEvents="box-none"
        ref={sortMenuOverlayRef}
        style={styles.sortMenuOverlay}
      >
        {isSortMenuMounted ? (
          <>
            <Pressable
              accessibilityLabel="Close sort options"
              accessibilityRole="button"
              onPress={closeSortMenu}
              style={styles.sortMenuDismissArea}
            />
            <Animated.View
              style={[
                styles.sortMenuCard,
                {
                  opacity: sortMenuFade,
                  right: sortMenuAnchor.right,
                  top: sortMenuAnchor.top,
                },
              ]}
            >
              {sortMenuOptions.map(({ key, label }) => {
                const isSelected = key === activeSortKey;

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    key={key}
                    onPress={() => {
                      setSortKey(key);
                      closeSortMenu();
                    }}
                    style={({ pressed }) => [
                      styles.sortMenuOption,
                      isSelected && styles.sortMenuOptionSelected,
                      pressed && styles.sortMenuOptionPressed,
                    ]}
                  >
                    <AppText
                      style={[
                        styles.sortMenuOptionLabel,
                        isSelected && styles.sortMenuOptionLabelSelected,
                      ]}
                      variant="body"
                    >
                      {label}
                    </AppText>

                    {isSelected ? (
                      <View style={styles.sortMenuSelectedDot} />
                    ) : null}
                  </Pressable>
                );
              })}
            </Animated.View>
          </>
        ) : null}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#FBFAF3',
    paddingBottom: 0,
    paddingTop: theme.spacing.xl,
    position: 'relative',
  },
  backgroundBase: {
    ...StyleSheet.absoluteFillObject,
    bottom: -48,
    left: -theme.spacing.md,
    right: -theme.spacing.md,
    top: -48,
  },
  backgroundDashboardGlow: {
    backgroundColor: 'rgba(234, 241, 226, 0.74)',
    borderRadius: 170,
    height: 260,
    left: -126,
    position: 'absolute',
    top: 104,
    transform: [{ rotate: '-18deg' }],
    width: 470,
  },
  backgroundPaperWash: {
    backgroundColor: 'rgba(255, 253, 246, 0.78)',
    borderRadius: 170,
    height: 330,
    left: -144,
    position: 'absolute',
    top: 158,
    transform: [{ rotate: '-22deg' }],
    width: 500,
  },
  backgroundSageGlow: {
    backgroundColor: 'rgba(212, 228, 203, 0.84)',
    borderRadius: 180,
    height: 292,
    position: 'absolute',
    right: -116,
    top: -84,
    width: 318,
  },
  backgroundWarmGlow: {
    backgroundColor: 'rgba(238, 219, 185, 0.3)',
    borderRadius: 260,
    bottom: -34,
    height: 430,
    left: -228,
    position: 'absolute',
    transform: [{ rotate: '-8deg' }],
    width: 448,
  },
  backgroundLowerSageWash: {
    backgroundColor: 'rgba(224, 233, 215, 0.28)',
    borderRadius: 260,
    bottom: 58,
    height: 270,
    position: 'absolute',
    right: -244,
    transform: [{ rotate: '-14deg' }],
    width: 520,
  },
  backgroundLowerBlend: {
    bottom: -48,
    height: 360,
    left: -theme.spacing.md,
    position: 'absolute',
    right: -theme.spacing.md,
  },
  scroll: {
    flex: 1,
    position: 'relative',
  },
  content: {
    flexGrow: 1,
    paddingBottom: 122,
    paddingTop: theme.spacing.sm,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
    marginTop: 2,
  },
  headerCopy: {
    flex: 1,
    gap: 3,
  },
  // Inline row holding the greeting + the Pro badge, left-aligned so the badge
  // follows the greeting text rather than being pushed to the far edge. alignItems
  // center vertically aligns the badge with the caption; the badge sizes to content.
  greetingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  // Flex spacers around the badge place it ~a third into the free space after the
  // greeting (left flex 1 : right flex 2), rather than centred. This 1 : 2 ratio is
  // the single knob for the badge's horizontal position.
  greetingSpacerLeft: {
    flex: 1,
  },
  greetingSpacerRight: {
    flex: 2,
  },
  greeting: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 18,
  },
  title: {
    ...theme.typography.screenTitle,
    color: '#12322D',
    fontSize: 32,
    lineHeight: 38,
  },
  notificationButton: {
    alignItems: 'center',
    backgroundColor: '#FFFDF8',
    borderColor: 'rgba(92, 111, 82, 0.18)',
    borderRadius: 20,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 10,
      width: 0,
    },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    width: 48,
    elevation: 2,
  },
  notificationButtonPressed: {
    backgroundColor: '#F6F8F1',
    opacity: theme.press.pressedOpacity,
  },
  bellIcon: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    position: 'relative',
    width: 24,
  },
  bellGlyph: {
    height: 21,
    position: 'relative',
    width: 19,
  },
  bellStem: {
    backgroundColor: theme.colors.greenDark,
    borderRadius: theme.radius.pill,
    height: 3.5,
    left: 8.5,
    opacity: 0.86,
    position: 'absolute',
    top: 1,
    width: 2,
  },
  bellDome: {
    backgroundColor: 'transparent',
    borderColor: theme.colors.greenDark,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderWidth: 1.7,
    borderBottomWidth: 0,
    height: 13.5,
    left: 2,
    opacity: 0.86,
    position: 'absolute',
    top: 4.5,
    width: 15,
  },
  bellRim: {
    backgroundColor: theme.colors.greenDark,
    borderRadius: theme.radius.pill,
    height: 1.8,
    left: 1,
    opacity: 0.86,
    position: 'absolute',
    top: 16.5,
    width: 17,
  },
  bellClapper: {
    backgroundColor: theme.colors.greenDark,
    borderRadius: theme.radius.pill,
    height: 3.4,
    left: 7.8,
    opacity: 0.82,
    position: 'absolute',
    top: 17.5,
    width: 3.4,
  },
  bellDot: {
    backgroundColor: theme.colors.amber,
    borderColor: theme.colors.card,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    height: 4,
    opacity: 0.78,
    position: 'absolute',
    right: 3.5,
    top: 3.5,
    width: 4,
  },
  attentionCard: {
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 28,
    borderWidth: 1,
    marginTop: 22,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 15,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 18,
      width: 0,
    },
    shadowOpacity: 0.14,
    shadowRadius: 30,
    elevation: 4,
  },
  attentionCardGlow: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 130,
    height: 160,
    position: 'absolute',
    right: -72,
    top: -82,
    width: 180,
  },
  // Pro STATUS badge in the card's top-right corner. zIndex 2 lifts it above the
  // decorative glow (unlayered) and the content rows (zIndex 1). Insets moved in
  // from the card's 15/16 padding to 22/22 so ProBadge's on-dark glow ring — which
  // now extends 11px beyond the badge — clears the card's overflow:'hidden' + 28px
  // rounded corner; the outer ring settles ~11px inside the card edges instead of
  // being clipped at the corner.
  attentionProBadge: {
    position: 'absolute',
    right: 22,
    top: 22,
    zIndex: 2,
  },
  attentionTopRow: {
    gap: 2,
    position: 'relative',
    zIndex: 1,
  },
  attentionLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 15,
    textTransform: 'uppercase',
  },
  attentionCount: {
    color: '#FFFDF7',
    fontSize: 28,
    fontWeight: theme.fontWeight.bold,
    lineHeight: 34,
  },
  attentionMiniCards: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: 12,
    position: 'relative',
    zIndex: 1,
  },
  attentionMiniCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.13)',
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    minHeight: 66,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  attentionMiniLabel: {
    color: 'rgba(255, 255, 255, 0.66)',
    fontSize: 11,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 15,
  },
  attentionMiniValue: {
    color: '#FFFDF7',
    fontSize: 14,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 19,
    marginTop: 6,
  },
  segmentedFilter: {
    backgroundColor: 'rgba(246, 247, 240, 0.86)',
    borderColor: 'rgba(91, 105, 82, 0.13)',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 3,
    marginTop: 20,
    padding: 5,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 8,
      width: 0,
    },
    shadowOpacity: 0.045,
    shadowRadius: 18,
    elevation: 1,
  },
  filterItem: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 38,
  },
  filterItemSelected: {
    backgroundColor: '#FFFDF8',
    borderColor: 'rgba(223, 226, 216, 0.9)',
    borderWidth: 1,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 5,
      width: 0,
    },
    shadowOpacity: 0.055,
    shadowRadius: 12,
    elevation: 1,
  },
  filterItemPressed: {
    backgroundColor: 'rgba(255, 253, 248, 0.7)',
  },
  filterText: {
    color: '#747A70',
    fontSize: 13,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 17,
  },
  filterTextSelected: {
    color: theme.colors.greenDark,
  },
  segmentedFilterDimmed: {
    opacity: 0.5,
  },
  searchField: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: 'rgba(91, 105, 82, 0.13)',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    marginTop: 20,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 4,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 8,
      width: 0,
    },
    shadowOpacity: 0.045,
    shadowRadius: 18,
    elevation: 1,
  },
  searchIcon: {
    height: 16,
    position: 'relative',
    width: 16,
  },
  searchIconGlass: {
    borderColor: '#747A70',
    borderRadius: theme.radius.pill,
    borderWidth: 1.6,
    height: 11,
    width: 11,
  },
  searchIconHandle: {
    backgroundColor: '#747A70',
    borderRadius: theme.radius.pill,
    bottom: 0,
    height: 2,
    position: 'absolute',
    right: 0,
    transform: [{ rotate: '45deg' }],
    width: 6,
  },
  searchInput: {
    ...theme.typography.input,
    color: theme.colors.text,
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    minHeight: 40,
    padding: 0,
    paddingVertical: 0,
  },
  searchClear: {
    alignItems: 'center',
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  searchClearPressed: {
    opacity: theme.press.pressedOpacity,
  },
  searchClearText: {
    color: '#747A70',
    fontSize: 18,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 20,
  },
  searchMatchHighlight: {
    // Applied over both itemName (semibold) and storeName (regular), so the
    // weight bump stays: it is the only contrast lever on storeName.
    color: theme.colors.greenDark,
    fontWeight: theme.fontWeight.bold,
  },
  searchEmptyText: {
    color: '#111A14',
    fontSize: 15,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 21,
    textAlign: 'center',
  },
  swipeContent: {
    flexGrow: 1,
    marginTop: 20,
  },
  sectionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...theme.typography.sectionTitle,
    color: '#111A14',
    lineHeight: 22,
  },
  sectionMeta: {
    ...theme.typography.capsMeta,
    color: '#858B80',
    lineHeight: 15,
  },
  // Reuses the muted section-meta caps style; only adds a hair of top spacing so each
  // currency header reads as belonging to the group beneath it, not a heavy divider.
  currencyGroupHeader: {
    marginTop: 4,
  },
  // Neutral card/border pill, deliberately not theme.colors.sage: sage reads as
  // "selected" on the sort rows and the currency picker, and the trigger is not
  // a selection. Quiet enough to stay a discoverability cue, not a button.
  sectionMetaTrigger: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sectionMetaTriggerPressed: {
    opacity: 0.82,
  },
  sortMenuOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  // Transparent on purpose — a popover dismiss target, not a modal scrim.
  sortMenuDismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  // The amber Pro hairline is a 2px top *border*, not an absolutely-positioned
  // bar: a border follows borderRadius on its own, so it cannot overhang the
  // rounded corners and needs no overflow:'hidden' — which on iOS would clip
  // this card's own shadow away. (ProfileScreen's proUsageAccent has to clip,
  // so its shadow lives on a separate proUsageCardWrapper.)
  sortMenuCard: {
    backgroundColor: '#FFFDF8',
    borderColor: '#E3E5DD',
    borderRadius: 18,
    borderTopColor: theme.colors.amber,
    borderTopWidth: 2,
    borderWidth: 1,
    elevation: 6,
    maxWidth: 220,
    minWidth: 168,
    padding: 6,
    position: 'absolute',
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 10,
      width: 0,
    },
    shadowOpacity: 0.14,
    shadowRadius: 20,
  },
  sortMenuOption: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 40,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  sortMenuOptionLabel: {
    color: theme.colors.greenDark,
    fontSize: 14,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 19,
  },
  sortMenuOptionLabelSelected: {
    fontWeight: theme.fontWeight.semibold,
  },
  sortMenuOptionPressed: {
    opacity: 0.82,
  },
  sortMenuOptionSelected: {
    backgroundColor: theme.colors.sage,
  },
  sortMenuSelectedDot: {
    backgroundColor: theme.colors.greenDark,
    borderRadius: theme.radius.pill,
    height: 6,
    opacity: 0.76,
    width: 6,
  },
  itemList: {
    gap: 12,
    marginTop: 12,
  },
  emptyStateCard: {
    alignItems: 'center',
    backgroundColor: '#FFFDF8',
    borderColor: 'rgba(92, 111, 82, 0.14)',
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 24,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 10,
      width: 0,
    },
    shadowOpacity: 0.045,
    shadowRadius: 20,
    elevation: 2,
  },
  emptyStateTitle: {
    color: '#111A14',
    fontSize: 17,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 23,
    marginTop: 13,
    textAlign: 'center',
  },
  emptyStateBody: {
    color: '#73786E',
    fontSize: 13,
    fontWeight: theme.fontWeight.regular,
    lineHeight: 19,
    marginTop: 5,
    maxWidth: 260,
    textAlign: 'center',
  },
  emptyStateAction: {
    alignItems: 'center',
    backgroundColor: '#EEF4EA',
    borderColor: '#DCE8D5',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 38,
    paddingHorizontal: 18,
  },
  emptyStateActionPressed: {
    opacity: 0.82,
  },
  emptyStateActionText: {
    color: theme.colors.greenDark,
    fontSize: 13,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 18,
  },
  itemCard: {
    backgroundColor: '#FFFDF8',
    borderColor: 'rgba(92, 111, 82, 0.14)',
    borderRadius: 26,
    borderWidth: 1,
    padding: 16,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 10,
      width: 0,
    },
    shadowOpacity: 0.045,
    shadowRadius: 20,
    elevation: 2,
  },
  resolvedItemCard: {
    paddingHorizontal: 15,
    paddingVertical: 14,
    shadowOpacity: 0.08,
    shadowRadius: 20,
  },
  cardTapArea: {
    borderRadius: 22,
  },
  cardTapAreaPressed: {
    opacity: theme.press.pressedOpacity,
  },
  keptItemCard: {
    backgroundColor: '#FFF9EE',
    borderColor: '#E7D8BA',
    shadowColor: '#7B6237',
  },
  pendingItemCard: {
    borderColor: '#E7D7BF',
  },
  returnedItemCard: {
    backgroundColor: '#FFFDF8',
    borderColor: '#D8E5CF',
  },
  itemTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 13,
  },
  productIcon: {
    alignItems: 'center',
    backgroundColor: '#EAF1E4',
    borderColor: '#DCE8D5',
    borderRadius: 18,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  productThumbnail: {
    backgroundColor: '#EEF4EA',
    borderColor: '#DCE8D5',
    borderRadius: 18,
    borderWidth: 1,
    height: 54,
    overflow: 'hidden',
    width: 54,
  },
  productThumbnailImage: {
    height: '100%',
    width: '100%',
  },
  bagHandle: {
    borderColor: theme.colors.greenDark,
    borderBottomWidth: 0,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderWidth: 1.5,
    height: 10,
    marginBottom: -2,
    opacity: 0.84,
    width: 18,
    zIndex: 1,
  },
  bagBody: {
    alignItems: 'center',
    backgroundColor: '#FAFBF5',
    borderColor: theme.colors.greenDark,
    borderRadius: 8,
    borderWidth: 1.5,
    height: 24,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: 30,
  },
  bagFold: {
    backgroundColor: '#DDE7D4',
    borderRadius: theme.radius.pill,
    height: 1.5,
    opacity: 0.9,
    position: 'absolute',
    top: 6,
    width: 14,
  },
  itemCopy: {
    flex: 1,
    gap: 5,
  },
  itemNameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
    justifyContent: 'space-between',
  },
  itemName: {
    color: '#111A14',
    flex: 1,
    fontSize: 17,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 22,
  },
  storeName: {
    ...theme.typography.meta,
    color: '#7D8278',
    fontWeight: theme.fontWeight.regular,
    lineHeight: 18,
  },
  statusPill: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillText: {
    ...theme.typography.chipText,
    lineHeight: 14,
  },
  activePill: {
    backgroundColor: theme.colors.sage,
  },
  activePillText: {
    color: theme.colors.greenDark,
  },
  pendingPill: {
    backgroundColor: '#F5EEE1',
    borderColor: '#E7D7BF',
    borderWidth: 1,
  },
  pendingPillText: {
    color: '#8C6A2F',
  },
  returnedPill: {
    backgroundColor: '#ECF2E7',
    borderColor: '#D8E4D1',
    borderWidth: 1,
  },
  returnedPillText: {
    color: theme.colors.greenDark,
  },
  keptPill: {
    backgroundColor: '#F8EFE0',
    borderColor: '#EADBBE',
    borderWidth: 1,
  },
  keptPillText: {
    color: '#7B6237',
  },
  returnInfoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  returnByText: {
    ...theme.typography.meta,
    color: '#5F6E58',
    fontWeight: theme.fontWeight.medium,
    lineHeight: 18,
  },
  resolvedLineText: {
    fontSize: 12,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 17,
    marginTop: 1,
  },
  returnedResolvedLineText: {
    color: theme.colors.greenDark,
  },
  keptResolvedLineText: {
    color: '#7B6237',
  },
  daysText: {
    fontSize: 13,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 18,
  },
  alertDaysText: {
    color: theme.colors.pending,
  },
  soonDaysText: {
    color: theme.colors.amber,
  },
  calmDaysText: {
    color: theme.colors.greenDark,
  },
  neutralDaysText: {
    color: theme.colors.muted,
  },
  returnedDaysText: {
    color: theme.colors.greenDark,
  },
  pendingDaysText: {
    color: '#8C6A2F',
  },
  keptDaysText: {
    color: '#536346',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  cardActionButton: {
    alignItems: 'center',
    borderColor: 'rgba(92, 111, 82, 0.16)',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
  },
  cardActionButtonPressed: {
    opacity: theme.press.pressedOpacity,
  },
  returnedActionButton: {
    backgroundColor: '#536A4E',
    borderColor: '#536A4E',
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 6,
      width: 0,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  keepActionButton: {
    backgroundColor: '#F0F2EA',
    borderColor: '#E1E4D9',
  },
  cardActionText: {
    color: theme.colors.greenDark,
    fontSize: 14,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 19,
  },
  returnedActionText: {
    color: '#FFFDF7',
  },
});
