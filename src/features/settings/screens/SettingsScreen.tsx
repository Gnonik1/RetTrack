import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { AppBottomNav } from '../../../components/AppBottomNav';
import { AppScreen } from '../../../components/AppScreen';
import { AppText } from '../../../components/AppText';
import { theme } from '../../../constants/theme';
import { useAuth } from '../../../state/AuthState';
import {
  currencyOptions,
  type CurrencyCode,
  useAppSettings,
} from '../state/AppSettingsState';

type SettingsModalKey =
  | 'notifications'
  | 'currency'
  | 'deleteAccount'
  | 'shareError';
type StaticSettingsModalKey = Exclude<SettingsModalKey, 'deleteAccount'>;
type RowTone = 'danger' | 'gold' | 'sage';
type SectionTone = 'account' | 'app' | 'rettrack';

type SettingsModalContent = {
  body: string;
  secondaryBody: string;
  title: string;
};

const SHARE_MESSAGE =
  "I'm using RetTrack to keep track of purchases and return dates.";
const RETTRACK_LOGO_MARK = require('../../../../assets/rettrack-logo-mark.png');

const SETTINGS_MODAL_CONTENT: Record<
  StaticSettingsModalKey,
  SettingsModalContent
> = {
  currency: {
    body: 'Choose the default currency for new purchases.',
    secondaryBody: 'Existing purchases keep their saved currency.',
    title: 'Currency',
  },
  notifications: {
    body: 'Return reminders are scheduled 7 days before, 3 days before, and on the last day.',
    secondaryBody: 'Quiet hours are 9 PM to 9 AM.',
    title: 'Notifications',
  },
  shareError: {
    body: "Sharing isn't available right now.",
    secondaryBody: 'Please try again in a moment.',
    title: 'Share RetTrack',
  },
};

function getDeleteAccountModalContent({
  isAuthenticated,
  isAuthLoading,
}: {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
}): SettingsModalContent {
  if (isAuthLoading) {
    return {
      body: 'Checking account status before showing account deletion options.',
      secondaryBody: 'Please wait a moment and try again.',
      title: 'Delete account',
    };
  }

  if (!isAuthenticated) {
    return {
      body: 'Delete account is not available in guest mode.',
      secondaryBody:
        'Create or sign in to an account before managing account deletion.',
      title: 'Delete account',
    };
  }

  return {
    body: 'Secure account deletion is not available yet.',
    secondaryBody:
      'This will be added before release so signed-in accounts can be removed safely.',
    title: 'Delete account',
  };
}

type SettingsSectionProps = {
  children: ReactNode;
  detail: string;
  icon: ReactNode;
  title: string;
  tone: SectionTone;
};

function SettingsSection({
  children,
  detail,
  icon,
  title,
  tone,
}: SettingsSectionProps) {
  return (
    <View
      style={[
        styles.sectionCard,
        tone === 'app' && styles.sectionCardApp,
        tone === 'rettrack' && styles.sectionCardRetTrack,
        tone === 'account' && styles.sectionCardAccount,
      ]}
    >
      <View
        style={[
          styles.sectionHeader,
          tone === 'app' && styles.sectionHeaderApp,
          tone === 'rettrack' && styles.sectionHeaderRetTrack,
          tone === 'account' && styles.sectionHeaderAccount,
        ]}
      >
        <View
          style={[
            styles.sectionIcon,
            tone === 'app' && styles.sectionIconApp,
            tone === 'rettrack' && styles.sectionIconRetTrack,
            tone === 'account' && styles.sectionIconAccount,
          ]}
        >
          {icon}
        </View>
        <View style={styles.sectionCopy}>
          <AppText style={styles.sectionTitle} variant="body">
            {title}
          </AppText>
          <AppText style={styles.sectionDetail} variant="caption">
            {detail}
          </AppText>
        </View>
      </View>
      <View style={styles.sectionRows}>{children}</View>
    </View>
  );
}

type SettingsRowProps = {
  detail: string;
  destructive?: boolean;
  icon: ReactNode;
  isLast?: boolean;
  onPress: () => void;
  rightValue?: string;
  title: string;
  tone?: RowTone;
};

function SettingsRow({
  destructive = false,
  detail,
  icon,
  isLast = false,
  onPress,
  rightValue,
  title,
  tone = 'sage',
}: SettingsRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !isLast && styles.rowDivider,
        pressed && styles.rowPressed,
      ]}
    >
      <View
        style={[
          styles.rowIcon,
          tone === 'sage' && styles.rowIconSage,
          tone === 'gold' && styles.rowIconGold,
          tone === 'danger' && styles.rowIconDanger,
        ]}
      >
        {icon}
      </View>

      <View style={styles.rowCopy}>
        <AppText
          style={[styles.rowTitle, destructive && styles.destructiveTitle]}
          variant="body"
        >
          {title}
        </AppText>
        <AppText style={styles.rowDetail} variant="caption">
          {detail}
        </AppText>
      </View>

      <View style={styles.rowRight}>
        {rightValue ? (
          <AppText style={styles.rowValue} variant="caption">
            {rightValue}
          </AppText>
        ) : null}
        <SettingsRowChevron destructive={destructive} />
      </View>
    </Pressable>
  );
}

function SettingsRowChevron({ destructive }: { destructive: boolean }) {
  return (
    <View
      accessibilityElementsHidden
      style={[styles.rowChevron, destructive && styles.destructiveRowChevron]}
    />
  );
}

function AppSectionIcon() {
  return (
    <View accessibilityElementsHidden style={styles.slidersIcon}>
      <View style={[styles.sliderTrack, styles.sliderTrackTop]} />
      <View style={[styles.sliderTrack, styles.sliderTrackMiddle]} />
      <View style={[styles.sliderTrack, styles.sliderTrackBottom]} />
      <View style={[styles.sliderDot, styles.sliderDotTop]} />
      <View style={[styles.sliderDot, styles.sliderDotMiddle]} />
      <View style={[styles.sliderDot, styles.sliderDotBottom]} />
    </View>
  );
}

function BellIcon() {
  return (
    <View accessibilityElementsHidden style={styles.bellIcon}>
      <View style={styles.bellTop} />
      <View style={styles.bellBody} />
      <View style={styles.bellBase} />
      <View style={styles.bellClapper} />
    </View>
  );
}

function CurrencyIcon() {
  return (
    <View accessibilityElementsHidden style={styles.currencyIcon}>
      <AppText style={styles.currencyIconText} variant="caption">
        $
      </AppText>
    </View>
  );
}

function ShareIcon() {
  return (
    <View accessibilityElementsHidden style={styles.shareIcon}>
      <View style={styles.shareStem} />
      <View style={[styles.shareHead, styles.shareHeadLeft]} />
      <View style={[styles.shareHead, styles.shareHeadRight]} />
      <View style={styles.shareTray} />
    </View>
  );
}

function RetTrackSectionIcon() {
  return (
    <View accessibilityElementsHidden style={styles.giftIcon}>
      <View style={styles.giftBowWrap}>
        <View style={[styles.giftBow, styles.giftBowLeft]} />
        <View style={[styles.giftBow, styles.giftBowRight]} />
      </View>
      <View style={styles.giftLid} />
      <View style={styles.giftBox}>
        <View style={styles.giftRibbonVertical} />
        <View style={styles.giftRibbonHorizontal} />
      </View>
    </View>
  );
}

function AccountSectionIcon() {
  return (
    <View accessibilityElementsHidden style={styles.accountIcon}>
      <View style={styles.accountHead} />
      <View style={styles.accountBody} />
    </View>
  );
}

function TrashIcon() {
  return (
    <View accessibilityElementsHidden style={styles.trashIcon}>
      <View style={styles.trashHandle} />
      <View style={styles.trashLid} />
      <View style={styles.trashCan}>
        <View style={styles.trashLine} />
        <View style={styles.trashLine} />
      </View>
    </View>
  );
}

function FooterMark() {
  return (
    <Image
      accessibilityIgnoresInvertColors
      source={RETTRACK_LOGO_MARK}
      style={styles.footerLogo}
    />
  );
}

export function SettingsScreen() {
  const { defaultCurrency, setDefaultCurrency } = useAppSettings();
  const { isAuthenticated, isAuthLoading } = useAuth();
  const [activeModal, setActiveModal] = useState<SettingsModalKey | null>(null);
  const modalContent =
    activeModal === 'deleteAccount'
      ? getDeleteAccountModalContent({ isAuthenticated, isAuthLoading })
      : activeModal
        ? SETTINGS_MODAL_CONTENT[activeModal]
        : null;
  const isCurrencyModal = activeModal === 'currency';
  const isDeleteModal = activeModal === 'deleteAccount';
  const deleteAccountDetail = isAuthLoading
    ? 'Checking account status'
    : isAuthenticated
      ? 'Not available yet'
      : 'Not available in guest mode';
  const accountSectionDetail = isAuthenticated
    ? 'Signed-in account controls.'
    : 'Account controls require sign-in.';

  const closeModal = () => {
    setActiveModal(null);
  };

  const handleCurrencySelect = (currency: CurrencyCode) => {
    setDefaultCurrency(currency);
  };

  const handleShareRetTrack = async () => {
    try {
      await Share.share({
        message: SHARE_MESSAGE,
      });
    } catch {
      setActiveModal('shareError');
    }
  };

  return (
    <AppScreen style={styles.screen}>
      <LinearGradient
        colors={['#FBFAF3', '#F1F5EC', '#FFF8EC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.backgroundBase}
      />
      <View pointerEvents="none" style={styles.backgroundSageGlow} />
      <View pointerEvents="none" style={styles.backgroundWarmGlow} />
      <View pointerEvents="none" style={styles.backgroundPaperWash} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <View style={styles.header}>
          <AppText style={styles.title} variant="title">
            Settings
          </AppText>
          <AppText style={styles.subtitle} variant="subtitle">
            Manage your RetTrack preferences.
          </AppText>
        </View>

        <View style={styles.sections}>
          <SettingsSection
            detail="Customize how RetTrack works for you."
            icon={<AppSectionIcon />}
            title="App"
            tone="app"
          >
            <SettingsRow
              detail="Reminder timing and quiet hours"
              icon={<BellIcon />}
              onPress={() => setActiveModal('notifications')}
              title="Notifications"
              tone="sage"
            />
            <SettingsRow
              detail="Default for new purchases"
              icon={<CurrencyIcon />}
              isLast
              onPress={() => setActiveModal('currency')}
              rightValue={defaultCurrency}
              title="Default currency"
              tone="sage"
            />
          </SettingsSection>

          <SettingsSection
            detail="Share the app with friends."
            icon={<RetTrackSectionIcon />}
            title="RetTrack"
            tone="rettrack"
          >
            <SettingsRow
              detail="Invite someone to RetTrack"
              icon={<ShareIcon />}
              isLast
              onPress={handleShareRetTrack}
              title="Share RetTrack"
              tone="gold"
            />
          </SettingsSection>

          <SettingsSection
            detail={accountSectionDetail}
            icon={<AccountSectionIcon />}
            title="Account"
            tone="account"
          >
            <SettingsRow
              destructive
              detail={deleteAccountDetail}
              icon={<TrashIcon />}
              isLast
              onPress={() => setActiveModal('deleteAccount')}
              title="Delete account"
              tone="danger"
            />
          </SettingsSection>
        </View>

        <View style={styles.appMetadataFooter}>
          <View style={styles.footerWordmarkRow}>
            <FooterMark />
            <AppText style={styles.footerWordmarkText} variant="caption">
              etTrack
            </AppText>
          </View>
          <AppText style={styles.appMetadataText} variant="caption">
            Version 1.0
          </AppText>
        </View>
      </ScrollView>

      <AppBottomNav activeTab="settings" />

      {modalContent ? (
        <View style={styles.sheetOverlay}>
          <Pressable
            accessibilityLabel="Close settings sheet"
            accessibilityRole="button"
            onPress={closeModal}
            style={styles.sheetBackdrop}
          />
          <View
            style={[
              styles.modalCard,
              isCurrencyModal && styles.currencyModalCard,
              isDeleteModal && styles.deleteModalCard,
            ]}
          >
            <View
              style={[
                styles.modalAccent,
                isDeleteModal && styles.modalAccentDanger,
              ]}
            />
            <AppText
              style={[styles.modalTitle, isDeleteModal && styles.destructiveTitle]}
              variant="title"
            >
              {modalContent.title}
            </AppText>
            <AppText
              style={[
                styles.modalBody,
                isCurrencyModal && styles.currencyModalBody,
              ]}
              variant="body"
            >
              {modalContent.body}
            </AppText>
            {isCurrencyModal ? (
              <>
                <View style={styles.currencyOptions}>
                  {currencyOptions.map(({ code, name }) => {
                    const isSelected = code === defaultCurrency;

                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        key={code}
                        onPress={() => handleCurrencySelect(code)}
                        style={({ pressed }) => [
                          styles.currencyOption,
                          isSelected && styles.currencyOptionSelected,
                          pressed && styles.currencyOptionPressed,
                        ]}
                      >
                        <View style={styles.currencyOptionCopy}>
                          <AppText
                            style={[
                              styles.currencyOptionCode,
                              isSelected && styles.currencyOptionCodeSelected,
                            ]}
                            variant="body"
                          >
                            {code}
                          </AppText>
                          <AppText
                            style={styles.currencyOptionName}
                            variant="caption"
                          >
                            {name}
                          </AppText>
                        </View>

                        {isSelected ? (
                          <View style={styles.currencySelectedDot} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>

                <View
                  style={[styles.modalSecondaryBox, styles.currencySecondaryBox]}
                >
                  <AppText style={styles.modalSecondaryBody} variant="caption">
                    {modalContent.secondaryBody}
                  </AppText>
                </View>
                <AppButton
                  onPress={closeModal}
                  style={[styles.modalButton, styles.currencyModalButton]}
                  title="Done"
                />
              </>
            ) : (
              <>
                <View
                  style={[
                    styles.modalSecondaryBox,
                    isDeleteModal && styles.modalSecondaryBoxDanger,
                  ]}
                >
                  <AppText
                    style={[
                      styles.modalSecondaryBody,
                      isDeleteModal && styles.modalSecondaryBodyDanger,
                    ]}
                    variant="caption"
                  >
                    {modalContent.secondaryBody}
                  </AppText>
                </View>
                <AppButton
                  onPress={closeModal}
                  style={styles.modalButton}
                  title="Done"
                />
              </>
            )}
          </View>
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  accountBody: {
    borderColor: '#9F6760',
    borderRadius: 7,
    borderWidth: 2,
    height: 10,
    marginTop: 3,
    width: 20,
  },
  accountHead: {
    borderColor: '#9F6760',
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    height: 9,
    width: 9,
  },
  accountIcon: {
    alignItems: 'center',
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  appMetadata: {
    alignItems: 'center',
  },
  appMetadataFooter: {
    alignItems: 'center',
    gap: 2,
    marginTop: 32,
    paddingBottom: 12,
  },
  appMetadataText: {
    color: '#7E8477',
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
  backgroundBase: {
    ...StyleSheet.absoluteFillObject,
    bottom: -40,
    left: -theme.spacing.md,
    right: -theme.spacing.md,
    top: -40,
  },
  backgroundPaperWash: {
    backgroundColor: 'rgba(255, 252, 243, 0.72)',
    borderRadius: 160,
    height: 320,
    left: -128,
    position: 'absolute',
    top: 94,
    transform: [{ rotate: '-18deg' }],
    width: 460,
  },
  backgroundSageGlow: {
    backgroundColor: 'rgba(218, 231, 207, 0.82)',
    borderRadius: 160,
    height: 250,
    position: 'absolute',
    right: -104,
    top: -62,
    width: 290,
  },
  backgroundWarmGlow: {
    backgroundColor: 'rgba(242, 225, 196, 0.58)',
    borderRadius: 170,
    bottom: 54,
    height: 290,
    left: -118,
    position: 'absolute',
    width: 290,
  },
  bellBase: {
    backgroundColor: theme.colors.greenDark,
    borderRadius: theme.radius.pill,
    height: 3,
    marginTop: -1,
    width: 20,
  },
  bellBody: {
    backgroundColor: theme.colors.green,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    height: 17,
    opacity: 0.96,
    width: 16,
  },
  bellClapper: {
    backgroundColor: theme.colors.amber,
    borderRadius: theme.radius.pill,
    height: 4,
    marginTop: 1,
    width: 4,
  },
  bellIcon: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  bellTop: {
    backgroundColor: theme.colors.green,
    borderRadius: theme.radius.pill,
    height: 4,
    marginBottom: -1,
    width: 8,
  },
  content: {
    paddingBottom: 116,
    paddingTop: theme.spacing.xl,
  },
  currencyIcon: {
    alignItems: 'center',
    borderColor: theme.colors.greenDark,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  currencyIconText: {
    color: theme.colors.greenDark,
    fontSize: 14,
    fontWeight: theme.fontWeight.bold,
    lineHeight: 16,
  },
  currencyModalBody: {
    marginTop: 5,
  },
  currencyModalButton: {
    marginTop: 10,
  },
  currencyModalCard: {
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  currencyOption: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 7,
    position: 'relative',
    width: '48.5%',
  },
  currencyOptionCode: {
    color: theme.colors.greenDark,
    fontSize: 15,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 20,
  },
  currencyOptionCodeSelected: {
    color: theme.colors.greenDark,
    fontWeight: theme.fontWeight.semibold,
  },
  currencyOptionCopy: {
    alignItems: 'center',
    gap: 0,
  },
  currencyOptionName: {
    color: theme.colors.muted,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
  currencyOptionPressed: {
    opacity: 0.82,
  },
  currencyOptionSelected: {
    backgroundColor: theme.colors.sage,
    borderColor: '#D8E3D0',
  },
  currencyOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 12,
  },
  currencySecondaryBox: {
    marginTop: 10,
    paddingVertical: 8,
  },
  currencySelectedDot: {
    backgroundColor: theme.colors.greenDark,
    borderRadius: theme.radius.pill,
    height: 6,
    opacity: 0.76,
    position: 'absolute',
    right: 9,
    top: 9,
    width: 6,
  },
  deleteModalCard: {
    borderColor: '#E6CFC8',
  },
  destructiveRowChevron: {
    borderColor: theme.colors.pending,
    opacity: 0.46,
  },
  destructiveTitle: {
    color: theme.colors.pending,
  },
  footerLogo: {
    height: 24,
    opacity: 0.86,
    width: 24,
  },
  footerWordmarkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 0,
    justifyContent: 'center',
  },
  footerWordmarkText: {
    color: theme.colors.greenDark,
    fontSize: 17,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 22,
    marginLeft: -2,
    textAlign: 'center',
  },
  giftBow: {
    borderColor: '#8C6A2F',
    borderRadius: 6,
    borderWidth: 2,
    height: 8,
    position: 'absolute',
    top: 0,
    width: 10,
  },
  giftBowLeft: {
    left: 5,
    transform: [{ rotate: '-28deg' }],
  },
  giftBowRight: {
    right: 5,
    transform: [{ rotate: '28deg' }],
  },
  giftBowWrap: {
    height: 9,
    position: 'relative',
    width: 28,
  },
  giftBox: {
    alignItems: 'center',
    borderColor: '#8C6A2F',
    borderRadius: 5,
    borderTopWidth: 0,
    borderWidth: 2,
    height: 15,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: 20,
  },
  giftIcon: {
    alignItems: 'center',
    height: 29,
    justifyContent: 'center',
    width: 29,
  },
  giftLid: {
    backgroundColor: '#8C6A2F',
    borderRadius: theme.radius.pill,
    height: 3,
    marginBottom: 1,
    width: 23,
  },
  giftRibbonHorizontal: {
    backgroundColor: '#8C6A2F',
    height: 2,
    position: 'absolute',
    width: 20,
  },
  giftRibbonVertical: {
    backgroundColor: '#8C6A2F',
    height: 15,
    position: 'absolute',
    width: 2,
  },
  header: {
    gap: 6,
    paddingTop: theme.spacing.xs,
  },
  modalAccent: {
    alignSelf: 'center',
    backgroundColor: theme.colors.greenDark,
    borderRadius: theme.radius.pill,
    height: 4,
    marginBottom: 10,
    opacity: 0.24,
    width: 42,
  },
  modalAccentDanger: {
    backgroundColor: theme.colors.pending,
  },
  modalBody: {
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
    textAlign: 'center',
  },
  modalButton: {
    alignSelf: 'stretch',
    marginTop: 12,
  },
  modalCard: {
    backgroundColor: '#FFFDFB',
    borderColor: '#E3E5DD',
    borderRadius: 28,
    borderWidth: 1,
    maxWidth: 420,
    paddingHorizontal: 22,
    paddingVertical: 18,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 18,
      width: 0,
    },
    shadowOpacity: 0.12,
    shadowRadius: 34,
    width: '100%',
  },
  modalSecondaryBody: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  modalSecondaryBodyDanger: {
    color: '#7E5C56',
  },
  modalSecondaryBox: {
    backgroundColor: theme.colors.sage,
    borderColor: '#D8E3D0',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  modalSecondaryBoxDanger: {
    backgroundColor: '#F7EFEC',
    borderColor: '#E6D1CB',
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: theme.fontWeight.bold,
    lineHeight: 28,
    textAlign: 'center',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  rowChevron: {
    borderColor: '#697263',
    borderRightWidth: 1.6,
    borderTopWidth: 1.6,
    height: 8,
    opacity: 0.58,
    transform: [{ rotate: '45deg' }],
    width: 8,
  },
  rowCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  rowDetail: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  rowDivider: {
    borderBottomColor: 'rgba(90, 103, 82, 0.14)',
    borderBottomWidth: 1,
  },
  rowIcon: {
    alignItems: 'center',
    borderRadius: theme.radius.lg,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  rowIconDanger: {
    backgroundColor: '#F3E2DC',
  },
  rowIconGold: {
    backgroundColor: '#F8E8BF',
  },
  rowIconSage: {
    backgroundColor: '#E7EEDF',
  },
  rowPressed: {
    backgroundColor: 'rgba(244, 240, 230, 0.72)',
  },
  rowRight: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 9,
  },
  rowTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 20,
  },
  rowValue: {
    color: theme.colors.greenDark,
    fontSize: 13,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 18,
  },
  screen: {
    paddingBottom: 0,
    paddingTop: theme.spacing.lg,
  },
  scroll: {
    flex: 1,
  },
  sectionCard: {
    borderRadius: 25,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 14,
      width: 0,
    },
    shadowOpacity: 0.045,
    shadowRadius: 22,
  },
  sectionCardAccount: {
    backgroundColor: '#FFF7F2',
    borderColor: '#E8DAD2',
    shadowColor: theme.colors.pending,
  },
  sectionCardApp: {
    backgroundColor: '#EEF4EA',
    borderColor: '#DCE8D5',
  },
  sectionCardRetTrack: {
    backgroundColor: '#FFF6DF',
    borderColor: '#EBDDBB',
  },
  sectionCopy: {
    flex: 1,
    gap: 3,
  },
  sectionDetail: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionHeaderAccount: {
    backgroundColor: '#FFF5F0',
  },
  sectionHeaderApp: {
    backgroundColor: '#F2F7EE',
  },
  sectionHeaderRetTrack: {
    backgroundColor: '#FFF6E0',
  },
  sectionIcon: {
    alignItems: 'center',
    borderRadius: theme.radius.lg,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  sectionIconAccount: {
    backgroundColor: '#F3E2DC',
  },
  sectionIconApp: {
    backgroundColor: '#E4EEDC',
  },
  sectionIconRetTrack: {
    backgroundColor: '#F8E7B9',
  },
  sectionRows: {
    backgroundColor: 'rgba(255, 255, 253, 0.88)',
  },
  sections: {
    gap: 14,
    marginTop: 24,
  },
  sectionTitle: {
    color: '#12322D',
    fontSize: 18,
    fontWeight: theme.fontWeight.bold,
    lineHeight: 24,
  },
  shareHead: {
    backgroundColor: '#8C6A2F',
    borderRadius: theme.radius.pill,
    height: 2,
    position: 'absolute',
    top: 4,
    width: 9,
  },
  shareHeadLeft: {
    left: 7,
    transform: [{ rotate: '-45deg' }],
  },
  shareHeadRight: {
    right: 7,
    transform: [{ rotate: '45deg' }],
  },
  shareIcon: {
    height: 28,
    position: 'relative',
    width: 28,
  },
  shareStem: {
    backgroundColor: '#8C6A2F',
    borderRadius: theme.radius.pill,
    height: 18,
    left: 13,
    position: 'absolute',
    top: 4,
    width: 2,
  },
  shareTray: {
    borderBottomWidth: 2,
    borderColor: '#8C6A2F',
    borderLeftWidth: 2,
    borderRadius: 4,
    borderRightWidth: 2,
    bottom: 2,
    height: 10,
    left: 5,
    position: 'absolute',
    width: 18,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(25, 27, 23, 0.36)',
  },
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    zIndex: 20,
  },
  sliderDot: {
    backgroundColor: theme.colors.greenDark,
    borderRadius: theme.radius.pill,
    height: 6,
    position: 'absolute',
    width: 6,
  },
  sliderDotBottom: {
    right: 6,
    top: 18,
  },
  sliderDotMiddle: {
    left: 9,
    top: 10,
  },
  sliderDotTop: {
    right: 9,
    top: 2,
  },
  slidersIcon: {
    height: 26,
    justifyContent: 'center',
    position: 'relative',
    width: 28,
  },
  sliderTrack: {
    backgroundColor: theme.colors.greenDark,
    borderRadius: theme.radius.pill,
    height: 2,
    left: 4,
    opacity: 0.9,
    position: 'absolute',
    width: 20,
  },
  sliderTrackBottom: {
    top: 20,
  },
  sliderTrackMiddle: {
    top: 12,
  },
  sliderTrackTop: {
    top: 4,
  },
  subtitle: {
    ...theme.typography.screenSubtitle,
    color: theme.colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  title: {
    ...theme.typography.screenTitle,
    color: '#12322D',
    fontSize: 32,
    lineHeight: 39,
  },
  trashCan: {
    alignItems: 'center',
    borderColor: theme.colors.pending,
    borderRadius: 4,
    borderTopWidth: 0,
    borderWidth: 2,
    flexDirection: 'row',
    gap: 3,
    height: 16,
    justifyContent: 'center',
    marginTop: 2,
    width: 17,
  },
  trashHandle: {
    backgroundColor: theme.colors.pending,
    borderRadius: theme.radius.pill,
    height: 2,
    width: 8,
  },
  trashIcon: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  trashLid: {
    backgroundColor: theme.colors.pending,
    borderRadius: theme.radius.pill,
    height: 2,
    marginTop: 2,
    width: 21,
  },
  trashLine: {
    backgroundColor: theme.colors.pending,
    borderRadius: theme.radius.pill,
    height: 9,
    opacity: 0.78,
    width: 2,
  },
});
