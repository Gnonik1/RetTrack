import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { AppBottomNav } from '../../../components/AppBottomNav';
import { AppScreen } from '../../../components/AppScreen';
import { AppText } from '../../../components/AppText';
import { theme } from '../../../constants/theme';
import {
  currencyOptions,
  type CurrencyCode,
  useAppSettings,
} from '../state/AppSettingsState';

type SettingsModalKey = 'notifications' | 'currency' | 'deleteAccount';

const SETTINGS_MODAL_CONTENT: Record<
  SettingsModalKey,
  {
    body: string;
    secondaryBody: string;
    title: string;
  }
> = {
  currency: {
    body: 'Choose the default currency for new purchases.',
    secondaryBody: 'Existing purchases keep their saved currency.',
    title: 'Currency',
  },
  deleteAccount: {
    body: 'Delete account is not available in guest mode.',
    secondaryBody: 'Create or sign in to an account before managing account deletion.',
    title: 'Delete account',
  },
  notifications: {
    body: 'Return reminders are scheduled 7 days before, 3 days before, and on the last day.',
    secondaryBody: 'Quiet hours are 9 PM to 9 AM.',
    title: 'Notifications',
  },
};

type SettingsRowProps = {
  detail: string;
  destructive?: boolean;
  isLast?: boolean;
  onPress: () => void;
  rightValue?: string;
  title: string;
};

function SettingsRow({
  destructive = false,
  detail,
  isLast = false,
  onPress,
  rightValue,
  title,
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

export function SettingsScreen() {
  const { defaultCurrency, setDefaultCurrency } = useAppSettings();
  const [activeModal, setActiveModal] = useState<SettingsModalKey | null>(null);
  const modalContent = activeModal ? SETTINGS_MODAL_CONTENT[activeModal] : null;
  const isCurrencyModal = activeModal === 'currency';

  const closeModal = () => {
    setActiveModal(null);
  };

  const handleCurrencySelect = (currency: CurrencyCode) => {
    setDefaultCurrency(currency);
  };

  return (
    <AppScreen style={styles.screen}>
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
            Manage how the app works for you.
          </AppText>
        </View>

        <View style={styles.settingsCard}>
          <SettingsRow
            detail="Reminder timing and quiet hours"
            isLast
            onPress={() => setActiveModal('notifications')}
            title="Notifications"
          />
        </View>

        <View style={styles.standaloneCard}>
          <SettingsRow
            detail="Default for new purchases"
            isLast
            onPress={() => setActiveModal('currency')}
            rightValue={defaultCurrency}
            title="Currency"
          />
        </View>

        <View style={styles.accountCard}>
          <SettingsRow
            destructive
            detail="Not available in guest mode"
            isLast
            onPress={() => setActiveModal('deleteAccount')}
            title="Delete account"
          />
        </View>

        <View style={styles.messageBlockWrap}>
          <View style={styles.messageBlock}>
            <Text style={styles.messageTitle}>Stay organized without the clutter</Text>
            <Text style={styles.messageText}>
              RetTrack keeps your purchases, return dates, and decisions in one place
            </Text>
          </View>
        </View>

        <View style={styles.appMetadataFooter}>
          <View style={styles.appMetadata}>
            <AppText style={styles.appMetadataTitle} variant="caption">
              RetTrack
            </AppText>
            <AppText style={styles.appMetadataText} variant="caption">
              Guest mode active · Saved locally · Version 1.0
            </AppText>
          </View>
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
            ]}
          >
            <View style={styles.modalAccent} />
            <AppText
              style={[
                styles.modalTitle,
                activeModal === 'deleteAccount' && styles.destructiveTitle,
              ]}
              variant="title"
            >
              {modalContent?.title}
            </AppText>
            <AppText
              style={[
                styles.modalBody,
                isCurrencyModal && styles.currencyModalBody,
              ]}
              variant="body"
            >
              {modalContent?.body}
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
                    {modalContent?.secondaryBody}
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
                <View style={styles.modalSecondaryBox}>
                  <AppText style={styles.modalSecondaryBody} variant="caption">
                    {modalContent?.secondaryBody}
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
  appMetadata: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  appMetadataFooter: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingTop: 32,
  },
  appMetadataText: {
    color: theme.colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
    textAlign: 'center',
  },
  appMetadataTitle: {
    color: theme.colors.greenDark,
    fontSize: 13,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 18,
    textAlign: 'center',
  },
  accountCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    marginTop: 12,
    overflow: 'hidden',
  },
  content: {
    flexGrow: 1,
    paddingBottom: 108,
    paddingTop: theme.spacing.xs,
  },
  messageBlock: {
    backgroundColor: '#EEF1E9',
    borderColor: '#DCE3D5',
    borderRadius: 28,
    borderWidth: 1,
    elevation: 1,
    paddingHorizontal: 22,
    paddingVertical: 22,
    shadowColor: '#556B4F',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    width: '100%',
  },
  messageBlockWrap: {
    alignItems: 'center',
    marginTop: 64,
    width: '100%',
  },
  messageText: {
    color: '#6F7468',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 23,
    textAlign: 'center',
  },
  messageTitle: {
    color: '#445842',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 10,
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
  currencyModalCard: {
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  currencyModalBody: {
    marginTop: 5,
  },
  currencyModalButton: {
    marginTop: 10,
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
  destructiveTitle: {
    color: theme.colors.pending,
  },
  destructiveRowChevron: {
    borderColor: theme.colors.pending,
    opacity: 0.4,
  },
  header: {
    gap: 6,
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
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    maxWidth: 420,
    paddingHorizontal: 22,
    paddingVertical: 18,
    width: '100%',
  },
  modalSecondaryBody: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
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
    gap: theme.spacing.md,
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  rowCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  rowDetail: {
    color: theme.colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  rowDivider: {
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 1,
  },
  rowChevron: {
    borderColor: '#8F968A',
    borderRightWidth: 1.4,
    borderTopWidth: 1.4,
    height: 7,
    opacity: 0.48,
    transform: [{ rotate: '45deg' }],
    width: 7,
  },
  rowPressed: {
    backgroundColor: theme.colors.paper,
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
    fontSize: 12,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 17,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(22, 24, 22, 0.36)',
  },
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    zIndex: 20,
  },
  screen: {
    paddingBottom: 0,
    paddingTop: theme.spacing.xl,
  },
  scroll: {
    flex: 1,
  },
  settingsCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    marginTop: 22,
    overflow: 'hidden',
  },
  standaloneCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    marginTop: 12,
    overflow: 'hidden',
  },
  subtitle: {
    ...theme.typography.screenSubtitle,
    color: theme.colors.muted,
    lineHeight: 21,
  },
  title: {
    ...theme.typography.screenTitle,
    color: theme.colors.text,
    fontSize: 29,
    lineHeight: 36,
  },
});
