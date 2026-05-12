import { useMemo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

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

function HistoryMarker({
  photoUri,
  status,
}: {
  photoUri?: string;
  status: MockPurchase['status'];
}) {
  const isReturned = status === 'returned';
  const resolvedPhotoUri = photoUri?.trim();

  if (resolvedPhotoUri) {
    return (
      <View
        accessibilityElementsHidden
        style={[
          styles.thumbnailFrame,
          isReturned ? styles.returnedThumbnailFrame : styles.keptThumbnailFrame,
        ]}
      >
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="cover"
          source={{ uri: resolvedPhotoUri }}
          style={styles.thumbnailImage}
        />
      </View>
    );
  }

  return (
    <View
      accessibilityElementsHidden
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
      <LinearGradient
        colors={['#FBFAF3', '#F3F7EF', '#FFF8EC']}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
        start={{ x: 0, y: 0 }}
        style={styles.backgroundBase}
      />
      <View pointerEvents="none" style={styles.backgroundTopSageGlow} />
      <View pointerEvents="none" style={styles.backgroundArchiveWash} />
      <View pointerEvents="none" style={styles.backgroundPaperVeil} />
      <View pointerEvents="none" style={styles.backgroundLowerWarmGlow} />
      <View pointerEvents="none" style={styles.backgroundLowerSageVeil} />

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
                    const isReturned = purchase.status === 'returned';

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
                        <HistoryMarker
                          photoUri={purchase.photoUris?.[0]}
                          status={purchase.status}
                        />

                        <View style={styles.rowCopy}>
                          <View style={styles.rowTitleLine}>
                            <AppText
                              numberOfLines={2}
                              style={styles.itemName}
                              variant="body"
                            >
                              {purchase.itemName}
                            </AppText>
                            <View
                              style={[
                                styles.statusPill,
                                isReturned
                                  ? styles.returnedStatusPill
                                  : styles.keptStatusPill,
                              ]}
                            >
                              <AppText
                                style={[
                                  styles.statusText,
                                  isReturned
                                    ? styles.returnedStatusText
                                    : styles.keptStatusText,
                                ]}
                                variant="caption"
                              >
                                {purchaseStatusLabels[purchase.status]}
                              </AppText>
                            </View>
                          </View>

                          <AppText style={styles.storeName} variant="caption">
                            {purchase.store}
                          </AppText>

                          {resolvedStatusText ? (
                            <AppText
                              style={[
                                styles.completedText,
                                isReturned
                                  ? styles.returnedCompletedText
                                  : styles.keptCompletedText,
                              ]}
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
    fontSize: 12,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 17,
    marginTop: 6,
  },
  backgroundArchiveWash: {
    backgroundColor: 'rgba(239, 244, 233, 0.34)',
    borderRadius: 260,
    height: 420,
    left: -250,
    position: 'absolute',
    top: 168,
    transform: [{ rotate: '-12deg' }],
    width: 760,
  },
  backgroundBase: {
    ...StyleSheet.absoluteFillObject,
    bottom: -48,
    left: -theme.spacing.md,
    right: -theme.spacing.md,
    top: -48,
  },
  backgroundLowerSageVeil: {
    backgroundColor: 'rgba(226, 234, 217, 0.2)',
    borderRadius: 360,
    bottom: -70,
    height: 440,
    position: 'absolute',
    right: -320,
    transform: [{ rotate: '-8deg' }],
    width: 760,
  },
  backgroundLowerWarmGlow: {
    backgroundColor: 'rgba(242, 226, 198, 0.2)',
    borderRadius: 420,
    bottom: -190,
    height: 640,
    left: -480,
    position: 'absolute',
    transform: [{ rotate: '-4deg' }],
    width: 920,
  },
  backgroundPaperVeil: {
    backgroundColor: 'rgba(255, 253, 248, 0.54)',
    borderRadius: 260,
    height: 430,
    left: -200,
    position: 'absolute',
    top: 275,
    transform: [{ rotate: '-10deg' }],
    width: 730,
  },
  backgroundTopSageGlow: {
    backgroundColor: 'rgba(216, 231, 207, 0.34)',
    borderRadius: 360,
    height: 610,
    position: 'absolute',
    right: -440,
    top: -275,
    width: 720,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 128,
    paddingTop: theme.spacing.sm,
  },
  emptyBody: {
    color: '#747A70',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 7,
    maxWidth: 250,
    textAlign: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFDF8',
    borderColor: 'rgba(92, 111, 82, 0.16)',
    borderRadius: 28,
    borderWidth: 1,
    marginTop: 24,
    paddingHorizontal: 22,
    paddingVertical: 30,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 16,
      width: 0,
    },
    shadowOpacity: 0.055,
    shadowRadius: 24,
    elevation: 3,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: '#EEF4EA',
    borderColor: '#DCE8D4',
    borderRadius: 20,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    marginBottom: 15,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 7,
      width: 0,
    },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    width: 54,
    elevation: 1,
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
    fontSize: 17,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 23,
    textAlign: 'center',
  },
  header: {
    gap: 7,
    marginTop: 2,
  },
  historyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFDF8',
    borderColor: 'rgba(92, 111, 82, 0.16)',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 82,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 10,
      width: 0,
    },
    shadowOpacity: 0.045,
    shadowRadius: 18,
    elevation: 2,
  },
  historyCardPressed: {
    backgroundColor: '#F8FAF4',
  },
  itemName: {
    color: theme.colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 21,
  },
  keptMarker: {
    backgroundColor: '#FBF4E8',
    borderColor: '#E8DDC4',
  },
  keptMarkerDot: {
    backgroundColor: '#9A743D',
  },
  keptCompletedText: {
    color: '#7B6237',
  },
  keptStatusPill: {
    backgroundColor: '#F8EFE0',
    borderColor: '#EADBBE',
  },
  keptStatusText: {
    color: '#7B6237',
  },
  keptThumbnailFrame: {
    borderColor: '#E8DDC4',
  },
  marker: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  markerDot: {
    borderRadius: theme.radius.pill,
    height: 8,
    opacity: 0.74,
    width: 8,
  },
  monthGroup: {
    gap: 10,
  },
  monthItems: {
    gap: 12,
  },
  monthLabel: {
    color: '#596654',
    fontSize: 11,
    fontWeight: theme.fontWeight.semibold,
    letterSpacing: 1.2,
    lineHeight: 15,
    marginLeft: 2,
    textTransform: 'uppercase',
  },
  returnedMarker: {
    backgroundColor: '#EEF4EA',
    borderColor: '#D8E5CF',
  },
  returnedMarkerDot: {
    backgroundColor: theme.colors.greenDark,
  },
  returnedCompletedText: {
    color: theme.colors.greenDark,
  },
  returnedStatusPill: {
    backgroundColor: '#EEF4EA',
    borderColor: '#D8E5CF',
  },
  returnedStatusText: {
    color: theme.colors.greenDark,
  },
  returnedThumbnailFrame: {
    borderColor: '#D8E5CF',
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
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  screen: {
    backgroundColor: '#FBFAF3',
    paddingBottom: 0,
    paddingTop: theme.spacing.xl,
    position: 'relative',
  },
  scroll: {
    flex: 1,
    position: 'relative',
  },
  statusText: {
    fontSize: 11,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 16,
  },
  statusPill: {
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flexShrink: 0,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  storeName: {
    color: '#73796F',
    fontSize: 14,
    lineHeight: 19,
    marginTop: 4,
  },
  subtitle: {
    ...theme.typography.screenSubtitle,
    color: theme.colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  timeline: {
    gap: 18,
    marginTop: 26,
  },
  thumbnailFrame: {
    backgroundColor: '#EEF4EA',
    borderRadius: 18,
    borderWidth: 1,
    height: 42,
    overflow: 'hidden',
    width: 42,
  },
  thumbnailImage: {
    height: '100%',
    width: '100%',
  },
  title: {
    ...theme.typography.screenTitle,
    color: '#12322D',
    fontSize: 32,
    lineHeight: 39,
  },
});
