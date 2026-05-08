import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { supabase } from '../lib/supabase';
import { getCurrentSession, getProfileFullName } from '../services/authService';

type AuthStateValue = {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  isProfileLoading: boolean;
  profileFullName: string | null;
  refreshProfile: () => Promise<void>;
  session: Session | null;
  user: User | null;
};

const AuthStateContext = createContext<AuthStateValue | undefined>(undefined);

function compactFullName(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getUserMetadataFullName(user?: User | null) {
  return compactFullName(user?.user_metadata?.full_name);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [profileFullName, setProfileFullName] = useState<string | null>(null);
  const user = session?.user ?? null;
  const isAuthenticated = Boolean(user);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfileFullName(null);
      setIsProfileLoading(false);
      return;
    }

    const fallbackFullName = getUserMetadataFullName(user);

    setIsProfileLoading(true);

    try {
      const { data, error } = await getProfileFullName(user.id);

      if (error) {
        setProfileFullName(fallbackFullName);
        return;
      }

      setProfileFullName(compactFullName(data?.full_name) ?? fallbackFullName);
    } catch {
      setProfileFullName(fallbackFullName);
    } finally {
      setIsProfileLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    const hydrateSession = async () => {
      try {
        const { data } = await getCurrentSession();

        if (!isMounted) {
          return;
        }

        setSession(data.session ?? null);
      } catch {
        if (isMounted) {
          setSession(null);
        }
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    };

    const { data: authStateListener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!isMounted) {
          return;
        }

        setSession(nextSession);
        setIsAuthLoading(false);
      },
    );

    hydrateSession();

    return () => {
      isMounted = false;
      authStateListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const value = useMemo(
    () => ({
      isAuthenticated,
      isAuthLoading,
      isProfileLoading,
      profileFullName,
      refreshProfile,
      session,
      user,
    }),
    [
      isAuthenticated,
      isAuthLoading,
      isProfileLoading,
      profileFullName,
      refreshProfile,
      session,
      user,
    ],
  );

  return (
    <AuthStateContext.Provider value={value}>
      {children}
    </AuthStateContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthStateContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
