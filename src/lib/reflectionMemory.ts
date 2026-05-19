/*
 * Reflection Memory System
 *
 * Purpose:
 * Surface a past journal entry (~1 week old) to prompt the user to reflect
 * on how their perspective or emotional state has shifted since they wrote it.
 *
 * Candidate window — 6 to 8 days:
 * This range is deliberate. Entries from 6–8 days ago provide psychological
 * distance (the user is no longer "in" that moment) while still feeling
 * emotionally relevant. Less than 6 days feels too immediate; more than 8 days
 * risks the memory feeling stale or detached.
 *
 * Minimum content length — 120 bytes:
 * Very short entries (greetings, one-liners) are unlikely to carry enough
 * emotional weight to be useful for reflection. The threshold filters for
 * entries that contain a real thought.
 *
 * 30-day suppression per entry:
 * Once an entry has been surfaced, it is suppressed for 30 days using
 * localStorage keyed by entry ID. This prevents the same memory from
 * appearing repeatedly, which would erode its impact and become annoying.
 *
 * One reflection per session:
 * sessionStorage tracks whether a reflection card was shown in the current
 * browser session. This ensures the card appears at most once per visit,
 * even if the user navigates between pages multiple times.
 *
 * Marking happens after visible render (not on fetch):
 * The candidate is fetched and decrypted eagerly, but `markReflectionCandidateShown`
 * is only called from a useEffect in JournalPage after both `reflectionCandidate`
 * and `reflectionContent` are set in state. This means a failed decryption
 * or empty result does NOT consume the entry's 30-day suppression slot.
 *
 * Candidate scoring — recency + richness:
 * When multiple eligible candidates exist, the scorer blends two signals:
 * - Recency (70% weight): prefer entries closer to today within the window.
 * - Richness (30% weight, capped at 1200 chars): prefer substantive entries.
 * Pure recency would always pick the newest entry. Adding richness ensures a
 * short recent entry doesn't beat out a longer, more meaningful older entry.
 */

import { supabase } from './supabaseClient';

export type ReflectionCandidate = {
  id: string;
  created_at: string;
  content: string;
  emotion_score: number | null;
  trigger_reason: string | null;
  origin: string;
  tags: string[];
};

const SUPPRESSION_KEY_PREFIX = 'reflection_memory_shown_at:';
const SESSION_SEEN_KEY = 'reflection_memory_seen_this_session';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function fetchReflectionCandidates(
  userId: string
): Promise<ReflectionCandidate[]> {
  const now = new Date();

  const upperBound = new Date(now);
  upperBound.setDate(upperBound.getDate() - 6);
  upperBound.setHours(23, 59, 59, 999);

  const lowerBound = new Date(now);
  lowerBound.setDate(lowerBound.getDate() - 8);
  lowerBound.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, created_at, content_enc, emotion_score_at_creation, trigger_reason, origin, tags')
    .eq('user_id', userId)
    .eq('is_draft', false)
    .gte('created_at', lowerBound.toISOString())
    .lte('created_at', upperBound.toISOString())
    .gt('content_bytes', 120)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[reflectionMemory] fetchReflectionCandidates error:', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    content: row.content_enc,
    emotion_score: row.emotion_score_at_creation ?? null,
    trigger_reason: row.trigger_reason ?? null,
    origin: row.origin ?? 'manual',
    tags: row.tags ?? [],
  }));
}

export function wasReflectionCandidateShownRecently(
  entryId: string,
  now: number = Date.now()
): boolean {
  try {
    const raw = localStorage.getItem(`${SUPPRESSION_KEY_PREFIX}${entryId}`);
    if (!raw) return false;
    const shownAt = parseInt(raw, 10);
    if (isNaN(shownAt)) return false;
    return now - shownAt < THIRTY_DAYS_MS;
  } catch {
    return false;
  }
}

export function markReflectionCandidateShown(entryId: string): void {
  try {
    localStorage.setItem(`${SUPPRESSION_KEY_PREFIX}${entryId}`, String(Date.now()));
  } catch {
    // localStorage may be unavailable in private browsing or SSR contexts
  }
}

export function hasSeenReflectionThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markReflectionSeenThisSession(): void {
  try {
    sessionStorage.setItem(SESSION_SEEN_KEY, '1');
  } catch {
    // sessionStorage may be unavailable in SSR or restricted contexts
  }
}

const RICHNESS_CAP = 1200;
const RICHNESS_WEIGHT = 0.3;

function scoreCandidate(
  candidate: ReflectionCandidate,
  minTs: number,
  maxTs: number
): number {
  const ts = new Date(candidate.created_at).getTime();
  // Guard against NaN from any malformed timestamp (this candidate or range bounds).
  // Returning 0 sorts the candidate last without throwing.
  if (isNaN(ts) || isNaN(minTs) || isNaN(maxTs)) return 0;
  const recencyScore = maxTs === minTs ? 1 : (ts - minTs) / (maxTs - minTs);
  const richness = Math.min(candidate.content.length, RICHNESS_CAP) / RICHNESS_CAP;
  const richnessScore = richness * RICHNESS_WEIGHT;
  return recencyScore + richnessScore;
}

export function pickReflectionCandidate(
  candidates: ReflectionCandidate[]
): ReflectionCandidate | null {
  try {
    const now = Date.now();
    const eligible = candidates.filter(
      (c) => !wasReflectionCandidateShownRecently(c.id, now)
    );

    if (eligible.length === 0) return null;
    if (eligible.length === 1) return eligible[0];

    const timestamps = eligible.map((c) => new Date(c.created_at).getTime());
    const minTs = Math.min(...timestamps);
    const maxTs = Math.max(...timestamps);

    const scored = eligible
      .map((c) => ({ candidate: c, score: scoreCandidate(c, minTs, maxTs) }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.candidate.created_at).getTime() - new Date(a.candidate.created_at).getTime();
      });

    return scored[0].candidate;
  } catch {
    const now = Date.now();
    for (const candidate of candidates) {
      if (!wasReflectionCandidateShownRecently(candidate.id, now)) {
        return candidate;
      }
    }
    return null;
  }
}

export async function getReflectionCandidateForSession(
  userId: string
): Promise<ReflectionCandidate | null> {
  if (hasSeenReflectionThisSession()) return null;
  const candidates = await fetchReflectionCandidates(userId);
  return pickReflectionCandidate(candidates);
}
