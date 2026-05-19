import type { SignalType, SignalTotals } from './insightWeekly';
import type { JournalEntryLite } from './journalProgress';
import { extractJournalAggRows } from './insightWeeklyJournal';

export type TrendDirection = 'rising' | 'falling' | 'stable';

export type WeekSlice = {
  weekStart: string;
  weekEnd: string;
  totals: SignalTotals;
  dayCount: number;
};

export type SignalTrend = {
  signal: SignalType;
  direction: TrendDirection;
  weekCount: number;
  sustained: boolean;
  delta: number;
};

export type MultiWeekTrend = {
  slices: WeekSlice[];
  trends: SignalTrend[];
  weeksWithData: number;
};

type AggRow = {
  signal_date: string;
  signal_type: SignalType;
  score: number;
};

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function offsetDate(baseStr: string, days: number): string {
  const [y, mo, d] = baseStr.split('-').map(Number);
  const dt = new Date(y, mo - 1, d);
  dt.setDate(dt.getDate() + days);
  return localDateStr(dt);
}

function emptyTotals(): SignalTotals {
  return { positive: 0, stress: 0, anxiety: 0, gratitude: 0 };
}

export function buildWeekSlices(rows: AggRow[], numWeeks = 4): WeekSlice[] {
  const todayStr = localDateStr(new Date());
  const slices: WeekSlice[] = [];

  for (let i = 0; i < numWeeks; i++) {
    const weekEnd = offsetDate(todayStr, -(i * 7));
    const weekStart = offsetDate(weekEnd, -6);

    const weekRows = rows.filter(
      (r) => r.signal_date >= weekStart && r.signal_date <= weekEnd
    );

    const totals = emptyTotals();
    const uniqueDays = new Set<string>();

    for (const r of weekRows) {
      totals[r.signal_type] += Number(r.score) || 0;
      uniqueDays.add(r.signal_date);
    }

    slices.push({ weekStart, weekEnd, totals, dayCount: uniqueDays.size });
  }

  return slices;
}

const SIGNAL_TYPES: SignalType[] = ['positive', 'stress', 'anxiety', 'gratitude'];

const MIN_DELTA_THRESHOLD = 1.5;

export function detectMultiWeekTrends(slices: WeekSlice[]): MultiWeekTrend {
  const weeksWithData = slices.filter((s) => s.dayCount > 0).length;

  if (slices.length < 2 || weeksWithData < 2) {
    return { slices, trends: [], weeksWithData };
  }

  const trends: SignalTrend[] = [];

  for (const signal of SIGNAL_TYPES) {
    const values = slices.map((s) => s.totals[signal]);

    const weekCount = slices.filter(
      (s) => s.dayCount > 0 && s.totals[signal] > 0
    ).length;

    const totalDelta = values[0] - values[values.length - 1];

    if (Math.abs(totalDelta) < MIN_DELTA_THRESHOLD) {
      trends.push({ signal, direction: 'stable', weekCount, sustained: false, delta: totalDelta });
      continue;
    }

    const direction: TrendDirection = totalDelta > 0 ? 'rising' : 'falling';

    const deltas: number[] = [];
    for (let i = 0; i < values.length - 1; i++) {
      deltas.push(values[i] - values[i + 1]);
    }

    const consistentCount = deltas.filter((d) =>
      direction === 'rising' ? d > 0 : d < 0
    ).length;

    const sustained = slices.length >= 3 && consistentCount >= slices.length - 1;

    trends.push({ signal, direction, weekCount, sustained, delta: totalDelta });
  }

  return { slices, trends, weeksWithData };
}

export type MoodLogLite = {
  local_date: string;
  emoji: string;
};

const MOOD_EMOJI_SIGNAL: Record<string, { signal: SignalType; score: number }> = {
  '😊': { signal: 'positive', score: 1.0 },
  '🙂': { signal: 'positive', score: 0.5 },
  '😟': { signal: 'stress',   score: 0.5 },
  '😔': { signal: 'stress',   score: 1.0 },
};

export function buildMultiSourceAggRows(
  chatRows: AggRow[],
  journalEntries: JournalEntryLite[],
  moodLogs: MoodLogLite[],
): AggRow[] {
  const merged: AggRow[] = [...chatRows];

  for (const row of extractJournalAggRows(journalEntries)) {
    merged.push({ signal_date: row.signal_date, signal_type: row.signal_type, score: row.score });
  }

  for (const log of moodLogs) {
    const mapped = MOOD_EMOJI_SIGNAL[log.emoji];
    if (mapped) {
      merged.push({ signal_date: log.local_date, signal_type: mapped.signal, score: mapped.score });
    }
  }

  return merged;
}
