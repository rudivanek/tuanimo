# Stage Multi-Week Trends 03: Subtle UI Trend Surfacing
**Elena — Trend Awareness in the Weekly Insight Panel**
Last Updated: 2026-03-19T00:00:00Z
Status: Implemented

---

## 1. Audit — State Before Trends-03

### 1.1 What the WeeklyInsightPanel had

`multiWeekTrend: MultiWeekTrend | null` was already declared in the `Props` interface (wired in Trends-01). It was **not destructured** in the component function signature — the prop was silently ignored at render time.

The existing rendered insight content was:
1. Date label ("Semana del …")
2. Comparison block (ArrowLeftRight icon + one-line comparison from AI)
3. Main insight text
4. Chat summary line (optional, `text-[11px] text-app-muted/80`)
5. Micro step block (emerald box)
6. Save/copy actions

No multi-week context appeared anywhere in the rendered UI.

### 1.2 Where trend awareness fits naturally

The most natural position is **directly below the main insight text** (`sanitized.mainText`), before the chat summary and micro step. This mirrors how a thoughtful person might add a closing observation after summarising the week — understated, not the headline.

The chat summary line already establishes a convention of tiny muted supporting text. A trend line fits in that visual register.

### 1.3 Why not modify the comparison block

The comparison block is derived from AI-generated text stored in `insight_text`. Modifying or overriding it would mix AI-generated and client-computed content in a single rendered block, creating inconsistency. The trend line is rendered separately so the two sources are visually and semantically distinct.

### 1.4 Why one line, not a badge or section

The design principle for Trends-03 is: **perception, not exposition**. A badge, label, or "trend detected" section would pull the user's attention toward a system concept rather than their own emotional experience. A small italic line keeps the focus on the narrative.

---

## 2. Implementation

### 2.1 New function: `getStrongTrendLine`

Added to `src/components/insights/WeeklyInsightPanel.tsx`.

```typescript
function getStrongTrendLine(trend: MultiWeekTrend | null | undefined): string | null
```

**Logic:**
1. Guard: return `null` if `trend` is null/undefined, `weeksWithData < 2`, or `trends` is empty
2. Filter to qualifying trends: `direction !== 'stable'` AND (`|delta| >= 3` OR `sustained === true`)
3. If no qualifying trends: return `null`
4. Select the "best" trend: prefers `sustained = true` over non-sustained; among non-sustained, prefers highest `|delta|`
5. Look up the Spanish line from `TREND_LINES` table keyed by signal + direction
6. Return `entry.sustained` or `entry.clear` based on `best.sustained`

**"Strong enough" gate:** Identical to Trends-02 — `|delta| >= 3` OR `sustained`. This ensures the UI and the AI prompt use the same threshold for what counts as meaningful.

### 2.2 `TREND_LINES` lookup table

A `Record<signal, Record<direction, { sustained, clear }>>` in the component file. Each signal has separate phrasing for:
- `sustained` — used when the trend held consistently over 3+ weeks
- `clear` — used when delta is large enough but pattern wasn't fully consistent

| Signal | Direction | Sustained | Clear |
|---|---|---|---|
| stress | rising | "El estrés parece haberte acompañado durante varias semanas." | "El estrés parece haber ido en aumento en las últimas semanas." |
| stress | falling | "El estrés parece ir aflojando poco a poco a lo largo del tiempo." | "El estrés parece haberse reducido en las últimas semanas." |
| anxiety | rising | "La ansiedad parece haber ido ganando presencia semana a semana." | "La ansiedad parece haber aumentado en semanas recientes." |
| anxiety | falling | "La ansiedad parece haberse ido calmando a lo largo de las semanas." | "La ansiedad parece haberse reducido gradualmente." |
| positive | rising | "Los momentos positivos han ido creciendo a lo largo de varias semanas." | "Parece haber más energía positiva en las últimas semanas." |
| positive | falling | "Los momentos positivos han ido haciéndose menos frecuentes con el tiempo." | "Parece haber menos momentos positivos que en semanas anteriores." |
| gratitude | rising | "La gratitud ha ido apareciendo con más frecuencia a lo largo de varias semanas." | "La gratitud parece estar ganando más presencia en los últimos días." |
| gratitude | falling | "La gratitud ha aparecido con menos frecuencia en las últimas semanas." | "La gratitud parece haberse vuelto algo más escasa recientemente." |

### 2.3 Component changes

- `multiWeekTrend` added to destructured props
- `const trendLine = getStrongTrendLine(multiWeekTrend)` computed once in the render path
- Rendered as:
  ```tsx
  {trendLine && (
    <p className="text-[11px] text-app-muted/70 italic leading-relaxed">{trendLine}</p>
  )}
  ```
  Positioned between `sanitized.mainText` and the chat summary / micro step block.

### 2.4 Visual style

- `text-[11px]` — same size as chat summary line, clearly subordinate to main text
- `text-app-muted/70` — slightly more faded than the `text-app-muted/80` chat line; least prominent element in the card
- `italic` — marks it as a contextual observation rather than a fact or instruction
- `leading-relaxed` — maintains comfortable rhythm

---

## 3. What Conditions Trigger the Trend Line

| Condition | Result |
|---|---|
| `multiWeekTrend` not passed / null | Nothing rendered |
| `weeksWithData < 2` | Nothing rendered |
| All signals `direction === 'stable'` | Nothing rendered |
| Signal moving with `\|delta\| < 3` AND not sustained | Nothing rendered |
| Signal moving with `\|delta\| >= 3` OR sustained | Line rendered |

Only one line is ever rendered — the strongest qualifying trend. If two signals both qualify, the sustained one wins; if both are non-sustained, the one with the larger absolute delta wins.

---

## 4. What Happens When Trend Is Weak

Nothing changes. `getStrongTrendLine` returns `null`. The `{trendLine && ...}` conditional renders nothing. The panel looks and behaves exactly as it did before Trends-03.

---

## 5. Files Created

| File | Purpose |
|---|---|
| `docs/elena-stage-multiweek-trends-03-ui-surfacing.md` | This document |

## 6. Files Modified

| File | Change |
|---|---|
| `src/components/insights/WeeklyInsightPanel.tsx` | Added `TREND_LINES`, `TREND_STRONG_DELTA`, `getStrongTrendLine`; destructured `multiWeekTrend`; rendered trend line below main insight text |

---

## 7. What Still Remains Weak After Trends-03

### 7.1 Client-side trend data uses "today" as anchor; AI uses week end date

`buildWeekSlices` in `src/lib/insightTrends.ts` anchors week buckets from `today` backward. The edge function (`Trends-02`) anchors from `weekEndDate`. For users viewing InsightsPage on any day other than Monday, the buckets may not align perfectly with the AI's bucket windows. In practice the difference is ≤6 days and has minimal effect on trend direction — but the boundary is a known inconsistency.

### 7.2 Trend line is derived from chat signals only

Mood log data does not feed into `MultiWeekTrend`. A user who journals daily but rarely chats will have `weeksWithData = 0` and never see a trend line.

### 7.3 No persistence — recomputed on every load

`multiWeekTrend` is recomputed as a `useMemo` from `chatAggRows` on every InsightsPage mount. There is no caching or persistence of the trend computation.

### 7.4 The trend line and AI insight text may occasionally describe the same pattern twice

If the AI (guided by Trends-02 trend context injection) already said "El estrés ha ido aumentando a lo largo de las semanas" in `sanitized.mainText`, and the client-side trend line also reads "El estrés parece haber ido en aumento en las últimas semanas", there is minor semantic overlap. Both are phrased differently enough that it is unlikely to feel repetitive, but it is a potential redundancy for users with strong trends.

### 7.5 No per-signal priority logic for emotional tone

The "best" trend selection currently uses `sustained` flag and `|delta|` as criteria. It does not consider emotional salience — e.g., a small sustained stress trend is treated as more important than a larger positive trend. A future refinement could weight signals by emotional impact.

### 7.6 Trend line is not included when saving to journal

When a user clicks "Guardar en diario", the saved entry includes `mainText`, `comparison`, and `microStep`. The `trendLine` is not appended. Whether to include it is a deliberate omission for now — it is a system observation, not part of the AI narrative.
