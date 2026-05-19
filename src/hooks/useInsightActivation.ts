/*
 * Insight Activation Chip
 *
 * Purpose:
 * Show a one-time nudge chip on Journal and Chat pages inviting the user to
 * visit the Insights page when they cross the evidence threshold for the first
 * time in a given activation cycle.
 *
 * Evidence threshold:
 * The user must have either:
 * - Chat signal score >= 3 across >= 2 distinct days in the past 6 days, OR
 * - >= 2 journal entries saved across >= 2 distinct days in the past 6 days.
 * These thresholds indicate genuine recent engagement with the app, not a
 * casual one-time use.
 *
 * Threshold-crossing behavior (one chip per cycle):
 * The chip only appears on the session when evidence first crosses the
 * threshold. This is detected by comparing the current result against the
 * result from the previous session (stored in `LS_PREV_KEY`).
 * - If the previous session was already "enough", the cycle is considered
 *   already active — the chip has already been shown or been seen.
 * - If this is the very first session ever (no previous value), the chip is
 *   suppressed to avoid surprising brand-new users.
 *
 * Activation cycle:
 * A cycle begins when evidence crosses the threshold from below.
 * It ends when either:
 * 1. The user visits Insights with enough evidence (`LS_SEEN_KEY` is set), or
 * 2. Evidence drops below the threshold again, which clears both `LS_SHOWN_KEY`
 *    and `LS_SEEN_KEY` so the next threshold-crossing starts a fresh cycle.
 *
 * localStorage keys:
 * - `LS_PREV_KEY` — stores whether evidence was enough on the previous session.
 * - `LS_SHOWN_KEY` — set to 'true' on the session the chip first appears.
 *   Prevents it from re-appearing on subsequent page loads in the same cycle.
 * - `LS_SEEN_KEY` — set to 'true' by InsightsPage when the user arrives while
 *   evidence is enough. Ends the cycle from the Insights side.
 *
 * "Seen in Insights" suppression:
 * When the user visits InsightsPage with sufficient evidence, `markActivationSeenInInsights`
 * writes `LS_SEEN_KEY`. On the next mount of Journal or Chat, the hook reads
 * this key and hides the chip immediately, since the user has already reached
 * the destination the chip was pointing to.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

const LS_PREV_KEY = 'insight_activation_v1:evidence_was_enough';
const LS_SHOWN_KEY = 'insight_activation_v1:shown';
const LS_SEEN_KEY = 'insight_activation_v1:seen_in_insights';

export function markActivationSeenInInsights() {
  try {
    localStorage.setItem(LS_SEEN_KEY, 'true');
  } catch {
    // localStorage may be unavailable in private browsing or SSR contexts
  }
}

async function computeEvidenceEnough(userId: string): Promise<boolean> {
  const since = new Date();
  since.setDate(since.getDate() - 6);
  const sinceDate = since.toISOString().split('T')[0];

  const { data: chatRows } = await supabase
    .from('chat_signal_daily_agg')
    .select('signal_date, score')
    .gte('signal_date', sinceDate);

  let chatScore = 0;
  const chatDays = new Set<string>();
  for (const row of chatRows ?? []) {
    const s = Number(row.score) || 0;
    if (s > 0) {
      chatScore += s;
      chatDays.add(row.signal_date as string);
    }
  }
  if (chatScore >= 3 && chatDays.size >= 2) return true;

  const { data: journalRows } = await supabase
    .from('journal_entries')
    .select('id, saved_at')
    .eq('user_id', userId)
    .eq('is_draft', false)
    .gte('saved_at', since.toISOString())
    .limit(10);

  const journalDays = new Set<string>();
  for (const row of journalRows ?? []) {
    if (row.saved_at) {
      journalDays.add((row.saved_at as string).split('T')[0]);
    }
  }
  return (journalRows?.length ?? 0) >= 2 && journalDays.size >= 2;
}

export function useInsightActivation() {
  const { user } = useAuth();
  const [showActivation, setShowActivation] = useState(false);
  const [evidenceEnough, setEvidenceEnough] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function check() {
      try {
        const isEnough = await computeEvidenceEnough(user!.id);
        if (cancelled) return;

        setEvidenceEnough(isEnough);

        const prevRaw = localStorage.getItem(LS_PREV_KEY);
        const prevWasEnough = prevRaw === 'true';
        const firstVisit = prevRaw === null;
        const alreadyShown = localStorage.getItem(LS_SHOWN_KEY) === 'true';

        localStorage.setItem(LS_PREV_KEY, String(isEnough));

        if (!isEnough) {
          if (prevWasEnough) {
            localStorage.removeItem(LS_SHOWN_KEY);
            localStorage.removeItem(LS_SEEN_KEY);
          }
          setShowActivation(false);
          return;
        }

        const seenInInsights = localStorage.getItem(LS_SEEN_KEY) === 'true';

        if (firstVisit || prevWasEnough || alreadyShown || seenInInsights) {
          setShowActivation(false);
          return;
        }

        localStorage.setItem(LS_SHOWN_KEY, 'true');
        setShowActivation(true);
      } catch {
        setShowActivation(false);
      }
    }

    // `cancelled` is set in cleanup, which React runs before re-executing the
    // effect (e.g. strict mode double-invoke, or user change).  Any in-flight
    // check that resolves after cleanup skips all state writes — preventing
    // stale results from overlapping concurrent checks.
    check();
    return () => { cancelled = true; };
  }, [user]);

  function dismiss() {
    setShowActivation(false);
  }

  return { showActivation, dismiss, evidenceEnough };
}
