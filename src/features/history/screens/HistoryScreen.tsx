import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppBottomNav } from '../../../components/AppBottomNav';
import { AppScreen } from '../../../components/AppScreen';
import { AppText } from '../../../components/AppText';
import { theme } from '../../../constants/theme';
import {
  purchaseStatusLabels,
  type MockPurchase,
} from '../../purchases/data/mockPurchases';
import { usePurchases } from '../../purchases/state/PurchasesState';
import { formatCompactDate } from '../../purchases/utils/purchaseDates';

type HistoryGroup = {
  items: MockPurchase[];
  month: string;
};

function isHistoryPurchase(purchase: MockPurchase) {
  return purchase.status === 'returned' || purchase.status === 'kept';
}

function getResolvedSortValue(purchase: MockPurchase) {
  return purchase.resolvedAt ?? 0;
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

function getMonthLabel(purchase: MockPurchase) {
  const resolvedDate = getResolvedDateFromValue(purchase.resolvedAt);

  if (!resolvedDate) {
    return 'Recent';
  }

  return resolvedDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function getHistoryGroups(purchases: MockPurchase[]): HistoryGroup[] {
  const groupsByMonth = new Map<string, MockPurchase[]>();

  purchases
    .filter(isHistoryPurchase)
    .sort(
      (firstPurchase, secondPurchase) =>
        getResolvedSortValue(secondPurchase) -
        getResolvedSortValue(firstPurchase),
    )
    .forEach((purchase) => {
      const month = getMonthLabel(purchase);
      const monthPurchases = groupsByMonth.get(month) ?? [];

      monthPurchases.push(purchase);
      groupsByMonth.set(month, monthPurchases);
    });

  return Array.from(groupsByMonth, ([month, items]) => ({ items, month }));
}

function getResolvedStatusText(purchase: MockPurchase) {
  const resolvedDate = getResolvedDateFromValue(purchase.resolvedAt);

  if (resolvedDate) {
    return `${purchaseStatusLabels[purchase.status]} on ${formatCompactDate(
      resolvedDate,
    )}`;
  }

  return purchase.completedText;
}

function HistoryMarker({ status }: { status: MockPurchase['status'] }) {
  const isReturned = status === 'returned';

  return (
    <View
      style={[
        styles.marker,
        isReturned ? styles.returnedMarker : styles.keptMarker,
      ]}
    >
      <View
        style={[
          styles.markerDot,
          isReturned ? styles.returnedMarkerDot : styles.keptMarkerDot,
        ]}
      />
    </View>
  );
}

function HistoryEmptyIcon() {
  return (
    <View style={styles.emptyIcon} accessibilityElementsHidden>
      <View style={styles.emptyIconRing}>
        <View style={styles.emptyIconHandLong} />
        <View style={styles.emptyIconHandShort} />
      </View>
    </View>
  );
}

function RowChevron() {
  return <View style={styles.rowChevron} accessibilityElementsHidden />;
}

export function HistoryScreen() {
  const router = useRouter();
  const { purchases } = usePurchases();
  const historyGroups = useMemo(() => getHistoryGroups(purchases), [purchases]);

  return (
    <AppScreen style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <View style={styles.header}>
          <AppText style={styles.title} variant="title">
            History
          </AppText>
          <AppText style={styles.subtitle} variant="subtitle">
            A simple archive of your decisions.
          </AppText>
        </View>

        {historyGroups.length === 0 ? (
          <View style={styles.emptyCard}>
            <HistoryEmptyIcon />
            <AppText style={styles.emptyTitle} variant="body">
              No history yet
            </AppText>
            <AppText style={styles.emptyBody} variant="caption">
              Returned and kept items will appear here.
            </AppText>
          </View>
        ) : (
          <View style={styles.timeline}>
            {historyGroups.map((group) => (
              <View style={styles.monthGroup} key={group.month}>
                <AppText style={styles.monthLabel} variant="caption">
                  {group.month}
                </AppText>

                <View style={styles.monthItems}>
                  {group.items.map((purchase, index) => {
                    const resolvedStatusText = getResolvedStatusText(purchase);

                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={purchase.id}
                        onPress={() =>
                          router.push({
                            pathname: '/purchase-details',
                            params: {
                              itemId: purchase.id,
                            },
                          })
                        }
                        style={({ pressed }) => [
                          styles.historyCard,
                          pressed && styles.historyCardPressed,
                        ]}
                      >
                        <HistoryMarker status={purchase.status} />

                        <View style={styles.rowCopy}>
                          <View style={styles.rowTitleLine}>
                            <AppText
                              numberOfLines={2}
                              style={styles.itemName}
                              variant="body"
                            >
                              {purchase.itemName}
                            </AppText>
                            <AppText style={styles.statusText} variant="caption">
                              {purchaseStatusLabels[purchase.status]}
                            </AppText>
                          </View>

                          <AppText style={styles.storeName} variant="caption">
                            {purchase.store}
                          </AppText>

                          {resolvedStatusText ? (
                            <AppText
                              style={styles.completedText}
                              variant="caption"
                            >
                              {resolvedStatusText}
                            </AppText>
                          ) : null}
                        </View>

                        <RowChevron />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <AppBottomNav activeTab="history" />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  completedText: {
    color: theme.colors.greenDark,
    fontSize: 12,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 17,
    marginTop: 5,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 160,
    paddingTop: theme.spacing.xs,
  },
  emptyBody: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    maxWidth: 250,
    textAlign: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    marginTop: 22,
    paddingHorizontal: 18,
    paddingVertical: 26,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: '#E6EEDF',
    borderColor: '#D8E3D0',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    marginBottom: 13,
    width: 44,
  },
  emptyIconHandLong: {
    backgroundColor: theme.colors.greenDark,
    borderRadius: theme.radius.pill,
    height: 8,
    left: 11.7,
    opacity: 0.76,
    position: 'absolute',
    top: 5.5,
    width: 1.7,
  },
  emptyIconHandShort: {
    backgroundColor: theme.colors.greenDark,
    borderRadius: theme.radius.pill,
    height: 1.7,
    left: 11.6,
    opacity: 0.76,
    position: 'absolute',
    top: 12,
    width: 7,
  },
  emptyIconRing: {
    borderColor: theme.colors.greenDark,
    borderRadius: theme.radius.pill,
    borderWidth: 1.6,
    height: 26,
    opacity: 0.84,
    position: 'relative',
    width: 26,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 22,
    textAlign: 'center',
  },
  header: {
    gap: 6,
  },
  historyCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    minHeight: 82,
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  historyCardPressed: {
    backgroundColor: theme.colors.paper,
  },
  itemName: {
    color: theme.colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 20,
  },
  keptMarker: {
    backgroundColor: '#F4F2E8',
    borderColor: '#E3DEC9',
  },
  keptMarkerDot: {
    backgroundColor: '#7B815F',
  },
  marker: {
    alignItems: 'center',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    opacity: 0.68,
    width: 22,
  },
  markerDot: {
    borderRadius: theme.radius.pill,
    height: 6,
    opacity: 0.72,
    width: 6,
  },
  monthGroup: {
    gap: 9,
  },
  monthItems: {
    gap: 13,
  },
  monthLabel: {
    color: '#50574E',
    fontSize: 11,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 15,
    textTransform: 'uppercase',
  },
  returnedMarker: {
    backgroundColor: theme.colors.sage,
    borderColor: '#E0E8D9',
  },
  returnedMarkerDot: {
    backgroundColor: theme.colors.greenDark,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowChevron: {
    borderColor: '#8F968A',
    borderRightWidth: 1.4,
    borderTopWidth: 1.4,
    flexShrink: 0,
    height: 7,
    marginLeft: 2,
    opacity: 0.48,
    transform: [{ rotate: '45deg' }],
    width: 7,
  },
  rowTitleLine: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  screen: {
    paddingBottom: 0,
    paddingTop: theme.spacing.xl,
  },
  scroll: {
    flex: 1,
  },
  statusText: {
    color: theme.colors.greenDark,
    flexShrink: 0,
    fontSize: 11,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 16,
  },
  storeName: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  subtitle: {
    ...theme.typography.screenSubtitle,
    color: theme.colors.muted,
    lineHeight: 21,
  },
  timeline: {
    gap: 18,
    marginTop: 22,
  },
  title: {
    ...theme.typography.screenTitle,
    color: theme.colors.text,
    fontSize: 29,
    lineHeight: 36,
  },
});
