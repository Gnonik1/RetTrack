import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { supabase } from '../lib/supabase';
import { getCurrentSession } from '../services/authService';

type AuthStateValue = {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  session: Session | null;
  user: User | null;
};

const AuthStateContext = createContext<AuthStateValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const user = session?.user ?? null;
  const isAuthenticated = Boolean(user);

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

  const value = useMemo(
    () => ({
      isAuthenticated,
      isAuthLoading,
      session,
      user,
    }),
    [isAuthenticated, isAuthLoading, session, user],
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
