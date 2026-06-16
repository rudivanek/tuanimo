/**
 * useOnboardingGate.ts
 *
 * Checks whether the current user needs to see the onboarding conversation.
 * Reads `onboarding_v2_completed` from `profiles`.
 *
 * Returns:
 *   needsOnboarding  — true while flag is false/null (shows overlay)
 *   markComplete     — flips flag to true and dismisses overlay
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useOnboardingGate(userId: string | null, authLoading: boolean) {
  // null = still checking, true = needs onboarding, false = already done
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading || !userId) {
      setNeedsOnboarding(null);
      return;
    }

    let cancelled = false;

    supabase
      .from('profiles')
      .select('onboarding_v2_completed')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error) return;
        // If column doesn't exist yet or is false/null → show onboarding
        const done = data?.onboarding_v2_completed === true;
        setNeedsOnboarding(!done);
      });

    return () => { cancelled = true; };
  }, [userId, authLoading]);

  const markComplete = useCallback(async () => {
    if (!userId) return;
    await supabase
      .from('profiles')
      .update({ onboarding_v2_completed: true })
      .eq('id', userId);
    setNeedsOnboarding(false);
  }, [userId]);

  // While still checking, treat as "not needed" to avoid flash
  return {
    needsOnboarding: needsOnboarding === true,
    markComplete,
  };
}