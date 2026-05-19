export function hasNewInsightsSinceLastView(
  latestInsightAt: string | null,
): boolean {
  try {
    if (!latestInsightAt) return false;
    const lastViewed = localStorage.getItem("insights_last_viewed_at");
    if (!lastViewed) return false;
    return new Date(latestInsightAt) > new Date(lastViewed);
  } catch {
    return false;
  }
}
