import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

export type LatestInsight = {
  created_at: string | null;
  theme: string | null;
};

export function useLatestInsightAt() {
  const { user } = useAuth();

  return useQuery<LatestInsight>({
    queryKey: ['latest-insight-at', user?.id],
    queryFn: async () => {
      if (!user) return { created_at: null, theme: null };
      const { data, error } = await supabase
        .from('mood_weekly_insights')
        .select('created_at, signal_meta')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) return { created_at: null, theme: null };
      const meta = data.signal_meta as { chat?: { dominant?: string } } | null;
      const theme = meta?.chat?.dominant ?? null;
      return { created_at: data.created_at ?? null, theme };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}
