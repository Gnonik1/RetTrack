import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { AppScreen } from '../../../components/AppScreen';
import { AppText } from '../../../components/AppText';
import { theme } from '../../../constants/theme';
import {
  purchaseStatusLabels,
  type PurchaseStatus,
} from '../data/mockPurchases';
import { usePurchases } from '../state/PurchasesState';
import { getFullReturnDate } from '../utils/purchaseDates';

type PurchaseDetailsScreenProps = {
  itemId?: string | string[];
  onBack?: () => void;
  onEdit?: (itemId: string) => void;
};

function BackChevron() {
  return <View style={styles.backChevron} accessibilityElementsHidden />;
}

function DetailsProductIcon() {
  return (
    <View style={styles.productIconShell} accessibilityElementsHidden>
      <View style={styles.bagHandle} />
      <View style={styles.bagBody}>
        <View style={styles.bagFold} />
      </View>
    </View>
  );
}

function getStatusPillStyle(status: PurchaseStatus) {
  if (status === 'pending') {
    return styles.pendingStatusPill;
  }

  if (status === 'returned') {
    return styles.returnedStatusPill;
  }

  if (status === 'kept') {
    return styles.keptStatusPill;
  }

  return styles.activeStatusPill;
}

function getStatusPillTextStyle(status: PurchaseStatus) {
  if (status === 'pending') {
    return styles.pendingStatusPillText;
  }

  if (status === 'kept') {
    return styles.keptStatusPillText;
  }

  return styles.greenStatusPillText;
}

function getConfirmationStyle(status: PurchaseStatus) {
  if (status === 'kept') {
    return styles.keptConfirmation;
  }

  return styles.returnedConfirmation;
}

function getConfirmationTextStyle(status: PurchaseStatus) {
  if (status === 'kept') {
    return styles.keptConfirmationText;
  }

  return styles.returnedConfirmationText;
}

export function PurchaseDetailsScreen({
  itemId,
  onBack,
  onEdit,
}: PurchaseDetailsScreenProps) {
  const { getPurchaseById, resolvePurchase } = usePurchases();
  const purchaseDetails = getPurchaseById(itemId);
  const storeMetaLine = purchaseDetails.productDomain
    ? `${purchaseDetails.store} · ${purchaseDetails.productDomain}`
    : purchaseDetails.store;
  const infoItems = [
    {
      label: 'Price',
      value: purchaseDetails.price ?? 'Not added',
    },
    {
      label: 'Return by',
      value: getFullReturnDate(purchaseDetails),
    },
    {
      label: 'Purchased',
      value: purchaseDetails.purchased ?? 'Not added',
    },
    {
      label: 'Status',
      value: purchaseStatusLabels[purchaseDetails.status],
    },
  ] as const;
  const canResolveItem =
    purchaseDetails.status === 'active' || purchaseDetails.status === 'pending';
  const showCompletionStatus = Boolean(
    (purchaseDetails.status === 'returned' || purchaseDetails.status === 'kept') &&
      purchaseDetails.completedText,
  );
  const hasComment = Boolean(purchaseDetails.comment?.trim().length);

  return (
    <AppScreen style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.controlPressed,
          ]}
        >
          <BackChevron />
        </Pressable>

        <AppText style={styles.headerTitle} variant="body">
          Purchase details
        </AppText>

        <Pressable
          accessibilityRole="button"
          onPress={() => onEdit?.(purchaseDetails.id)}
          style={({ pressed }) => [
            styles.editButton,
            pressed && styles.controlPressed,
          ]}
        >
          <AppText style={styles.editText} variant="button">
            Edit
          </AppText>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <View style={styles.detailsCard}>
          <View style={styles.photoPlaceholder}>
            <DetailsProductIcon />
            <AppText style={styles.photoPlaceholderText} variant="caption">
              No photo yet
            </AppText>
          </View>

          <View style={styles.titleBlock}>
            <AppText style={styles.itemTitle} variant="title">
              {purchaseDetails.itemName}
            </AppText>
            <AppText style={styles.metaLine} variant="caption">
              {storeMetaLine}
            </AppText>
          </View>

          <View style={styles.infoGrid}>
            {infoItems.map((infoItem) => {
              const isStatus = infoItem.label === 'Status';

              return (
                <View style={styles.infoCell} key={infoItem.label}>
                  <AppText style={styles.infoLabel} variant="caption">
                    {infoItem.label}
                  </AppText>
                  {isStatus ? (
                    <View
                      style={[
                        styles.statusPill,
                        getStatusPillStyle(purchaseDetails.status),
                      ]}
                    >
                      <AppText
                        style={[
                          styles.statusPillText,
                          getStatusPillTextStyle(purchaseDetails.status),
                        ]}
                        variant="caption"
                      >
                        {infoItem.value}
                      </AppText>
                    </View>
                  ) : (
                    <AppText style={styles.infoValue} variant="body">
                      {infoItem.value}
                    </AppText>
                  )}
                </View>
              );
            })}
          </View>

          {hasComment ? (
            <View style={styles.commentBlock}>
              <AppText style={styles.commentLabel} variant="caption">
                Comment
              </AppText>
              <AppText style={styles.commentText} variant="body">
                {purchaseDetails.comment}
              </AppText>
            </View>
          ) : null}
        </View>

        {showCompletionStatus ? (
          <View style={styles.statusFooter}>
            <View
              style={[
                styles.statusConfirmation,
                getConfirmationStyle(purchaseDetails.status),
              ]}
            >
              <AppText
                style={[
                  styles.statusConfirmationText,
                  getConfirmationTextStyle(purchaseDetails.status),
                ]}
                variant="body"
              >
                {purchaseDetails.completedText}
              </AppText>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {canResolveItem ? (
        <View style={styles.bottomActions}>
          <AppButton
            onPress={() => resolvePurchase(purchaseDetails.id, 'kept')}
            style={styles.actionButton}
            title="Keep Item"
            variant="secondary"
          />
          <AppButton
            onPress={() => resolvePurchase(purchaseDetails.id, 'returned')}
            style={styles.actionButton}
            title="Mark Returned"
            variant="primary"
          />
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingBottom: 0,
    paddingTop: theme.spacing.md,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: theme.colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 22,
    textAlign: 'center',
  },
  backButton: {
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
  backChevron: {
    borderColor: theme.colors.greenDark,
    borderLeftWidth: 2,
    borderTopWidth: 2,
    height: 11,
    marginLeft: 4,
    transform: [{ rotate: '-45deg' }],
    width: 11,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    paddingTop: 8,
  },
  actionButton: {
    borderRadius: theme.radius.pill,
    flex: 1,
    minHeight: 52,
  },
  content: {
    paddingBottom: theme.spacing.md,
    paddingTop: theme.spacing.lg,
  },
  controlPressed: {
    opacity: 0.78,
  },
  detailsCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    padding: 14,
    shadowColor: theme.colors.text,
    shadowOffset: {
      height: 12,
      width: 0,
    },
    shadowOpacity: 0.055,
    shadowRadius: 22,
  },
  editButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: theme.spacing.sm,
    width: 44,
  },
  editText: {
    color: theme.colors.greenDark,
    fontSize: 14,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 18,
  },
  photoPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#E8EEDF',
    borderColor: '#D9E4D1',
    borderRadius: 28,
    borderWidth: 1,
    gap: 10,
    height: 216,
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    color: '#7A846F',
    fontSize: 12,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 16,
  },
  productIconShell: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.74)',
    borderColor: 'rgba(63, 81, 58, 0.13)',
    borderRadius: 28,
    borderWidth: 1,
    height: 88,
    justifyContent: 'center',
    shadowColor: theme.colors.text,
    shadowOffset: {
      height: 8,
      width: 0,
    },
    shadowOpacity: 0.045,
    shadowRadius: 14,
    width: 88,
  },
  bagHandle: {
    borderColor: theme.colors.greenDark,
    borderBottomWidth: 0,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderWidth: 1.8,
    height: 16,
    marginBottom: -4,
    opacity: 0.84,
    width: 30,
    zIndex: 1,
  },
  bagBody: {
    alignItems: 'center',
    backgroundColor: '#FAFBF5',
    borderColor: theme.colors.greenDark,
    borderRadius: 14,
    borderWidth: 1.8,
    height: 42,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: 48,
  },
  bagFold: {
    backgroundColor: '#DDE7D4',
    borderRadius: theme.radius.pill,
    height: 2,
    opacity: 0.9,
    position: 'absolute',
    top: 11,
    width: 25,
  },
  titleBlock: {
    marginTop: theme.spacing.md,
  },
  itemTitle: {
    color: theme.colors.text,
    fontSize: 27,
    fontWeight: theme.fontWeight.bold,
    lineHeight: 33,
  },
  metaLine: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 18,
    marginTop: 4,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: theme.spacing.md,
  },
  infoCell: {
    backgroundColor: theme.colors.paper,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 76,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  infoLabel: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 15,
    textTransform: 'uppercase',
  },
  infoValue: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 22,
    marginTop: 8,
  },
  statusPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 34,
    minWidth: 86,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 17,
    textAlign: 'center',
  },
  activeStatusPill: {
    backgroundColor: theme.colors.sage,
    borderColor: theme.colors.sage,
  },
  pendingStatusPill: {
    backgroundColor: theme.colors.softPending,
    borderColor: '#EBD5D0',
  },
  returnedStatusPill: {
    backgroundColor: '#ECF2E7',
    borderColor: '#D8E4D1',
  },
  keptStatusPill: {
    backgroundColor: '#EEF1DF',
    borderColor: '#DCE4C9',
  },
  greenStatusPillText: {
    color: theme.colors.greenDark,
  },
  pendingStatusPillText: {
    color: theme.colors.pending,
  },
  keptStatusPillText: {
    color: '#536346',
  },
  commentBlock: {
    backgroundColor: theme.colors.paper,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    marginTop: theme.spacing.md,
    padding: 13,
  },
  commentLabel: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 15,
    textTransform: 'uppercase',
  },
  commentText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 21,
    marginTop: 8,
  },
  scroll: {
    flex: 1,
  },
  statusFooter: {
    alignItems: 'center',
    marginTop: 48,
    paddingBottom: theme.spacing.md,
  },
  statusConfirmation: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    maxWidth: '82%',
    minHeight: 44,
    minWidth: 162,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 10,
    shadowColor: theme.colors.text,
    shadowOffset: {
      height: 6,
      width: 0,
    },
    shadowOpacity: 0.035,
    shadowRadius: 12,
  },
  returnedConfirmation: {
    backgroundColor: '#ECF2E7',
    borderColor: '#D8E4D1',
  },
  keptConfirmation: {
    backgroundColor: '#EEF1DF',
    borderColor: '#DCE4C9',
  },
  statusConfirmationText: {
    fontSize: 16,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 22,
    textAlign: 'center',
  },
  returnedConfirmationText: {
    color: theme.colors.greenDark,
  },
  keptConfirmationText: {
    color: '#536346',
  },
});
