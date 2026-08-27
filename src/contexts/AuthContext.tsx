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

/**
 * Fires the welcome email (which BCCs rfv@datago.net).
 *
 * Safe to call more than once: the edge function checks
 * email_lifecycle_events and returns { skipped: true, reason: 'already_sent' }
 * if this user already has a day1_empieza_simple event logged.
 */
/**
 * Records that this user is active right now.
 *
 * Writes profiles.last_active_at / sessions_count / first_session_at, which
 * drive the reminder + insight email tracks and the admin engagement tables.
 * A new session is counted after a 30-minute gap.
 *
 * Best-effort and non-blocking: a failure here must never block sign-in.
 */
async function touchActivity(): Promise<void> {
  try {
    await supabase.rpc('touch_user_activity');
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('touch_user_activity failed (non-blocking):', err);
    }
  }
}

async function sendWelcomeEmail(): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    await fetch(`${supabaseUrl}/functions/v1/send-welcome-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (err) {
    console.warn('Welcome email failed (non-blocking):', err);
  }
}

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

  // Set while signUp() is running so the onAuthStateChange handler does not
  // also fire the welcome email — signUp() sends it itself, after it has
  // written first_name to the profile.
  const passwordSignUpInFlight = useRef(false);

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

      // Captured synchronously: signUp() clears this flag once it has sent the
      // welcome email itself, and that can happen before the await below
      // resolves.
      const skipWelcome = passwordSignUpInFlight.current;

      // Deferred: calling supabase inside onAuthStateChange synchronously
      // can deadlock the client. setTimeout breaks out of the callback.
      setTimeout(async () => {
        const reason = await getBlockReason(session.user.id);
        if (reason) {
          await forceSignOut(reason);
          return;
        }
        lastCheckedUserId.current = session.user.id;

        // Google OAuth users never pass through signUp(), so this is the only
        // point at which their welcome email can be triggered. No-op for
        // password signups (skipWelcome) and for anyone who already has one.
        if (!skipWelcome) void sendWelcomeEmail();

        // Stamp activity. Inside the same setTimeout for the deadlock reason
        // noted above. No argument = now().
        void touchActivity();
      }, 0);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, firstName: string, lastName?: string) => {
    // Suppresses the onAuthStateChange welcome trigger for this signup, so the
    // two paths cannot race each other into a duplicate send.
    passwordSignUpInFlight.current = true;
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error || !data.user) return { error };

      // Save name to profile first — the welcome email reads first_name.
      await supabase.from('profiles').update({
        first_name: firstName.trim() || null,
        last_name: lastName?.trim() || null,
      }).eq('id', data.user.id);

      // Fire and forget — don't block signup on email delivery.
      void sendWelcomeEmail();
      return { error: null };
    } finally {
      passwordSignUpInFlight.current = false;
    }
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