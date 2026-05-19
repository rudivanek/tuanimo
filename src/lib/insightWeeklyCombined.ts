import type { WeeklyInsightSummary } from './insightWeekly';

type SignalType = 'positive' | 'stress' | 'anxiety' | 'gratitude';

function dominantSignal(totals: WeeklyInsightSummary['weekTotals']): SignalType | null {
  const entries = Object.entries(totals) as [SignalType, number][];
  const best = entries.reduce((a, b) => (b[1] > a[1] ? b : a), entries[0]);
  return best[1] > 0 ? best[0] : null;
}

export function combineWeeklyInsightSummaries(
  chat: WeeklyInsightSummary | null,
  journal: WeeklyInsightSummary | null,
): WeeklyInsightSummary | null {
  if (!chat && !journal) return null;
  if (!chat) return journal;
  if (!journal) return chat;

  const weekTotals = {
    positive: chat.weekTotals.positive + journal.weekTotals.positive,
    stress: chat.weekTotals.stress + journal.weekTotals.stress,
    anxiety: chat.weekTotals.anxiety + journal.weekTotals.anxiety,
    gratitude: chat.weekTotals.gratitude + journal.weekTotals.gratitude,
  };

  const previousWeekTotals = {
    positive: chat.previousWeekTotals.positive + journal.previousWeekTotals.positive,
    stress: chat.previousWeekTotals.stress + journal.previousWeekTotals.stress,
    anxiety: chat.previousWeekTotals.anxiety + journal.previousWeekTotals.anxiety,
    gratitude: chat.previousWeekTotals.gratitude + journal.previousWeekTotals.gratitude,
  };

  const change = {
    positive: weekTotals.positive - previousWeekTotals.positive,
    stress: weekTotals.stress - previousWeekTotals.stress,
    anxiety: weekTotals.anxiety - previousWeekTotals.anxiety,
    gratitude: weekTotals.gratitude - previousWeekTotals.gratitude,
  };

  const sourcesAgree =
    chat?.dominantThisWeek &&
    journal?.dominantThisWeek &&
    chat.dominantThisWeek === journal.dominantThisWeek;

  // When chat and journal agree on the same dominant signal,
  // boost confidence slightly so the combined insight is stable.
  if (sourcesAgree) {
    const key = chat!.dominantThisWeek!;
    if (weekTotals[key] !== undefined) {
      weekTotals[key] += 2;
    }
  }

  const dominantThisWeek = dominantSignal(weekTotals);

  return {
    weekTotals,
    previousWeekTotals,
    dominantThisWeek,
    change,
  };
}
