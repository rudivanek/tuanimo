import type { SupabaseClient } from '@supabase/supabase-js';

export type TopTheme = { key: string; count: number };

export type JournalEntryLite = {
  id: string;
  title: string | null;
  created_at: string;
  saved_at: string;
  origin: string | null;
  tags: string[] | null;
};

export async function fetchSavedEntries30d(
  supabase: SupabaseClient,
  userId: string,
): Promise<JournalEntryLite[]> {
  const from30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('journal_entries')
    .select('id, title, created_at, saved_at, origin, tags')
    .eq('user_id', userId)
    .not('saved_at', 'is', null)
    .gte('created_at', from30d)
    .order('saved_at', { ascending: false });
  return (data ?? []) as JournalEntryLite[];
}

export type JournalProgress = {
  saved7d: number;
  saved30d: number;
  originChat30d: number;
  originManual30d: number;
  topTrigger30d: { key: string; count: number } | null;
  avgEmotionScore30d: number | null;
  topThemes30d: TopTheme[];
};

const ES_STOPWORDS = new Set([
  'sobre', 'desde', 'hasta', 'entre', 'antes', 'después', 'cuando', 'donde',
  'porque', 'aunque', 'mientras', 'siempre', 'nunca', 'también', 'pero', 'sino',
  'como', 'para', 'esto', 'esta', 'estos', 'estas', 'aquel', 'aquella', 'todo',
  'todos', 'todas', 'mucho', 'muchos', 'muchas', 'poco', 'pocos', 'pocas',
  'algo', 'alguien', 'nadie', 'nada', 'cada', 'mismo', 'misma', 'otro', 'otra',
  'tener', 'hacer', 'poder', 'querer', 'saber', 'estar', 'haber', 'decir',
  'hoy', 'ayer', 'mañana', 'ahora', 'luego', 'después', 'menos', 'más',
]);

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-záéíóúüñ\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 5 && !ES_STOPWORDS.has(t));
}

function computeTopThemes(
  rows: Array<{ tags?: string[] | null; title?: string | null }>,
): TopTheme[] {
  const counts: Record<string, number> = {};

  const hasTags = rows.some(r => Array.isArray(r.tags) && r.tags.length > 0);

  if (hasTags) {
    for (const row of rows) {
      if (Array.isArray(row.tags)) {
        for (const tag of row.tags) {
          const t = tag.trim().toLowerCase();
          if (t) counts[t] = (counts[t] ?? 0) + 1;
        }
      }
    }
  } else {
    for (const row of rows) {
      for (const kw of extractKeywords(row.title ?? '')) {
        counts[kw] = (counts[kw] ?? 0) + 1;
      }
    }
  }

  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([key, count]) => ({ key, count }));
}

export async function getJournalProgress(
  supabase: SupabaseClient,
  userId: string,
): Promise<JournalProgress> {
  const now = new Date();
  const from30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const from7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('journal_entries')
    .select('saved_at, origin, trigger_reason, emotion_score_at_creation, tags, title')
    .eq('user_id', userId)
    .not('saved_at', 'is', null)
    .gte('saved_at', from30d);

  const empty: JournalProgress = {
    saved7d: 0,
    saved30d: 0,
    originChat30d: 0,
    originManual30d: 0,
    topTrigger30d: null,
    avgEmotionScore30d: null,
    topThemes30d: [],
  };

  if (error || !data) return empty;

  const saved30d = data.length;
  const saved7d = data.filter(r => r.saved_at != null && r.saved_at >= from7d).length;
  const originChat30d = data.filter(r => r.origin === 'chat').length;
  const originManual30d = data.filter(r => r.origin === 'manual').length;

  const triggerCounts: Record<string, number> = {};
  for (const row of data) {
    if (row.trigger_reason) {
      triggerCounts[row.trigger_reason] = (triggerCounts[row.trigger_reason] ?? 0) + 1;
    }
  }
  const triggerEntries = Object.entries(triggerCounts).sort(([, a], [, b]) => b - a);
  const topTrigger30d =
    triggerEntries.length > 0
      ? { key: triggerEntries[0][0], count: triggerEntries[0][1] }
      : null;

  const scores = data
    .map(r => r.emotion_score_at_creation)
    .filter((s): s is number => typeof s === 'number' && Number.isFinite(s));
  const avgEmotionScore30d =
    scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : null;

  const topThemes30d = computeTopThemes(data);

  return {
    saved7d,
    saved30d,
    originChat30d,
    originManual30d,
    topTrigger30d,
    avgEmotionScore30d,
    topThemes30d,
  };
}
