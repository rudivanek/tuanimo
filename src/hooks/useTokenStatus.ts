import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

export interface TokenStatus {
  isTokenExhausted: boolean;
  reason: 'OK' | 'DAILY_LIMIT_REACHED' | 'MONTHLY_LIMIT_REACHED' | null;
  dailyUsed: number;
  dailyLimit: number;
  monthlyUsed: number;
  monthlyLimit: number;
  isLoaded: boolean;
}

export function useTokenStatus(): TokenStatus {
  const { user } = useAuth();

  const { data, isSuccess } = useQuery({
    queryKey: ['token-budget', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.rpc('check_token_budget', { p_user_id: user.id });
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 180_000,
    refetchOnWindowFocus: true,
  });

  if (!isSuccess || !data) {
    return {
      isTokenExhausted: false,
      reason: null,
      dailyUsed: 0,
      dailyLimit: 0,
      monthlyUsed: 0,
      monthlyLimit: 0,
      isLoaded: isSuccess,
    };
  }

  return {
    isTokenExhausted: !data.allowed,
    reason: data.reason as TokenStatus['reason'],
    dailyUsed: data.daily_used ?? 0,
    dailyLimit: data.daily_limit ?? 0,
    monthlyUsed: data.monthly_used ?? 0,
    monthlyLimit: data.monthly_limit ?? 0,
    isLoaded: true,
  };
}
