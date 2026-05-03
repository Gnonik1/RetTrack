import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AppScreen } from '../../../components/AppScreen';
import { AppText } from '../../../components/AppText';
import { theme } from '../../../constants/theme';
import {
  getNotificationPermissionsStatus,
  requestNotificationPermissions,
} from '../../notifications/notifications';
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
  getCompactReturnDate,
  getDateSortValue,
  getReturnDateUrgency,
} from '../utils/purchaseDates';

type PurchasesHomeScreenProps = {
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

function ProductIcon() {
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

function getCardUrgencyText(item: MockPurchase) {
  if (item.status === 'pending') {
    return 'Needs decision';
  }

  if (item.status === 'active') {
    return getReturnDateUrgency(item).label;
  }

  return item.days;
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
  item,
  onPress,
  onResolveItem,
}: {
  item: MockPurchase;
  onPress?: () => void;
  onResolveItem?: (itemId: string, status: ResolvedPurchaseStatus) => void;
}) {
  const canResolveItem = item.status === 'active' || item.status === 'pending';
  const showActions = canResolveItem && onResolveItem;
  const urgencyText = getCardUrgencyText(item);

  return (
    <View style={[styles.itemCard, getItemCardStyle(item.status)]}>
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
          <ProductIcon />

          <View style={styles.itemCopy}>
            <View style={styles.itemNameRow}>
              <AppText style={styles.itemName} variant="body">
                {item.itemName}
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
              {item.store}
            </AppText>
          </View>
        </View>

        <View style={styles.returnInfoRow}>
          <AppText style={styles.returnByText} variant="caption">
            Return by {getCompactReturnDate(item)}
          </AppText>
          <AppText
            style={[styles.daysText, getUrgencyTextStyle(item, urgencyText)]}
            variant="caption"
          >
            {urgencyText}
          </AppText>
        </View>
      </Pressable>

      {showActions ? (
        <View style={styles.cardActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onResolveItem?.(item.id, 'returned')}
            style={[styles.cardActionButton, styles.returnedActionButton]}
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
            style={[styles.cardActionButton, styles.keepActionButton]}
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

function HomeNavIcon({ active = false }: { active?: boolean }) {
  return (
    <View style={styles.navIconHome} accessibilityElementsHidden>
      <View style={[styles.navHomeRoof, active && styles.navIconActive]} />
      <View style={[styles.navHomeBody, active && styles.navIconActive]} />
    </View>
  );
}

function HistoryNavIcon() {
  return (
    <View style={styles.navIconCircle} accessibilityElementsHidden>
      <View style={styles.navClockMinute} />
      <View style={styles.navClockHour} />
      <View style={styles.navClockCenter} />
    </View>
  );
}

function ProfileNavIcon() {
  return (
    <View style={styles.navIconProfile} accessibilityElementsHidden>
      <View style={styles.navProfileHead} />
      <View style={styles.navProfileBody} />
    </View>
  );
}

function SettingsNavIcon() {
  return (
    <View style={styles.navIconSettings} accessibilityElementsHidden>
      <View style={[styles.navGearTooth, styles.navGearToothTop]} />
      <View style={[styles.navGearTooth, styles.navGearToothRight]} />
      <View style={[styles.navGearTooth, styles.navGearToothBottom]} />
      <View style={[styles.navGearTooth, styles.navGearToothLeft]} />
      <View style={[styles.navGearTooth, styles.navGearToothUpperRight]} />
      <View style={[styles.navGearTooth, styles.navGearToothLowerRight]} />
      <View style={[styles.navGearTooth, styles.navGearToothLowerLeft]} />
      <View style={[styles.navGearTooth, styles.navGearToothUpperLeft]} />
      <View style={styles.navGearRing}>
        <View style={styles.navGearCenter} />
      </View>
    </View>
  );
}

export function PurchasesHomeScreen({
  onAddItem,
  onPurchasePress,
}: PurchasesHomeScreenProps) {
  const { purchases, resolvePurchase } = usePurchases();
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>('active');
  const selectedFilterIndex = filterItems.findIndex(
    (filterItem) => filterItem.key === selectedFilter,
  );
  const gestureLock = useRef<GestureLock>('undecided');
  const tabTransition = useRef(new Animated.Value(1)).current;
  const transitionDirection = useRef(1);
  const attentionSummary = useMemo(
    () => getAttentionSummary(purchases),
    [purchases],
  );
  const greeting = getTimeAwareGreeting();
  const visiblePurchaseItems = useMemo(
    () => getVisiblePurchaseItems(purchases, selectedFilter),
    [purchases, selectedFilter],
  );
  const sectionHeading = sectionHeadings[selectedFilter];
  const selectFilter = useCallback(
    (nextFilter: FilterKey) => {
      if (nextFilter === selectedFilter) {
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
    },
    [selectedFilter, selectedFilterIndex, tabTransition],
  );

  const showNotificationStatus = useCallback(async () => {
    const status = await getNotificationPermissionsStatus();

    if (status?.granted) {
      Alert.alert(
        'Reminders are on',
        'We\u2019ll notify you before return dates and pending decisions.',
        [
          {
            text: 'OK',
          },
        ],
      );
      return;
    }

    Alert.alert(
      'Reminders are off',
      'Turn on reminders so you don\u2019t miss return dates.',
      [
        {
          onPress: () => {
            requestNotificationPermissions().catch(() => undefined);
          },
          text: 'Enable notifications',
        },
        {
          style: 'cancel',
          text: 'Not now',
        },
      ],
    );
  }, []);

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
    <AppScreen style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        scrollEnabled={isScrollEnabled}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <AppText style={styles.greeting} variant="caption">
              {greeting}
            </AppText>
            <AppText style={styles.title} variant="title">
              Your purchases
            </AppText>
          </View>

          <Pressable
            accessibilityLabel="Notifications"
            accessibilityRole="button"
            onPress={showNotificationStatus}
            style={styles.notificationButton}
          >
            <NotificationBell />
          </Pressable>
        </View>

        <View style={styles.attentionCard}>
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
        </View>

        <View style={styles.segmentedFilter}>
          {filterItems.map((filterItem) => {
            const isSelected = filterItem.key === selectedFilter;

            return (
              <Pressable
                accessibilityRole="button"
                key={filterItem.key}
                onPress={() => selectFilter(filterItem.key)}
                style={[
                  styles.filterItem,
                  isSelected && styles.filterItemSelected,
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
              <AppText style={styles.sectionMeta} variant="caption">
                {sectionHeading.meta}
              </AppText>
            </View>

            <View style={styles.itemList}>
              {visiblePurchaseItems.length === 0 ? (
                <PurchaseEmptyState
                  onAddItem={onAddItem}
                  selectedFilter={selectedFilter}
                />
              ) : (
                visiblePurchaseItems.map((item) => (
                  <PurchaseCard
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

      <View style={styles.bottomNav}>
        <View style={styles.navItem}>
          <HomeNavIcon active />
          <AppText style={[styles.navLabel, styles.navLabelActive]} variant="caption">
            Home
          </AppText>
          <View style={styles.navActiveIndicator} />
        </View>

        <View style={styles.navItem}>
          <HistoryNavIcon />
          <AppText style={styles.navLabel} variant="caption">
            History
          </AppText>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={onAddItem}
          style={({ pressed }) => [
            styles.navAddButton,
            pressed && onAddItem ? styles.navAddButtonPressed : null,
          ]}
        >
          <AppText style={styles.navAddButtonText} variant="button">
            +
          </AppText>
        </Pressable>

        <View style={styles.navItem}>
          <ProfileNavIcon />
          <AppText style={styles.navLabel} variant="caption">
            Profile
          </AppText>
        </View>

        <View style={styles.navItem}>
          <SettingsNavIcon />
          <AppText style={styles.navLabel} variant="caption">
            Settings
          </AppText>
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingBottom: 0,
    paddingTop: theme.spacing.xl,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 112,
    paddingTop: theme.spacing.xs,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
  },
  greeting: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 17,
  },
  title: {
    ...theme.typography.screenTitle,
    color: theme.colors.text,
    fontSize: 29,
    lineHeight: 35,
    marginTop: 3,
  },
  notificationButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    shadowColor: theme.colors.text,
    shadowOffset: {
      height: 8,
      width: 0,
    },
    shadowOpacity: 0.045,
    shadowRadius: 14,
    width: 44,
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
    backgroundColor: theme.colors.greenDark,
    borderRadius: theme.radius.xl,
    marginTop: theme.spacing.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 12,
      width: 0,
    },
    shadowOpacity: 0.15,
    shadowRadius: 22,
  },
  attentionTopRow: {
    gap: 2,
  },
  attentionLabel: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 11,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  attentionCount: {
    color: theme.colors.card,
    fontSize: 26,
    fontWeight: theme.fontWeight.bold,
    lineHeight: 32,
  },
  attentionMiniCards: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: 10,
  },
  attentionMiniCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    flex: 1,
    minHeight: 62,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  attentionMiniLabel: {
    color: 'rgba(255, 255, 255, 0.68)',
    fontSize: 11,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 16,
  },
  attentionMiniValue: {
    color: theme.colors.card,
    fontSize: 13,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 18,
    marginTop: 6,
  },
  segmentedFilter: {
    backgroundColor: theme.colors.sage,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 2,
    marginTop: 18,
    padding: 4,
  },
  filterItem: {
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    flex: 1,
    justifyContent: 'center',
    minHeight: 36,
  },
  filterItemSelected: {
    backgroundColor: theme.colors.card,
    shadowColor: theme.colors.text,
    shadowOffset: {
      height: 5,
      width: 0,
    },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  filterText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 16,
  },
  filterTextSelected: {
    color: theme.colors.greenDark,
  },
  swipeContent: {
    flexGrow: 1,
    marginTop: 18,
  },
  sectionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 21,
  },
  sectionMeta: {
    color: '#8C9186',
    fontSize: 10,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  itemList: {
    gap: 11,
    marginTop: 10,
  },
  emptyStateCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 22,
    shadowColor: theme.colors.text,
    shadowOffset: {
      height: 8,
      width: 0,
    },
    shadowOpacity: 0.035,
    shadowRadius: 14,
  },
  emptyStateTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 22,
    marginTop: 13,
    textAlign: 'center',
  },
  emptyStateBody: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: theme.fontWeight.regular,
    lineHeight: 19,
    marginTop: 5,
    maxWidth: 260,
    textAlign: 'center',
  },
  emptyStateAction: {
    alignItems: 'center',
    backgroundColor: theme.colors.sage,
    borderColor: '#D8E3D0',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 36,
    paddingHorizontal: 17,
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
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    padding: 14,
    shadowColor: theme.colors.text,
    shadowOffset: {
      height: 10,
      width: 0,
    },
    shadowOpacity: 0.045,
    shadowRadius: 18,
  },
  cardTapArea: {
    borderRadius: theme.radius.lg,
  },
  cardTapAreaPressed: {
    opacity: 0.78,
  },
  keptItemCard: {
    borderColor: '#DCE5CC',
  },
  pendingItemCard: {
    borderColor: '#EDDEDA',
  },
  returnedItemCard: {
    borderColor: '#DBE5D4',
  },
  itemTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
  },
  productIcon: {
    alignItems: 'center',
    backgroundColor: '#E6EEDF',
    borderColor: '#D8E3D0',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  bagHandle: {
    borderColor: theme.colors.greenDark,
    borderBottomWidth: 0,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderWidth: 1.5,
    height: 9,
    marginBottom: -2,
    opacity: 0.84,
    width: 17,
    zIndex: 1,
  },
  bagBody: {
    alignItems: 'center',
    backgroundColor: '#FAFBF5',
    borderColor: theme.colors.greenDark,
    borderRadius: 8,
    borderWidth: 1.5,
    height: 23,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: 28,
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
    gap: 4,
  },
  itemNameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
    justifyContent: 'space-between',
  },
  itemName: {
    color: theme.colors.text,
    flex: 1,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 22,
  },
  storeName: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: theme.fontWeight.regular,
    lineHeight: 18,
  },
  statusPill: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 14,
  },
  activePill: {
    backgroundColor: theme.colors.sage,
  },
  activePillText: {
    color: theme.colors.greenDark,
  },
  pendingPill: {
    backgroundColor: theme.colors.softPending,
  },
  pendingPillText: {
    color: theme.colors.pending,
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
    backgroundColor: '#EEF1DF',
    borderColor: '#DCE4C9',
    borderWidth: 1,
  },
  keptPillText: {
    color: '#536346',
  },
  returnInfoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  returnByText: {
    color: theme.colors.greenDark,
    fontSize: 12,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 17,
  },
  daysText: {
    fontSize: 12,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 17,
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
    color: theme.colors.pending,
  },
  keptDaysText: {
    color: '#536346',
  },
  cardActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: 10,
  },
  cardActionButton: {
    alignItems: 'center',
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 38,
  },
  returnedActionButton: {
    backgroundColor: theme.colors.green,
    borderColor: theme.colors.green,
  },
  keepActionButton: {
    backgroundColor: theme.colors.sage,
  },
  cardActionText: {
    color: theme.colors.greenDark,
    fontSize: 13,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 18,
  },
  returnedActionText: {
    color: theme.colors.card,
  },
  bottomNav: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: 22,
    borderWidth: 1,
    bottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: theme.spacing.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    position: 'absolute',
    right: theme.spacing.md,
    shadowColor: theme.colors.text,
    shadowOffset: {
      height: 14,
      width: 0,
    },
    shadowOpacity: 0.08,
    shadowRadius: 24,
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
    justifyContent: 'center',
    minHeight: 46,
    position: 'relative',
  },
  navActiveIndicator: {
    backgroundColor: theme.colors.greenDark,
    borderRadius: theme.radius.pill,
    bottom: 1,
    height: 2,
    opacity: 0.82,
    position: 'absolute',
    width: 12,
  },
  navLabel: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 14,
  },
  navLabelActive: {
    color: theme.colors.greenDark,
    fontWeight: theme.fontWeight.semibold,
  },
  navIconHome: {
    alignItems: 'center',
    height: 20,
    justifyContent: 'center',
    width: 22,
  },
  navHomeRoof: {
    borderColor: theme.colors.muted,
    borderLeftWidth: 1.8,
    borderTopWidth: 1.8,
    height: 12,
    position: 'absolute',
    top: 2,
    transform: [{ rotate: '45deg' }],
    width: 12,
  },
  navHomeBody: {
    borderColor: theme.colors.muted,
    borderRadius: 3,
    borderWidth: 1.8,
    height: 11,
    marginTop: 7,
    width: 14,
  },
  navIconActive: {
    borderColor: theme.colors.greenDark,
  },
  navIconCircle: {
    alignItems: 'center',
    borderColor: theme.colors.muted,
    borderRadius: theme.radius.pill,
    borderWidth: 1.8,
    height: 21,
    justifyContent: 'center',
    position: 'relative',
    width: 21,
  },
  navClockMinute: {
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radius.pill,
    height: 6.2,
    left: 9.6,
    position: 'absolute',
    top: 5.2,
    width: 1.8,
  },
  navClockHour: {
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radius.pill,
    height: 1.8,
    left: 9.6,
    position: 'absolute',
    top: 10.1,
    width: 5.3,
  },
  navClockCenter: {
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radius.pill,
    height: 3.2,
    left: 8.9,
    position: 'absolute',
    top: 8.9,
    width: 3.2,
  },
  navAddButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.green,
    borderRadius: theme.radius.pill,
    height: 52,
    justifyContent: 'center',
    marginHorizontal: 8,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 10,
      width: 0,
    },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    width: 52,
  },
  navAddButtonPressed: {
    opacity: 0.82,
  },
  navAddButtonText: {
    color: theme.colors.card,
    fontSize: 30,
    fontWeight: theme.fontWeight.regular,
    lineHeight: 32,
    marginTop: -2,
  },
  navIconProfile: {
    alignItems: 'center',
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  navProfileHead: {
    borderColor: theme.colors.muted,
    borderRadius: theme.radius.pill,
    borderWidth: 1.8,
    height: 8,
    width: 8,
  },
  navProfileBody: {
    borderColor: theme.colors.muted,
    borderRadius: 8,
    borderWidth: 1.8,
    height: 8,
    marginTop: 2,
    width: 16,
  },
  navIconSettings: {
    alignItems: 'center',
    height: 22,
    justifyContent: 'center',
    position: 'relative',
    width: 22,
  },
  navGearCenter: {
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radius.pill,
    height: 3.4,
    width: 3.4,
  },
  navGearRing: {
    alignItems: 'center',
    borderColor: theme.colors.muted,
    borderRadius: theme.radius.pill,
    borderWidth: 1.7,
    height: 12.5,
    justifyContent: 'center',
    width: 12.5,
  },
  navGearTooth: {
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radius.pill,
    height: 1.8,
    position: 'absolute',
    width: 4.4,
  },
  navGearToothBottom: {
    bottom: 1.4,
    left: 8.8,
    transform: [{ rotate: '90deg' }],
  },
  navGearToothLeft: {
    left: 1.4,
    top: 10.1,
  },
  navGearToothLowerLeft: {
    bottom: 4.1,
    left: 3.8,
    transform: [{ rotate: '45deg' }],
  },
  navGearToothLowerRight: {
    bottom: 4.1,
    right: 3.8,
    transform: [{ rotate: '-45deg' }],
  },
  navGearToothRight: {
    right: 1.4,
    top: 10.1,
  },
  navGearToothTop: {
    left: 8.8,
    top: 1.4,
    transform: [{ rotate: '90deg' }],
  },
  navGearToothUpperLeft: {
    left: 3.8,
    top: 4.1,
    transform: [{ rotate: '-45deg' }],
  },
  navGearToothUpperRight: {
    right: 3.8,
    top: 4.1,
    transform: [{ rotate: '45deg' }],
  },
});
