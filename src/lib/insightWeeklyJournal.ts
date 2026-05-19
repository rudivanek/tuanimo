import type { JournalEntryLite } from './journalProgress';
import type { WeeklyInsightSummary } from './insightWeekly';

type SignalType = 'positive' | 'stress' | 'anxiety' | 'gratitude';

type SignalTotals = {
  positive: number;
  stress: number;
  anxiety: number;
  gratitude: number;
};

const SIGNAL_KEYWORDS: Record<SignalType, string[]> = {
  gratitude: [
    'gratitud', 'agradecimiento', 'gracias', 'agradecer',
    'agradecida', 'agradecido',
  ],
  anxiety: [
    'ansiedad', 'ansioso', 'ansiosa', 'nervios', 'nervioso', 'nerviosa',
    'preocupación', 'preocupacion', 'preocupado', 'preocupada',
  ],
  stress: [
    'estrés', 'estres', 'agobio', 'agobiado', 'agobiada',
    'carga', 'presión', 'presion', 'tension', 'tensión',
    'sobrecarga', 'agotamiento',
  ],
  positive: [
    'positivo', 'positiva', 'alegría', 'alegria', 'alegre',
    'calma', 'tranquilo', 'tranquila', 'feliz', 'felicidad',
    'bienestar', 'contento', 'contenta', 'satisfecho', 'satisfecha',
  ],
};

function emptyTotals(): SignalTotals {
  return { positive: 0, stress: 0, anxiety: 0, gratitude: 0 };
}

export function matchSignals(tags: string[] | null, title: string | null): SignalType[] {
  const tokens: string[] = [];
  if (tags) {
    for (const tag of tags) tokens.push(tag.toLowerCase().trim());
  }
  if (title) {
    tokens.push(
      ...title
        .toLowerCase()
        .replace(/[^a-záéíóúüñ\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean),
    );
  }

  const matched = new Set<SignalType>();
  for (const [signal, keywords] of Object.entries(SIGNAL_KEYWORDS) as [SignalType, string[]][]) {
    for (const kw of keywords) {
      if (tokens.some(t => t.includes(kw))) {
        matched.add(signal);
        break;
      }
    }
  }
  return Array.from(matched);
}

function dominantSignal(totals: SignalTotals): SignalType | null {
  const entries = Object.entries(totals) as [SignalType, number][];
  const best = entries.reduce((a, b) => (b[1] > a[1] ? b : a), entries[0]);
  return best[1] > 0 ? best[0] : null;
}

/**
 * Extracts the local calendar date from any Date as YYYY-MM-DD.
 * Uses local getFullYear/getMonth/getDate — not UTC — so entries are
 * bucketed by the calendar day they were created in the user's timezone.
 */
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Offsets a YYYY-MM-DD string by `days` calendar days.
 * Constructs the date from local parts to avoid UTC/DST shifting.
 * Handles month and year rollovers correctly via JS Date arithmetic.
 */
function offsetDateStr(base: string, days: number): string {
  const [y, mo, d] = base.split('-').map(Number);
  const dt = new Date(y, mo - 1, d);
  dt.setDate(dt.getDate() + days);
  return localDateStr(dt);
}

export function buildJournalWeeklyInsightSummary(
  entries: JournalEntryLite[],
): WeeklyInsightSummary | null {
  if (entries.length === 0) return null;

  // All window bounds are YYYY-MM-DD strings — lexicographic order matches calendar order.
  const todayStr     = localDateStr(new Date());
  const weekStartStr = offsetDateStr(todayStr, -6);      // inclusive lower bound → 7-day window
  const prevStartStr = offsetDateStr(weekStartStr, -7);
  const prevEndStr   = offsetDateStr(weekStartStr, -1);  // day before weekStart

  const weekTotals = emptyTotals();
  const previousWeekTotals = emptyTotals();

  for (const entry of entries) {
    // Convert full ISO timestamp to local calendar date before comparing.
    // This ensures entries near midnight aren't shifted into the wrong window by UTC offset.
    const dateStr = localDateStr(new Date(entry.saved_at));
    const signals = matchSignals(entry.tags, entry.title);
    if (signals.length === 0) continue;

    const isThisWeek = dateStr >= weekStartStr && dateStr <= todayStr;
    const isPrevWeek = dateStr >= prevStartStr && dateStr <= prevEndStr;

    for (const signal of signals) {
      if (isThisWeek) weekTotals[signal] += 1;
      if (isPrevWeek) previousWeekTotals[signal] += 1;
    }
  }

  const totalSignals = Object.values(weekTotals).reduce((a, b) => a + b, 0);
  if (totalSignals === 0) return null;

  const change: SignalTotals = {
    positive: weekTotals.positive - previousWeekTotals.positive,
    stress: weekTotals.stress - previousWeekTotals.stress,
    anxiety: weekTotals.anxiety - previousWeekTotals.anxiety,
    gratitude: weekTotals.gratitude - previousWeekTotals.gratitude,
  };

  return {
    weekTotals,
    previousWeekTotals,
    dominantThisWeek: dominantSignal(weekTotals),
    change,
  };
}

export type JournalAggRow = {
  signal_date: string;
  signal_type: SignalType;
  score: number;
};

export function extractJournalAggRows(entries: JournalEntryLite[]): JournalAggRow[] {
  const rows: JournalAggRow[] = [];
  for (const entry of entries) {
    const dateStr = localDateStr(new Date(entry.saved_at));
    const signals = matchSignals(entry.tags, entry.title);
    for (const signal of signals) {
      rows.push({ signal_date: dateStr, signal_type: signal, score: 1 });
    }
  }
  return rows;
}
