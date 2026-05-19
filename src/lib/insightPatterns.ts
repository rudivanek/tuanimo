import type { WeeklyInsightSummary } from './insightWeekly';

export type InsightPatternType =
  | 'stress_rising'
  | 'anxiety_rising'
  | 'recovery'
  | 'gratitude_streak'
  | 'positive_momentum';

export type InsightPattern = {
  type: InsightPatternType;
  label: string;
  strength: number;
};

function patternPriority(pattern: InsightPattern): number {
  switch (pattern.type) {
    case 'recovery':
      return 3;
    case 'stress_rising':
    case 'anxiety_rising':
      return 2;
    case 'gratitude_streak':
    case 'positive_momentum':
      return 1;
    default:
      return 0;
  }
}

export function detectInsightPatterns(summary: WeeklyInsightSummary): InsightPattern[] {
  const patterns: InsightPattern[] = [];
  const { change, weekTotals } = summary;

  if (change.stress >= 3) {
    patterns.push({ type: 'stress_rising', label: 'Estrés en aumento', strength: change.stress });
  }

  if (change.anxiety >= 3) {
    patterns.push({ type: 'anxiety_rising', label: 'Ansiedad en aumento', strength: change.anxiety });
  }

  const stressOrAnxietyDown = change.stress <= -2 || change.anxiety <= -2;
  const positiveOrGratitudeUp = change.positive >= 1 || change.gratitude >= 1;
  if (stressOrAnxietyDown && positiveOrGratitudeUp) {
    patterns.push({ type: 'recovery', label: 'Señales de recuperación', strength: 2 });
  }

  if (weekTotals.gratitude >= 4) {
    patterns.push({ type: 'gratitude_streak', label: 'Racha de gratitud', strength: weekTotals.gratitude });
  }

  if (weekTotals.positive >= 4 && change.positive >= 2) {
    patterns.push({ type: 'positive_momentum', label: 'Ánimo en mejora', strength: change.positive });
  }

  // Recovery can outrank nearby rising-signal patterns when strengths are close.
  return patterns.sort((a, b) => {
    const diff = b.strength - a.strength;
    if (Math.abs(diff) >= 2) return diff;

    const prioDiff = patternPriority(b) - patternPriority(a);
    if (prioDiff !== 0) return prioDiff;

    return diff;
  });
}
