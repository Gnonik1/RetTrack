import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

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

export const DEFAULT_CURRENCY: CurrencyCode = 'USD';

type AppSettingsStateValue = {
  completeOnboarding: () => void;
  defaultCurrency: CurrencyCode;
  hasCompletedOnboarding: boolean;
  hasHydratedSettings: boolean;
  setDefaultCurrency: (currency: CurrencyCode) => void;
};

const APP_SETTINGS_STORAGE_KEY = 'rettrack:app-settings:v1';
const DEFAULT_CURRENCY_STORAGE_KEY = 'rettrack:defaultCurrency:v1';
const GUEST_APP_SETTINGS_SCOPE_KEY = 'guest';
const ONBOARDING_COMPLETION_STORAGE_KEY_PREFIX =
  `${APP_SETTINGS_STORAGE_KEY}:hasCompletedOnboarding`;

const AppSettingsStateContext = createContext<AppSettingsStateValue | undefined>(
  undefined,
);

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return currencyOptions.some(({ code }) => code === value);
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

export async function getStoredHasCompletedOnboardingForUser(userId: string) {
  const storedValue = await AsyncStorage.getItem(
    getOnboardingCompletionStorageKey(getAppSettingsScopeKey(userId)),
  );

  return parseStoredBoolean(storedValue) ?? false;
}

async function hydrateAppSettingsScope(scopeKey: string) {
  const onboardingCompletionStorageKey =
    getOnboardingCompletionStorageKey(scopeKey);
  const [storedDefaultCurrency, storedOnboardingCompletion, storedLegacySettings] =
    await Promise.all([
      AsyncStorage.getItem(DEFAULT_CURRENCY_STORAGE_KEY),
      AsyncStorage.getItem(onboardingCompletionStorageKey),
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
  const [hasHydratedSettings, setHasHydratedSettings] = useState(false);
  const [hydratedSettingsScopeKey, setHydratedSettingsScopeKey] = useState<
    string | null
  >(null);

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
      } catch {
        if (isMounted) {
          setDefaultCurrencyState(DEFAULT_CURRENCY);
          setHasCompletedOnboardingState(false);
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

  const completeOnboarding = useCallback(() => {
    setHasCompletedOnboardingState(true);
  }, []);

  const setDefaultCurrency = useCallback((currency: CurrencyCode) => {
    setDefaultCurrencyState(currency);
  }, []);

  const value = useMemo(
    () => ({
      completeOnboarding,
      defaultCurrency,
      hasCompletedOnboarding,
      hasHydratedSettings,
      setDefaultCurrency,
    }),
    [
      completeOnboarding,
      defaultCurrency,
      hasCompletedOnboarding,
      hasHydratedSettings,
      setDefaultCurrency,
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
