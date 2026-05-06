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

const AppSettingsStateContext = createContext<AppSettingsStateValue | undefined>(
  undefined,
);

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return currencyOptions.some(({ code }) => code === value);
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [defaultCurrency, setDefaultCurrencyState] =
    useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [hasCompletedOnboarding, setHasCompletedOnboardingState] =
    useState(false);
  const [hasHydratedSettings, setHasHydratedSettings] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const hydrateSettings = async () => {
      try {
        const storedSettings = await AsyncStorage.getItem(APP_SETTINGS_STORAGE_KEY);

        if (!isMounted || !storedSettings) {
          return;
        }

        const parsedSettings: unknown = JSON.parse(storedSettings);

        if (!isObjectRecord(parsedSettings)) {
          return;
        }

        if (isCurrencyCode(parsedSettings.defaultCurrency)) {
          setDefaultCurrencyState(parsedSettings.defaultCurrency);
        }

        if (typeof parsedSettings.hasCompletedOnboarding === 'boolean') {
          setHasCompletedOnboardingState(
            parsedSettings.hasCompletedOnboarding,
          );
        }
      } catch {
        // Keep defaults if persisted app settings cannot be read.
      } finally {
        if (isMounted) {
          setHasHydratedSettings(true);
        }
      }
    };

    hydrateSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasHydratedSettings) {
      return;
    }

    AsyncStorage.setItem(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify({ defaultCurrency, hasCompletedOnboarding }),
    ).catch(() => {
      // App settings persistence is best-effort for the frontend-only app.
    });
  }, [defaultCurrency, hasCompletedOnboarding, hasHydratedSettings]);

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
