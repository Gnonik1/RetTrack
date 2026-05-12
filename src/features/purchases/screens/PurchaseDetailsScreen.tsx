import { useEffect, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { AppScreen } from '../../../components/AppScreen';
import { AppText } from '../../../components/AppText';
import { theme } from '../../../constants/theme';
import {
  type MockPurchase,
  purchaseStatusLabels,
  type PurchaseStatus,
} from '../data/mockPurchases';
import { usePurchases } from '../state/PurchasesState';
import { formatCompactDate, getFullReturnDate } from '../utils/purchaseDates';

type PurchaseDetailsScreenProps = {
  itemId?: string | string[];
  onBack?: () => void;
  onEdit?: (itemId: string) => void;
};

function BackChevron() {
  return <View style={styles.backChevron} accessibilityElementsHidden />;
}

function DetailsBackground() {
  return (
    <>
      <LinearGradient
        colors={['#FBFAF3', '#F4F7EF', '#FFF8EC']}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
        start={{ x: 0, y: 0 }}
        style={styles.backgroundBase}
      />
      <View pointerEvents="none" style={styles.backgroundSageGlow} />
      <View pointerEvents="none" style={styles.backgroundPaperWash} />
      <View pointerEvents="none" style={styles.backgroundWarmVeil} />
      <View pointerEvents="none" style={styles.backgroundLowerSageWash} />
    </>
  );
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

function getResolvedStatusText(purchase: MockPurchase) {
  if (purchase.status !== 'returned' && purchase.status !== 'kept') {
    return null;
  }

  const statusLabel = purchase.status === 'returned' ? 'Returned' : 'Kept';
  const resolvedDate = getResolvedDateFromValue(purchase.resolvedAt);

  if (resolvedDate) {
    return `${statusLabel} on ${formatCompactDate(resolvedDate)}`;
  }

  return purchase.completedText ?? statusLabel;
}

function getUniquePhotoUris(photoUris?: string[]) {
  const seenPhotoUris = new Set<string>();

  return (photoUris ?? [])
    .map((photoUri) => photoUri.trim())
    .filter((photoUri) => {
      if (!photoUri || seenPhotoUris.has(photoUri)) {
        return false;
      }

      seenPhotoUris.add(photoUri);
      return true;
    });
}

function isLocalPreviewUri(photoUri: string) {
  return photoUri.startsWith('file:') || photoUri.startsWith('content:');
}

export function PurchaseDetailsScreen({
  itemId,
  onBack,
  onEdit,
}: PurchaseDetailsScreenProps) {
  const { deletePurchase, findPurchaseById, resolvePurchase } = usePurchases();
  const { width: windowWidth } = useWindowDimensions();
  const previewListRef = useRef<FlatList<string>>(null);
  const isPhotoPreviewVisibleRef = useRef(false);
  const [isPhotoPreviewVisible, setIsPhotoPreviewVisible] = useState(false);
  const [previewPhotoIndex, setPreviewPhotoIndex] = useState<number | null>(
    null,
  );
  const [loadedPreviewPhotoUris, setLoadedPreviewPhotoUris] = useState<
    string[]
  >([]);
  const purchaseDetails = findPurchaseById(itemId);
  const photoUris = getUniquePhotoUris(purchaseDetails?.photoUris);
  const previewPhotoPosition =
    previewPhotoIndex === null ? 1 : previewPhotoIndex + 1;
  const photoUriKey = photoUris.join('|');
  const markPreviewPhotoLoaded = (photoUri: string) => {
    setLoadedPreviewPhotoUris((currentPhotoUris) =>
      currentPhotoUris.includes(photoUri)
        ? currentPhotoUris
        : [...currentPhotoUris, photoUri],
    );
  };
  const warmPreviewPhoto = (photoUri?: string) => {
    if (!photoUri || isLocalPreviewUri(photoUri)) {
      return;
    }

    Image.prefetch(photoUri).catch(() => undefined);
  };
  const openPhotoPreview = (photoIndex: number) => {
    isPhotoPreviewVisibleRef.current = true;
    setPreviewPhotoIndex(
      Math.min(Math.max(photoIndex, 0), photoUris.length - 1),
    );
    setIsPhotoPreviewVisible(true);
  };
  const closePhotoPreview = () => {
    isPhotoPreviewVisibleRef.current = false;
    setIsPhotoPreviewVisible(false);
    setPreviewPhotoIndex(null);
  };
  const handlePreviewScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    if (!isPhotoPreviewVisibleRef.current || !photoUris.length) {
      return;
    }

    const pageWidth = event.nativeEvent.layoutMeasurement.width || windowWidth;
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);

    setPreviewPhotoIndex(
      Math.min(Math.max(nextIndex, 0), photoUris.length - 1),
    );
  };

  useEffect(() => {
    let isMounted = true;
    const localPhotoUris = photoUris.filter(isLocalPreviewUri);

    if (localPhotoUris.length) {
      setLoadedPreviewPhotoUris((currentPhotoUris) => [
        ...currentPhotoUris,
        ...localPhotoUris.filter(
          (photoUri) => !currentPhotoUris.includes(photoUri),
        ),
      ]);
    }

    photoUris.forEach((photoUri) => {
      Image.prefetch(photoUri)
        .then(() => {
          if (isMounted) {
            markPreviewPhotoLoaded(photoUri);
          }
        })
        .catch(() => undefined);
    });

    return () => {
      isMounted = false;
    };
  }, [photoUriKey]);

  useEffect(() => {
    if (!isPhotoPreviewVisible || previewPhotoIndex === null) {
      return;
    }

    requestAnimationFrame(() => {
      previewListRef.current?.scrollToIndex({
        animated: false,
        index: previewPhotoIndex,
      });
    });
  }, [isPhotoPreviewVisible, previewPhotoIndex, windowWidth]);

  if (!purchaseDetails) {
    return (
      <AppScreen style={styles.screen}>
        <DetailsBackground />

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

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.notFoundCard}>
          <AppText style={styles.notFoundTitle} variant="body">
            Purchase not found
          </AppText>
          <AppText style={styles.notFoundBody} variant="caption">
            This item may have already been removed from RetTrack.
          </AppText>
          <Pressable
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [
              styles.notFoundAction,
              pressed && styles.controlPressed,
            ]}
          >
            <AppText style={styles.notFoundActionText} variant="button">
              Back to purchases
            </AppText>
          </Pressable>
        </View>
      </AppScreen>
    );
  }

  const storeMetaLine = purchaseDetails.productDomain
    ? `${purchaseDetails.store} · ${purchaseDetails.productDomain}`
    : purchaseDetails.store;
  const resolvedStatusText = getResolvedStatusText(purchaseDetails);
  const infoItems = [
    {
      label: 'Price',
      value: purchaseDetails.price ?? 'Not added',
    },
    resolvedStatusText
      ? {
          label: 'Decision',
          value: resolvedStatusText,
        }
      : {
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
  const hasComment = Boolean(purchaseDetails.comment?.trim().length);
  const handleDeletePurchase = () => {
    Alert.alert('Delete purchase?', 'This will remove this item from RetTrack.', [
      {
        style: 'cancel',
        text: 'Cancel',
      },
      {
        onPress: () => {
          const didDeletePurchase = deletePurchase(purchaseDetails.id);

          if (didDeletePurchase) {
            onBack?.();
          }
        },
        style: 'destructive',
        text: 'Delete',
      },
    ]);
  };

  return (
    <AppScreen style={styles.screen}>
      <DetailsBackground />

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
        <View style={styles.productDetail}>
          <View style={styles.photoHeroSurface}>
            <View style={styles.photoPlaceholder}>
              {photoUris.length === 1 ? (
                <Pressable
                  accessibilityLabel="Open photo preview"
                  accessibilityRole="button"
                  onPressIn={() => warmPreviewPhoto(photoUris[0])}
                  onPress={() => openPhotoPreview(0)}
                  style={({ pressed }) => [
                    styles.photoPressable,
                    pressed && styles.controlPressed,
                  ]}
                >
                  <Image
                    resizeMode="cover"
                    source={{ uri: photoUris[0] }}
                    style={styles.photoImage}
                  />
                </Pressable>
              ) : photoUris.length > 1 ? (
                <>
                  <View style={styles.photoCountBadge}>
                    <AppText style={styles.photoCountBadgeText} variant="caption">
                      {photoUris.length} photos
                    </AppText>
                  </View>

                  <View style={styles.photoStrip}>
                    {photoUris.map((photoUri, index) => (
                      <Pressable
                        accessibilityLabel={`Open photo ${index + 1} of ${photoUris.length}`}
                        accessibilityRole="button"
                        key={`${photoUri}-${index}`}
                        onPressIn={() => warmPreviewPhoto(photoUri)}
                        onPress={() => openPhotoPreview(index)}
                        style={({ pressed }) => [
                          styles.photoStripItem,
                          pressed && styles.controlPressed,
                        ]}
                      >
                        <Image
                          resizeMode="cover"
                          source={{ uri: photoUri }}
                          style={styles.photoStripImage}
                        />
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <DetailsProductIcon />
                  <AppText style={styles.photoPlaceholderText} variant="caption">
                    No photo yet
                  </AppText>
                </>
              )}
            </View>
          </View>

          <View style={styles.detailsSheet}>
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
        </View>

        <View style={styles.bottomActions}>
          {canResolveItem ? (
            <View style={styles.resolveActions}>
              <AppButton
                onPress={() => resolvePurchase(purchaseDetails.id, 'kept')}
                style={[styles.actionButton, styles.keepActionButton]}
                title="Keep"
                variant="secondary"
              />
              <AppButton
                onPress={() => resolvePurchase(purchaseDetails.id, 'returned')}
                style={[styles.actionButton, styles.returnedActionButton]}
                title="Returned"
                variant="primary"
              />
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={handleDeletePurchase}
            style={({ pressed }) => [
              styles.deleteAction,
              pressed && styles.deleteActionPressed,
            ]}
          >
            <AppText style={styles.deleteActionText} variant="button">
              Delete purchase
            </AppText>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={closePhotoPreview}
        transparent
        visible={isPhotoPreviewVisible && photoUris.length > 0}
      >
        <View style={styles.photoPreviewOverlay}>
          <View style={styles.photoPreviewHeader}>
            <Pressable
              accessibilityRole="button"
              onPress={(event) => {
                event.stopPropagation();
                closePhotoPreview();
              }}
              style={({ pressed }) => [
                styles.photoPreviewClose,
                pressed && styles.controlPressed,
              ]}
            >
              <AppText style={styles.photoPreviewCloseText} variant="button">
                Close
              </AppText>
            </Pressable>

            <AppText style={styles.photoPreviewCount} variant="caption">
              {previewPhotoPosition} of {photoUris.length}
            </AppText>
          </View>

          <FlatList
            data={photoUris}
            getItemLayout={(_, index) => ({
              index,
              length: windowWidth,
              offset: windowWidth * index,
            })}
            horizontal
            initialScrollIndex={previewPhotoIndex ?? 0}
            keyExtractor={(photoUri, index) => `${photoUri}-${index}`}
            onMomentumScrollEnd={handlePreviewScrollEnd}
            onScrollToIndexFailed={({ index }) => {
              requestAnimationFrame(() => {
                previewListRef.current?.scrollToOffset({
                  animated: false,
                  offset: windowWidth * index,
                });
              });
            }}
            pagingEnabled
            ref={previewListRef}
            renderItem={({ item }) => {
              const hasLoadedPhoto = loadedPreviewPhotoUris.includes(item);

              return (
                <View style={[styles.photoPreviewPage, { width: windowWidth }]}>
                  {!hasLoadedPhoto ? (
                    <View style={styles.photoPreviewLoading}>
                      <ActivityIndicator color="#FAFBF5" />
                    </View>
                  ) : null}
                  <Image
                    onError={() => markPreviewPhotoLoaded(item)}
                    onLoadEnd={() => markPreviewPhotoLoaded(item)}
                    resizeMode="contain"
                    source={{ uri: item }}
                    style={styles.photoPreviewImage}
                  />
                </View>
              );
            }}
            showsHorizontalScrollIndicator={false}
          />

          {photoUris.length > 1 ? (
            <View style={styles.photoPreviewDots}>
              {photoUris.map((photoUri, index) => (
                <View
                  key={`${photoUri}-${index}`}
                  style={[
                    styles.photoPreviewDot,
                    index === previewPhotoIndex && styles.photoPreviewDotActive,
                  ]}
                />
              ))}
            </View>
          ) : null}
        </View>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#FBFAF3',
    paddingBottom: 0,
    paddingTop: theme.spacing.md,
    position: 'relative',
  },
  backgroundBase: {
    ...StyleSheet.absoluteFillObject,
    bottom: -48,
    left: -theme.spacing.md,
    right: -theme.spacing.md,
    top: -48,
  },
  backgroundLowerSageWash: {
    backgroundColor: 'rgba(226, 234, 217, 0.22)',
    borderRadius: 360,
    bottom: -100,
    height: 440,
    position: 'absolute',
    right: -350,
    transform: [{ rotate: '-8deg' }],
    width: 780,
  },
  backgroundPaperWash: {
    backgroundColor: 'rgba(255, 253, 248, 0.62)',
    borderRadius: 260,
    height: 430,
    left: -260,
    position: 'absolute',
    top: 172,
    transform: [{ rotate: '-14deg' }],
    width: 760,
  },
  backgroundSageGlow: {
    backgroundColor: 'rgba(216, 231, 207, 0.42)',
    borderRadius: 350,
    height: 620,
    position: 'absolute',
    right: -430,
    top: -310,
    width: 760,
  },
  backgroundWarmVeil: {
    backgroundColor: 'rgba(242, 226, 198, 0.22)',
    borderRadius: 360,
    bottom: -180,
    height: 560,
    left: -450,
    position: 'absolute',
    transform: [{ rotate: '-7deg' }],
    width: 820,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
    position: 'relative',
    zIndex: 1,
  },
  headerTitle: {
    color: '#172118',
    flex: 1,
    fontSize: 16,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 22,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: '#FFFDF8',
    borderColor: 'rgba(92, 111, 82, 0.16)',
    borderRadius: 20,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 10,
      width: 0,
    },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    width: 44,
    elevation: 2,
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
    gap: 12,
    marginTop: 22,
    paddingBottom: theme.spacing.sm,
    paddingTop: 0,
    position: 'relative',
  },
  resolveActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    borderRadius: 24,
    flex: 1,
    minHeight: 54,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 10,
      width: 0,
    },
    shadowOpacity: 0.055,
    shadowRadius: 16,
    elevation: 2,
  },
  content: {
    paddingBottom: theme.spacing.md,
    paddingTop: 18,
  },
  controlPressed: {
    opacity: 0.78,
  },
  deleteAction: {
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
    marginTop: 1,
    minHeight: 40,
    paddingHorizontal: theme.spacing.lg,
  },
  deleteActionPressed: {
    opacity: 0.72,
  },
  deleteActionText: {
    color: '#A65B52',
    fontSize: 13,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 18,
  },
  detailsSheet: {
    backgroundColor: 'rgba(255, 253, 248, 0.96)',
    borderColor: 'rgba(92, 111, 82, 0.14)',
    borderRadius: 28,
    borderWidth: 1,
    marginTop: 12,
    paddingBottom: 18,
    paddingHorizontal: 18,
    paddingTop: 18,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 12,
      width: 0,
    },
    shadowOpacity: 0.045,
    shadowRadius: 22,
    elevation: 2,
  },
  editButton: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: theme.spacing.sm,
    width: 54,
  },
  editText: {
    color: theme.colors.greenDark,
    fontSize: 14,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 18,
  },
  photoPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#EEF4EA',
    borderColor: '#DCE8D4',
    borderRadius: 30,
    borderWidth: 1,
    gap: 10,
    height: 252,
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 8,
      width: 0,
    },
    shadowOpacity: 0.025,
    shadowRadius: 14,
  },
  photoImage: {
    height: '100%',
    width: '100%',
  },
  photoPressable: {
    height: '100%',
    width: '100%',
  },
  photoPlaceholderText: {
    color: '#7A846F',
    fontSize: 12,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 16,
  },
  photoCountBadge: {
    backgroundColor: 'rgba(255, 253, 248, 0.94)',
    borderColor: 'rgba(63, 81, 58, 0.12)',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    position: 'absolute',
    right: 12,
    top: 12,
    zIndex: 2,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 5,
      width: 0,
    },
    shadowOpacity: 0.045,
    shadowRadius: 10,
  },
  photoCountBadgeText: {
    color: theme.colors.greenDark,
    fontSize: 11,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 14,
  },
  photoPreviewClose: {
    alignItems: 'center',
    backgroundColor: 'rgba(250, 251, 245, 0.92)',
    borderRadius: theme.radius.pill,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: theme.spacing.md,
  },
  photoPreviewCloseText: {
    color: theme.colors.greenDark,
    fontSize: 14,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 18,
  },
  photoPreviewCount: {
    color: '#FAFBF5',
    fontSize: 13,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 18,
  },
  photoPreviewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: theme.spacing.lg,
    position: 'absolute',
    right: theme.spacing.lg,
    top: 58,
    zIndex: 2,
  },
  photoPreviewImage: {
    height: '100%',
    width: '100%',
  },
  photoPreviewDot: {
    backgroundColor: 'rgba(250, 251, 245, 0.34)',
    borderRadius: theme.radius.pill,
    height: 6,
    width: 6,
  },
  photoPreviewDotActive: {
    backgroundColor: '#FAFBF5',
    width: 18,
  },
  photoPreviewDots: {
    alignSelf: 'center',
    bottom: 34,
    flexDirection: 'row',
    gap: 7,
    position: 'absolute',
  },
  photoPreviewLoading: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  photoPreviewOverlay: {
    backgroundColor: 'rgba(24, 31, 24, 0.94)',
    flex: 1,
    justifyContent: 'center',
  },
  photoPreviewPage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoStrip: {
    alignSelf: 'stretch',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    padding: 8,
  },
  photoStripItem: {
    borderRadius: 22,
    flex: 1,
    overflow: 'hidden',
  },
  photoStripImage: {
    borderRadius: 22,
    height: 236,
    width: '100%',
  },
  photoHeroSurface: {
    backgroundColor: '#FFFDF8',
    borderColor: 'rgba(92, 111, 82, 0.14)',
    borderRadius: 34,
    borderWidth: 1,
    padding: 9,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 18,
      width: 0,
    },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 3,
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
    marginTop: 0,
  },
  itemTitle: {
    color: '#161816',
    fontSize: 30,
    fontWeight: theme.fontWeight.bold,
    lineHeight: 36,
  },
  metaLine: {
    color: '#747A70',
    fontSize: 14,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 19,
    marginTop: 4,
  },
  notFoundAction: {
    alignItems: 'center',
    backgroundColor: theme.colors.green,
    borderRadius: theme.radius.pill,
    justifyContent: 'center',
    marginTop: theme.spacing.lg,
    minHeight: 44,
    paddingHorizontal: theme.spacing.lg,
  },
  notFoundActionText: {
    color: theme.colors.card,
    fontSize: 14,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 18,
  },
  notFoundBody: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'center',
  },
  notFoundCard: {
    alignItems: 'center',
    backgroundColor: '#FFFDF8',
    borderColor: 'rgba(92, 111, 82, 0.16)',
    borderRadius: 28,
    borderWidth: 1,
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    position: 'relative',
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 16,
      width: 0,
    },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    zIndex: 1,
    elevation: 3,
  },
  notFoundTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 23,
    textAlign: 'center',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  infoCell: {
    backgroundColor: 'rgba(250, 251, 245, 0.62)',
    borderColor: 'rgba(92, 111, 82, 0.11)',
    borderRadius: 18,
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
    letterSpacing: 0.5,
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
    backgroundColor: '#EEF4EA',
    borderColor: '#DCE8D4',
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
    backgroundColor: '#F8EFE0',
    borderColor: '#EADBBE',
  },
  greenStatusPillText: {
    color: theme.colors.greenDark,
  },
  pendingStatusPillText: {
    color: theme.colors.pending,
  },
  keptStatusPillText: {
    color: '#7B6237',
  },
  commentBlock: {
    backgroundColor: 'rgba(250, 251, 245, 0.62)',
    borderColor: 'rgba(92, 111, 82, 0.11)',
    borderRadius: 18,
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
    position: 'relative',
    zIndex: 1,
  },
  productDetail: {
    position: 'relative',
  },
  keepActionButton: {
    backgroundColor: '#F0F2EA',
    borderColor: 'rgba(92, 111, 82, 0.14)',
  },
  returnedActionButton: {
    backgroundColor: '#536A4E',
    borderColor: '#536A4E',
  },
});
