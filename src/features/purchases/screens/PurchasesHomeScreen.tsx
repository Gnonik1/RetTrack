import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AppScreen } from '../../../components/AppScreen';
import { AppBottomNav } from '../../../components/AppBottomNav';
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
  formatCompactDate,
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
  item,
  onPress,
  onResolveItem,
}: {
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
      <LinearGradient
        colors={['#FBFAF3', '#F4F7EE', '#FFF7EC']}
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
        </LinearGradient>

        <View style={styles.segmentedFilter}>
          {filterItems.map((filterItem) => {
            const isSelected = filterItem.key === selectedFilter;

            return (
              <Pressable
                accessibilityRole="button"
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

      <AppBottomNav activeTab="home" onAddPress={onAddItem} />
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
