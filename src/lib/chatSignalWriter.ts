import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatSignals } from './chatSignals';

// localStorage key — used by InsightsPage as an advisory "already wrote today" hint.
// Not relied upon for correctness; the DB upsert uses GREATEST semantics so any
// number of writes for the same (user, date, type) is safe.
export const CHAT_AGG_WRITE_KEY = 'insights:wroteChatAgg';

// ── localStorage helpers (InsightsPage) ──────────────────────────────────────
// InsightsPage computes signals from a fixed DB snapshot on each page load,
// so one write per day per browser is the correct semantic there.

export function alreadyWroteToday(key: string, date: string): boolean {
  try {
    return window.localStorage.getItem(key) === date;
  } catch {
    return false;
  }
}

export function markWroteToday(key: string, date: string) {
  try {
    window.localStorage.setItem(key, date);
  } catch {
    // ignore storage errors silently
  }
}

// ── Session-scoped flag (ChatPage) ───────────────────────────────────────────
// Module-level variable: survives React re-renders within a single page-load
// but resets automatically on page refresh/tab close.  Unlike localStorage
// it cannot be cleared by the user, is never shared across tabs, and does not
// depend on browser storage permissions.  ChatPage uses this so its reactive
// effect writes once per session rather than on every message, while still
// allowing a second tab (which has its own in-memory state) to write
// independently — both writes are safe because the DB upsert keeps GREATEST.

let _sessionWroteOnDate: string | null = null;

export function alreadyWroteThisSession(date: string): boolean {
  return _sessionWroteOnDate === date;
}

export function markWroteThisSession(date: string): void {
  _sessionWroteOnDate = date;
}

// ── Core write helper ─────────────────────────────────────────────────────────

export async function writeChatSignalAgg({
  chatSignals,
  messageCount,
  signalDate,
  supabase,
}: {
  chatSignals: ChatSignals;
  messageCount: number;
  signalDate: string;
  supabase: SupabaseClient;
}): Promise<void> {
  const entries = [
    { signal_type: 'positive', score: chatSignals.positive },
    { signal_type: 'stress', score: chatSignals.stress },
    { signal_type: 'anxiety', score: chatSignals.anxiety },
    { signal_type: 'gratitude', score: chatSignals.gratitude },
  ];

  const nonZero = entries.filter((e) => e.score > 0);

  const writeErrors: string[] = [];
  for (const e of nonZero) {
    const { error } = await supabase.rpc('upsert_chat_signal_daily_agg', {
      p_signal_date: signalDate,
      p_signal_type: e.signal_type,
      p_score: e.score,
      p_message_count: messageCount,
    });
    if (error) {
      writeErrors.push(e.signal_type);
      if (import.meta.env.DEV) {
        console.warn('[chatSignalWriter] upsert failed for', e.signal_type, error.message);
      }
    }
  }
  if (writeErrors.length > 0) throw new Error(`upsert failed for: ${writeErrors.join(', ')}`);
}
