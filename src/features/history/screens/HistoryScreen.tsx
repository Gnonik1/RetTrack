import { useMemo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

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
      <View style={styles.markerIconTile}>
        <View
          style={[
            styles.markerBagHandle,
            isReturned
              ? styles.returnedMarkerBagStroke
              : styles.keptMarkerBagStroke,
          ]}
        />
        <View
          style={[
            styles.markerBagBody,
            isReturned
              ? styles.returnedMarkerBagBody
              : styles.keptMarkerBagBody,
          ]}
        >
          <View
            style={[
              styles.markerBagFold,
              isReturned
                ? styles.returnedMarkerBagFold
                : styles.keptMarkerBagFold,
            ]}
          />
        </View>
      </View>
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

// Shown while the purchases store has not yet hydrated for the CURRENT scope, so
// an unhydrated `purchases: []` is never mistaken for a genuinely empty archive.
// Mirrors the month-group geometry below (label, then 82pt rows with a 42pt
// marker) so the layout does not shift when real content replaces it. Static by
// design — no shimmer, no spinner — matching the calm treatment the paywall and
// Manage Pro screens already use for their plan skeletons.
function HistoryLoadingPlaceholder() {
  return (
    <View accessibilityElementsHidden style={styles.placeholderTimeline}>
      <View style={styles.placeholderMonthLabel} />

      <View style={styles.placeholderMonthItems}>
        {[0, 1, 2].map((rowKey) => (
          <View key={rowKey} style={styles.placeholderCard}>
            <View style={styles.placeholderMarker} />

            <View style={styles.placeholderCopy}>
              <View style={styles.placeholderLineWide} />
              <View style={styles.placeholderLineNarrow} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export function HistoryScreen() {
  const router = useRouter();
  const { isPurchasesScopeReady, purchases } = usePurchases();
  const historyGroups = useMemo(() => getHistoryGroups(purchases), [purchases]);

  return (
    <AppScreen stableTopInset style={styles.screen}>
      <LinearGradient
        colors={['#FBFAF3', '#F4F7EF', '#FFF8EC']}
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

        {!isPurchasesScopeReady ? (
          <HistoryLoadingPlaceholder />
        ) : historyGroups.length === 0 ? (
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
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  completedText: {
    ...theme.typography.meta,
    fontSize: 12,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 17,
    marginTop: 6,
  },
  backgroundArchiveWash: {
    backgroundColor: 'rgba(230, 238, 222, 0.42)',
    borderRadius: 340,
    height: 500,
    left: -330,
    position: 'absolute',
    top: 126,
    transform: [{ rotate: '-10deg' }],
    width: 860,
  },
  backgroundBase: {
    ...StyleSheet.absoluteFillObject,
    bottom: -48,
    left: -theme.spacing.md,
    right: -theme.spacing.md,
    top: -48,
  },
  backgroundLowerSageVeil: {
    backgroundColor: 'rgba(226, 234, 217, 0.13)',
    borderRadius: 420,
    bottom: -155,
    height: 520,
    position: 'absolute',
    right: -370,
    transform: [{ rotate: '-6deg' }],
    width: 820,
  },
  backgroundLowerWarmGlow: {
    backgroundColor: 'rgba(239, 219, 184, 0.3)',
    borderRadius: 380,
    height: 500,
    left: -410,
    position: 'absolute',
    top: 230,
    transform: [{ rotate: '-7deg' }],
    width: 860,
  },
  backgroundPaperVeil: {
    backgroundColor: 'rgba(255, 253, 248, 0.34)',
    borderRadius: 320,
    height: 480,
    left: -260,
    position: 'absolute',
    top: 248,
    transform: [{ rotate: '-7deg' }],
    width: 820,
  },
  backgroundTopSageGlow: {
    backgroundColor: 'rgba(218, 232, 209, 0.32)',
    borderRadius: 420,
    height: 560,
    position: 'absolute',
    right: -360,
    top: -255,
    width: 780,
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
    opacity: theme.press.pressedOpacity,
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
  keptMarkerBagBody: {
    backgroundColor: '#FFF9EE',
    borderColor: '#8C6A2F',
  },
  keptMarkerBagFold: {
    backgroundColor: '#E8DDC4',
  },
  keptMarkerBagStroke: {
    borderColor: '#8C6A2F',
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
  markerBagBody: {
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1.2,
    height: 18,
    justifyContent: 'center',
    marginTop: -1,
    overflow: 'hidden',
    width: 22,
  },
  markerBagFold: {
    borderRadius: theme.radius.pill,
    height: 1.4,
    opacity: 0.86,
    position: 'absolute',
    top: 5,
    width: 10,
  },
  markerBagHandle: {
    borderBottomWidth: 0,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderWidth: 1.2,
    height: 8,
    opacity: 0.78,
    width: 13,
    zIndex: 1,
  },
  markerIconTile: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 253, 248, 0.58)',
    borderColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 13,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  monthGroup: {
    gap: 10,
  },
  monthItems: {
    gap: 12,
  },
  monthLabel: {
    ...theme.typography.capsMeta,
    color: '#596654',
    letterSpacing: 1.2,
    lineHeight: 15,
    marginLeft: 2,
  },
  placeholderCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 82,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  placeholderCopy: {
    flex: 1,
    gap: theme.spacing.sm,
    minWidth: 0,
  },
  placeholderLineNarrow: {
    backgroundColor: theme.colors.sage,
    borderRadius: theme.radius.sm,
    height: 10,
    width: '42%',
  },
  placeholderLineWide: {
    backgroundColor: theme.colors.sage,
    borderRadius: theme.radius.sm,
    height: 12,
    width: '68%',
  },
  placeholderMarker: {
    backgroundColor: theme.colors.sage,
    borderRadius: theme.radius.lg,
    height: 42,
    width: 42,
  },
  placeholderMonthItems: {
    gap: 12,
  },
  placeholderMonthLabel: {
    backgroundColor: theme.colors.sage,
    borderRadius: theme.radius.sm,
    height: 11,
    marginLeft: 2,
    width: 96,
  },
  placeholderTimeline: {
    gap: 10,
    marginTop: 26,
  },
  returnedMarker: {
    backgroundColor: '#EEF4EA',
    borderColor: '#D8E5CF',
  },
  returnedMarkerBagBody: {
    backgroundColor: '#F6FAF2',
    borderColor: theme.colors.greenDark,
  },
  returnedMarkerBagFold: {
    backgroundColor: '#D8E5CF',
  },
  returnedMarkerBagStroke: {
    borderColor: theme.colors.greenDark,
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
    ...theme.typography.chipText,
    lineHeight: 15,
  },
  statusPill: {
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flexShrink: 0,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  storeName: {
    ...theme.typography.meta,
    color: '#7D8278',
    lineHeight: 18,
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
