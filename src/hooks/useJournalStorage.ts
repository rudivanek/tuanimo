import { useProfile } from './useProfile';
import { formatBytes } from '../lib/formatBytes';

export type StorageState = 'normal' | 'warning' | 'critical';

export interface JournalStorageStatus {
  used: number;
  allowed: number;
  pct: number;
  state: StorageState;
  planKey: 'starter' | 'pro' | 'power';
  usedLabel: string;
  allowedLabel: string;
  isLoaded: boolean;
}

export function useJournalStorage(): JournalStorageStatus {
  const { data: profile, isSuccess } = useProfile();

  const used = profile?.journal_storage_bytes_used ?? 0;
  const allowed = profile?.journal_storage_bytes_allowed ?? 52_428_800;
  const planKey = profile?.plan_key ?? 'starter';
  const pct = allowed > 0 ? Math.min((used / allowed) * 100, 100) : 0;

  const state: StorageState = pct >= 100 ? 'critical' : pct >= 80 ? 'warning' : 'normal';

  return {
    used,
    allowed,
    pct,
    state,
    planKey,
    usedLabel: formatBytes(used),
    allowedLabel: formatBytes(allowed),
    isLoaded: isSuccess,
  };
}
