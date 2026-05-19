import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

export function useAdmin() {
  const { user } = useAuth();

  return useQuery<boolean>({
    queryKey: ['isAdmin', user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase.rpc('is_admin', {
        p_uid: user.id,
        p_email: user.email ?? '',
      });
      if (error) return false;
      return data as boolean;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}
