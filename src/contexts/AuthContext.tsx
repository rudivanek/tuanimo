import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, firstName: string, lastName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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
            setSession(data.session);
            setUser(data.session.user);
            setLoading(false);
            return;
          }
        } catch {
        }
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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
      })();
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
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
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
    }
  };

  const value = {
    user,
    session,
    loading,
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
