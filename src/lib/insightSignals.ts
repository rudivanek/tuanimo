// Stage 3D will connect this helper with the Insights system

export type InsightSignalType =
  | "positive"
  | "stress"
  | "anxiety"
  | "gratitude"
  | null;

export type InsightSignal = {
  type: InsightSignalType;
  score: number;
};

export function buildInsightSignal(
  dominant: { dominant: InsightSignalType; score: number }
): InsightSignal | null {
  if (!dominant || !dominant.dominant) {
    return null;
  }

  return {
    type: dominant.dominant,
    score: dominant.score,
  };
}
