# Stage Multi-Week Trends 02: Weekly Insight Generation
**Elena — Multi-Week Trend Injection into Weekly Insight AI Generation**
Last Updated: 2026-03-19T00:00:00Z
Status: Implemented and Deployed

---

## 1. Audit — Generation Flow Before This Stage

### 1.1 What the edge function received before Trends-02

`generateInsightForUser` fetched:
- Current week mood logs (`[weekStartDate, weekEndDate)`)
- Prior week mood logs (`[priorWeekStart, weekStartDate)`)
- Current week chat signal summary (aggregated totals for `[weekStartDate, weekEndDate)`)

The `buildMoodPrompt` and `buildChatOnlyPrompt` functions produced user messages containing:
- Emoji distribution and mood totals for current vs. prior week
- Optional one-line chat signal context (current week only)

**No multi-week history was available to the AI.** The comparison instruction explicitly limited the AI to "compare this week with the previous week." There was no mechanism to express that a pattern had been building or fading across several weeks.

### 1.2 The gap

The AI could observe: "stress went up this week compared to last week."
It could not observe: "stress has been rising for three consecutive weeks."

The `signal_meta` field in `mood_weekly_insights` was not queried at generation time — past insights were not used as input for new generation.

### 1.3 Why not use past `mood_weekly_insights` rows

Past insight rows would be the natural source for cross-week context. However:
- `signal_meta` was added mid-product; older rows are null
- The AI text in `insight_text` is already a composed narrative, not raw signal values
- Re-feeding AI-generated text back into AI prompts creates hallucination drift

Using raw `chat_signal_daily_agg` rows for the 28-day window is more reliable, consistent, and directly auditable.

---

## 2. Design Decisions

### 2.1 Data source

The multi-week trend is derived from `chat_signal_daily_agg` over a 28-day window (`weekStartDate - 21` to `weekEndDate`), fetched in the same `Promise.all` as the existing mood log queries — no serial latency added.

### 2.2 Trend detection replication

The edge function cannot import client-side TypeScript modules. The detection logic from `src/lib/insightTrends.ts` is replicated as standalone functions in the edge function:
- `buildWeekSlicesEdge(rows, referenceEndDate, numWeeks)` — same algorithm as client
- `detectTrendsEdge(slices)` — same thresholds: `MIN_DELTA = 1.5`, direction from total delta

### 2.3 "Strong enough" threshold for injection

A trend is injected into the prompt **only when**:
- `weeksWithData >= 2` (minimum data requirement — same as Trends-01)
- AND for each signal: `direction !== 'stable'` (i.e., `|delta| >= 1.5`)
- AND: `|delta| >= STRONG_DELTA (3.0)` OR `sustained === true`

The second condition is the key gate. A signal that moved by 1.8 total score over 4 weeks and is not sustained is not mentioned. Only meaningful, defensible trends surface.

### 2.4 Graceful degradation

`buildMultiWeekTrendContext` returns `""` when evidence is too weak. Both prompt builders treat `""` as a no-op — no trend block is added. The weekly generation flow is **100% unchanged** for users with insufficient history.

### 2.5 AI instruction framing

The injected trend context ends with:
> "Menciona esta tendencia sólo si encaja de forma natural con la reflexión — no lo fuerces."

This gives the AI explicit permission to ignore the context if it doesn't fit. The AI is not instructed to always mention the trend — only to use it when it enriches the reflection naturally.

---

## 3. Implementation

### 3.1 New functions in `generate-weekly-insights/index.ts`

**`buildWeekSlicesEdge(rows, referenceEndDate, numWeeks = 4)`**
- Slices `ChatSignalRow[]` into N 7-day buckets ending at `referenceEndDate` (exclusive)
- `slices[0]` = most recent week (the week being generated)
- Returns `WeekSliceEdge[]` with `totals` and `dayCount` per bucket

**`detectTrendsEdge(slices)`**
- Guards: `slices.length < 2` or `weeksWithData < 2` → `{ trends: [], weeksWithData }`
- For each signal: computes `totalDelta = slices[0].totals[s] - slices[n-1].totals[s]`
- If `|totalDelta| < 1.5` → `direction = 'stable'`
- Otherwise derives direction and checks consistency for `sustained` flag
- Returns `{ trends: SignalTrendEdge[], weeksWithData }`

**`fetchMultiWeekChatSignals(svc, userId, since, before)`**
- Queries `chat_signal_daily_agg` for all rows in a date range
- Returns `ChatSignalRow[]`

**`buildMultiWeekTrendContext(trends, weeksWithData)`**
- Filters to trends that cross the strong-enough bar
- Produces one Spanish sentence per qualifying signal
- Returns empty string when nothing qualifies
- Prefixes with "Contexto de tendencia (últimas semanas):" + instruction not to force-mention

### 3.2 Changes to `generateInsightForUser`

```
trendWindowStart = weekStartDate - 21 days

Promise.all now fetches 4 items (was 3):
  + fetchMultiWeekChatSignals(svc, userId, trendWindowStart, weekEndDate)

After fetches:
  trendSlices = buildWeekSlicesEdge(multiWeekRows, weekEndDate, 4)
  { trends, weeksWithData } = detectTrendsEdge(trendSlices)
  trendContext = buildMultiWeekTrendContext(trends, weeksWithData)

Both prompt paths now receive trendContext as a parameter.
```

### 3.3 Changes to `buildMoodPrompt`

Signature: `buildMoodPrompt(current, prior, chatSignals, trendContext)`

User message now appends `trendContext` as a final block when non-empty, after the chat signal context line.

### 3.4 Changes to `buildChatOnlyPrompt`

Signature: `buildChatOnlyPrompt(chatSignals, trendContext)`

User message now appends `trendContext` when non-empty, after the "no mood logs" instruction.

### 3.5 `signal_meta` audit fields

When trend context is injected, two fields are added to `signal_meta`:
- `trend_context_injected: true`
- `trend_weeks_with_data: <number>`

This makes it auditable whether trend context influenced a given weekly insight.

---

## 4. What Qualifies as "Strong Enough"

| Condition | Injected? |
|---|---|
| `weeksWithData < 2` | No — not enough history |
| `direction = 'stable'` (delta < 1.5) | No — too small to mention |
| `direction = 'rising/falling'` AND `|delta| >= 3` | Yes |
| `direction = 'rising/falling'` AND `sustained = true` (3+ consistent weeks) | Yes |
| `direction = 'rising/falling'` AND `|delta| < 3` AND NOT sustained | No — weak signal suppressed |

---

## 5. Example Injected Context (Spanish)

**Stress rising, sustained:**
> "Contexto de tendencia (últimas semanas): El estrés se ha mantenido elevado durante varias semanas consecutivas. Menciona esta tendencia sólo si encaja de forma natural con la reflexión — no lo fuerces."

**Positive signal building (not sustained, but delta >= 3):**
> "Contexto de tendencia (últimas semanas): Parece haber más energía positiva en las últimas semanas. Menciona esta tendencia sólo si encaja de forma natural con la reflexión — no lo fuerces."

**Multiple signals qualifying:**
> "Contexto de tendencia (últimas semanas): El estrés ha ido bajando de forma sostenida en las últimas semanas. Los momentos positivos han ido creciendo semana a semana — una tendencia alentadora. Menciona esta tendencia sólo si encaja de forma natural con la reflexión — no lo fuerces."

---

## 6. Files Created

| File | Purpose |
|---|---|
| `docs/elena-stage-multiweek-trends-02-weekly-generation.md` | This document |

## 7. Files Modified

| File | Change |
|---|---|
| `supabase/functions/generate-weekly-insights/index.ts` | Added types, 4 new functions, updated `generateInsightForUser`, updated both prompt builders |

---

## 8. What Still Remains Weak After Trends-02

### 8.1 Chat-only data source

Trend detection uses only `chat_signal_daily_agg`. Users who log mood daily but rarely chat will have sparse or absent trend data. Mood logs are not aggregated into the multi-week trend window at this stage.

### 8.2 No client-triggered generation path

The `generate-weekly-insights` edge function is the cron/auto-generation path. The client-triggered generation path in `mood-insights/index.ts` does not yet receive multi-week trend context. That function generates insights on-demand from InsightsPage and follows a different code path.

### 8.3 AI is instructed not to force-mention trends

This is a deliberate honesty constraint. In practice, the AI may sometimes not use the trend context even when it is strong. There is no mechanism to verify whether the AI actually incorporated the trend data into its output.

### 8.4 No trend context in `comparison` field specifically

The trend context is injected into the general user message. The AI's `comparison` field is still implicitly guided to compare "this week vs. last week" only. A future refinement could ask the AI to specifically use multi-week language in the `comparison` field when trend context is present.

### 8.5 `STRONG_DELTA_EDGE = 3` is a heuristic

The threshold was chosen to avoid false positives. Users with low engagement may have signal scores that never reach 3 total, making trend context permanently absent. The threshold may need calibration as user data accumulates.

### 8.6 No UI reflection

The weekly insight card still presents the insight as a single-week reflection. Even if the AI incorporated multi-week trend language into the `insight` field text, there is no UI indicator that says "this insight reflects a multi-week pattern." That belongs to a future Trends-03 stage.
