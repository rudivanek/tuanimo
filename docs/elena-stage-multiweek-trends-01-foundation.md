# Stage Multi-Week Trends 01: Foundation
**Elena — Multi-Week Trend Awareness, Foundation Layer**
Last Updated: 2026-03-19T00:00:00Z
Status: Implemented

---

## 1. Audit — Current Trend-Awareness Limitations

### 1.1 What existed before this stage

| Capability | Status | Notes |
|---|---|---|
| Current week vs. previous week delta | Present | `buildWeeklyInsightSummary()` in `insightWeekly.ts` |
| Pattern detection based on that delta | Present | `detectInsightPatterns()` in `insightPatterns.ts` |
| 3–4 week trend detection (rising/falling) | Absent | No code queries or analyzes a multi-week series |
| Recurring theme detection across 4 past insights | Present (text only) | `InsightMemoryCard` extracts keywords from prose — not mood signal values |
| Historical mood_weekly_insights rows | Present | One row per week per user; accumulates naturally over time |
| 30-day chat_signal_daily_agg loading | Present | Already loaded in InsightsPage; more than enough for 4-week window |

### 1.2 Root limitation

`buildWeeklyInsightSummary` computes a delta between week N and week N-1. All pattern detection (`insightPatterns.ts`) is anchored to that single delta. There is no aggregation of weeks N-1, N-2, N-3 to detect whether a signal has been consistently rising, consistently elevated, or recovering over multiple weeks.

### 1.3 Data availability

The `chat_signal_daily_agg` table already loads 30 calendar days of data into `chatAggRows` on InsightsPage mount. This covers exactly 4 rolling 7-day windows with no additional DB query needed.

The `mood_weekly_insights` table stores one row per week per user with a `signal_meta` JSONB column, but its `chat` sub-object was only added in migration `20260308164509`. Older rows may have `signal_meta = null`. Using `chatAggRows` is the more reliable and complete source.

---

## 2. Design Decisions

### 2.1 What was built

A single new module: `src/lib/insightTrends.ts`

Contains:
- Types: `TrendDirection`, `WeekSlice`, `SignalTrend`, `MultiWeekTrend`
- `buildWeekSlices(rows, numWeeks = 4)` — slices existing `chatAggRows` into N weekly buckets
- `detectMultiWeekTrends(slices)` — detects trend direction per signal

### 2.2 Why not use mood_weekly_insights signal_meta

- `signal_meta` was added mid-product; many users have weeks with null or partial metadata
- `chatAggRows` is always fresh, granular (daily), and already loaded
- Deriving trends from `chatAggRows` is more consistent and complete

### 2.3 Why no new DB query

The InsightsPage already fetches 30 days of `chat_signal_daily_agg`. A 4-week window requires 28 days. Zero additional network cost.

### 2.4 Honesty constraints baked in

- A trend is only declared when absolute change across the window exceeds `MIN_DELTA_THRESHOLD = 1.5` score units. Below this, the direction is always `stable`.
- `sustained: true` requires at least 3 weeks analyzed AND consistent direction in all week-over-week comparisons.
- Minimum 2 weeks with data (`weeksWithData >= 2`) required before any trend is returned.

---

## 3. Implementation

### 3.1 New file: `src/lib/insightTrends.ts`

**Types exported:**

```typescript
type TrendDirection = 'rising' | 'falling' | 'stable';

type WeekSlice = {
  weekStart: string;  // YYYY-MM-DD, inclusive
  weekEnd: string;    // YYYY-MM-DD, inclusive
  totals: SignalTotals;  // positive, stress, anxiety, gratitude
  dayCount: number;   // unique dates with any signal data
};

type SignalTrend = {
  signal: SignalType;
  direction: TrendDirection;
  weekCount: number;  // number of slices where this signal was non-zero
  sustained: boolean; // true if direction consistent across 3+ weeks
  delta: number;      // current week total minus oldest week total
};

type MultiWeekTrend = {
  slices: WeekSlice[];   // slices[0] = current, slices[n-1] = oldest
  trends: SignalTrend[];
  weeksWithData: number;
};
```

**`buildWeekSlices` logic:**
- Computes `numWeeks` consecutive 7-day windows ending today
- Window i covers `[today - (i*7 + 6), today - (i*7)]`
- Each window aggregates `score` per signal type and counts unique `signal_date` values
- Returns slices oldest-to-current order with `slices[0]` = current week

**`detectMultiWeekTrends` logic:**
- Guards: `slices.length < 2` or `weeksWithData < 2` → returns empty trends
- For each signal type:
  - Computes `totalDelta = currentWeek - oldestWeek`
  - If `|totalDelta| < 1.5` → `direction = 'stable'`
  - Otherwise: `direction = totalDelta > 0 ? 'rising' : 'falling'`
  - `sustained = true` only if 3+ slices and ALL week-over-week deltas match direction

### 3.2 Modified: `src/pages/InsightsPage.tsx`

Added import:
```typescript
import { buildWeekSlices, detectMultiWeekTrends } from '../lib/insightTrends';
import type { MultiWeekTrend } from '../lib/insightTrends';
```

Added `useMemo`:
```typescript
const multiWeekTrend = useMemo((): MultiWeekTrend | null => {
  if (!chatAggRows.length) return null;
  const slices = buildWeekSlices(chatAggRows, 4);
  return detectMultiWeekTrends(slices);
}, [chatAggRows]);
```

Passed to `WeeklyInsightPanel` as `multiWeekTrend={multiWeekTrend}`.

### 3.3 Modified: `src/components/insights/WeeklyInsightPanel.tsx`

Added `multiWeekTrend?: MultiWeekTrend | null` to the Props interface.
Panel accepts the prop but does not yet render from it — the prop is wired and available for the next stage.

---

## 4. What is Now Detectable

| Pattern | Detectable | Notes |
|---|---|---|
| Stress rising this week vs. last | Yes (existing) | `insightPatterns.ts` delta ≥ 3 |
| Stress rising across 3–4 consecutive weeks | **Yes (new)** | `trends[stress].direction = 'rising'` + `sustained = true` |
| Anxiety consistently elevated but not changing | **Yes (new)** | `direction = 'stable'` with high `totals` each week |
| Positive signal recovering over multiple weeks | **Yes (new)** | `trends[positive].direction = 'rising'` |
| Gratitude building over 3+ weeks | **Yes (new)** | `trends[gratitude].sustained = true` + direction rising |
| Emotional volatility (alternating high/low) | Not yet | Requires variance-based detection, not implemented |

---

## 5. Historical Window Used

- Source: `chatAggRows` (already loaded in InsightsPage, 30-day window)
- Sliced into: 4 rolling 7-day windows
- Total span covered: 28 calendar days (≈ 4 weeks)
- No new database queries

---

## 6. Files Created

| File | Purpose |
|---|---|
| `src/lib/insightTrends.ts` | Types + `buildWeekSlices` + `detectMultiWeekTrends` |
| `docs/elena-stage-multiweek-trends-01-foundation.md` | This document |

## 7. Files Modified

| File | Change |
|---|---|
| `src/pages/InsightsPage.tsx` | Import + `multiWeekTrend` useMemo + prop passed to WeeklyInsightPanel |
| `src/components/insights/WeeklyInsightPanel.tsx` | Import + `multiWeekTrend` added to Props interface |

---

## 8. What Still Remains Weak After This Stage

### 8.1 No UI rendering
`multiWeekTrend` is computed and wired into `WeeklyInsightPanel` but nothing renders from it. The data is available; a future stage must use it to show trend indicators, sparklines, or contextual copy.

### 8.2 Chat-only data source
The trend detection uses only `chat_signal_daily_agg` rows. Mood logs and journal entries contribute to the single-week pattern system but are not yet included in multi-week trends. Mood trend data would require a separate aggregation path.

### 8.3 No AI context injection
The `multiWeekTrend` result is not yet included in the prompt sent to the AI when generating weekly insights. That is the highest-value next step.

### 8.4 No volatility detection
Alternating high/low weeks (e.g., stress high, then low, then high) are not classified. The current `delta`-based model only sees net direction, not variance. A user with alternating weeks will show `direction = 'stable'` which is technically correct but loses information.

### 8.5 Sparse data edge cases
Users with fewer than 2 weeks of chat data receive `trends = []`. This is correct and honest, but means new users have no trend awareness at all. This is the right behavior.

### 8.6 No persistence
Trend results are recomputed on every page load from raw daily data. This is fine at current scale. If `chatAggRows` load time becomes a concern, trend results could be cached in `mood_weekly_insights.signal_meta`.
