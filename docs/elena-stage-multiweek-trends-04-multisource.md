# Stage Multi-Week Trends 04: Multi-Source Trend Awareness
**Elena — Extending Trend Detection to Journal and Mood Log Data**
Last Updated: 2026-03-19T00:00:00Z
Status: Implemented

---

## 1. Audit — State Before Trends-04

### 1.1 Current trend pipeline (after Trends-01–03)

`buildWeekSlices(chatAggRows, 4)` → `detectMultiWeekTrends(slices)` → `multiWeekTrend` passed to `WeeklyInsightPanel`.

The input was exclusively `chatAggRows` from `chat_signal_daily_agg`. If a user had no chat activity, `chatAggRows.length === 0` → `multiWeekTrend = null` → no trend awareness in the UI and no trend context in the AI prompt (Trends-02).

### 1.2 Available non-chat sources

**Mood logs (`moodLogs` state in `InsightsPage`):**
- Structure: `{ id, local_date, emoji, note? }`
- 30 days of data, decrypted, available in state
- `local_date` is already YYYY-MM-DD — maps directly to `signal_date`
- Emoji encodes valence but NOT specific signal type. It can reliably map to:
  - `positive` (😊 / 🙂)
  - `stress` (😔 / 😟) — a proxy for "negative" mood; cannot distinguish stress from anxiety
  - 😐 (neutral) carries no signal
- **Reliability: low-medium.** One log per day, rough mapping, no signal specificity beyond positive/negative.

**Journal entries (`savedEntries30d` state in `InsightsPage`):**
- Structure: `JournalEntryLite` — `{ id, title, saved_at, tags, origin }`
- `matchSignals(tags, title)` already existed in `insightWeeklyJournal.ts` and returned `SignalType[]` per entry
- Signal types: `positive`, `stress`, `anxiety`, `gratitude` — same as chat
- Score per matched signal: 1 (binary per entry-day, no message-count weighting)
- **Reliability: medium.** Keyword-based on tags and title only; doesn't scan full entry content. Misses entries with no tags and neutral titles. But when it fires, it's reasonably accurate.

**Chat agg (`chatAggRows`):**
- Score is weighted by message count and chat signal strength
- Most specific, most reliable, highest score magnitude
- **Reliability: high.**

### 1.3 What changed for trend detection

Before Trends-04, if `chatAggRows` was empty (journal-only or mood-only user), `multiWeekTrend` returned `null` unconditionally. These users never received:
- Multi-week trend context in the AI weekly insight (Trends-02)
- The subtle trend line in the WeeklyInsightPanel (Trends-03)

---

## 2. Design Decisions

### 2.1 Merge strategy: additive, not priority-branching

The simplest correct approach is to convert all three sources into a shared `AggRow` format (`signal_date`, `signal_type`, `score`) and merge them into a single list. `buildWeekSlices` sums scores per bucket — so all three sources accumulate naturally.

This avoids complex priority branching ("use chat if > N, else fall back to journal…") which would be brittle and harder to reason about. The thresholds in `detectMultiWeekTrends` (`MIN_DELTA_THRESHOLD = 1.5`) and in `getStrongTrendLine` (`TREND_STRONG_DELTA = 3`) act as natural filters.

### 2.2 Conservative score weights for non-chat sources

| Source | Score per signal match |
|---|---|
| Chat agg | As stored in `score` column — can be 5–30+ over a week |
| Journal entry | 1.0 per matched signal per entry |
| Mood log (positive: 😊) | 1.0 |
| Mood log (positive: 🙂) | 0.5 |
| Mood log (negative: 😟) | 0.5 |
| Mood log (negative: 😔) | 1.0 |
| Mood log (neutral: 😐) | 0 (skipped) |

Lower weights for mood logs reflect their reduced specificity. Journal entries use score=1 because each entry is an intentional act with keyword evidence.

### 2.3 Mood logs only map to `positive` and `stress`

This is a deliberate limitation. Emoji alone cannot distinguish anxiety from general stress, or gratitude from generic positivity. Mapping emoji to only two signals prevents false claims and keeps the inference honest.

### 2.4 Chat data still dominates when present

A week with 10 chat messages (score ~8–15) vs 3 journal entries (score=3) and 4 mood logs (score=2–4). Chat will still dominate trend direction in that week. Multi-source primarily affects users with low chat activity.

### 2.5 No new database queries

All three sources are already loaded into `InsightsPage` state. No new queries.

---

## 3. Implementation

### 3.1 `insightWeeklyJournal.ts` changes

- `matchSignals` changed from `function` to `export function` (was already fully implemented — no logic change)
- New exported type `JournalAggRow`:
  ```typescript
  export type JournalAggRow = {
    signal_date: string;
    signal_type: SignalType;
    score: number;
  };
  ```
- New exported function `extractJournalAggRows(entries: JournalEntryLite[]): JournalAggRow[]`:
  - Iterates entries, calls `matchSignals(entry.tags, entry.title)`, emits one row per matched signal per entry
  - Uses the existing `localDateStr(new Date(entry.saved_at))` for date bucketing (consistent with the rest of the module)

### 3.2 `insightTrends.ts` changes

New imports:
```typescript
import type { JournalEntryLite } from './journalProgress';
import { extractJournalAggRows } from './insightWeeklyJournal';
```

New exported type `MoodLogLite`:
```typescript
export type MoodLogLite = {
  local_date: string;
  emoji: string;
};
```

New constant `MOOD_EMOJI_SIGNAL` (internal):
```typescript
const MOOD_EMOJI_SIGNAL: Record<string, { signal: SignalType; score: number }> = {
  '😊': { signal: 'positive', score: 1.0 },
  '🙂': { signal: 'positive', score: 0.5 },
  '😟': { signal: 'stress',   score: 0.5 },
  '😔': { signal: 'stress',   score: 1.0 },
};
```

New exported function `buildMultiSourceAggRows`:
```typescript
export function buildMultiSourceAggRows(
  chatRows: AggRow[],
  journalEntries: JournalEntryLite[],
  moodLogs: MoodLogLite[],
): AggRow[]
```
- Copies `chatRows` as-is
- Calls `extractJournalAggRows` and appends results
- Maps each mood log through `MOOD_EMOJI_SIGNAL` and appends non-null matches
- Returns merged `AggRow[]`

### 3.3 `InsightsPage.tsx` changes

Import change:
```typescript
import { buildWeekSlices, detectMultiWeekTrends, buildMultiSourceAggRows } from '../lib/insightTrends';
```

Updated `multiWeekTrend` useMemo:
```typescript
const multiWeekTrend = useMemo((): MultiWeekTrend | null => {
  const merged = buildMultiSourceAggRows(chatAggRows, savedEntries30d, moodLogs);
  if (!merged.length) return null;
  const slices = buildWeekSlices(merged, 4);
  return detectMultiWeekTrends(slices);
}, [chatAggRows, savedEntries30d, moodLogs]);
```

- Removed the `if (!chatAggRows.length) return null` guard
- Added `savedEntries30d` and `moodLogs` to dependencies
- `MoodLog` (local InsightsPage type) is structurally compatible with `MoodLogLite` (superset)

---

## 4. Data Sources Now Used

| Source | Table / State | Signals | Score range | Coverage |
|---|---|---|---|---|
| Chat agg | `chat_signal_daily_agg` DB table | positive, stress, anxiety, gratitude | 0–30+ per week | Chat users |
| Journal entries | `savedEntries30d` (in-memory, 30d) | positive, stress, anxiety, gratitude | 0–N per week (N = matched entries) | Journal users |
| Mood logs | `moodLogs` (in-memory, 30d) | positive, stress only | 0–7 per week | Mood-log users |

---

## 5. Conflict Handling Between Sources

There are no conflicts — the merge is purely additive. If two sources both fire on the same (date, signal_type), their scores sum in `buildWeekSlices`. This means a day with both a journal entry matching `stress` AND a 😔 mood log will contribute score=2.0 to the stress bucket for that week. That is intentional: two independent signals on the same day provide stronger evidence.

The only potential concern is double-counting for users active across all three sources. In practice this inflates scores modestly. The `MIN_DELTA_THRESHOLD = 1.5` and `TREND_STRONG_DELTA = 3` thresholds still require meaningful cross-week change before any trend fires.

---

## 6. What Improved

**Coverage for journal-only users:**
Users who write journal entries regularly but rarely chat now get `weeksWithData >= 2` as long as they have entries across 2+ weeks with keyword-matched signals. The trend line in the UI and the AI context injection (Trends-02, Trends-03) now work for them.

**Coverage for mood-log-only users:**
Users who only tap daily mood can now receive trend awareness for positive and stress/negative signals. This is coarser, but for users with 4+ weeks of logs, a sustained positive or negative streak will clear the threshold.

**Richer signal for mixed users:**
Users who chat AND journal will see their trends reinforced by both sources. If they chat less in one week but journal more, the trend is less likely to produce a false "falling" reading.

---

## 7. What Still Remains Weak

### 7.1 Mood logs only cover positive and stress

Anxiety and gratitude trends are invisible from mood logs alone. A user who writes anxious journal entries but rarely uses their anxiety-indicating emoji (or has no matching title keywords) will not get an anxiety trend.

### 7.2 Journal keyword matching is limited to tags and title

The full journal content is encrypted and not scanned at the client. Keyword matching only runs on `tags` (if set) and `title`. Many journal entries have no tags and a neutral title ("Mi reflexión de hoy") — these produce zero signal rows.

### 7.3 No signal-specificity from mood logs

😔 maps to `stress` but could equally represent anxiety, grief, or exhaustion. This is an honest approximation, not a precise classification.

### 7.4 Score inflation risk for highly active users

Users who chat, journal, and log mood daily may have inflated totals. The `MIN_DELTA_THRESHOLD = 1.5` minimum is low enough that even small consistent changes in a single source would fire. This is acceptable for the current use case (trend awareness, not clinical measurement).

### 7.5 No source attribution in the trend line

The `trendLine` string displayed in the UI (Trends-03) is the same regardless of which source(s) drove the trend. A user might see "El estrés ha ido en aumento" based solely on mood log emoji — which is a weaker claim than the same line based on chat signal data. There is no way to communicate this nuance without introducing the kind of technical labeling we explicitly want to avoid.

### 7.6 Trends-02 edge function still uses only chat data

The `generate-weekly-insights` edge function receives trend context via the `multiWeekTrend` field of the insight signal. This field is currently built server-side from `chat_signal_daily_agg` only. The client-side multi-source `multiWeekTrend` computed in InsightsPage is not sent to the edge function — the AI prompt does not yet benefit from journal or mood trend data. This is a known gap.
