import { useState } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { AppScreen } from '../../../components/AppScreen';
import { AppText } from '../../../components/AppText';
import { AppTextField } from '../../../components/AppTextField';
import { theme } from '../../../constants/theme';

type AddFirstPurchaseScreenProps = {
  onBack?: () => void;
};

type OptionalSectionKey = 'price' | 'purchaseDate' | 'photos' | 'comment';

type DatePickerMode = 'return' | 'purchase';

const optionalDetailRows = [
  {
    key: 'price',
    label: 'Add price',
  },
  {
    key: 'purchaseDate',
    label: 'Add purchase date',
  },
  {
    key: 'photos',
    label: 'Add photos',
  },
  {
    key: 'comment',
    label: 'Add comment',
  },
] as const;

const currencyOptions = [
  {
    code: 'USD',
    name: 'US Dollar',
  },
  {
    code: 'EUR',
    name: 'Euro',
  },
  {
    code: 'GBP',
    name: 'British Pound',
  },
  {
    code: 'GEL',
    name: 'Georgian Lari',
  },
] as const;

type CurrencyCode = (typeof currencyOptions)[number]['code'];

const defaultCurrency: CurrencyCode = 'USD';

const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

const monthLabels = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function formatDate(date: Date) {
  return `${monthLabels[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function getDefaultReturnDate() {
  return addDays(new Date(), 14);
}

function getMonthLabel(date: Date) {
  return `${monthLabels[date.getMonth()]} ${date.getFullYear()}`;
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getCalendarRows(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const rows: Array<Array<number | null>> = [];

  for (let index = 0; index < cells.length; index += 7) {
    rows.push(cells.slice(index, index + 7));
  }

  return rows;
}

function isSameDate(firstDate: Date, secondDate: Date) {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );
}

export function AddFirstPurchaseScreen({ onBack }: AddFirstPurchaseScreenProps) {
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [priceText, setPriceText] = useState('');
  const [draftPriceText, setDraftPriceText] = useState('');
  const [priceCurrency, setPriceCurrency] =
    useState<CurrencyCode>(defaultCurrency);
  const [selectedCurrency, setSelectedCurrency] =
    useState<CurrencyCode>(defaultCurrency);
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);
  const [returnDate, setReturnDate] = useState(() => getDefaultReturnDate());
  const [purchaseDate, setPurchaseDate] = useState<Date | null>(null);
  const [activeDatePicker, setActiveDatePicker] =
    useState<DatePickerMode | null>(null);
  const [draftDate, setDraftDate] = useState(() => getDefaultReturnDate());
  const [visibleMonth, setVisibleMonth] = useState(() =>
    getMonthStart(getDefaultReturnDate()),
  );
  const [isPhotosModalOpen, setIsPhotosModalOpen] = useState(false);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [draftComment, setDraftComment] = useState('');

  const returnDateDisplay = formatDate(returnDate);
  const datePickerTitle =
    activeDatePicker === 'purchase'
      ? 'Select purchase date'
      : 'Select return date';
  const calendarRows = getCalendarRows(visibleMonth);
  const pricePreview = priceText ? `${priceCurrency} ${priceText}` : '';

  const openPriceModal = () => {
    setSelectedCurrency(priceCurrency);
    setDraftPriceText(priceText);
    setIsCurrencyModalOpen(false);
    setIsPriceModalOpen(true);
  };

  const closePriceModal = () => {
    setSelectedCurrency(priceCurrency);
    setDraftPriceText(priceText);
    setIsCurrencyModalOpen(false);
    setIsPriceModalOpen(false);
  };

  const handlePriceModalClose = () => {
    if (isCurrencyModalOpen) {
      setIsCurrencyModalOpen(false);
      return;
    }

    closePriceModal();
  };

  const confirmPriceModal = () => {
    setPriceText(draftPriceText.trim());
    setPriceCurrency(selectedCurrency);
    setIsCurrencyModalOpen(false);
    setIsPriceModalOpen(false);
  };

  const openDatePicker = (mode: DatePickerMode) => {
    const initialDate =
      mode === 'return' ? returnDate : purchaseDate ?? new Date();

    setDraftDate(initialDate);
    setVisibleMonth(getMonthStart(initialDate));
    setActiveDatePicker(mode);
  };

  const closeDatePicker = () => {
    setActiveDatePicker(null);
  };

  const confirmDatePicker = () => {
    if (activeDatePicker === 'return') {
      setReturnDate(draftDate);
    }

    if (activeDatePicker === 'purchase') {
      setPurchaseDate(draftDate);
    }

    closeDatePicker();
  };

  const changeVisibleMonth = (offset: number) => {
    setVisibleMonth(
      (currentMonth) =>
        new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1),
    );
  };

  const selectCalendarDay = (day: number) => {
    setDraftDate(
      new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day),
    );
  };

  const openCommentModal = () => {
    setDraftComment(commentText);
    setIsCommentModalOpen(true);
  };

  const confirmCommentModal = () => {
    setCommentText(draftComment.trim());
    setIsCommentModalOpen(false);
  };

  const handleOptionalRowPress = (section: OptionalSectionKey) => {
    if (section === 'price') {
      openPriceModal();
      return;
    }

    if (section === 'purchaseDate') {
      openDatePicker('purchase');
      return;
    }

    if (section === 'photos') {
      setIsPhotosModalOpen(true);
      return;
    }

    openCommentModal();
  };

  return (
    <AppScreen style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          onPress={onBack}
          style={styles.backButton}
        >
          <AppText style={styles.backButtonText} variant="body">
            {'\u2039'}
          </AppText>
        </Pressable>

        <View style={styles.headerCopy}>
          <AppText style={styles.title} variant="title">
            Add first purchase
          </AppText>
          <AppText style={styles.subtitle} variant="subtitle">
            Start with the essentials
          </AppText>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.formContent}
        showsVerticalScrollIndicator={false}
        style={styles.form}
      >
        <View style={styles.fields}>
          <AppTextField label="Item name *" placeholder="Cashmere coat" />
          <View style={styles.storeLinkRow}>
            <AppTextField
              label="Store"
              placeholder="Farfetch"
              style={styles.storeLinkField}
            />
            <AppTextField
              autoCapitalize="none"
              keyboardType="url"
              label="Link"
              placeholder="Paste URL"
              style={styles.storeLinkField}
            />
          </View>

          <View style={styles.helperNote}>
            <AppText style={styles.helperText} variant="caption">
              Add either a store or product link to continue
            </AppText>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => openDatePicker('return')}
            style={({ pressed }) => [
              styles.tappableField,
              pressed && styles.tappableFieldPressed,
            ]}
          >
            <View style={styles.returnDateField}>
              <AppText style={styles.returnDateLabel} variant="caption">
                Return date *
              </AppText>
              <View style={styles.returnDateCard}>
                <AppText style={styles.returnDateValue} variant="body">
                  {returnDateDisplay}
                </AppText>
              </View>
            </View>
          </Pressable>
        </View>

        <View style={styles.optionalSection}>
          <AppText style={styles.optionalHeading} variant="caption">
            Optional details
          </AppText>

          <View style={styles.optionalRows}>
            {optionalDetailRows.map(({ key, label }) => {
              const rowValue =
                key === 'price'
                  ? pricePreview
                  : key === 'purchaseDate' && purchaseDate
                    ? formatDate(purchaseDate)
                    : key === 'comment' && commentText.trim()
                      ? 'Added'
                      : '';

              return (
                <View key={key} style={styles.optionalItem}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleOptionalRowPress(key)}
                    style={({ pressed }) => [
                      styles.optionalRow,
                      pressed && styles.optionalRowPressed,
                    ]}
                  >
                    <View style={styles.optionalRowCopy}>
                      <AppText style={styles.optionalRowLabel} variant="body">
                        {label}
                      </AppText>
                    </View>

                    {rowValue ? (
                      <AppText
                        numberOfLines={1}
                        style={styles.optionalRowValue}
                        variant="caption"
                      >
                        {rowValue}
                      </AppText>
                    ) : (
                      <AppText style={styles.optionalPlus} variant="button">
                        +
                      </AppText>
                    )}
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <AppButton title="Save item" variant="primary" />
      </View>

      <Modal
        animationType="none"
        onRequestClose={handlePriceModalClose}
        transparent
        visible={isPriceModalOpen}
      >
        <View style={styles.centeredModalOverlay}>
          <Pressable
            accessibilityLabel="Close price modal"
            accessibilityRole="button"
            onPress={handlePriceModalClose}
            style={styles.centeredModalBackdrop}
          />

          {isCurrencyModalOpen ? (
            <View style={styles.currencyModalCard}>
              <AppText style={styles.currencyModalTitle} variant="title">
                Choose currency
              </AppText>

              <View style={styles.currencyModalOptions}>
                {currencyOptions.map(({ code, name }) => {
                  const isSelected = code === selectedCurrency;

                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={code}
                      onPress={() => {
                        setSelectedCurrency(code);
                        setIsCurrencyModalOpen(false);
                      }}
                      style={({ pressed }) => [
                        styles.currencyModalOption,
                        isSelected && styles.currencyModalOptionSelected,
                        pressed && styles.currencyModalOptionPressed,
                      ]}
                    >
                      <View style={styles.currencyModalOptionCopy}>
                        <AppText
                          style={[
                            styles.currencyModalOptionCode,
                            isSelected && styles.currencyModalOptionCodeSelected,
                          ]}
                          variant="button"
                        >
                          {code}
                        </AppText>
                        <AppText
                          style={styles.currencyModalOptionName}
                          variant="caption"
                        >
                          {name}
                        </AppText>
                      </View>

                      {isSelected ? (
                        <View style={styles.currencyModalSelectedDot} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={styles.standardModalCard}>
              <AppText style={styles.centeredModalTitle} variant="title">
                Add price
              </AppText>

              <View style={styles.priceModalRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    Keyboard.dismiss();
                    setIsCurrencyModalOpen(true);
                  }}
                  style={({ pressed }) => [
                    styles.currencyChip,
                    pressed && styles.currencyChipPressed,
                  ]}
                >
                  <AppText style={styles.currencyChipText} variant="button">
                    {selectedCurrency} {'\u25be'}
                  </AppText>
                </Pressable>

                <View style={styles.priceInputCard}>
                  <TextInput
                    keyboardType="decimal-pad"
                    onChangeText={setDraftPriceText}
                    placeholder="117.00"
                    placeholderTextColor={theme.colors.muted}
                    selectionColor={theme.colors.green}
                    style={styles.priceInput}
                    value={draftPriceText}
                  />
                </View>
              </View>

              <View style={styles.modalActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={closePriceModal}
                  style={({ pressed }) => [
                    styles.modalActionButton,
                    pressed && styles.modalActionButtonPressed,
                  ]}
                >
                  <AppText style={styles.modalCancelText} variant="button">
                    Cancel
                  </AppText>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={confirmPriceModal}
                  style={({ pressed }) => [
                    styles.modalActionButton,
                    styles.modalDoneButton,
                    pressed && styles.modalActionButtonPressed,
                  ]}
                >
                  <AppText style={styles.modalDoneText} variant="button">
                    Done
                  </AppText>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={closeDatePicker}
        transparent
        visible={Boolean(activeDatePicker)}
      >
        <View style={styles.centeredModalOverlay}>
          <Pressable
            accessibilityLabel="Close date picker"
            accessibilityRole="button"
            onPress={closeDatePicker}
            style={styles.centeredModalBackdrop}
          />

          <View style={styles.dateModalCard}>
            <AppText style={styles.centeredModalTitle} variant="title">
              {datePickerTitle}
            </AppText>

            <View style={styles.calendarHeader}>
              <Pressable
                accessibilityLabel="Previous month"
                accessibilityRole="button"
                onPress={() => changeVisibleMonth(-1)}
                style={({ pressed }) => [
                  styles.calendarMonthButton,
                  pressed && styles.calendarMonthButtonPressed,
                ]}
              >
                <AppText style={styles.calendarMonthButtonText} variant="button">
                  {'\u2039'}
                </AppText>
              </Pressable>

              <AppText style={styles.calendarMonthLabel} variant="button">
                {getMonthLabel(visibleMonth)}
              </AppText>

              <Pressable
                accessibilityLabel="Next month"
                accessibilityRole="button"
                onPress={() => changeVisibleMonth(1)}
                style={({ pressed }) => [
                  styles.calendarMonthButton,
                  pressed && styles.calendarMonthButtonPressed,
                ]}
              >
                <AppText style={styles.calendarMonthButtonText} variant="button">
                  {'\u203a'}
                </AppText>
              </Pressable>
            </View>

            <View style={styles.calendarGrid}>
              <View style={styles.calendarWeek}>
                {weekdayLabels.map((weekday, index) => (
                  <View key={`${weekday}-${index}`} style={styles.calendarDayCell}>
                    <AppText style={styles.calendarWeekday} variant="caption">
                      {weekday}
                    </AppText>
                  </View>
                ))}
              </View>

              {calendarRows.map((week, weekIndex) => (
                <View key={`week-${weekIndex}`} style={styles.calendarWeek}>
                  {week.map((day, dayIndex) => {
                    if (!day) {
                      return (
                        <View
                          key={`empty-${weekIndex}-${dayIndex}`}
                          style={styles.calendarDayCell}
                        />
                      );
                    }

                    const dayDate = new Date(
                      visibleMonth.getFullYear(),
                      visibleMonth.getMonth(),
                      day,
                    );
                    const isSelected = isSameDate(dayDate, draftDate);

                    return (
                      <View
                        key={`day-${day}`}
                        style={styles.calendarDayCell}
                      >
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => selectCalendarDay(day)}
                          style={({ pressed }) => [
                            styles.calendarDayButton,
                            isSelected && styles.calendarDayButtonSelected,
                            pressed && styles.calendarDayButtonPressed,
                          ]}
                        >
                          <AppText
                            style={[
                              styles.calendarDayText,
                              isSelected && styles.calendarDayTextSelected,
                            ]}
                            variant="caption"
                          >
                            {day}
                          </AppText>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={closeDatePicker}
                style={({ pressed }) => [
                  styles.modalActionButton,
                  pressed && styles.modalActionButtonPressed,
                ]}
              >
                <AppText style={styles.modalCancelText} variant="button">
                  Cancel
                </AppText>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={confirmDatePicker}
                style={({ pressed }) => [
                  styles.modalActionButton,
                  styles.modalDoneButton,
                  pressed && styles.modalActionButtonPressed,
                ]}
              >
                <AppText style={styles.modalDoneText} variant="button">
                  Done
                </AppText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setIsPhotosModalOpen(false)}
        transparent
        visible={isPhotosModalOpen}
      >
        <View style={styles.centeredModalOverlay}>
          <Pressable
            accessibilityLabel="Close photos modal"
            accessibilityRole="button"
            onPress={() => setIsPhotosModalOpen(false)}
            style={styles.centeredModalBackdrop}
          />

          <View style={styles.standardModalCard}>
            <AppText style={styles.centeredModalTitle} variant="title">
              Add photos
            </AppText>
            <AppText style={styles.centeredModalBody} variant="body">
              Add receipt or product photos
            </AppText>
            <AppText style={styles.centeredModalCaption} variant="caption">
              Up to 3 photos per item
            </AppText>

            <View style={styles.photoSlots}>
              {[0, 1, 2].map((slot) => (
                <View key={slot} style={styles.photoSlot}>
                  <AppText style={styles.photoSlotPlus} variant="button">
                    +
                  </AppText>
                </View>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsPhotosModalOpen(false)}
                style={({ pressed }) => [
                  styles.modalActionButton,
                  pressed && styles.modalActionButtonPressed,
                ]}
              >
                <AppText style={styles.modalCancelText} variant="button">
                  Cancel
                </AppText>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => setIsPhotosModalOpen(false)}
                style={({ pressed }) => [
                  styles.modalActionButton,
                  styles.modalDoneButton,
                  pressed && styles.modalActionButtonPressed,
                ]}
              >
                <AppText style={styles.modalDoneText} variant="button">
                  Done
                </AppText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="none"
        onRequestClose={() => setIsCommentModalOpen(false)}
        transparent
        visible={isCommentModalOpen}
      >
        <View style={styles.centeredModalOverlay}>
          <Pressable
            accessibilityLabel="Close comment modal"
            accessibilityRole="button"
            onPress={() => setIsCommentModalOpen(false)}
            style={styles.centeredModalBackdrop}
          />

          <View style={styles.standardModalCard}>
            <AppText style={styles.centeredModalTitle} variant="title">
              Add comment
            </AppText>

            <View style={styles.modalCommentInputCard}>
              <TextInput
                multiline
                onChangeText={setDraftComment}
                placeholder="Size, fit, packaging, notes..."
                placeholderTextColor={theme.colors.muted}
                selectionColor={theme.colors.green}
                style={styles.modalCommentInput}
                textAlignVertical="top"
                value={draftComment}
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsCommentModalOpen(false)}
                style={({ pressed }) => [
                  styles.modalActionButton,
                  pressed && styles.modalActionButtonPressed,
                ]}
              >
                <AppText style={styles.modalCancelText} variant="button">
                  Cancel
                </AppText>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={confirmCommentModal}
                style={({ pressed }) => [
                  styles.modalActionButton,
                  styles.modalDoneButton,
                  pressed && styles.modalActionButtonPressed,
                ]}
              >
                <AppText style={styles.modalDoneText} variant="button">
                  Done
                </AppText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingBottom: theme.spacing.md,
    paddingTop: theme.spacing.lg,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  backButtonText: {
    color: theme.colors.greenDark,
    fontSize: 28,
    fontWeight: theme.fontWeight.regular,
    lineHeight: 30,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: theme.fontWeight.bold,
    lineHeight: 32,
  },
  subtitle: {
    ...theme.typography.screenSubtitle,
    lineHeight: 20,
    marginTop: 2,
  },
  form: {
    flex: 1,
    marginTop: theme.spacing.lg + theme.spacing.xs,
  },
  formContent: {
    paddingBottom: theme.spacing.xl + theme.spacing.lg,
  },
  tappableField: {
    borderRadius: theme.radius.lg,
  },
  tappableFieldPressed: {
    opacity: 0.84,
  },
  returnDateField: {
    gap: 7,
  },
  returnDateLabel: {
    ...theme.typography.fieldLabel,
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: theme.fontWeight.semibold,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  returnDateCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    height: 52,
    paddingHorizontal: theme.spacing.md,
  },
  returnDateValue: {
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  fields: {
    gap: 14,
  },
  storeLinkRow: {
    flexDirection: 'row',
    gap: 12,
  },
  storeLinkField: {
    flex: 1,
  },
  helperNote: {
    backgroundColor: theme.colors.sage,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  helperText: {
    color: theme.colors.greenDark,
    fontSize: 12,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 18,
  },
  optionalSection: {
    marginTop: theme.spacing.lg,
  },
  optionalHeading: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 18,
    textTransform: 'uppercase',
  },
  optionalRows: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  optionalItem: {
    gap: theme.spacing.sm,
  },
  optionalRow: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 50,
    paddingHorizontal: theme.spacing.md,
  },
  optionalRowPressed: {
    opacity: 0.82,
  },
  optionalRowCopy: {
    flex: 1,
    paddingRight: theme.spacing.sm,
  },
  optionalRowLabel: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
  optionalRowValue: {
    color: theme.colors.muted,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 16,
    maxWidth: 136,
    textAlign: 'right',
  },
  optionalPlus: {
    color: theme.colors.green,
    fontSize: 22,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 24,
  },
  priceModalRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  currencyChip: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    minWidth: 96,
  },
  currencyChipPressed: {
    opacity: 0.82,
  },
  currencyChipText: {
    color: theme.colors.greenDark,
    fontSize: 14,
    fontWeight: theme.fontWeight.semibold,
  },
  priceInputCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    flex: 1,
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  priceInput: {
    ...theme.typography.input,
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 28,
    padding: 0,
    paddingVertical: 0,
  },
  currencyModalCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    elevation: 8,
    maxWidth: 310,
    padding: 14,
    shadowColor: theme.colors.text,
    shadowOffset: {
      height: 14,
      width: 0,
    },
    shadowOpacity: 0.08,
    shadowRadius: 26,
    width: '74%',
  },
  currencyModalTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: theme.fontWeight.bold,
    lineHeight: 26,
  },
  currencyModalOptions: {
    gap: 6,
    marginTop: theme.spacing.md,
  },
  currencyModalOption: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 50,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 7,
  },
  currencyModalOptionSelected: {
    backgroundColor: theme.colors.sage,
    borderColor: theme.colors.sage,
  },
  currencyModalOptionPressed: {
    opacity: 0.82,
  },
  currencyModalOptionCopy: {
    flex: 1,
    gap: 1,
  },
  currencyModalOptionCode: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 18,
  },
  currencyModalOptionCodeSelected: {
    color: theme.colors.greenDark,
  },
  currencyModalOptionName: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: theme.fontWeight.regular,
    lineHeight: 16,
  },
  currencyModalSelectedDot: {
    backgroundColor: theme.colors.green,
    borderRadius: theme.radius.pill,
    height: 8,
    marginLeft: theme.spacing.md,
    width: 8,
  },
  centeredModalOverlay: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  centeredModalBackdrop: {
    backgroundColor: 'rgba(22, 24, 22, 0.24)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  dateModalCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    elevation: 8,
    maxWidth: 320,
    padding: 12,
    shadowColor: theme.colors.text,
    shadowOffset: {
      height: 14,
      width: 0,
    },
    shadowOpacity: 0.08,
    shadowRadius: 26,
    width: '78%',
  },
  standardModalCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    elevation: 8,
    maxWidth: 310,
    padding: 14,
    shadowColor: theme.colors.text,
    shadowOffset: {
      height: 14,
      width: 0,
    },
    shadowOpacity: 0.08,
    shadowRadius: 26,
    width: '78%',
  },
  centeredModalTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: theme.fontWeight.bold,
    lineHeight: 26,
  },
  centeredModalBody: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    lineHeight: 20,
    marginTop: 10,
  },
  centeredModalCaption: {
    color: theme.colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  calendarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  calendarMonthButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.sage,
    borderRadius: theme.radius.pill,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  calendarMonthButtonPressed: {
    opacity: 0.75,
  },
  calendarMonthButtonText: {
    color: theme.colors.greenDark,
    fontSize: 19,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 20,
    textAlign: 'center',
  },
  calendarMonthLabel: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
  calendarGrid: {
    marginTop: 8,
  },
  calendarWeek: {
    flexDirection: 'row',
  },
  calendarDayCell: {
    alignItems: 'center',
    flex: 1,
    height: 29,
    justifyContent: 'center',
  },
  calendarWeekday: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 14,
  },
  calendarDayButton: {
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    height: 27,
    justifyContent: 'center',
    width: 27,
  },
  calendarDayButtonSelected: {
    backgroundColor: theme.colors.green,
  },
  calendarDayButtonPressed: {
    opacity: 0.78,
  },
  calendarDayText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 16,
  },
  calendarDayTextSelected: {
    color: theme.colors.card,
    fontWeight: theme.fontWeight.semibold,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  modalActionButton: {
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  modalDoneButton: {
    backgroundColor: theme.colors.green,
  },
  modalActionButtonPressed: {
    opacity: 0.78,
  },
  modalCancelText: {
    color: theme.colors.muted,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
  modalDoneText: {
    color: theme.colors.card,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
  photoSlots: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: 10,
  },
  photoSlot: {
    alignItems: 'center',
    aspectRatio: 1,
    backgroundColor: theme.colors.sage,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
  },
  photoSlotPlus: {
    color: theme.colors.greenDark,
    fontSize: 22,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 24,
  },
  modalCommentInputCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    height: 112,
    marginTop: 12,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
  },
  modalCommentInput: {
    ...theme.typography.input,
    color: theme.colors.text,
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    padding: 0,
    paddingVertical: 0,
  },
  actions: {
    paddingTop: theme.spacing.xs,
    width: '100%',
  },
});
