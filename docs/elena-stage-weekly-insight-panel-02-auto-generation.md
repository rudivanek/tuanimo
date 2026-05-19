# Stage WIP-02: Silent Auto-Generation of Weekly Insight
**Elena — Weekly Insight Panel Auto-Generation on Page Load**
Last Updated: 2026-03-19T23:45:00Z
Status: Implemented

---

## 1. Generation Flow Audit

### 1.1 How manual generation works

`handleGenerateInsight()` in `InsightsPage.tsx`:
1. Sets `isGeneratingInsight = true` (triggers skeleton in `WeeklyInsightPanel`)
2. Calls `generateMoodInsight(weekStartDate)` via `src/lib/api.ts`
3. On success: calls `loadWeeklyInsights()` to refresh the panel, sets `justGenerated = true` (brief highlight)
4. On `TokenLimitError`: sets `tokenLimitError` with server message
5. On other errors: sets `weeklyGenError` with user-facing message
6. Always: sets `isGeneratingInsight = false` in `finally`

The function is robust and fully handles its own error states. Auto-generation reuses this same path without modification.

### 1.2 Pre-existing guards that already gate generation

| Guard | Where |
|-------|-------|
| `!user` | First check in `handleGenerateInsight` |
| `isGeneratingInsight` | Button disabled state + `WeeklyInsightPanel` |
| `tokenLimitError` | Button disabled (`!tokenLimitError` condition on `onGenerate` prop) |
| Evidence gating | `hasEvidenceWithGrace` derived from `weeklyChatEvidence` + `weeklyJournalEvidence` |

### 1.3 Where the safest auto-trigger point is

The safest trigger requires two async loads to have settled:
1. `isInsightsLoaded` — we know the actual state of `latestInsight` (real null vs. loading null)
2. `isChatAggLoaded` — we know chat signal evidence is computed

Without both, the effect might fire while `latestInsight === null` due to in-flight fetch, producing an unnecessary generation for users who already have a current-week insight.

---

## 2. Exact Auto-Generation Gating Conditions

All six must be true simultaneously:

| # | Condition | Rationale |
|---|-----------|-----------|
| 1 | `isInsightsLoaded === true` | Weekly insights DB query has resolved; `latestInsight` reflects real state |
| 2 | `isChatAggLoaded === true` | Chat signal aggregation has resolved; `hasEvidenceWithGrace` is accurate |
| 3 | `user` is set | Authenticated session exists |
| 4 | `!isGeneratingInsight` | No active request in flight |
| 5 | `!tokenLimitError` | Budget not exhausted |
| 6 | `hasEvidenceWithGrace` | Sufficient signal evidence (chat score >= 3 AND days >= 2, OR journal entries >= 2 AND days >= 2, with 24h grace window) |
| 7 | `isStaleWeek === true` | `latestInsight` exists AND `latestInsight.week_start_date !== currentWeekStart` |
| 8 | `autoGenAttemptedRef.current === false` | Not already attempted in this browser session |
| 9 | `localStorage[AUTO_GEN_WEEK_KEY] !== currentWeekStart` | Not already auto-generated this calendar week in this browser |

**Note: Condition 7 is strict — empty state (null insight, no insight ever) does NOT trigger auto-generation.** This is intentional. New users land on the improved empty state from WIP-01 and can generate voluntarily. Auto-generation only fires for returning users who have a prior insight but it belongs to a previous week.

---

## 3. Local Guard Behavior

**Session-level guard:** `autoGenAttemptedRef` (React ref, `false` by default)
- Set to `true` before calling `handleGenerateInsight()`
- Prevents any re-trigger within the same browser session, even if deps change and the effect re-runs
- Reset on page reload (it's a ref, not persisted)

**Weekly localStorage guard:** `localStorage['insights:autoGenWeek']` = `currentWeekStart` (YYYY-MM-DD)
- Written before calling `handleGenerateInsight()`, same write as the session ref
- Persists across page reloads within the same week
- On next page load: if stored value equals `currentWeekStart`, skip auto-generation
- On next week's page load: stored value is the previous week's date string, which no longer matches `currentWeekStart` → auto-generation fires again

**Writing order:** both guards are set BEFORE `handleGenerateInsight()` is called. This means even if the generation fails, the guards remain set — intentionally preventing repeated failed attempts. The user retains the manual "Generar ahora" button in the stale banner.

---

## 4. What Happens on Failure

1. `handleGenerateInsight()` sets `isGeneratingInsight = false` in `finally` — panel exits skeleton state
2. `weeklyGenError` is set with a user-facing message in the panel
3. `latestInsight` remains the previous week's insight (unchanged since `loadWeeklyInsights()` wasn't called on error path)
4. Stale banner remains visible (`isStaleWeek` is still true)
5. "Generar ahora" button in stale banner remains clickable (manual path intact)
6. Auto-generation will NOT retry (localStorage guard is already written)
7. No looping, no polling, no silent repeated attempts

---

## 5. Files Created

| File | Purpose |
|------|---------|
| `docs/elena-stage-weekly-insight-panel-02-auto-generation.md` | This document |

## 6. Files Modified

| File | Change |
|------|--------|
| `src/pages/InsightsPage.tsx` | Added `isInsightsLoaded` state; `autoGenAttemptedRef` ref; `AUTO_GEN_WEEK_KEY` constant; `setIsInsightsLoaded(true)` in `loadWeeklyInsights`; auto-generation `useEffect` with nine gating conditions |

---

## 7. What Is Already Working Well

The auto-generation implementation reuses 100% of the existing generation path. There is no duplication, no new API surface, no new edge function invocations, no new state machines. The `handleGenerateInsight` function handles loading state, error state, and success state — auto-generation inherits all of this for free.

The `isInsightsLoaded` and `isChatAggLoaded` flags ensure the effect only fires after both asynchronous data sources are resolved. This prevents false-positive stale detection on first render.

---

## 8. What Still Remains Weak After WIP-02

### 8.1 No cron awareness
If the scheduled cron job (`generate-weekly-insights`) has already generated this week's insight for the user (e.g., Monday 9am cron), and the user opens the Insights page on Monday at 10am, `latestInsight.week_start_date` will already equal `currentWeekStart`. Auto-generation will not fire (`isStaleWeek === false`). This is correct behavior — the cron and auto-gen are not in conflict.

However, if the cron fires AFTER the user has opened Insights (and auto-gen already ran), the user won't see the new cron insight until they reload. There is no subscription to `mood_weekly_insights` for live updates.

### 8.2 No suppression of scroll-to-panel
When auto-generation fires, `handleGenerateInsight` calls `weeklyPanelRef.current?.scrollIntoView(...)` twice (once on start, once on success). For most users, the panel is at the top of the page and the user hasn't scrolled yet when auto-gen fires (~300–800ms after page load). The scroll is harmless but not explicitly suppressed. A future `silent` parameter on `handleGenerateInsight` could address this cleanly if it becomes a user complaint.

### 8.3 localStorage guard not synced across tabs
If the user opens Insights in two tabs simultaneously, both tabs may fire auto-generation (the localStorage write and the `handleGenerateInsight` call happen in the same synchronous block, but race conditions across tabs are possible). In practice this is an edge case with negligible real-world impact — the second generation would simply overwrite the first with the same content.

### 8.4 No badge/notification when cron-generated insight arrives
A user who does not open Insights until Thursday may not know their Monday cron insight exists. The `hasNewInsightsSinceLastView()` mechanism provides a badge in the navigation, but only if the user has previously visited Insights (the `insights_last_viewed_at` localStorage key must be set). New users without that key will never see the badge.

---

## 9. Decision Log — Narrower Than Requested

The task asked to consider auto-generating for "stale for the current week" which could include `latestInsight === null`. The implementation deliberately excludes this case (condition 7 requires `!!latestInsight`). Reasons:

1. A null insight means the user is new OR has never generated. Silently generating on their behalf feels presumptuous — they haven't learned the flow yet.
2. New users land on the improved empty state from WIP-01 with an explicit CTA. That's the right introduction.
3. The stale case (has prior insight, new week) is a clear repeat-user pattern where auto-generation is unambiguously helpful: the user knows the feature, has generated before, and just needs the panel to refresh.

This decision keeps auto-generation predictable and trustworthy.
