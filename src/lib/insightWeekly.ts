export type SignalType = 'positive' | 'stress' | 'anxiety' | 'gratitude';

export type SignalTotals = {
  positive: number;
  stress: number;
  anxiety: number;
  gratitude: number;
};

export type WeeklyInsightSummary = {
  weekTotals: SignalTotals;
  previousWeekTotals: SignalTotals;
  dominantThisWeek: SignalType | null;
  change: SignalTotals;
};

type AggRow = {
  signal_date: string;
  signal_type: SignalType;
  score: number;
};

function emptyTotals(): SignalTotals {
  return { positive: 0, stress: 0, anxiety: 0, gratitude: 0 };
}

function sumRows(rows: AggRow[]): SignalTotals {
  const t = emptyTotals();
  for (const r of rows) {
    t[r.signal_type] += Number(r.score) || 0;
  }
  return t;
}

function dominantSignal(totals: SignalTotals): SignalType | null {
  const entries = Object.entries(totals) as [SignalType, number][];
  const best = entries.reduce((a, b) => (b[1] > a[1] ? b : a), entries[0]);
  return best[1] > 0 ? best[0] : null;
}

/**
 * Returns today's local calendar date as a YYYY-MM-DD string.
 * Uses local year/month/day (not UTC) so it matches how signal_date rows are bucketed.
 */
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Offsets a YYYY-MM-DD string by `days` calendar days (positive = forward, negative = back).
 * Constructs the date from explicit local parts to avoid any UTC/DST shifting,
 * then re-serialises. Handles month and year rollovers correctly.
 *
 * Examples:
 *   offsetDateStr("2026-03-01", -6) → "2026-02-23"  (Feb has 28 days in 2026)
 *   offsetDateStr("2026-01-01", -6) → "2025-12-26"  (crosses year boundary)
 *   offsetDateStr("2024-03-10", -6) → "2024-03-04"  (DST-transition week, unaffected)
 */
function offsetDateStr(base: string, days: number): string {
  const [y, mo, d] = base.split('-').map(Number);
  // new Date(y, mo-1, d) uses local calendar parts — no time zone, no DST ambiguity.
  const dt = new Date(y, mo - 1, d);
  dt.setDate(dt.getDate() + days);
  return localDateStr(dt);
}

export function buildWeeklyInsightSummary(rows: AggRow[]): WeeklyInsightSummary {
  // All window boundaries are YYYY-MM-DD strings.
  // YYYY-MM-DD strings are lexicographically ordered identically to chronological order,
  // so >= / <= string comparisons are correct and unambiguous.

  const todayStr     = localDateStr(new Date());         // today (inclusive upper bound)
  const weekStartStr = offsetDateStr(todayStr, -6);      // 6 days ago (inclusive lower bound → 7-day window)
  const prevStartStr = offsetDateStr(weekStartStr, -7);  // 7 days before weekStart
  const prevEndStr   = offsetDateStr(weekStartStr, -1);  // day immediately before weekStart

  const thisWeekRows = rows.filter(r => r.signal_date >= weekStartStr && r.signal_date <= todayStr);
  const prevWeekRows = rows.filter(r => r.signal_date >= prevStartStr && r.signal_date <= prevEndStr);

  const weekTotals = sumRows(thisWeekRows);
  const previousWeekTotals = sumRows(prevWeekRows);

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
