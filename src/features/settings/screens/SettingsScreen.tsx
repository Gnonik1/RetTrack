import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  View,
} from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { AppScreen } from '../../../components/AppScreen';
import { AppText } from '../../../components/AppText';
import { theme } from '../../../constants/theme';
import { deleteCurrentAccount } from '../../../services/accountDeletionService';
import {
  cancelAllScheduledAppReminders,
  requestNotificationPermissions,
} from '../../notifications/notifications';
import { usePlan } from '../../monetization/state/PlanState';
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
  | 'legalLinkError'
  | 'shareError';
type StaticSettingsModalKey = Exclude<SettingsModalKey, 'deleteAccount'>;
type RowTone = 'danger' | 'gold' | 'paper' | 'sage';
type SectionTone = 'account' | 'app' | 'legal' | 'rettrack';

type SettingsModalContent = {
  body: string;
  secondaryBody: string;
  title: string;
};

const SHARE_MESSAGE =
  'Track what you buy and remember return dates with RetTrack.\n\nDownload on the App Store:\nhttps://apps.apple.com/app/id6775811683';
const PRIVACY_POLICY_URL =
  'https://gnonik1.github.io/rettrack-legal/privacy-policy/';
const TERMS_OF_USE_URL = 'https://gnonik1.github.io/rettrack-legal/terms-of-use/';
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
    body: 'Return reminders: 7 days before, 3 days before, and last day',
    secondaryBody: 'Quiet hours: 10\u00A0PM \u2013 10\u00A0AM',
    title: 'Notifications',
  },
  legalLinkError: {
    body: "The legal page couldn't be opened right now.",
    secondaryBody: 'Please try again in a moment.',
    title: 'Legal',
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
    body: 'Permanently delete your RetTrack account?',
    secondaryBody:
      'Your purchases, photos, and related account data will be deleted. This cannot be undone.',
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
        tone === 'legal' && styles.sectionCardLegal,
        tone === 'account' && styles.sectionCardAccount,
      ]}
    >
      <View
        style={[
          styles.sectionHeader,
          tone === 'app' && styles.sectionHeaderApp,
          tone === 'rettrack' && styles.sectionHeaderRetTrack,
          tone === 'legal' && styles.sectionHeaderLegal,
          tone === 'account' && styles.sectionHeaderAccount,
        ]}
      >
        <View
          style={[
            styles.sectionIcon,
            tone === 'app' && styles.sectionIconApp,
            tone === 'rettrack' && styles.sectionIconRetTrack,
            tone === 'legal' && styles.sectionIconLegal,
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
          tone === 'paper' && styles.rowIconPaper,
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

function LegalSectionIcon() {
  return (
    <View accessibilityElementsHidden style={styles.legalIcon}>
      <View style={styles.legalPage}>
        <View style={styles.legalPageFold} />
        <View style={[styles.legalPageLine, styles.legalPageLineLong]} />
        <View style={[styles.legalPageLine, styles.legalPageLineMedium]} />
        <View style={[styles.legalPageLine, styles.legalPageLineShort]} />
      </View>
    </View>
  );
}

function PrivacyPolicyIcon() {
  return (
    <View accessibilityElementsHidden style={styles.lockIcon}>
      <View style={styles.lockShackle} />
      <View style={styles.lockBody}>
        <View style={styles.lockDot} />
      </View>
    </View>
  );
}

function TermsIcon() {
  return (
    <View accessibilityElementsHidden style={styles.termsIcon}>
      <View style={styles.termsScale}>
        <View style={styles.termsScaleCap} />
        <View style={styles.termsScaleBeam} />
        <View style={styles.termsScaleStem} />
        <View style={[styles.termsScaleCord, styles.termsScaleCordLeft]} />
        <View style={[styles.termsScaleCord, styles.termsScaleCordRight]} />
        <View style={[styles.termsScalePan, styles.termsScalePanLeft]} />
        <View style={[styles.termsScalePan, styles.termsScalePanRight]} />
        <View style={styles.termsScaleBase} />
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

const INTERACTIVE_RETURN_REMINDER_OFFSETS = [
  { label: '1 day before', offset: 1 },
  { label: '3 days before', offset: 3 },
  { label: '7 days before', offset: 7 },
] as const;

const FIXED_RETURN_REMINDER_OFFSETS: number[] =
  INTERACTIVE_RETURN_REMINDER_OFFSETS.map(({ offset }) => offset);

// No existing setting bounds the number of days between a purchase and its
// return date, so cap the custom "days before" reminder at 45 days — a generous
// buffer over the ~30-day return windows most retailers offer, without allowing
// unrealistic values.
const MIN_CUSTOM_REMINDER_OFFSET = 1;
const MAX_CUSTOM_REMINDER_OFFSET = 45;
const DEFAULT_CUSTOM_REMINDER_OFFSET = 10;
const STEPPER_REVEAL_DURATION = 200;
const STEPPER_REVEAL_MAX_HEIGHT = 96;

function formatReminderOffsetLabel(offset: number) {
  return `${offset} ${offset === 1 ? 'day' : 'days'} before`;
}

function ReturnReminderChips({
  offsets,
  onChange,
  remindersEnabled,
}: {
  offsets: number[];
  onChange: (offsets: number[]) => void;
  remindersEnabled: boolean;
}) {
  const [customReminderOffset, setCustomReminderOffset] = useState<
    number | null
  >(
    () =>
      offsets.find(
        (value) => !FIXED_RETURN_REMINDER_OFFSETS.includes(value),
      ) ?? null,
  );
  const [isStepperOpen, setIsStepperOpen] = useState(false);
  const [stepperValue, setStepperValue] = useState(
    () => customReminderOffset ?? DEFAULT_CUSTOM_REMINDER_OFFSET,
  );
  const stepperReveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Same Animated.timing + interpolate reveal pattern the tab transition in
    // PurchasesHomeScreen uses; height can't run on the native driver.
    const revealAnimation = Animated.timing(stepperReveal, {
      duration: STEPPER_REVEAL_DURATION,
      toValue: isStepperOpen ? 1 : 0,
      useNativeDriver: false,
    });

    revealAnimation.start();

    return () => {
      revealAnimation.stop();
    };
  }, [isStepperOpen, stepperReveal]);

  const toggleReturnReminderOffset = (offset: number) => {
    if (offsets.includes(offset)) {
      // Keep at least one "days before" interval selected: tapping the last
      // remaining selected chip is a no-op rather than clearing the list.
      if (offsets.length <= 1) {
        return;
      }

      onChange(offsets.filter((value) => value !== offset));
      return;
    }

    onChange([...offsets, offset].sort((first, second) => second - first));
  };

  const openStepper = () => {
    setStepperValue(customReminderOffset ?? DEFAULT_CUSTOM_REMINDER_OFFSET);
    setIsStepperOpen(true);
  };

  const adjustStepperValue = (delta: number) => {
    setStepperValue((current) =>
      Math.min(
        MAX_CUSTOM_REMINDER_OFFSET,
        Math.max(MIN_CUSTOM_REMINDER_OFFSET, current + delta),
      ),
    );
  };

  const confirmCustomOffset = () => {
    // Drop any prior custom value (and any accidental duplicate of the new one),
    // then add the new custom offset selected-by-default. Fixed presets already
    // in the draft are left untouched.
    const nextOffsets = offsets.filter(
      (value) => value !== customReminderOffset && value !== stepperValue,
    );
    nextOffsets.push(stepperValue);

    setCustomReminderOffset(stepperValue);
    setIsStepperOpen(false);
    onChange(nextOffsets.sort((first, second) => second - first));
  };

  const deleteCustomOffset = () => {
    if (customReminderOffset === null) {
      return;
    }

    // Mirror toggle's "keep >=1 selected" guard: refuse to delete when the
    // custom offset is the only selected reminder.
    if (offsets.length === 1 && offsets[0] === customReminderOffset) {
      return;
    }

    onChange(offsets.filter((value) => value !== customReminderOffset));
    setCustomReminderOffset(null);
  };

  const isStepperValueFixedPreset =
    FIXED_RETURN_REMINDER_OFFSETS.includes(stepperValue);
  const isStepperAtMinimum = stepperValue <= MIN_CUSTOM_REMINDER_OFFSET;
  const isStepperAtMaximum = stepperValue >= MAX_CUSTOM_REMINDER_OFFSET;
  const isCustomSelected =
    customReminderOffset !== null && offsets.includes(customReminderOffset);
  const isCustomOnlySelected =
    customReminderOffset !== null &&
    offsets.length === 1 &&
    offsets[0] === customReminderOffset;

  return (
    <View
      style={[
        styles.returnReminderSection,
        !remindersEnabled && styles.returnReminderSectionDisabled,
      ]}
    >
      <AppText style={styles.modalSecondaryBody} variant="caption">
        Remind me
      </AppText>
      <View style={styles.returnReminderChips}>
        <View
          style={[
            styles.returnReminderChip,
            styles.returnReminderChipSelected,
            styles.returnReminderChipLocked,
          ]}
        >
          <AppText
            style={[
              styles.returnReminderChipText,
              styles.returnReminderChipTextSelected,
            ]}
            variant="caption"
          >
            Day of
          </AppText>
        </View>
        {INTERACTIVE_RETURN_REMINDER_OFFSETS.map(({ label, offset }) => {
          const isSelected = offsets.includes(offset);

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              key={offset}
              onPress={() => toggleReturnReminderOffset(offset)}
              style={({ pressed }) => [
                styles.returnReminderChip,
                isSelected && styles.returnReminderChipSelectedInteractive,
                pressed && styles.returnReminderChipPressed,
              ]}
            >
              <AppText
                style={[
                  styles.returnReminderChipText,
                  isSelected && styles.returnReminderChipTextSelectedInteractive,
                ]}
                variant="caption"
              >
                {label}
              </AppText>
            </Pressable>
          );
        })}
        {customReminderOffset !== null && (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isCustomSelected }}
            onPress={() => toggleReturnReminderOffset(customReminderOffset)}
            style={({ pressed }) => [
              styles.returnReminderChip,
              styles.returnReminderChipCustom,
              isCustomSelected && styles.returnReminderChipSelectedInteractive,
              pressed && styles.returnReminderChipPressed,
            ]}
          >
            <AppText
              style={[
                styles.returnReminderChipText,
                isCustomSelected &&
                  styles.returnReminderChipTextSelectedInteractive,
              ]}
              variant="caption"
            >
              {formatReminderOffsetLabel(customReminderOffset)}
            </AppText>
            <Pressable
              accessibilityLabel="Remove custom reminder"
              accessibilityRole="button"
              accessibilityState={{ disabled: isCustomOnlySelected }}
              disabled={isCustomOnlySelected}
              onPress={deleteCustomOffset}
              style={[
                styles.returnReminderChipDelete,
                isCustomOnlySelected && styles.returnReminderChipDeleteDisabled,
              ]}
            >
              <AppText
                style={[
                  styles.returnReminderChipDeleteLabel,
                  isCustomSelected &&
                    styles.returnReminderChipTextSelectedInteractive,
                ]}
                variant="caption"
              >
                ×
              </AppText>
            </Pressable>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: isStepperOpen }}
          onPress={openStepper}
          style={({ pressed }) => [
            styles.returnReminderChip,
            pressed && styles.returnReminderChipPressed,
          ]}
        >
          <AppText style={styles.returnReminderChipText} variant="caption">
            + Custom
          </AppText>
        </Pressable>
      </View>
      <Animated.View
        style={[
          styles.returnReminderStepperWrapper,
          {
            maxHeight: stepperReveal.interpolate({
              inputRange: [0, 1],
              outputRange: [0, STEPPER_REVEAL_MAX_HEIGHT],
            }),
            opacity: stepperReveal,
          },
        ]}
      >
        <View style={styles.returnReminderStepper}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isStepperAtMinimum }}
            disabled={isStepperAtMinimum}
            onPress={() => adjustStepperValue(-1)}
            style={({ pressed }) => [
              styles.returnReminderStepperButton,
              isStepperAtMinimum && styles.returnReminderStepperButtonDisabled,
              pressed && styles.returnReminderChipPressed,
            ]}
          >
            <AppText
              style={styles.returnReminderStepperButtonLabel}
              variant="caption"
            >
              −
            </AppText>
          </Pressable>
          <AppText style={styles.returnReminderStepperValue} variant="caption">
            {formatReminderOffsetLabel(stepperValue)}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isStepperAtMaximum }}
            disabled={isStepperAtMaximum}
            onPress={() => adjustStepperValue(1)}
            style={({ pressed }) => [
              styles.returnReminderStepperButton,
              isStepperAtMaximum && styles.returnReminderStepperButtonDisabled,
              pressed && styles.returnReminderChipPressed,
            ]}
          >
            <AppText
              style={styles.returnReminderStepperButtonLabel}
              variant="caption"
            >
              +
            </AppText>
          </Pressable>
          <Pressable
            accessibilityLabel="Confirm custom reminder"
            accessibilityRole="button"
            accessibilityState={{ disabled: isStepperValueFixedPreset }}
            disabled={isStepperValueFixedPreset}
            onPress={confirmCustomOffset}
            style={({ pressed }) => [
              styles.returnReminderStepperConfirm,
              isStepperValueFixedPreset &&
                styles.returnReminderStepperConfirmDisabled,
              pressed && styles.returnReminderChipPressed,
            ]}
          >
            <AppText
              style={styles.returnReminderStepperConfirmLabel}
              variant="caption"
            >
              ✓
            </AppText>
          </Pressable>
        </View>
        {isStepperValueFixedPreset && (
          <AppText style={styles.returnReminderStepperHint} variant="caption">
            Already available above
          </AppText>
        )}
      </Animated.View>
    </View>
  );
}

export function SettingsScreen() {
  const router = useRouter();
  const {
    defaultCurrency,
    remindersEnabled,
    resetHomeReminderNudge,
    returnReminderOffsets,
    setDefaultCurrency,
    setNotificationPromptStatus,
    setRemindersEnabled,
    setReturnReminderOffsets,
  } = useAppSettings();
  const { isAuthenticated, isAuthLoading } = useAuth();
  const { isPro } = usePlan();
  const [activeModal, setActiveModal] = useState<SettingsModalKey | null>(null);
  const [deleteAccountError, setDeleteAccountError] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [reminderOffsetsDraft, setReminderOffsetsDraft] =
    useState<number[]>(returnReminderOffsets);
  const modalContent =
    activeModal === 'deleteAccount'
      ? getDeleteAccountModalContent({ isAuthenticated, isAuthLoading })
      : activeModal
        ? SETTINGS_MODAL_CONTENT[activeModal]
        : null;
  const isCurrencyModal = activeModal === 'currency';
  const isDeleteModal = activeModal === 'deleteAccount';
  const shouldShowDeleteConfirmation =
    isDeleteModal && isAuthenticated && !isAuthLoading;
  const isNotificationsModal = activeModal === 'notifications';
  const deleteAccountDetail = isAuthLoading
    ? 'Checking account status'
    : isAuthenticated
      ? 'Permanent deletion'
      : 'Not available in guest mode';
  const accountSectionDetail = isAuthenticated
    ? 'Signed-in account controls.'
    : 'Account controls require sign-in.';

  const closeModal = () => {
    if (isDeletingAccount) {
      return;
    }

    setDeleteAccountError('');
    setActiveModal(null);
  };

  const openDeleteAccountModal = () => {
    setDeleteAccountError('');
    setActiveModal('deleteAccount');
  };

  const openNotificationsModal = () => {
    // Seed the draft from the committed setting each time the sheet opens, so
    // an earlier unsaved edit never persists across opens.
    setReminderOffsetsDraft(returnReminderOffsets);
    setActiveModal('notifications');
  };

  const handleNotificationsDone = () => {
    // Commit the draft only for Pro (the only users who can edit it), then
    // close. Any non-Done close leaves the committed setting untouched.
    if (isPro) {
      setReturnReminderOffsets(reminderOffsetsDraft);
    }

    closeModal();
  };

  const handleCurrencySelect = (currency: CurrencyCode) => {
    setDefaultCurrency(currency);
  };

  const silentlyResetHomeReminderNudge = async () => {
    try {
      await resetHomeReminderNudge();
    } catch {
      // Nudge reset must never block reminder preference changes.
    }
  };

  const turnOffReminders = async () => {
    setRemindersEnabled(false);
    setNotificationPromptStatus('dismissed');
    cancelAllScheduledAppReminders().catch(() => undefined);
    await silentlyResetHomeReminderNudge();
  };

  const turnOnReminders = async () => {
    const isGranted = await requestNotificationPermissions();

    setRemindersEnabled(isGranted);
    setNotificationPromptStatus(isGranted ? 'enabled' : 'dismissed');

    if (!isGranted) {
      await cancelAllScheduledAppReminders();
      await silentlyResetHomeReminderNudge();
    }
  };

  const handleReminderPreferenceChange = async (isEnabled: boolean) => {
    if (!isEnabled) {
      await turnOffReminders();
      return;
    }

    await turnOnReminders().catch(() => undefined);
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

  const handleOpenLegalUrl = (url: string) => {
    void Linking.openURL(url).catch(() => {
      setActiveModal('legalLinkError');
    });
  };

  const handleDeleteAccount = async () => {
    if (!shouldShowDeleteConfirmation || isDeletingAccount) {
      return;
    }

    setDeleteAccountError('');
    setIsDeletingAccount(true);

    try {
      const result = await deleteCurrentAccount();

      if (!result.success) {
        setDeleteAccountError(result.error);
        return;
      }

      setActiveModal(null);
      router.replace('/welcome');
    } catch {
      setDeleteAccountError(
        'We could not delete your account right now. Please try again.',
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <AppScreen stableTopInset style={styles.screen}>
      <LinearGradient
        colors={['#FBFAF3', '#F1F5EC', '#FFF8EC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
        style={styles.backgroundBase}
      />
      <View pointerEvents="none" style={styles.backgroundSageGlow} />
      <View pointerEvents="none" style={styles.backgroundWarmGlow} />
      <View pointerEvents="none" style={styles.backgroundPaperWash} />

      <ScrollView
        automaticallyAdjustContentInsets={false}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="never"
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
              detail={remindersEnabled ? 'Reminders are on' : 'Reminders are off'}
              icon={<BellIcon />}
              onPress={openNotificationsModal}
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
            detail="Privacy and terms for RetTrack."
            icon={<LegalSectionIcon />}
            title="Legal"
            tone="legal"
          >
            <SettingsRow
              detail="How RetTrack handles your data"
              icon={<PrivacyPolicyIcon />}
              onPress={() => handleOpenLegalUrl(PRIVACY_POLICY_URL)}
              title="Privacy Policy"
              tone="paper"
            />
            <SettingsRow
              detail="Rules for using RetTrack"
              icon={<TermsIcon />}
              isLast
              onPress={() => handleOpenLegalUrl(TERMS_OF_USE_URL)}
              title="Terms of Use"
              tone="paper"
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
              onPress={openDeleteAccountModal}
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
      {modalContent ? (
        <View style={styles.sheetOverlay}>
          <Pressable
            accessibilityLabel="Close settings sheet"
            accessibilityRole="button"
            disabled={isDeletingAccount}
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
              style={[
                styles.modalTitle,
                isDeleteModal && styles.destructiveTitle,
                isNotificationsModal && styles.notificationsModalTitle,
              ]}
              variant="title"
            >
              {modalContent.title}
            </AppText>
            {isNotificationsModal && isPro ? (
              <ReturnReminderChips
                offsets={reminderOffsetsDraft}
                onChange={setReminderOffsetsDraft}
                remindersEnabled={remindersEnabled}
              />
            ) : (
              <AppText
                style={[
                  styles.modalBody,
                  isCurrencyModal && styles.currencyModalBody,
                ]}
                variant="body"
              >
                {modalContent.body}
              </AppText>
            )}
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
                {isNotificationsModal ? (
                  <View style={styles.reminderPreferenceBox}>
                    <View style={styles.reminderPreferenceContent}>
                      <View style={styles.reminderPreferenceCopy}>
                        <AppText
                          style={styles.reminderPreferenceLabel}
                          variant="body"
                        >
                          Reminders
                        </AppText>
                        <AppText
                          style={styles.reminderPreferenceDetail}
                          variant="caption"
                        >
                          {remindersEnabled ? 'On' : 'Off'}
                        </AppText>
                      </View>
                      <Switch
                        accessibilityLabel="Reminders"
                        onValueChange={handleReminderPreferenceChange}
                        ios_backgroundColor="#DDE7D7"
                        style={styles.reminderPreferenceSwitch}
                        thumbColor="#FFFDF8"
                        trackColor={{
                          false: '#DDE7D7',
                          true: '#729B66',
                        }}
                        value={remindersEnabled}
                      />
                    </View>
                  </View>
                ) : null}
                {shouldShowDeleteConfirmation ? (
                  <>
                    {deleteAccountError ? (
                      <View style={styles.deleteErrorBox}>
                        <AppText style={styles.deleteErrorText} variant="caption">
                          {deleteAccountError}
                        </AppText>
                      </View>
                    ) : null}
                    <View style={styles.deleteActions}>
                      <AppButton
                        disabled={isDeletingAccount}
                        onPress={closeModal}
                        style={styles.deleteActionButton}
                        title="Cancel"
                        variant="outline"
                      />
                      <AppButton
                        disabled={isDeletingAccount}
                        onPress={handleDeleteAccount}
                        style={[
                          styles.deleteActionButton,
                          styles.deleteConfirmButton,
                        ]}
                        title={
                          isDeletingAccount ? 'Deleting...' : 'Delete account'
                        }
                      />
                    </View>
                  </>
                ) : (
                  <AppButton
                    onPress={
                      isNotificationsModal ? handleNotificationsDone : closeModal
                    }
                    style={styles.modalButton}
                    title="Done"
                  />
                )}
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
    ...theme.typography.footerText,
    color: '#7E8477',
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
    paddingTop: theme.spacing.sm,
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
  deleteActionButton: {
    flex: 1,
    marginTop: 0,
    minHeight: 50,
  },
  deleteActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  deleteConfirmButton: {
    backgroundColor: theme.colors.pending,
  },
  deleteErrorBox: {
    backgroundColor: '#FFF7F5',
    borderColor: '#E7C8C0',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  deleteErrorText: {
    color: '#7E4D45',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
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
    fontSize: 16,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 22,
    marginLeft: -2,
    opacity: 0.82,
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
    paddingTop: 0,
  },
  legalIcon: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  legalPage: {
    alignItems: 'center',
    borderColor: '#706A4A',
    borderRadius: 5,
    borderWidth: 2,
    gap: 3,
    height: 24,
    justifyContent: 'center',
    position: 'relative',
    width: 20,
  },
  legalPageFold: {
    borderLeftColor: 'transparent',
    borderLeftWidth: 5,
    borderTopColor: '#706A4A',
    borderTopWidth: 5,
    opacity: 0.42,
    position: 'absolute',
    right: 1,
    top: 1,
  },
  legalPageLine: {
    backgroundColor: '#706A4A',
    borderRadius: theme.radius.pill,
    height: 2,
  },
  legalPageLineLong: {
    width: 10,
  },
  legalPageLineMedium: {
    width: 8,
  },
  legalPageLineShort: {
    width: 6,
  },
  lockBody: {
    alignItems: 'center',
    borderColor: '#706A4A',
    borderRadius: 5,
    borderWidth: 2,
    height: 15,
    justifyContent: 'center',
    width: 20,
  },
  lockDot: {
    backgroundColor: '#706A4A',
    borderRadius: theme.radius.pill,
    height: 4,
    width: 4,
  },
  lockIcon: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  lockShackle: {
    borderColor: '#706A4A',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 2,
    borderBottomWidth: 0,
    height: 10,
    marginBottom: -1,
    width: 14,
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
  notificationsModalTitle: {
    color: theme.colors.greenDark,
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
    ...theme.typography.meta,
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
  rowIconPaper: {
    backgroundColor: '#EFECD5',
  },
  rowIconSage: {
    backgroundColor: '#E7EEDF',
  },
  rowPressed: {
    backgroundColor: theme.press.pressedSurfaceTint,
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
  reminderPreferenceBox: {
    backgroundColor: '#FFFDF8',
    borderColor: '#DDE7D7',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
  },
  reminderPreferenceContent: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reminderPreferenceCopy: {
    gap: 0,
  },
  reminderPreferenceDetail: {
    color: theme.colors.muted,
    fontSize: 12,
    lineHeight: 15,
  },
  reminderPreferenceLabel: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: theme.fontWeight.bold,
    lineHeight: 19,
  },
  reminderPreferenceSwitch: {
    transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],
  },
  returnReminderChip: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  returnReminderChipCustom: {
    flexDirection: 'row',
    gap: 4,
    paddingRight: 10,
  },
  returnReminderChipDelete: {
    alignItems: 'center',
    height: 18,
    justifyContent: 'center',
    marginLeft: 2,
    width: 18,
  },
  returnReminderChipDeleteDisabled: {
    opacity: 0.4,
  },
  returnReminderChipDeleteLabel: {
    color: '#747A70',
    fontSize: 15,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 16,
  },
  returnReminderChipLocked: {
    opacity: 0.7,
  },
  returnReminderChipPressed: {
    opacity: 0.82,
  },
  returnReminderChipSelected: {
    backgroundColor: theme.colors.sage,
    borderColor: '#D8E3D0',
  },
  returnReminderChipSelectedInteractive: {
    backgroundColor: theme.colors.green,
    borderColor: '#D8E3D0',
  },
  returnReminderChipText: {
    color: '#747A70',
    fontSize: 13,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 17,
  },
  returnReminderChipTextSelected: {
    color: theme.colors.greenDark,
  },
  returnReminderChipTextSelectedInteractive: {
    color: theme.colors.card,
  },
  returnReminderChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 12,
  },
  returnReminderSection: {
    marginTop: 6,
  },
  returnReminderSectionDisabled: {
    opacity: 0.5,
  },
  returnReminderStepper: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  returnReminderStepperButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.sage,
    borderRadius: theme.radius.pill,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  returnReminderStepperButtonDisabled: {
    opacity: 0.4,
  },
  returnReminderStepperButtonLabel: {
    color: theme.colors.greenDark,
    fontSize: 16,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 18,
  },
  returnReminderStepperConfirm: {
    alignItems: 'center',
    backgroundColor: theme.colors.green,
    borderRadius: theme.radius.pill,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  returnReminderStepperConfirmDisabled: {
    opacity: 0.4,
  },
  returnReminderStepperConfirmLabel: {
    color: theme.colors.card,
    fontSize: 14,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 16,
  },
  returnReminderStepperHint: {
    color: '#747A70',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  returnReminderStepperValue: {
    color: theme.colors.greenDark,
    fontSize: 13,
    fontWeight: theme.fontWeight.semibold,
    minWidth: 96,
    textAlign: 'center',
  },
  returnReminderStepperWrapper: {
    overflow: 'hidden',
  },
  screen: {
    paddingBottom: 0,
    paddingTop: theme.spacing.xl,
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
  sectionCardLegal: {
    backgroundColor: '#FFFBEF',
    borderColor: '#E2DFC8',
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
    ...theme.typography.meta,
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
  sectionHeaderLegal: {
    backgroundColor: '#FFF9EA',
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
  sectionIconLegal: {
    backgroundColor: '#EFECD5',
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
    ...theme.typography.sectionTitle,
    color: '#12322D',
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
  termsIcon: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  termsScale: {
    height: 26,
    position: 'relative',
    width: 26,
  },
  termsScaleBase: {
    backgroundColor: '#706A4A',
    borderRadius: theme.radius.pill,
    bottom: 3,
    height: 2,
    left: 8,
    position: 'absolute',
    width: 10,
  },
  termsScaleBeam: {
    backgroundColor: '#706A4A',
    borderRadius: theme.radius.pill,
    height: 2,
    left: 4,
    position: 'absolute',
    top: 7,
    width: 18,
  },
  termsScaleCap: {
    backgroundColor: '#706A4A',
    borderRadius: theme.radius.pill,
    height: 4,
    left: 11,
    position: 'absolute',
    top: 3,
    width: 4,
  },
  termsScaleCord: {
    backgroundColor: '#706A4A',
    borderRadius: theme.radius.pill,
    height: 6,
    position: 'absolute',
    top: 8,
    width: 2,
  },
  termsScaleCordLeft: {
    left: 6,
  },
  termsScaleCordRight: {
    right: 6,
  },
  termsScalePan: {
    borderBottomWidth: 2,
    borderColor: '#706A4A',
    borderLeftWidth: 2,
    borderRadius: 4,
    borderRightWidth: 2,
    height: 5,
    position: 'absolute',
    top: 14,
    width: 10,
  },
  termsScalePanLeft: {
    left: 2,
  },
  termsScalePanRight: {
    right: 2,
  },
  termsScaleStem: {
    backgroundColor: '#706A4A',
    borderRadius: theme.radius.pill,
    height: 16,
    left: 12,
    position: 'absolute',
    top: 7,
    width: 2,
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
