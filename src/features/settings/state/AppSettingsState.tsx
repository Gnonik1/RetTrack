import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  advanceHomeReminderNudgeForEligibleDay,
  createResetHomeReminderNudgeState,
  loadHomeReminderNudgeState,
  saveHomeReminderNudgeState,
} from '../../notifications/homeReminderNudge';
import { useAuth } from '../../../state/AuthState';

export const currencyOptions = [
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

export type CurrencyCode = (typeof currencyOptions)[number]['code'];
export type NotificationPromptStatus = 'dismissed' | 'enabled' | 'undecided';

export const DEFAULT_CURRENCY: CurrencyCode = 'USD';
const DEFAULT_NOTIFICATION_PROMPT_STATUS: NotificationPromptStatus = 'undecided';

type NotificationPreference = {
  notificationPromptStatus: NotificationPromptStatus;
  remindersEnabled: boolean;
};

type AppSettingsStateValue = {
  appSettingsScopeKey: string | null;
  completeOnboarding: () => void;
  defaultCurrency: CurrencyCode;
  hasCompletedOnboarding: boolean;
  hasHydratedSettings: boolean;
  isHomeReminderNudgeScopeReady: boolean;
  isSettingsScopeReady: boolean;
  notificationPromptStatus: NotificationPromptStatus;
  persistNotificationPreference: (
    preference: NotificationPreference,
  ) => Promise<void>;
  recordEligibleHomeReminderDay: () => Promise<boolean>;
  remindersEnabled: boolean;
  resetHomeReminderNudge: () => Promise<boolean>;
  setDefaultCurrency: (currency: CurrencyCode) => void;
  setNotificationPromptStatus: (status: NotificationPromptStatus) => void;
  setRemindersEnabled: (isEnabled: boolean) => void;
};

const APP_SETTINGS_STORAGE_KEY = 'rettrack:app-settings:v1';
const DEFAULT_CURRENCY_STORAGE_KEY = 'rettrack:defaultCurrency:v1';
const GUEST_APP_SETTINGS_SCOPE_KEY = 'guest';
const ONBOARDING_COMPLETION_STORAGE_KEY_PREFIX =
  `${APP_SETTINGS_STORAGE_KEY}:hasCompletedOnboarding`;
const NOTIFICATION_PROMPT_STATUS_STORAGE_KEY_PREFIX =
  `${APP_SETTINGS_STORAGE_KEY}:notificationPromptStatus`;
const REMINDERS_ENABLED_STORAGE_KEY_PREFIX =
  `${APP_SETTINGS_STORAGE_KEY}:remindersEnabled`;

const AppSettingsStateContext = createContext<AppSettingsStateValue | undefined>(
  undefined,
);

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return currencyOptions.some(({ code }) => code === value);
}

function isNotificationPromptStatus(
  value: unknown,
): value is NotificationPromptStatus {
  return value === 'dismissed' || value === 'enabled' || value === 'undecided';
}

function parseStoredBoolean(value: string | null) {
  if (value === null) {
    return null;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  try {
    const parsedValue: unknown = JSON.parse(value);

    return typeof parsedValue === 'boolean' ? parsedValue : null;
  } catch {
    return null;
  }
}

function parseStoredCurrency(value: string | null) {
  if (isCurrencyCode(value)) {
    return value;
  }

  if (value === null) {
    return null;
  }

  try {
    const parsedValue: unknown = JSON.parse(value);

    return isCurrencyCode(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

function parseStoredNotificationPromptStatus(value: string | null) {
  if (isNotificationPromptStatus(value)) {
    return value;
  }

  if (value === null) {
    return null;
  }

  try {
    const parsedValue: unknown = JSON.parse(value);

    return isNotificationPromptStatus(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

function parseStoredAppSettings(value: string | null) {
  if (value === null) {
    return null;
  }

  try {
    const parsedSettings: unknown = JSON.parse(value);

    if (!isObjectRecord(parsedSettings)) {
      return null;
    }

    return {
      defaultCurrency: isCurrencyCode(parsedSettings.defaultCurrency)
        ? parsedSettings.defaultCurrency
        : null,
      hasCompletedOnboarding:
        typeof parsedSettings.hasCompletedOnboarding === 'boolean'
          ? parsedSettings.hasCompletedOnboarding
          : null,
      notificationPromptStatus: isNotificationPromptStatus(
        parsedSettings.notificationPromptStatus,
      )
        ? parsedSettings.notificationPromptStatus
        : null,
      remindersEnabled:
        typeof parsedSettings.remindersEnabled === 'boolean'
          ? parsedSettings.remindersEnabled
          : null,
    };
  } catch {
    return null;
  }
}

function getAppSettingsScopeKey(userId?: string | null) {
  return userId
    ? `user:${encodeURIComponent(userId)}`
    : GUEST_APP_SETTINGS_SCOPE_KEY;
}

function getOnboardingCompletionStorageKey(scopeKey: string) {
  return `${ONBOARDING_COMPLETION_STORAGE_KEY_PREFIX}:${scopeKey}`;
}

function getNotificationPromptStatusStorageKey(scopeKey: string) {
  return `${NOTIFICATION_PROMPT_STATUS_STORAGE_KEY_PREFIX}:${scopeKey}`;
}

function getRemindersEnabledStorageKey(scopeKey: string) {
  return `${REMINDERS_ENABLED_STORAGE_KEY_PREFIX}:${scopeKey}`;
}

async function persistNotificationPreferenceForScope(
  scopeKey: string,
  preference: NotificationPreference,
) {
  await AsyncStorage.multiSet([
    [
      getNotificationPromptStatusStorageKey(scopeKey),
      preference.notificationPromptStatus,
    ],
    [getRemindersEnabledStorageKey(scopeKey), String(preference.remindersEnabled)],
  ]);
}

export async function getStoredHasCompletedOnboardingForUser(userId: string) {
  const storedValue = await AsyncStorage.getItem(
    getOnboardingCompletionStorageKey(getAppSettingsScopeKey(userId)),
  );

  return parseStoredBoolean(storedValue) ?? false;
}

async function hydrateAppSettingsScope(scopeKey: string) {
  const onboardingCompletionStorageKey =
    getOnboardingCompletionStorageKey(scopeKey);
  const notificationPromptStatusStorageKey =
    getNotificationPromptStatusStorageKey(scopeKey);
  const remindersEnabledStorageKey = getRemindersEnabledStorageKey(scopeKey);
  const [
    storedDefaultCurrency,
    storedOnboardingCompletion,
    storedNotificationPromptStatus,
    storedRemindersEnabled,
    storedLegacySettings,
  ] = await Promise.all([
    AsyncStorage.getItem(DEFAULT_CURRENCY_STORAGE_KEY),
    AsyncStorage.getItem(onboardingCompletionStorageKey),
    AsyncStorage.getItem(notificationPromptStatusStorageKey),
    AsyncStorage.getItem(remindersEnabledStorageKey),
    AsyncStorage.getItem(APP_SETTINGS_STORAGE_KEY),
  ]);
  const legacySettings = parseStoredAppSettings(storedLegacySettings);
  const nextDefaultCurrency =
    parseStoredCurrency(storedDefaultCurrency) ??
    legacySettings?.defaultCurrency ??
    DEFAULT_CURRENCY;
  let nextHasCompletedOnboarding =
    parseStoredBoolean(storedOnboardingCompletion);

  if (
    nextHasCompletedOnboarding === null &&
    scopeKey === GUEST_APP_SETTINGS_SCOPE_KEY &&
    legacySettings?.hasCompletedOnboarding !== null &&
    legacySettings?.hasCompletedOnboarding !== undefined
  ) {
    nextHasCompletedOnboarding = legacySettings.hasCompletedOnboarding;
    await AsyncStorage.setItem(
      onboardingCompletionStorageKey,
      String(nextHasCompletedOnboarding),
    ).catch(() => undefined);
  }

  if (storedDefaultCurrency === null && legacySettings?.defaultCurrency) {
    await AsyncStorage.setItem(
      DEFAULT_CURRENCY_STORAGE_KEY,
      legacySettings.defaultCurrency,
    ).catch(() => undefined);
  }

  return {
    defaultCurrency: nextDefaultCurrency,
    hasCompletedOnboarding: nextHasCompletedOnboarding ?? false,
    notificationPromptStatus:
      parseStoredNotificationPromptStatus(storedNotificationPromptStatus) ??
      legacySettings?.notificationPromptStatus ??
      DEFAULT_NOTIFICATION_PROMPT_STATUS,
    remindersEnabled:
      parseStoredBoolean(storedRemindersEnabled) ??
      legacySettings?.remindersEnabled ??
      false,
  };
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const { isAuthLoading, user } = useAuth();
  const appSettingsScopeKey = useMemo(
    () => (isAuthLoading ? null : getAppSettingsScopeKey(user?.id)),
    [isAuthLoading, user?.id],
  );
  const [defaultCurrency, setDefaultCurrencyState] =
    useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [hasCompletedOnboarding, setHasCompletedOnboardingState] =
    useState(false);
  const [notificationPromptStatus, setNotificationPromptStatusState] =
    useState<NotificationPromptStatus>(DEFAULT_NOTIFICATION_PROMPT_STATUS);
  const [remindersEnabled, setRemindersEnabledState] = useState(false);
  const [hasHydratedSettings, setHasHydratedSettings] = useState(false);
  const [hydratedSettingsScopeKey, setHydratedSettingsScopeKey] = useState<
    string | null
  >(null);
  const [
    hydratedHomeReminderNudgeScopeKey,
    setHydratedHomeReminderNudgeScopeKey,
  ] = useState<string | null>(null);
  const [
    failedHomeReminderNudgeScopeKey,
    setFailedHomeReminderNudgeScopeKey,
  ] = useState<string | null>(null);
  const appSettingsScopeKeyRef = useRef<string | null>(appSettingsScopeKey);
  const failedHomeReminderNudgeScopeKeyRef = useRef<string | null>(
    failedHomeReminderNudgeScopeKey,
  );
  const isHomeReminderNudgeScopeReadyRef = useRef(false);
  const isHomeReminderNudgeOperationPendingRef = useRef(false);
  const isSettingsScopeReadyRef = useRef(false);
  const isSettingsScopeReady =
    hasHydratedSettings &&
    appSettingsScopeKey !== null &&
    hydratedSettingsScopeKey === appSettingsScopeKey;
  const isHomeReminderNudgeScopeReady =
    isSettingsScopeReady &&
    hydratedHomeReminderNudgeScopeKey === appSettingsScopeKey &&
    failedHomeReminderNudgeScopeKey !== appSettingsScopeKey;

  appSettingsScopeKeyRef.current = appSettingsScopeKey;
  failedHomeReminderNudgeScopeKeyRef.current =
    failedHomeReminderNudgeScopeKey;
  isHomeReminderNudgeScopeReadyRef.current =
    isHomeReminderNudgeScopeReady;
  isSettingsScopeReadyRef.current = isSettingsScopeReady;

  useEffect(() => {
    if (appSettingsScopeKey === null) {
      setHasHydratedSettings(false);
      setHydratedSettingsScopeKey(null);
      return;
    }

    let isMounted = true;

    const hydrateSettings = async () => {
      try {
        const nextSettings = await hydrateAppSettingsScope(appSettingsScopeKey);

        if (!isMounted) {
          return;
        }

        setDefaultCurrencyState(nextSettings.defaultCurrency);
        setHasCompletedOnboardingState(nextSettings.hasCompletedOnboarding);
        setNotificationPromptStatusState(nextSettings.notificationPromptStatus);
        setRemindersEnabledState(nextSettings.remindersEnabled);
      } catch {
        if (isMounted) {
          setDefaultCurrencyState(DEFAULT_CURRENCY);
          setHasCompletedOnboardingState(false);
          setNotificationPromptStatusState(DEFAULT_NOTIFICATION_PROMPT_STATUS);
          setRemindersEnabledState(false);
        }
      } finally {
        if (isMounted) {
          setHydratedSettingsScopeKey(appSettingsScopeKey);
          setHasHydratedSettings(true);
        }
      }
    };

    setHasHydratedSettings(false);
    setHydratedSettingsScopeKey(null);
    hydrateSettings();

    return () => {
      isMounted = false;
    };
  }, [appSettingsScopeKey]);

  useEffect(() => {
    if (!isSettingsScopeReady || appSettingsScopeKey === null) {
      setHydratedHomeReminderNudgeScopeKey(null);
      setFailedHomeReminderNudgeScopeKey(null);
      return;
    }

    let isMounted = true;
    const scopeKey = appSettingsScopeKey;

    setHydratedHomeReminderNudgeScopeKey(null);
    failedHomeReminderNudgeScopeKeyRef.current = null;
    setFailedHomeReminderNudgeScopeKey(null);

    const hydrateHomeReminderNudgeScope = async () => {
      try {
        await loadHomeReminderNudgeState(scopeKey);

        if (
          !isMounted ||
          appSettingsScopeKeyRef.current !== scopeKey
        ) {
          return;
        }

        setHydratedHomeReminderNudgeScopeKey(scopeKey);
      } catch {
        if (
          isMounted &&
          appSettingsScopeKeyRef.current === scopeKey &&
          !isHomeReminderNudgeOperationPendingRef.current
        ) {
          isHomeReminderNudgeScopeReadyRef.current = false;
          failedHomeReminderNudgeScopeKeyRef.current = scopeKey;
          setFailedHomeReminderNudgeScopeKey(scopeKey);
        }
      }
    };

    hydrateHomeReminderNudgeScope();

    return () => {
      isMounted = false;
    };
  }, [appSettingsScopeKey, isSettingsScopeReady]);

  useEffect(() => {
    if (!hasHydratedSettings) {
      return;
    }

    AsyncStorage.setItem(
      DEFAULT_CURRENCY_STORAGE_KEY,
      defaultCurrency,
    ).catch(() => {
      // App settings persistence is best-effort for the frontend-only app.
    });
  }, [defaultCurrency, hasHydratedSettings]);

  useEffect(() => {
    if (
      !hasHydratedSettings ||
      appSettingsScopeKey === null ||
      hydratedSettingsScopeKey !== appSettingsScopeKey
    ) {
      return;
    }

    AsyncStorage.setItem(
      getOnboardingCompletionStorageKey(appSettingsScopeKey),
      String(hasCompletedOnboarding),
    ).catch(() => {
      // Scoped onboarding persistence is best-effort for the local app state.
    });
  }, [
    appSettingsScopeKey,
    hasCompletedOnboarding,
    hasHydratedSettings,
    hydratedSettingsScopeKey,
  ]);

  useEffect(() => {
    if (
      !hasHydratedSettings ||
      appSettingsScopeKey === null ||
      hydratedSettingsScopeKey !== appSettingsScopeKey
    ) {
      return;
    }

    AsyncStorage.setItem(
      getRemindersEnabledStorageKey(appSettingsScopeKey),
      String(remindersEnabled),
    ).catch(() => {
      // Scoped reminder preference persistence is best-effort.
    });
  }, [
    appSettingsScopeKey,
    hasHydratedSettings,
    hydratedSettingsScopeKey,
    remindersEnabled,
  ]);

  useEffect(() => {
    if (
      !hasHydratedSettings ||
      appSettingsScopeKey === null ||
      hydratedSettingsScopeKey !== appSettingsScopeKey
    ) {
      return;
    }

    AsyncStorage.setItem(
      getNotificationPromptStatusStorageKey(appSettingsScopeKey),
      notificationPromptStatus,
    ).catch(() => {
      // Scoped notification prompt persistence is best-effort.
    });
  }, [
    appSettingsScopeKey,
    hasHydratedSettings,
    hydratedSettingsScopeKey,
    notificationPromptStatus,
  ]);

  const completeOnboarding = useCallback(() => {
    setHasCompletedOnboardingState(true);
  }, []);

  const setDefaultCurrency = useCallback((currency: CurrencyCode) => {
    setDefaultCurrencyState(currency);
  }, []);

  const setRemindersEnabled = useCallback((isEnabled: boolean) => {
    setRemindersEnabledState(isEnabled);
  }, []);

  const setNotificationPromptStatus = useCallback(
    (status: NotificationPromptStatus) => {
      setNotificationPromptStatusState(status);
    },
    [],
  );

  const persistNotificationPreference = useCallback(
    async (preference: NotificationPreference) => {
      if (
        appSettingsScopeKey === null ||
        hydratedSettingsScopeKey !== appSettingsScopeKey
      ) {
        throw new Error('App settings must hydrate before saving preferences.');
      }

      await persistNotificationPreferenceForScope(
        appSettingsScopeKey,
        preference,
      );

      setNotificationPromptStatusState(preference.notificationPromptStatus);
      setRemindersEnabledState(preference.remindersEnabled);
    },
    [appSettingsScopeKey, hydratedSettingsScopeKey],
  );

  const markHomeReminderNudgeScopeFailed = useCallback((scopeKey: string) => {
    if (appSettingsScopeKeyRef.current !== scopeKey) {
      return;
    }

    isHomeReminderNudgeScopeReadyRef.current = false;
    failedHomeReminderNudgeScopeKeyRef.current = scopeKey;
    setHydratedHomeReminderNudgeScopeKey(null);
    setFailedHomeReminderNudgeScopeKey(scopeKey);
  }, []);

  const recordEligibleHomeReminderDay = useCallback(async () => {
    const scopeKey = appSettingsScopeKeyRef.current;

    if (
      scopeKey === null ||
      !isHomeReminderNudgeScopeReadyRef.current ||
      isHomeReminderNudgeOperationPendingRef.current
    ) {
      return false;
    }

    isHomeReminderNudgeOperationPendingRef.current = true;

    try {
      const currentState = await loadHomeReminderNudgeState(scopeKey);

      if (
        appSettingsScopeKeyRef.current !== scopeKey ||
        !isHomeReminderNudgeScopeReadyRef.current
      ) {
        return false;
      }

      const result =
        advanceHomeReminderNudgeForEligibleDay(currentState);

      await saveHomeReminderNudgeState(scopeKey, result.state);

      if (
        appSettingsScopeKeyRef.current !== scopeKey ||
        !isHomeReminderNudgeScopeReadyRef.current
      ) {
        return false;
      }

      return result.shouldPresent;
    } catch {
      markHomeReminderNudgeScopeFailed(scopeKey);
      return false;
    } finally {
      isHomeReminderNudgeOperationPendingRef.current = false;
    }
  }, [markHomeReminderNudgeScopeFailed]);

  const resetHomeReminderNudge = useCallback(async () => {
    const scopeKey = appSettingsScopeKeyRef.current;

    if (
      scopeKey === null ||
      !isSettingsScopeReadyRef.current ||
      failedHomeReminderNudgeScopeKeyRef.current === scopeKey ||
      isHomeReminderNudgeOperationPendingRef.current
    ) {
      return false;
    }

    isHomeReminderNudgeOperationPendingRef.current = true;

    try {
      await saveHomeReminderNudgeState(
        scopeKey,
        createResetHomeReminderNudgeState(),
      );

      if (
        appSettingsScopeKeyRef.current !== scopeKey ||
        !isSettingsScopeReadyRef.current
      ) {
        return false;
      }

      failedHomeReminderNudgeScopeKeyRef.current = null;
      isHomeReminderNudgeScopeReadyRef.current = true;
      setFailedHomeReminderNudgeScopeKey((failedScopeKey) =>
        failedScopeKey === scopeKey ? null : failedScopeKey,
      );
      setHydratedHomeReminderNudgeScopeKey(scopeKey);

      return true;
    } catch {
      markHomeReminderNudgeScopeFailed(scopeKey);
      return false;
    } finally {
      isHomeReminderNudgeOperationPendingRef.current = false;
    }
  }, [markHomeReminderNudgeScopeFailed]);

  const value = useMemo(
    () => ({
      appSettingsScopeKey,
      completeOnboarding,
      defaultCurrency,
      hasCompletedOnboarding,
      hasHydratedSettings,
      isHomeReminderNudgeScopeReady,
      isSettingsScopeReady,
      notificationPromptStatus,
      persistNotificationPreference,
      recordEligibleHomeReminderDay,
      remindersEnabled,
      resetHomeReminderNudge,
      setDefaultCurrency,
      setNotificationPromptStatus,
      setRemindersEnabled,
    }),
    [
      appSettingsScopeKey,
      completeOnboarding,
      defaultCurrency,
      hasCompletedOnboarding,
      hasHydratedSettings,
      isHomeReminderNudgeScopeReady,
      isSettingsScopeReady,
      notificationPromptStatus,
      persistNotificationPreference,
      recordEligibleHomeReminderDay,
      remindersEnabled,
      resetHomeReminderNudge,
      setDefaultCurrency,
      setNotificationPromptStatus,
      setRemindersEnabled,
    ],
  );

  return (
    <AppSettingsStateContext.Provider value={value}>
      {children}
    </AppSettingsStateContext.Provider>
  );
}

export function useAppSettings() {
  const context = useContext(AppSettingsStateContext);

  if (!context) {
    throw new Error('useAppSettings must be used within AppSettingsProvider');
  }

  return context;
}
