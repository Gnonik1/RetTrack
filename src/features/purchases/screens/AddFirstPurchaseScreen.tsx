import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Animated,
  Image,
  Keyboard,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
  View,
} from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { AppScreen } from '../../../components/AppScreen';
import { AppText } from '../../../components/AppText';
import { theme } from '../../../constants/theme';
import { usePlan } from '../../monetization/state/PlanState';
import { useProFeatureGate } from '../../monetization/state/useProFeatureGate';
import {
  DEFAULT_CURRENCY,
  currencyOptions,
  type CurrencyCode,
  isCurrencyCode,
  useAppSettings,
} from '../../settings/state/AppSettingsState';
import type { AddPurchaseInput } from '../state/PurchasesState';
import {
  parsePurchaseDate,
  toLocalDateISO,
} from '../utils/purchaseDates';
import {
  pickPurchasePhotoDraft,
  storePurchasePhoto,
  type PurchasePhotoDraft,
} from '../utils/purchasePhotos';

type AddFirstPurchaseScreenProps = {
  initialValues?: PurchaseFormInitialValues;
  isAccountItemLimitReached?: boolean;
  isGuestItemLimitReached?: boolean;
  isSignedIn?: boolean;
  mode?: AddPurchaseMode;
  onBack?: () => void;
  onLimitSignUp?: () => void;
  onSaveItem?: (input: AddPurchaseInput) => boolean | void;
  onSkip?: () => void;
  photoLimitOverride?: number;
};

type AddPurchaseMode = 'addPurchase' | 'editPurchase' | 'firstPurchase';

type PurchaseFormInitialValues = Partial<AddPurchaseInput> & {
  returnByDetail?: string;
};

type OptionalSectionKey = 'price' | 'purchaseDate' | 'photos' | 'comment';

type DatePickerMode = 'return' | 'purchase';

type PhotoPickerMode = 'add' | 'replace';

type FormErrors = {
  itemName?: string;
  returnDate?: string;
  storeOrLink?: string;
};

type PurchaseTextFieldProps = {
  autoCapitalize?: TextInputProps['autoCapitalize'];
  inputRef?: Ref<TextInput>;
  keyboardType?: TextInputProps['keyboardType'];
  label: string;
  onChangeText: (text: string) => void;
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  placeholder: string;
  returnKeyType?: TextInputProps['returnKeyType'];
  style?: StyleProp<ViewStyle>;
  value: string;
};

const storeOrLinkErrorMessage = 'Add a store or product link to continue';

const screenCopy: Record<
  AddPurchaseMode,
  {
    subtitle: string;
    title: string;
  }
> = {
  addPurchase: {
    subtitle: 'Track return details',
    title: 'Add purchase',
  },
  editPurchase: {
    subtitle: 'Update return details',
    title: 'Edit purchase',
  },
  firstPurchase: {
    subtitle: 'Start with the essentials',
    title: 'Add first purchase',
  },
};

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
    label: 'Add photo',
  },
  {
    key: 'comment',
    label: 'Add comment',
  },
] as const;

const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
const PHOTO_SLOT_SIZE = 48;
const PHOTO_SLOT_REORDER_STEP = PHOTO_SLOT_SIZE + theme.spacing.sm;

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

function FormBackground() {
  return (
    <>
      <LinearGradient
        colors={['#FBFAF3', '#F4F7EF', '#FFF8EC']}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
        start={{ x: 0, y: 0 }}
        style={styles.backgroundBase}
      />
      <View pointerEvents="none" style={styles.backgroundTopSageGlow} />
      <View pointerEvents="none" style={styles.backgroundPaperWash} />
      <View pointerEvents="none" style={styles.backgroundWarmVeil} />
      <View pointerEvents="none" style={styles.backgroundLowerSageWash} />
    </>
  );
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function formatDate(date: Date) {
  return `${monthLabels[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function getDefaultReturnDate(purchaseDate?: Date | null) {
  return addDays(purchaseDate ?? new Date(), 14);
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

function getInitialReturnDate(
  initialValues?: PurchaseFormInitialValues,
  defaultPurchaseDate?: Date | null,
) {
  return (
    parsePurchaseDate({
      dateISO: initialValues?.returnDateISO,
      displayDate: initialValues?.returnByDetail ?? initialValues?.returnBy,
    }) ??
    getDefaultReturnDate(defaultPurchaseDate)
  );
}

function getInitialPurchaseDate(initialValues?: PurchaseFormInitialValues) {
  return parsePurchaseDate({
    dateISO: initialValues?.purchaseDateISO,
    displayDate: initialValues?.purchased,
  });
}

function getAlignedPhotoRemotePaths(
  photoRemotePaths: Array<string | null | undefined> | undefined,
  photoCount: number,
) {
  return Array.from(
    { length: photoCount },
    (_, index) => photoRemotePaths?.[index] ?? null,
  );
}

function clampIndex(index: number, maxIndex: number) {
  return Math.min(Math.max(index, 0), maxIndex);
}

function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);

  if (movedItem === undefined) {
    return items;
  }

  nextItems.splice(toIndex, 0, movedItem);

  return nextItems;
}

function getInitialPriceParts(
  initialValues?: PurchaseFormInitialValues,
  fallbackCurrency: CurrencyCode = DEFAULT_CURRENCY,
): {
  amount: string;
  currency: CurrencyCode;
} {
  const price = initialValues?.price?.trim();

  if (!price) {
    return {
      amount: '',
      currency: fallbackCurrency,
    };
  }

  const [priceCurrency, ...amountParts] = price.split(/\s+/);
  const amount = amountParts.join(' ').trim();

  if (!isCurrencyCode(priceCurrency) || !amount) {
    return {
      amount: price,
      currency: fallbackCurrency,
    };
  }

  return {
    amount,
    currency: priceCurrency,
  };
}

function PurchaseTextField({
  autoCapitalize,
  inputRef,
  keyboardType,
  label,
  onChangeText,
  onSubmitEditing,
  placeholder,
  returnKeyType,
  style,
  value,
}: PurchaseTextFieldProps) {
  return (
    <View style={[styles.fieldGroup, style]}>
      <AppText style={styles.fieldLabel} variant="caption">
        {label}
      </AppText>
      <View style={styles.inputCard}>
        <TextInput
          autoCapitalize={autoCapitalize}
          blurOnSubmit={returnKeyType !== 'next'}
          keyboardType={keyboardType}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.muted}
          ref={inputRef}
          returnKeyType={returnKeyType}
          selectionColor={theme.colors.green}
          style={styles.input}
          value={value}
        />
      </View>
    </View>
  );
}

export function AddFirstPurchaseScreen({
  initialValues,
  isAccountItemLimitReached = false,
  isGuestItemLimitReached = false,
  isSignedIn = false,
  mode = 'firstPurchase',
  onBack,
  onLimitSignUp,
  onSaveItem,
  onSkip,
  photoLimitOverride,
}: AddFirstPurchaseScreenProps) {
  const { defaultCurrency } = useAppSettings();
  const { limits, photoLimit: planPhotoLimit } = usePlan();
  // Shared Pro gate, same integration point Profile and Home use. A signed-in Free
  // subject resolves to showPaywall → /paywall; `signInSource` reuses the existing
  // 'limit' attribution already carried by onLimitSignUp's /sign-up?source=limit.
  const openProGate = useProFeatureGate({ signInSource: 'limit' });
  const isEditMode = mode === 'editPurchase';
  const hasInitialPrice = Boolean(initialValues?.price?.trim());
  const hasInitialReturnDate = Boolean(
    initialValues?.returnDateISO ||
      initialValues?.returnByDetail ||
      initialValues?.returnBy,
  );
  const initialPrice = getInitialPriceParts(initialValues, defaultCurrency);
  const initialPurchaseDate = getInitialPurchaseDate(initialValues);
  const initialReturnDate = getInitialReturnDate(
    initialValues,
    isEditMode ? null : initialPurchaseDate,
  );
  const photoLimit = photoLimitOverride ?? planPhotoLimit;
  const initialPhotoUris = initialValues?.photoUris ?? [];
  const [itemName, setItemName] = useState(initialValues?.itemName ?? '');
  const [store, setStore] = useState(initialValues?.store ?? '');
  const [productLink, setProductLink] = useState(
    initialValues?.productLink ?? '',
  );
  const [returnDate, setReturnDate] = useState<Date | null>(() =>
    initialReturnDate,
  );
  const [hasUserEditedReturnDate, setHasUserEditedReturnDate] = useState(
    isEditMode || hasInitialReturnDate,
  );
  const [priceAmount, setPriceAmount] = useState(initialPrice.amount);
  const [selectedCurrency, setSelectedCurrency] =
    useState<CurrencyCode>(initialPrice.currency);
  const [purchaseDate, setPurchaseDate] = useState<Date | null>(
    initialPurchaseDate,
  );
  const [comment, setComment] = useState(initialValues?.comment ?? '');
  const [photoUris, setPhotoUris] = useState<string[]>(() => initialPhotoUris);
  const [photoRemotePaths, setPhotoRemotePaths] = useState<
    Array<string | null>
  >(() =>
    getAlignedPhotoRemotePaths(
      initialValues?.photoRemotePaths,
      initialPhotoUris.length,
    ),
  );
  const [draftPhotos, setDraftPhotos] = useState<PurchasePhotoDraft[]>([]);
  const [photoMessage, setPhotoMessage] = useState('');
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [photoPickerMode, setPhotoPickerMode] =
    useState<PhotoPickerMode>('add');
  const [draggedPhotoIndex, setDraggedPhotoIndex] = useState<number | null>(
    null,
  );
  const [isPickingPhoto, setIsPickingPhoto] = useState(false);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isLimitMessageDismissed, setIsLimitMessageDismissed] =
    useState(false);
  const [isSaveSuccessful, setIsSaveSuccessful] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [draftPriceAmount, setDraftPriceAmount] = useState('');
  const [priceModalError, setPriceModalError] = useState('');
  const [draftCurrency, setDraftCurrency] =
    useState<CurrencyCode>(initialPrice.currency);
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);
  const [activeDatePicker, setActiveDatePicker] =
    useState<DatePickerMode | null>(null);
  const [draftDate, setDraftDate] = useState(() => initialReturnDate);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    getMonthStart(initialReturnDate),
  );
  const [isPhotosModalOpen, setIsPhotosModalOpen] = useState(false);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [draftComment, setDraftComment] = useState(initialValues?.comment ?? '');
  const [commentModalError, setCommentModalError] = useState('');
  const storeInputRef = useRef<TextInput>(null);
  const productLinkInputRef = useRef<TextInput>(null);
  const photoDragOffsetX = useRef(new Animated.Value(0)).current;
  const photoPickRequestIdRef = useRef(0);
  const saveSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const returnDateDisplay = returnDate
    ? formatDate(returnDate)
    : 'Select return date';
  const headerCopy = screenCopy[mode];
  const saveButtonTitle =
    mode === 'editPurchase' ? 'Save changes' : 'Save item';
  const activeLimitKind = isAccountItemLimitReached
    ? 'account'
    : isGuestItemLimitReached
      ? 'guest'
      : null;
  const isItemLimitBlockingAdd =
    mode !== 'editPurchase' && activeLimitKind !== null;
  const shouldShowLimitMessage =
    isItemLimitBlockingAdd && !isLimitMessageDismissed;
  const limitTitle =
    activeLimitKind === 'account'
      ? 'Purchase limit reached'
      : 'Guest limit reached';
  const limitBody =
    activeLimitKind === 'account'
      ? `Your account can keep up to ${limits.signedInFreePurchases} saved purchases. RetTrack Pro removes the limit.`
      : `Guest mode includes ${limits.guestPurchases} purchase entries. Create an account to add more.`;
  const saveSuccessText =
    mode === 'editPurchase' ? 'Purchase updated' : 'Purchase added';
  const datePickerTitle =
    activeDatePicker === 'purchase'
      ? 'Select purchase date'
      : 'Select return date';
  const calendarRows = getCalendarRows(visibleMonth);
  const pricePreview = priceAmount ? `${selectedCurrency} ${priceAmount}` : '';
  const selectedPhotoIndex = photoUris.length
    ? Math.min(activePhotoIndex, photoUris.length - 1)
    : 0;
  const selectedPhotoUri = photoUris[selectedPhotoIndex];
  const draftPhotoCount = draftPhotos.length;
  const draftPhotoUri = draftPhotos[0]?.uri;
  const remainingPhotoSlots = Math.max(photoLimit - photoUris.length, 0);
  const photoLimitCaption = `You can attach ${photoLimit} ${
    photoLimit === 1 ? 'photo' : 'photos'
  } per item.`;
  const photoCountLabel =
    photoUris.length === 1 ? '1 photo' : `${photoUris.length} photos`;
  const canAddAnotherPhoto = photoUris.length < photoLimit;
  const photoModalTitle =
    photoPickerMode === 'replace' && selectedPhotoUri
      ? 'Replace photo'
      : 'Add photo';
  const photoModalBody =
    draftPhotoCount > 1
      ? `${draftPhotoCount} photos selected`
      : photoPickerMode === 'replace' && selectedPhotoUri
        ? `Replace photo ${selectedPhotoIndex + 1} of ${photoUris.length}`
        : 'Add a receipt or product photo';
  const photoChooseTitle =
    photoPickerMode === 'replace' && selectedPhotoUri
      ? 'Choose replacement'
      : photoPickerMode === 'add' && remainingPhotoSlots > 1
        ? 'Choose photos'
        : 'Choose photo';

  useEffect(() => {
    return () => {
      if (saveSuccessTimerRef.current) {
        clearTimeout(saveSuccessTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isItemLimitBlockingAdd) {
      setIsLimitMessageDismissed(false);
    }
  }, [isItemLimitBlockingAdd]);

  useEffect(() => {
    if (hasInitialPrice || priceAmount.trim() || isPriceModalOpen) {
      return;
    }

    setSelectedCurrency(defaultCurrency);
    setDraftCurrency(defaultCurrency);
  }, [defaultCurrency, hasInitialPrice, isPriceModalOpen, priceAmount]);

  useEffect(() => {
    setActivePhotoIndex((currentIndex) => {
      if (!photoUris.length) {
        return 0;
      }

      return Math.min(currentIndex, photoUris.length - 1);
    });
  }, [photoUris.length]);

  const clearSaveSuccess = () => {
    if (saveSuccessTimerRef.current) {
      clearTimeout(saveSuccessTimerRef.current);
      saveSuccessTimerRef.current = null;
    }

    setIsSaveSuccessful(false);
  };

  const showLocalSuccess = () => {
    if (saveSuccessTimerRef.current) {
      clearTimeout(saveSuccessTimerRef.current);
    }

    setIsSaveSuccessful(true);
    saveSuccessTimerRef.current = setTimeout(() => {
      setIsSaveSuccessful(false);
      saveSuccessTimerRef.current = null;
    }, 2400);
  };

  const reorderPhotos = useCallback(
    (fromIndex: number, toIndex: number) => {
      const maxPhotoIndex = photoUris.length - 1;
      const safeFromIndex = clampIndex(fromIndex, maxPhotoIndex);
      const safeToIndex = clampIndex(toIndex, maxPhotoIndex);

      if (safeFromIndex === safeToIndex) {
        setActivePhotoIndex(safeToIndex);
        return;
      }

      const alignedPhotoRemotePaths = getAlignedPhotoRemotePaths(
        photoRemotePaths,
        photoUris.length,
      );

      clearSaveSuccess();
      setPhotoUris(moveArrayItem(photoUris, safeFromIndex, safeToIndex));
      setPhotoRemotePaths(
        moveArrayItem(alignedPhotoRemotePaths, safeFromIndex, safeToIndex),
      );
      setActivePhotoIndex(safeToIndex);
    },
    [photoRemotePaths, photoUris],
  );

  const finishPhotoDrag = useCallback(
    (gestureDx = 0) => {
      if (draggedPhotoIndex === null || photoUris.length < 2) {
        setDraggedPhotoIndex(null);
        photoDragOffsetX.setValue(0);
        return;
      }

      const targetIndex = clampIndex(
        draggedPhotoIndex + Math.round(gestureDx / PHOTO_SLOT_REORDER_STEP),
        photoUris.length - 1,
      );

      reorderPhotos(draggedPhotoIndex, targetIndex);
      setDraggedPhotoIndex(null);
      photoDragOffsetX.setValue(0);
    },
    [draggedPhotoIndex, photoDragOffsetX, photoUris.length, reorderPhotos],
  );

  const photoSlotPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          draggedPhotoIndex !== null && Math.abs(gestureState.dx) > 3,
        onPanResponderMove: (_, gestureState) => {
          if (draggedPhotoIndex !== null) {
            photoDragOffsetX.setValue(gestureState.dx);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          finishPhotoDrag(gestureState.dx);
        },
        onPanResponderTerminate: () => {
          finishPhotoDrag(0);
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [draggedPhotoIndex, finishPhotoDrag, photoDragOffsetX],
  );

  const startPhotoDrag = (photoIndex: number) => {
    if (!isSignedIn || photoUris.length < 2) {
      return;
    }

    setActivePhotoIndex(photoIndex);
    setDraggedPhotoIndex(photoIndex);
    photoDragOffsetX.setValue(0);
  };

  const clearFormError = (field: keyof FormErrors) => {
    setFormErrors((currentErrors) => {
      if (!currentErrors[field]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[field];

      return nextErrors;
    });
  };

  const handleItemNameChange = (text: string) => {
    setItemName(text);
    clearSaveSuccess();

    if (text.trim()) {
      clearFormError('itemName');
    }
  };

  const handleStoreChange = (text: string) => {
    setStore(text);
    clearSaveSuccess();

    if (text.trim() || productLink.trim()) {
      clearFormError('storeOrLink');
    }
  };

  const handleProductLinkChange = (text: string) => {
    setProductLink(text);
    clearSaveSuccess();

    if (store.trim() || text.trim()) {
      clearFormError('storeOrLink');
    }
  };

  const validateForm = () => {
    const nextErrors: FormErrors = {};

    if (!itemName.trim()) {
      nextErrors.itemName = 'Item name is required';
    }

    if (!returnDate) {
      nextErrors.returnDate = 'Choose a return date to continue';
    }

    if (!store.trim() && !productLink.trim()) {
      nextErrors.storeOrLink = storeOrLinkErrorMessage;
    }

    setFormErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  const getPurchaseInput = (): AddPurchaseInput => {
    const trimmedPriceAmount = priceAmount.trim();
    const nextPhotoUris = photoUris;
    const nextPhotoRemotePaths = getAlignedPhotoRemotePaths(
      photoRemotePaths,
      nextPhotoUris.length,
    );

    return {
      comment: comment.trim() || undefined,
      itemName: itemName.trim(),
      photoRemotePaths:
        isSignedIn && nextPhotoUris.length ? nextPhotoRemotePaths : undefined,
      photoUris: nextPhotoUris.length ? nextPhotoUris : undefined,
      price: trimmedPriceAmount
        ? `${selectedCurrency} ${trimmedPriceAmount}`
        : undefined,
      productLink: productLink.trim() || undefined,
      purchaseDateISO: purchaseDate ? toLocalDateISO(purchaseDate) : undefined,
      purchased: purchaseDate ? formatDate(purchaseDate) : undefined,
      returnBy: returnDate ? formatDate(returnDate) : returnDateDisplay,
      returnDateISO: returnDate ? toLocalDateISO(returnDate) : undefined,
      store: store.trim() || undefined,
    };
  };

  const resetForm = () => {
    const nextReturnDate = getDefaultReturnDate();

    clearSaveSuccess();
    setItemName('');
    setStore('');
    setProductLink('');
    setReturnDate(nextReturnDate);
    setHasUserEditedReturnDate(false);
    setPriceAmount('');
    setSelectedCurrency(defaultCurrency);
    setPurchaseDate(null);
    setComment('');
    setPhotoUris([]);
    setPhotoRemotePaths([]);
    setActivePhotoIndex(0);
    setPhotoPickerMode('add');
    setDraftPhotos([]);
    setPhotoMessage('');
    setIsPickingPhoto(false);
    setIsSavingPhoto(false);
    setFormErrors({});
    setIsLimitMessageDismissed(false);
    setIsPriceModalOpen(false);
    setDraftPriceAmount('');
    setPriceModalError('');
    setDraftCurrency(defaultCurrency);
    setIsCurrencyModalOpen(false);
    setActiveDatePicker(null);
    setDraftDate(nextReturnDate);
    setVisibleMonth(getMonthStart(nextReturnDate));
    setIsPhotosModalOpen(false);
    setIsCommentModalOpen(false);
    setDraftComment('');
    setCommentModalError('');
  };

  const handleSaveItem = () => {
    Keyboard.dismiss();

    if (isItemLimitBlockingAdd) {
      clearSaveSuccess();
      setIsLimitMessageDismissed(false);
      return;
    }

    if (!validateForm()) {
      clearSaveSuccess();
      return;
    }

    if (onSaveItem) {
      const purchaseInput = getPurchaseInput();
      const didSave = onSaveItem(purchaseInput);

      if (didSave === false) {
        clearSaveSuccess();
        setIsLimitMessageDismissed(false);
        return;
      }

      if (mode !== 'editPurchase') {
        resetForm();
      }
      return;
    }

    showLocalSuccess();
  };

  const openPriceModal = () => {
    Keyboard.dismiss();
    setDraftCurrency(selectedCurrency);
    setDraftPriceAmount(priceAmount);
    setPriceModalError('');
    setIsCurrencyModalOpen(false);
    setIsPriceModalOpen(true);
  };

  const closePriceModal = () => {
    setDraftCurrency(selectedCurrency);
    setDraftPriceAmount(priceAmount);
    setPriceModalError('');
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
    const nextPriceAmount = draftPriceAmount.trim();

    if (!nextPriceAmount) {
      setPriceModalError('Enter a price');
      return;
    }

    setPriceAmount(nextPriceAmount);
    setSelectedCurrency(draftCurrency);
    setPriceModalError('');
    clearSaveSuccess();
    setIsCurrencyModalOpen(false);
    setIsPriceModalOpen(false);
  };

  const handleDraftPriceAmountChange = (text: string) => {
    setDraftPriceAmount(text);

    if (text.trim()) {
      setPriceModalError('');
    }
  };

  const openDatePicker = (mode: DatePickerMode) => {
    Keyboard.dismiss();
    const initialDate =
      mode === 'return'
        ? returnDate ?? getDefaultReturnDate()
        : purchaseDate ?? new Date();

    setDraftDate(initialDate);
    setVisibleMonth(getMonthStart(initialDate));
    setActiveDatePicker(mode);
  };

  const closeDatePicker = () => {
    setActiveDatePicker(null);
  };

  const confirmDatePicker = () => {
    if (activeDatePicker === 'return') {
      setHasUserEditedReturnDate(
        (currentHasUserEditedReturnDate) =>
          currentHasUserEditedReturnDate ||
          !returnDate ||
          !isSameDate(returnDate, draftDate),
      );
      setReturnDate(draftDate);
      clearFormError('returnDate');
    }

    if (activeDatePicker === 'purchase') {
      setPurchaseDate(draftDate);

      if (!isEditMode && !hasUserEditedReturnDate) {
        setReturnDate(getDefaultReturnDate(draftDate));
      }
    }

    clearSaveSuccess();
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
    Keyboard.dismiss();
    setDraftComment(comment);
    setCommentModalError('');
    setIsCommentModalOpen(true);
  };

  const closeCommentModal = () => {
    setDraftComment(comment);
    setCommentModalError('');
    setIsCommentModalOpen(false);
  };

  const confirmCommentModal = () => {
    const nextComment = draftComment.trim();

    if (!nextComment) {
      setCommentModalError('Enter a comment or cancel');
      return;
    }

    setComment(nextComment);
    setCommentModalError('');
    clearSaveSuccess();
    setIsCommentModalOpen(false);
  };

  const handleDraftCommentChange = (text: string) => {
    setDraftComment(text);

    if (text.trim()) {
      setCommentModalError('');
    }
  };

  const handleOptionalRowPress = (section: OptionalSectionKey) => {
    Keyboard.dismiss();

    if (section === 'price') {
      openPriceModal();
      return;
    }

    if (section === 'purchaseDate') {
      openDatePicker('purchase');
      return;
    }

    if (section === 'photos') {
      if (canAddAnotherPhoto) {
        openAddPhotoModal();
        return;
      }

      openReplacePhotoModal(selectedPhotoIndex);
      return;
    }

    openCommentModal();
  };

  const openPhotosModal = (mode: PhotoPickerMode, photoIndex = 0) => {
    Keyboard.dismiss();
    clearSaveSuccess();
    photoPickRequestIdRef.current += 1;
    setActivePhotoIndex(photoIndex);
    setPhotoPickerMode(mode);
    setDraftPhotos([]);
    setPhotoMessage('');
    setIsPickingPhoto(false);
    setIsSavingPhoto(false);
    setIsPhotosModalOpen(true);
  };

  const openAddPhotoModal = () => {
    openPhotosModal('add', photoUris.length);
  };

  const openReplacePhotoModal = (photoIndex: number) => {
    if (!photoUris.length) {
      openAddPhotoModal();
      return;
    }

    openPhotosModal(
      'replace',
      Math.min(Math.max(photoIndex, 0), photoUris.length - 1),
    );
  };

  const closePhotosModal = () => {
    photoPickRequestIdRef.current += 1;
    setDraftPhotos([]);
    setPhotoMessage('');
    setIsPickingPhoto(false);
    setIsSavingPhoto(false);
    setIsPhotosModalOpen(false);
  };

  const getAvailablePhotoSlotsForCurrentPicker = () => {
    if (photoPickerMode === 'replace' && photoUris.length) {
      return 1;
    }

    return Math.max(photoLimit - photoUris.length, 0);
  };

  const handlePickPhoto = async () => {
    if (isPickingPhoto) {
      return;
    }

    Keyboard.dismiss();
    clearSaveSuccess();
    setPhotoMessage('');
    const requestId = photoPickRequestIdRef.current + 1;
    photoPickRequestIdRef.current = requestId;
    setIsPickingPhoto(true);

    try {
      const availablePhotoSlots = getAvailablePhotoSlotsForCurrentPicker();

      if (availablePhotoSlots <= 0) {
        setPhotoMessage(photoLimitCaption);
        return;
      }

      const allowsMultipleSelection =
        photoPickerMode === 'add' && availablePhotoSlots > 1;
      const selectionLimit = availablePhotoSlots;
      const result = await pickPurchasePhotoDraft({
        allowsMultipleSelection,
        selectionLimit,
      });

      if (photoPickRequestIdRef.current !== requestId) {
        return;
      }

      if (result.status === 'selected') {
        const limitedAssets = result.assets.slice(0, selectionLimit);

        setDraftPhotos(limitedAssets);

        if (result.assets.length > limitedAssets.length) {
          setPhotoMessage(photoLimitCaption);
        }

        return;
      }

      if (result.status === 'denied') {
        setPhotoMessage('Photo access is needed to attach purchase images.');
        return;
      }

      if (result.status === 'error') {
        setPhotoMessage("We couldn't attach that photo. Please try another image.");
      }
    } finally {
      if (photoPickRequestIdRef.current === requestId) {
        setIsPickingPhoto(false);
      }
    }
  };

  const handleConfirmPhoto = async () => {
    if (!draftPhotos.length || isSavingPhoto) {
      return;
    }

    const availablePhotoSlots = getAvailablePhotoSlotsForCurrentPicker();

    if (availablePhotoSlots <= 0) {
      setPhotoMessage(photoLimitCaption);
      return;
    }

    const requestId = photoPickRequestIdRef.current;
    const photosToStore = draftPhotos.slice(0, availablePhotoSlots);
    setIsSavingPhoto(true);
    setPhotoMessage(
      draftPhotos.length > photosToStore.length ? photoLimitCaption : '',
    );

    try {
      const storedPhotoUris = await Promise.all(
        photosToStore.map((draftPhoto) => storePurchasePhoto(draftPhoto)),
      );

      if (photoPickRequestIdRef.current !== requestId) {
        return;
      }

      const validStoredPhotoUris = storedPhotoUris.filter(
        (photoUri): photoUri is string => Boolean(photoUri),
      );

      if (validStoredPhotoUris.length !== photosToStore.length) {
        setPhotoMessage("We couldn't attach that photo. Please try another image.");
        return;
      }

      const currentPhotoRemotePaths = getAlignedPhotoRemotePaths(
        photoRemotePaths,
        photoUris.length,
      );
      const shouldAppendPhotos = isSignedIn && photoPickerMode === 'add';
      const appendedPhotoUris = validStoredPhotoUris;
      const remainingSlots = Math.max(photoLimit - photoUris.length, 0);
      const allowedAppendedPhotoUris = appendedPhotoUris.slice(
        0,
        remainingSlots,
      );
      const replacementPhotoUri = validStoredPhotoUris[0];
      const nextPhotoUris = shouldAppendPhotos
        ? [...photoUris, ...allowedAppendedPhotoUris]
        : photoUris.length
          ? photoUris.map((photoUri, index) =>
              index === selectedPhotoIndex ? replacementPhotoUri : photoUri,
            )
          : replacementPhotoUri
            ? [replacementPhotoUri]
            : [];
      const nextPhotoRemotePaths = shouldAppendPhotos
        ? [
            ...currentPhotoRemotePaths,
            ...allowedAppendedPhotoUris.map(() => null),
          ].slice(0, nextPhotoUris.length)
        : nextPhotoUris.map((_, index) =>
            index === selectedPhotoIndex
              ? null
              : currentPhotoRemotePaths[index] ?? null,
          );
      const nextActivePhotoIndex = shouldAppendPhotos
        ? nextPhotoUris.length - 1
        : Math.min(selectedPhotoIndex, nextPhotoUris.length - 1);

      setPhotoUris(nextPhotoUris);
      setPhotoRemotePaths(nextPhotoRemotePaths);
      setActivePhotoIndex(Math.max(nextActivePhotoIndex, 0));
      closePhotosModal();
    } catch {
      if (photoPickRequestIdRef.current === requestId) {
        setPhotoMessage("We couldn't attach that photo. Please try another image.");
      }
    } finally {
      if (photoPickRequestIdRef.current === requestId) {
        setIsSavingPhoto(false);
      }
    }
  };

  const handleRemovePhoto = () => {
    clearSaveSuccess();
    const nextPhotoUris = photoUris.filter(
      (_, index) => index !== selectedPhotoIndex,
    );
    const nextPhotoRemotePaths = getAlignedPhotoRemotePaths(
      photoRemotePaths,
      photoUris.length,
    ).filter((_, index) => index !== selectedPhotoIndex);
    const nextActivePhotoIndex = nextPhotoUris.length
      ? Math.min(selectedPhotoIndex, nextPhotoUris.length - 1)
      : 0;

    setPhotoUris(nextPhotoUris);
    setPhotoRemotePaths(nextPhotoRemotePaths);
    setActivePhotoIndex(nextActivePhotoIndex);
    setDraftPhotos([]);
    setPhotoMessage('');
  };

  const handleGuestLimitSignUp = () => {
    clearSaveSuccess();
    onLimitSignUp?.();
  };

  // Account (signed-in Free) counterpart to handleGuestLimitSignUp: same
  // clearSaveSuccess() first, then the shared gate rather than a direct
  // router.push, so paywall routing stays centralized in useProFeatureGate.
  const handleAccountLimitUpgrade = () => {
    clearSaveSuccess();
    openProGate('unlimitedPurchases');
  };

  return (
    <AppScreen style={styles.screen}>
      <FormBackground />

      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
        >
          <AppText style={styles.backButtonText} variant="body">
            {'\u2039'}
          </AppText>
        </Pressable>

        <View style={styles.headerCopy}>
          <AppText style={styles.title} variant="title">
            {headerCopy.title}
          </AppText>
          <AppText style={styles.subtitle} variant="subtitle">
            {headerCopy.subtitle}
          </AppText>
        </View>

        {mode === 'firstPurchase' ? (
          <Pressable
            accessibilityRole="button"
            onPress={onSkip}
            style={({ pressed }) => [
              styles.skipButton,
              pressed && styles.skipButtonPressed,
            ]}
          >
            <AppText style={styles.skipButtonText} variant="button">
              Skip
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.formContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.form}
      >
        <View style={styles.fields}>
          <View style={styles.fieldWithError}>
            <PurchaseTextField
              label="Item name *"
              onChangeText={handleItemNameChange}
              onSubmitEditing={() => storeInputRef.current?.focus()}
              placeholder="e.g. Cashmere coat"
              returnKeyType="next"
              value={itemName}
            />
            {formErrors.itemName ? (
              <AppText style={styles.errorText} variant="caption">
                {formErrors.itemName}
              </AppText>
            ) : null}
          </View>

          <View style={styles.storeLinkRow}>
            <PurchaseTextField
              inputRef={storeInputRef}
              label="Store"
              onChangeText={handleStoreChange}
              onSubmitEditing={() => productLinkInputRef.current?.focus()}
              placeholder="e.g. Farfetch"
              returnKeyType="next"
              style={styles.storeLinkField}
              value={store}
            />
            <PurchaseTextField
              autoCapitalize="none"
              inputRef={productLinkInputRef}
              keyboardType="url"
              label="Link"
              onChangeText={handleProductLinkChange}
              onSubmitEditing={Keyboard.dismiss}
              placeholder="Paste URL"
              returnKeyType="done"
              style={styles.storeLinkField}
              value={productLink}
            />
          </View>

          <View
            style={[
              styles.helperNote,
              formErrors.storeOrLink && styles.helperNoteError,
            ]}
          >
            <AppText
              style={[
                styles.helperText,
                formErrors.storeOrLink && styles.helperTextError,
              ]}
              variant="caption"
            >
              {formErrors.storeOrLink ??
                'Add either a store or product link to continue'}
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
              <View
                style={[
                  styles.returnDateCard,
                  formErrors.returnDate && styles.returnDateCardError,
                ]}
              >
                <AppText style={styles.returnDateValue} variant="body">
                  {returnDateDisplay}
                </AppText>
              </View>
              {formErrors.returnDate ? (
                <AppText style={styles.errorText} variant="caption">
                  {formErrors.returnDate}
                </AppText>
              ) : null}
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
                    : key === 'photos' && selectedPhotoUri
                      ? photoCountLabel
                      : key === 'comment' && comment.trim()
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

                  {key === 'photos' && selectedPhotoUri ? (
                    <View style={styles.photoInlinePanel}>
                      <View style={styles.photoInlinePreviewRow}>
                        <Image
                          resizeMode="cover"
                          source={{ uri: selectedPhotoUri }}
                          style={styles.photoInlineImage}
                        />

                        <View style={styles.photoInlineCopy}>
                          <AppText style={styles.photoInlineTitle} variant="body">
                            {photoUris.length === 1
                              ? 'Photo attached'
                              : `${photoUris.length} photos attached`}
                          </AppText>
                          <AppText
                            style={styles.photoInlineHelper}
                            variant="caption"
                          >
                            {photoLimitCaption}
                          </AppText>
                        </View>
                      </View>

                      {isSignedIn && photoUris.length > 1 ? (
                        <View style={styles.photoSlotRow}>
                          {photoUris.map((photoUri, index) => {
                            const isSelected = index === selectedPhotoIndex;
                            const isDragging = index === draggedPhotoIndex;

                            return (
                              <Animated.View
                                key={`${photoUri}-${index}`}
                                style={[
                                  styles.photoSlotWrapper,
                                  isDragging && styles.photoSlotWrapperDragging,
                                  isDragging && {
                                    transform: [
                                      { translateX: photoDragOffsetX },
                                    ],
                                  },
                                ]}
                                {...photoSlotPanResponder.panHandlers}
                              >
                                <Pressable
                                  accessibilityLabel={`Select photo ${index + 1}. Press and hold to reorder.`}
                                  accessibilityRole="button"
                                  delayLongPress={220}
                                  onLongPress={() => startPhotoDrag(index)}
                                  onPress={() => setActivePhotoIndex(index)}
                                  style={({ pressed }) => [
                                    styles.photoSlotButton,
                                    isSelected && styles.photoSlotButtonSelected,
                                    pressed && styles.photoInlineActionPressed,
                                  ]}
                                >
                                  <Image
                                    resizeMode="cover"
                                    source={{ uri: photoUri }}
                                    style={styles.photoSlotImage}
                                  />
                                  {index === 0 ? (
                                    <View style={styles.photoSlotMainBadge}>
                                      <AppText
                                        style={styles.photoSlotMainBadgeText}
                                        variant="caption"
                                      >
                                        Main
                                      </AppText>
                                    </View>
                                  ) : null}
                                </Pressable>
                              </Animated.View>
                            );
                          })}
                        </View>
                      ) : null}

                      <View style={styles.photoInlineActions}>
                        {canAddAnotherPhoto ? (
                          <Pressable
                            accessibilityRole="button"
                            onPress={openAddPhotoModal}
                            style={({ pressed }) => [
                              styles.photoInlineAction,
                              styles.photoInlinePrimaryAction,
                              pressed && styles.photoInlineActionPressed,
                            ]}
                          >
                            <AppText
                              style={styles.photoInlinePrimaryText}
                              variant="button"
                            >
                              Add photo
                            </AppText>
                          </Pressable>
                        ) : null}

                        <Pressable
                          accessibilityRole="button"
                          onPress={() => openReplacePhotoModal(selectedPhotoIndex)}
                          style={({ pressed }) => [
                            styles.photoInlineAction,
                            canAddAnotherPhoto
                              ? styles.photoInlineSecondaryAction
                              : styles.photoInlinePrimaryAction,
                            pressed && styles.photoInlineActionPressed,
                          ]}
                        >
                          <AppText
                            style={
                              canAddAnotherPhoto
                                ? styles.photoInlineSecondaryText
                                : styles.photoInlinePrimaryText
                            }
                            variant="button"
                          >
                            Replace photo
                          </AppText>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          onPress={handleRemovePhoto}
                          style={({ pressed }) => [
                            styles.photoInlineAction,
                            styles.photoInlineSecondaryAction,
                            pressed && styles.photoInlineActionPressed,
                          ]}
                        >
                          <AppText
                            style={styles.photoInlineSecondaryText}
                            variant="button"
                          >
                            Remove photo
                          </AppText>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={styles.actions}>
        {shouldShowLimitMessage ? (
          <View style={styles.guestLimitCard}>
            <View style={styles.guestLimitCopy}>
              <AppText style={styles.guestLimitTitle} variant="body">
                {limitTitle}
              </AppText>
              <AppText style={styles.guestLimitBody} variant="caption">
                {limitBody}
              </AppText>
            </View>

            <View style={styles.guestLimitActions}>
              {activeLimitKind === 'guest' ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={handleGuestLimitSignUp}
                  style={({ pressed }) => [
                    styles.guestLimitPrimaryAction,
                    pressed && styles.guestLimitActionPressed,
                  ]}
                >
                  <AppText style={styles.guestLimitPrimaryText} variant="button">
                    Sign up
                  </AppText>
                </Pressable>
              ) : null}

              {activeLimitKind === 'account' ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={handleAccountLimitUpgrade}
                  style={({ pressed }) => [
                    styles.guestLimitPrimaryAction,
                    pressed && styles.guestLimitActionPressed,
                  ]}
                >
                  <AppText style={styles.guestLimitPrimaryText} variant="button">
                    Upgrade to Pro
                  </AppText>
                </Pressable>
              ) : null}

              <Pressable
                accessibilityRole="button"
                onPress={() => setIsLimitMessageDismissed(true)}
                style={({ pressed }) => [
                  styles.guestLimitSecondaryAction,
                  pressed && styles.guestLimitActionPressed,
                ]}
              >
                <AppText style={styles.guestLimitSecondaryText} variant="button">
                  {activeLimitKind === 'account' ? 'Got it' : 'Maybe later'}
                </AppText>
              </Pressable>
            </View>
          </View>
        ) : null}

        {isSaveSuccessful ? (
          <AppText style={styles.successText} variant="caption">
            {saveSuccessText}
          </AppText>
        ) : null}
        <AppButton
          disabled={shouldShowLimitMessage}
          onPress={handleSaveItem}
          style={styles.saveButton}
          title={saveButtonTitle}
          variant="primary"
        />
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
                  const isSelected = code === draftCurrency;

                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={code}
                      onPress={() => {
                        setDraftCurrency(code);
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
                    {draftCurrency} {'\u25be'}
                  </AppText>
                </Pressable>

                <View
                  style={[
                    styles.priceInputCard,
                    priceModalError ? styles.modalInputCardError : null,
                  ]}
                >
                  <TextInput
                    keyboardType="decimal-pad"
                    onChangeText={handleDraftPriceAmountChange}
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.muted}
                    selectionColor={theme.colors.green}
                    style={styles.priceInput}
                    value={draftPriceAmount}
                  />
                </View>
              </View>

              {priceModalError ? (
                <AppText style={styles.modalErrorText} variant="caption">
                  {priceModalError}
                </AppText>
              ) : null}

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
        onRequestClose={closePhotosModal}
        transparent
        visible={isPhotosModalOpen}
      >
        <View style={styles.centeredModalOverlay}>
          <Pressable
            accessibilityLabel="Close photos modal"
            accessibilityRole="button"
            onPress={closePhotosModal}
            style={styles.centeredModalBackdrop}
          />

          <View style={styles.standardModalCard}>
            <AppText style={styles.centeredModalTitle} variant="title">
              {photoModalTitle}
            </AppText>
            <AppText style={styles.centeredModalBody} variant="body">
              {photoModalBody}
            </AppText>
            <AppText style={styles.centeredModalCaption} variant="caption">
              {photoLimitCaption}
            </AppText>

            {draftPhotoUri ? (
              <View style={styles.photoModalPreview}>
                <Image
                  resizeMode="cover"
                  source={{ uri: draftPhotoUri }}
                  style={styles.photoModalImage}
                />
              </View>
            ) : null}

            {photoMessage ? (
              <AppText style={styles.photoModalMessage} variant="caption">
                {photoMessage}
              </AppText>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={closePhotosModal}
                style={({ pressed }) => [
                  styles.modalActionButton,
                  pressed && styles.modalActionButtonPressed,
                ]}
              >
                <AppText style={styles.modalCancelText} variant="button">
                  Cancel
                </AppText>
              </Pressable>

              {draftPhotoUri ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={isSavingPhoto}
                  onPress={handleConfirmPhoto}
                  style={({ pressed }) => [
                    styles.modalActionButton,
                    styles.modalDoneButton,
                    pressed &&
                      !isSavingPhoto &&
                      styles.modalActionButtonPressed,
                    isSavingPhoto && styles.modalActionButtonDisabled,
                  ]}
                >
                  <AppText style={styles.modalDoneText} variant="button">
                    Done
                  </AppText>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  disabled={isPickingPhoto}
                  onPress={handlePickPhoto}
                  style={({ pressed }) => [
                    styles.modalActionButton,
                    styles.modalDoneButton,
                    pressed &&
                      !isPickingPhoto &&
                      styles.modalActionButtonPressed,
                    isPickingPhoto && styles.modalActionButtonDisabled,
                  ]}
                >
                  <AppText style={styles.modalDoneText} variant="button">
                    {isPickingPhoto ? 'Opening...' : photoChooseTitle}
                  </AppText>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="none"
        onRequestClose={closeCommentModal}
        transparent
        visible={isCommentModalOpen}
      >
        <View style={styles.centeredModalOverlay}>
          <Pressable
            accessibilityLabel="Close comment modal"
            accessibilityRole="button"
            onPress={closeCommentModal}
            style={styles.centeredModalBackdrop}
          />

          <View style={styles.standardModalCard}>
            <AppText style={styles.centeredModalTitle} variant="title">
              Add comment
            </AppText>

            <View
              style={[
                styles.modalCommentInputCard,
                commentModalError ? styles.modalInputCardError : null,
              ]}
            >
              <TextInput
                multiline
                onChangeText={handleDraftCommentChange}
                placeholder="Size, fit, packaging, notes..."
                placeholderTextColor={theme.colors.muted}
                selectionColor={theme.colors.green}
                style={styles.modalCommentInput}
                textAlignVertical="top"
                value={draftComment}
              />
            </View>

            {commentModalError ? (
              <AppText style={styles.modalErrorText} variant="caption">
                {commentModalError}
              </AppText>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={closeCommentModal}
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
    backgroundColor: '#FBFAF3',
    overflow: 'hidden',
    paddingBottom: theme.spacing.md,
    paddingTop: theme.spacing.lg,
  },
  backgroundBase: {
    ...StyleSheet.absoluteFillObject,
    bottom: -theme.spacing.xxl,
    left: -theme.spacing.md,
    right: -theme.spacing.md,
  },
  backgroundLowerSageWash: {
    backgroundColor: 'rgba(225, 234, 217, 0.18)',
    borderRadius: 190,
    bottom: -105,
    height: 235,
    position: 'absolute',
    right: -145,
    transform: [{ rotate: '11deg' }],
    width: 470,
  },
  backgroundPaperWash: {
    backgroundColor: 'rgba(255, 253, 248, 0.62)',
    borderRadius: 190,
    height: 245,
    left: -120,
    position: 'absolute',
    top: 210,
    transform: [{ rotate: '-16deg' }],
    width: 540,
  },
  backgroundTopSageGlow: {
    backgroundColor: 'rgba(215, 229, 205, 0.36)',
    borderRadius: 180,
    height: 260,
    left: -235,
    position: 'absolute',
    top: -76,
    transform: [{ rotate: '-13deg' }],
    width: 520,
  },
  backgroundWarmVeil: {
    backgroundColor: 'rgba(241, 225, 196, 0.18)',
    borderRadius: 200,
    bottom: 90,
    height: 250,
    left: -250,
    position: 'absolute',
    transform: [{ rotate: '9deg' }],
    width: 560,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
    zIndex: 1,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 253, 248, 0.94)',
    borderColor: 'rgba(222, 227, 216, 0.9)',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    elevation: 3,
    height: 44,
    justifyContent: 'center',
    shadowColor: theme.colors.text,
    shadowOffset: {
      height: 8,
      width: 0,
    },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    width: 44,
  },
  backButtonPressed: {
    backgroundColor: '#F6F8F1',
    opacity: theme.press.pressedOpacity,
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
    ...theme.typography.formTitle,
    color: theme.colors.text,
    lineHeight: 32,
  },
  subtitle: {
    ...theme.typography.screenSubtitle,
    lineHeight: 20,
    marginTop: 2,
  },
  skipButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: theme.radius.pill,
    justifyContent: 'center',
    marginTop: -2,
    minHeight: 40,
    paddingHorizontal: theme.spacing.sm,
  },
  skipButtonPressed: {
    opacity: 0.72,
  },
  skipButtonText: {
    color: theme.colors.greenDark,
    fontSize: 13,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 18,
    opacity: 0.88,
  },
  form: {
    flex: 1,
    marginTop: theme.spacing.lg + theme.spacing.xs,
    zIndex: 1,
  },
  formContent: {
    paddingBottom: theme.spacing.lg,
  },
  fieldGroup: {
    gap: 7,
  },
  fieldLabel: {
    ...theme.typography.fieldLabel,
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: theme.fontWeight.semibold,
    letterSpacing: 0.55,
    textTransform: 'uppercase',
  },
  inputCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 253, 248, 0.95)',
    borderColor: 'rgba(222, 227, 216, 0.92)',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    elevation: 1,
    flexDirection: 'row',
    height: 56,
    paddingHorizontal: theme.spacing.md,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 4,
      width: 0,
    },
    shadowOpacity: 0.025,
    shadowRadius: 10,
  },
  input: {
    ...theme.typography.input,
    color: theme.colors.text,
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 28,
    padding: 0,
    paddingVertical: 0,
  },
  fieldWithError: {
    gap: theme.spacing.xs,
  },
  errorText: {
    color: theme.colors.pending,
    fontSize: 12,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 18,
  },
  tappableField: {
    borderRadius: theme.radius.lg,
  },
  tappableFieldPressed: {
    opacity: theme.press.pressedOpacity,
  },
  returnDateField: {
    gap: 7,
  },
  returnDateLabel: {
    ...theme.typography.fieldLabel,
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: theme.fontWeight.semibold,
    letterSpacing: 0.55,
    textTransform: 'uppercase',
  },
  returnDateCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 253, 248, 0.95)',
    borderColor: 'rgba(222, 227, 216, 0.92)',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    elevation: 1,
    flexDirection: 'row',
    height: 52,
    paddingHorizontal: theme.spacing.md,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 4,
      width: 0,
    },
    shadowOpacity: 0.025,
    shadowRadius: 10,
  },
  returnDateCardError: {
    borderColor: theme.colors.pending,
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
    backgroundColor: 'rgba(238, 243, 233, 0.82)',
    borderColor: 'rgba(216, 226, 207, 0.92)',
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  helperNoteError: {
    backgroundColor: theme.colors.softPending,
  },
  helperText: {
    ...theme.typography.helperText,
    color: '#6F766A',
    fontWeight: theme.fontWeight.medium,
    lineHeight: 18,
  },
  helperTextError: {
    color: theme.colors.pending,
  },
  optionalSection: {
    marginTop: theme.spacing.lg,
  },
  optionalHeading: {
    ...theme.typography.capsMeta,
    color: theme.colors.muted,
    lineHeight: 18,
  },
  optionalRows: {
    backgroundColor: 'rgba(255, 253, 248, 0.48)',
    borderColor: 'rgba(227, 226, 214, 0.86)',
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    gap: 7,
    marginTop: theme.spacing.sm,
    padding: 6,
  },
  optionalItem: {
    gap: 7,
  },
  optionalRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 253, 248, 0.96)',
    borderColor: 'rgba(222, 227, 216, 0.92)',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: theme.spacing.md,
  },
  optionalRowPressed: {
    backgroundColor: '#F7FAF3',
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
    color: '#7E8478',
    flexShrink: 1,
    fontSize: 12,
    fontWeight: theme.fontWeight.regular,
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
  modalInputCardError: {
    borderColor: theme.colors.pending,
  },
  modalErrorText: {
    color: theme.colors.pending,
    fontSize: 12,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 16,
    marginTop: 6,
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
  modalActionButtonDisabled: {
    opacity: 0.55,
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
  photoInlineAction: {
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: theme.spacing.md,
  },
  photoInlineActionPressed: {
    opacity: theme.press.pressedOpacity,
  },
  photoInlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  photoInlineCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  photoInlineHelper: {
    color: theme.colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  photoInlineImage: {
    borderRadius: theme.radius.md,
    height: 58,
    width: 58,
  },
  photoInlinePanel: {
    backgroundColor: '#FAFBF5',
    borderColor: 'rgba(218, 226, 209, 0.96)',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    elevation: 1,
    paddingHorizontal: 13,
    paddingVertical: 12,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 5,
      width: 0,
    },
    shadowOpacity: 0.025,
    shadowRadius: 12,
  },
  photoInlinePreviewRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
  },
  photoInlinePrimaryAction: {
    backgroundColor: theme.colors.green,
  },
  photoInlinePrimaryText: {
    color: theme.colors.card,
    fontSize: 13,
    fontWeight: theme.fontWeight.semibold,
  },
  photoInlineSecondaryAction: {
    backgroundColor: 'rgba(255, 253, 248, 0.92)',
    borderColor: 'rgba(222, 227, 216, 0.95)',
    borderWidth: 1,
  },
  photoInlineSecondaryText: {
    color: theme.colors.greenDark,
    fontSize: 13,
    fontWeight: theme.fontWeight.semibold,
  },
  photoInlineTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 19,
  },
  photoSlotButton: {
    backgroundColor: theme.colors.sage,
    borderColor: 'rgba(255, 253, 248, 0.9)',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    height: PHOTO_SLOT_SIZE,
    overflow: 'hidden',
    width: PHOTO_SLOT_SIZE,
  },
  photoSlotButtonSelected: {
    borderColor: theme.colors.green,
    borderWidth: 2,
  },
  photoSlotImage: {
    height: '100%',
    width: '100%',
  },
  photoSlotMainBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(250, 251, 245, 0.94)',
    borderRadius: theme.radius.pill,
    bottom: 3,
    left: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    position: 'absolute',
  },
  photoSlotMainBadgeText: {
    color: theme.colors.greenDark,
    fontSize: 9,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 11,
  },
  photoSlotRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: 10,
  },
  photoSlotWrapper: {
    height: PHOTO_SLOT_SIZE,
    width: PHOTO_SLOT_SIZE,
  },
  photoSlotWrapperDragging: {
    elevation: 4,
    opacity: 0.92,
    shadowColor: theme.colors.text,
    shadowOffset: {
      height: 8,
      width: 0,
    },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    zIndex: 5,
  },
  photoModalImage: {
    height: '100%',
    width: '100%',
  },
  photoModalMessage: {
    color: theme.colors.pending,
    fontSize: 12,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 17,
    marginTop: 8,
  },
  photoModalPreview: {
    backgroundColor: theme.colors.sage,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    height: 148,
    marginTop: 12,
    overflow: 'hidden',
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
  guestLimitActionPressed: {
    opacity: 0.78,
  },
  guestLimitActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: 12,
  },
  guestLimitBody: {
    color: theme.colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  guestLimitCard: {
    backgroundColor: theme.colors.sage,
    borderColor: '#D8E3D0',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
  },
  guestLimitCopy: {
    gap: 4,
  },
  guestLimitPrimaryAction: {
    alignItems: 'center',
    backgroundColor: theme.colors.green,
    borderRadius: theme.radius.pill,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: theme.spacing.md,
  },
  guestLimitPrimaryText: {
    color: theme.colors.card,
    fontSize: 13,
    fontWeight: theme.fontWeight.semibold,
  },
  guestLimitSecondaryAction: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: theme.spacing.md,
  },
  guestLimitSecondaryText: {
    color: theme.colors.greenDark,
    fontSize: 13,
    fontWeight: theme.fontWeight.semibold,
  },
  guestLimitTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 20,
  },
  actions: {
    gap: theme.spacing.sm,
    paddingTop: 8,
    width: '100%',
    zIndex: 1,
  },
  saveButton: {
    elevation: 4,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 9,
      width: 0,
    },
    shadowOpacity: 0.12,
    shadowRadius: 18,
  },
  successText: {
    color: theme.colors.greenDark,
    fontSize: 12,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 18,
    textAlign: 'center',
  },
});
