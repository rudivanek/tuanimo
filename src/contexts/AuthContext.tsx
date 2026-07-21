import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { queryClient } from '../lib/queryClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  accountBlocked: string | null;
  clearAccountBlocked: () => void;
  signUp: (email: string, password: string, firstName: string, lastName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const BLOCKED_STORAGE_KEY = 'conelena_account_blocked';

const BLOCKED_DELETED_MSG =
  'Esta cuenta fue eliminada. Si crees que es un error, escríbenos a hola@conelena.app.';
const BLOCKED_DISABLED_MSG =
  'Esta cuenta está deshabilitada. Escríbenos a hola@conelena.app para más información.';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Read from storage so the reason survives the hard navigation that App.tsx
  // performs when there is no session.
  const [accountBlocked, setAccountBlocked] = useState<string | null>(() => {
    try {
      return localStorage.getItem(BLOCKED_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  // Guards against re-checking the same user repeatedly on token refresh
  const lastCheckedUserId = useRef<string | null>(null);

  /**
   * Returns a block message if the account is deleted or disabled, else null.
   * Fails OPEN: if the profile query errors (offline, RLS hiccup), we do not
   * lock the user out — we only block on a definitive positive result.
   */
  const getBlockReason = async (userId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('deleted_at, is_disabled')
        .eq('id', userId)
        .maybeSingle();

      if (error || !data) return null;
      if (data.deleted_at) return BLOCKED_DELETED_MSG;
      if (data.is_disabled) return BLOCKED_DISABLED_MSG;
      return null;
    } catch {
      return null;
    }
  };

  const forceSignOut = async (reason: string) => {
    setAccountBlocked(reason);
    try {
      localStorage.setItem(BLOCKED_STORAGE_KEY, reason);
    } catch {
      /* storage unavailable — message will be lost on navigation, not fatal */
    }
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (err) {
      console.warn('Blocked-account sign-out failed, clearing locally:', err);
    } finally {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sb-'))
        .forEach((k) => localStorage.removeItem(k));
      setSession(null);
      setUser(null);
      lastCheckedUserId.current = null;
      queryClient.clear();
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        try {
          const payload = JSON.parse(atob(session.access_token.split('.')[1]));
          const isExpired = Date.now() >= (payload.exp * 1000) - 60_000;
          if (isExpired) {
            const { data, error } = await supabase.auth.refreshSession();
            if (error || !data.session) {
              await supabase.auth.signOut();
              setSession(null);
              setUser(null);
              setLoading(false);
              return;
            }

            const reason = await getBlockReason(data.session.user.id);
            if (reason) {
              await forceSignOut(reason);
              setLoading(false);
              return;
            }
            lastCheckedUserId.current = data.session.user.id;

            setSession(data.session);
            setUser(data.session.user);
            setLoading(false);
            return;
          }
        } catch {
        }

        const reason = await getBlockReason(session.user.id);
        if (reason) {
          await forceSignOut(reason);
          setLoading(false);
          return;
        }
        lastCheckedUserId.current = session.user.id;
      }

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((error) => {
      console.error('Error getting session:', error);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Optimistically set state so the UI stays responsive.
      setSession(session);
      setUser(session?.user ?? null);

      if (!session?.user) {
        lastCheckedUserId.current = null;
        return;
      }

      // Only re-check on a genuine sign-in, not on every token refresh.
      const isNewSignIn =
        event === 'SIGNED_IN' && lastCheckedUserId.current !== session.user.id;
      if (!isNewSignIn) return;

      // Deferred: calling supabase inside onAuthStateChange synchronously
      // can deadlock the client. setTimeout breaks out of the callback.
      setTimeout(async () => {
        const reason = await getBlockReason(session.user.id);
        if (reason) {
          await forceSignOut(reason);
        } else {
          lastCheckedUserId.current = session.user.id;
        }
      }, 0);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, firstName: string, lastName?: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (!error && data.user) {
      // Save name to profile
      await supabase.from('profiles').update({
        first_name: firstName.trim() || null,
        last_name: lastName?.trim() || null,
      }).eq('id', data.user.id);

      // Send welcome email — fire and forget, don't block login on failure
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (token) {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
          fetch(`${supabaseUrl}/functions/v1/send-welcome-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          }).catch((err) => console.warn('Welcome email failed (non-blocking):', err));
        }
      } catch (err) {
        console.warn('Welcome email setup failed (non-blocking):', err);
      }
    }
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    clearAccountBlocked();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error && data.user) {
      const reason = await getBlockReason(data.user.id);
      if (reason) {
        await forceSignOut(reason);
        return { error: new Error(reason) };
      }
      lastCheckedUserId.current = data.user.id;
    }

    return { error };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (err) {
      console.warn('signOut failed, clearing locally:', err);
    } finally {
      // Drop any Supabase token that survived a failed sign-out
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sb-'))
        .forEach((k) => localStorage.removeItem(k));
      setSession(null);
      setUser(null);
      lastCheckedUserId.current = null;
      queryClient.clear();
    }
  };

  const clearAccountBlocked = () => {
    setAccountBlocked(null);
    try {
      localStorage.removeItem(BLOCKED_STORAGE_KEY);
    } catch {
      /* no-op */
    }
  };

  const value = {
    user,
    session,
    loading,
    accountBlocked,
    clearAccountBlocked,
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
