import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useChipCooldown(userId: string | null | undefined): boolean {
  const [isCoolingDown, setIsCoolingDown] = useState(false);

  useEffect(() => {
    if (!userId) return;

    supabase
      .from('chip_stats')
      .select('cooldown_until')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.cooldown_until && new Date(data.cooldown_until) > new Date()) {
          setIsCoolingDown(true);
        }
      }, () => {});
  }, [userId]);

  return isCoolingDown;
}
