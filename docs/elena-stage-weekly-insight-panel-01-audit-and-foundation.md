# Stage WIP-01: WeeklyInsightPanel Audit and Foundation
**Elena — Weekly Insight Panel Continuity**
Last Updated: 2026-03-19T23:30:00Z
Status: Implemented

---

## 1. Full Flow Audit

### 1.1 Where does the panel data come from?

`WeeklyInsightPanel` receives `latestInsight` from `InsightsPage`, which loads the 4 most recent rows from the `mood_weekly_insights` table ordered by `week_start_date` descending. `latestInsight` is then derived by sorting those rows by `created_at` descending and taking the first.

### 1.2 When is the AI insight generated?

**Two paths:**
1. **User-triggered:** the "Insight Semanal" button in the page header, which calls `handleGenerateInsight()` → `generateMoodInsight()` → `mood-insights` edge function → OpenAI → saves to `mood_weekly_insights`
2. **Cron-triggered:** `generate-weekly-insights` edge function runs on a schedule for all eligible users

### 1.3 What does the panel show in each state?

| State | What user sees (before this stage) |
|-------|------------------------------------|
| `isGenerating` | Skeleton animation + "Generando insight…" |
| Error | Red error box |
| `latestInsight` present | Week label, comparison band, main text, micro-step, copy/save actions |
| `latestInsight === null` | "Elena puede resumir los patrones emocionales de tu semana..." — ONE static sentence. No CTA. |
| `latestInsight` from previous week | Full old insight rendered — NO staleness indicator |

### 1.4 Is the panel continuous or does it have dead spots?

**The panel has two clear dead spots:**

**Dead spot A — Empty state (null insight)**
The placeholder sentence is cold, unactionable, and disconnected from the generate button sitting above it in the page header. A first-time user or a user arriving in a new week with no pre-generated insight cannot tell that the button above is what generates this panel's content. The button and panel are not visually linked.

**Dead spot B — Stale state (previous week insight)**
When the user opens the page on Monday of a new week, `latestInsight` contains last week's insight. The panel renders it with no indication that it belongs to the previous week beyond a small date label (`Semana del...`). There is no nudge to generate the current week's insight from within the panel. The user must notice the date, understand it's stale, and independently find the button.

### 1.5 What is truly dynamic vs static vs administrative?

| Part | Nature |
|------|--------|
| Insight text (main, comparison, micro-step) | Dynamic: AI-generated per week per user |
| Chat summary line (chatSummaryLine) | Dynamic: derived from chat signal aggregates |
| Copy / Save to Journal | Dynamic: functional actions on the AI text |
| Week label | Dynamic: derived from `week_start_date` |
| `weekLogCount` subtitle | Dynamic: live count of mood logs this week |
| "Ver semanas anteriores" button | Administrative: scroll link to history section |
| Error banner | Administrative: API failure states |
| Empty state placeholder text | Static: one hardcoded sentence — this was the gap |

---

## 2. Biggest Continuity/Trust Gap

**The stale insight scenario is the most common repeat-user failure.**

A user who generates an insight on Friday, then returns the following Monday, sees last week's insight with no cue to act. They're in a new week, the data has shifted, but the panel looks "current." Trust erodes when the emotional summary shown feels off — it describes last week's state, not today's.

The empty state is a day-1 problem (important but rare after first generation). The stale state is a weekly recurrence.

**The gap is not in the AI generation logic, the parsing, the signal computation, or the data fetching.** All of those work. The gap is purely in what the user sees when the content is not fresh.

---

## 3. Clean Minimal Architecture Chosen

**Add staleness awareness to WeeklyInsightPanel without touching data, edge functions, or cron scheduling.**

Requirements met:
- No fake intelligence (the banner just tells the truth: "this week's insight hasn't been generated")
- Uses existing `currentWeekStart` already computed in InsightsPage
- No new DB tables or migrations
- No new hooks or utilities
- No changes to the generate flow itself

Two additions:
1. **Stale banner:** when `latestInsight.week_start_date !== currentWeekStart`, show an amber notice above the old content with a "Generar ahora" button linked to `handleGenerateInsight`
2. **Improved empty state:** replace the static placeholder with an actionable "Generar insight de esta semana" button also linked to `handleGenerateInsight`

`onGenerate` is passed as `undefined` when `tokenLimitError` is set, so the buttons disappear automatically under token budget exhaustion (the token limit error is shown in the page header instead).

---

## 4. Files Created

| File | Purpose |
|------|---------|
| `docs/elena-stage-weekly-insight-panel-01-audit-and-foundation.md` | This document |

## 5. Files Modified

| File | Change |
|------|--------|
| `src/components/insights/WeeklyInsightPanel.tsx` | Added `currentWeekStart?: string` and `onGenerate?: () => void` props; `isCurrentWeek` / `isStale` derivations; amber stale banner with "Generar ahora" button; improved empty state with "Generar insight de esta semana" button |
| `src/pages/InsightsPage.tsx` | Fixed `currentWeekStart` timezone bug (was `toISOString()` UTC, now local date string); passed `currentWeekStart` and `onGenerate` to `WeeklyInsightPanel` |

---

## 6. Timezone Fix (Bundled)

**Bug fixed:** `currentWeekStart` on line 412 of `InsightsPage.tsx` was computed using `_ws.toISOString().split('T')[0]`, which returns a UTC date. In timezones west of UTC (all US timezones), this shifts the week start one day back. The `mood_weekly_insights.week_start_date` column is stored as a local date by the generate function. The comparison `latestInsight.week_start_date === currentWeekStart` would fail incorrectly on Sunday evenings in US timezones.

**Fix:** replaced `toISOString()` with template literal using `getFullYear()`, `getMonth()`, `getDate()` (local calendar values). Zero-behavior change in UTC+ timezones, correct behavior in UTC- timezones.

---

## 7. What is Already Working Well

- **Full content state (current week insight):** parsing, rendering, copy, save-to-journal, micro-step, chat summary line — all solid
- **Generate flow:** user-triggered generation, loading state, error handling, cron availability — complete
- **Evidence gating and grace window:** the 24-hour grace period preventing UI flickering after midnight — well designed
- **WeeklyInsightCard (WMI-01/WMI-02):** the compact signal card below the panel is independent and working well
- **Pattern cards:** InsightPatternCard with deduplication logic is clean
- **Parsing:** `parseInsightSections()` handles both old `\n\n` format and new `[[DELIMITER]]` format — resilient

---

## 8. What the Real Remaining Gap Is

**After this stage, the stale and empty states are addressed. The next real gap is:**

**There is no automatic insight generation.** The user must always actively click "generate" to see a current-week insight. The cron job (`generate-weekly-insights`) exists but only serves users via the cron schedule (typically once per week for all users). When a user generates on Wednesday and checks back Friday, they still have Wednesday's insight. When Monday arrives, they're in stale state again.

The UX currently requires the user to maintain a "weekly ritual" of clicking the button. Users who don't remember will see the stale banner but nothing proactively drives them to act (no push notification, no badge, no email trigger).

**The stale banner added in this stage is a minimal honesty fix.** It tells the truth without adding intelligence. But it does not solve the underlying requirement for users to re-generate weekly.

---

## 9. Next Recommended Implementation Step

**WIP-02: Auto-generation on page load for stale weeks (with budget guard)**

When the user opens the Insights page and `isStale === true`, trigger `handleGenerateInsight()` automatically — but only if:
- No `tokenLimitError`
- Not already generating
- User has enough evidence (`hasEvidenceWithGrace === true`)
- Not already auto-generated this calendar week (guard in localStorage to prevent repeated calls)

This removes the requirement for the user to click anything. The panel silently refreshes to the current week's insight on arrival. The stale amber banner would show briefly during loading then disappear once the insight is generated.

**Risk:** if the cron job already generated an insight for this week (e.g., Monday morning cron), auto-generation would wastefully regenerate it. The guard should check: if `latestInsight.week_start_date === currentWeekStart`, skip auto-generation (it's already current). This logic is already contained in `isStale`.

**Additional consideration:** notify users with a badge or email lifecycle event when their weekly insight is ready. The email lifecycle already exists but does not send a "your weekly insight is ready" message — this could be a future addition to `email-lifecycle`.
