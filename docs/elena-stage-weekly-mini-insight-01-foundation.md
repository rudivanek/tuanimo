# Stage WMI-01: Weekly Mini Insight Foundation
**Elena — Weekly Insight Card Data-Driven Text Engine**
Last Updated: 2026-03-19T22:30:00Z
Status: Implemented

---

## 1. Audit Findings: What Was Actually "Fake"

### What the WeeklyInsightCard showed before this stage

The `WeeklyInsightCard` displayed a main insight sentence by selecting from a static 3-variant list per signal type, rotated by day of week:

```typescript
const SIGNAL_MAIN_LINES: Record<SignalType, [string, string, string]> = {
  stress: [
    'Esta semana se siente más pesada de lo normal.',
    'Parece que la carga ha sido mayor esta semana.',
    'Se nota más tensión acumulada en los últimos días.',
  ],
  ...
};
const mainLine = SIGNAL_MAIN_LINES[dominantThisWeek][new Date().getDay() % 3];
```

**The problem:** These sentences are entirely generic. They say nothing about the actual magnitude of the signal or how it compared to the previous week. A user whose stress went up by 1 point saw the same sentence as a user whose stress went up by 10. The rotation was by day-of-week — cosmetic, not data-driven.

**What was already real and good:**
- The signal label (Estrés / Ansiedad / Ánimo positivo / Gratitud) — fully computed from aggregated chat/journal signals
- The delta line below (↑ Más que la semana pasada (+5)) — fully computed from real change
- The source label (Chats / Diario / Mixto) — computed from data source presence
- The evidence gating (card only shows when signal score ≥ minimum threshold)

**The only fake element was the main sentence on line 199.**

### What WeeklyInsightPanel shows (separate system)

The `WeeklyInsightPanel` displays full AI-generated insights from the `mood_weekly_insights` database table. This is a completely different component, shown only after an AI generation has been triggered. It was NOT fake — it was real AI text, just behind a manual trigger. Not addressed in this stage.

---

## 2. What Was Built (WMI-01 Foundation)

### New file: `src/lib/insightMiniCard.ts`

A focused rule-based engine that produces a data-grounded sentence from `WeeklyInsightSummary`.

**Exported types:**

```typescript
export type MiniInsightBasis =
  | 'recovery'       // stress/anxiety down + positive/gratitude up
  | 'delta_large'    // change magnitude >= 5 (stress/anxiety) or >= 4 (positive)
  | 'delta_moderate' // change magnitude 2-4
  | 'level'          // based on absolute week total (delta near zero)
  | 'fallback';      // no dominant signal

export type MiniInsightResult = {
  text: string;
  basis: MiniInsightBasis;
  confidence: 'high' | 'medium' | 'low';
};
```

**Main export:**

```typescript
export function buildWeeklyMiniInsight(summary: WeeklyInsightSummary): MiniInsightResult
```

**Logic tree (per signal type):**

For stress/anxiety:
1. Recovery first: `delta <= -3` AND (`change.positive >= 1` OR `change.gratitude >= 1`) → recovery sentence
2. Large rise: `delta >= 5` → "considerablemente mayor que la semana anterior"
3. Moderate rise: `delta >= 2` → "más carga/inquietud que la anterior"
4. Large drop: `delta <= -5` → "bajó de forma notable"
5. Moderate drop: `delta <= -2` → "cedió algo"
6. Near-zero delta — use absolute level: high (≥8), moderate (≥4), low

For positive/gratitude: same pattern with positive language, lower thresholds.

**Confidence field:** designed for future use by an AI override layer. If `confidence === 'low'`, a future stage could decide to try AI generation. If `confidence === 'high'`, the rule-based sentence is already specific enough.

### Modified file: `src/components/insights/WeeklyInsightCard.tsx`

- Removed `SIGNAL_MAIN_LINES` constant (16 lines of templated text)
- Removed `variantIndex` (`useMemo` + `getDay() % 3`) — no longer needed
- Removed `useMemo` import (now unused)
- Added import: `import { buildWeeklyMiniInsight } from '../../lib/insightMiniCard'`
- Replaced: `const mainLine = SIGNAL_MAIN_LINES[dominantThisWeek][variantIndex]`
- With: `const miniInsight = buildWeeklyMiniInsight(summary); const mainLine = miniInsight.text`

### Modified file: `src/lib/insightWeekly.ts`

- Exported `SignalType` and `SignalTotals` (previously module-private)
- Required for `insightMiniCard.ts` to use proper type-safe imports
- No logic changes

---

## 3. What the Card Now Shows

Before (stress signal, delta +3):
```
ESTRÉS
"Parece que la carga ha sido mayor esta semana."  ← same text regardless of delta magnitude
"↑ Más que la semana pasada (+3)"
```

After (stress signal, delta +3):
```
ESTRÉS
"Esta semana trajo más carga que la anterior."  ← magnitude-specific (delta 2-4)
"↑ Más que la semana pasada (+3)"
```

After (stress signal, delta +8):
```
ESTRÉS
"El nivel de estrés fue considerablemente mayor que la semana anterior."  ← (delta >= 5)
"↑ Más que la semana pasada (+8)"
```

After (stress signal, delta -4, positive up 2):
```
ESTRÉS
"La carga bajó esta semana y hay más espacio para lo positivo."  ← recovery pattern detected
"↓ Menos que la semana pasada (-4)"
```

---

## 4. Architecture for Future Extension

The `MiniInsightResult.confidence` and `MiniInsightResult.basis` fields are designed as extension hooks:

- A future **WMI-02 AI override** stage could check `confidence === 'low'` and attempt an AI-generated sentence (similar to the RP-04 architecture)
- `basis` can be logged/tracked to understand which rule paths are most common
- The function signature is stable and accepts `WeeklyInsightSummary` — no new data fetching required

---

## 5. Files Created

| File | Purpose |
|------|---------|
| `src/lib/insightMiniCard.ts` | Rule-based mini insight engine: `buildWeeklyMiniInsight()`, `MiniInsightResult`, `MiniInsightBasis` |

## 6. Files Modified

| File | Change |
|------|--------|
| `src/components/insights/WeeklyInsightCard.tsx` | Removed `SIGNAL_MAIN_LINES` and `variantIndex`; integrated `buildWeeklyMiniInsight()` |
| `src/lib/insightWeekly.ts` | Exported `SignalType` and `SignalTotals` |

---

## 7. What Is Already Working After WMI-01

- The main line in `WeeklyInsightCard` is now magnitude-aware and delta-grounded
- Recovery cross-signal detection is live (stress/anxiety down + positive/gratitude up)
- Text varies meaningfully when the data varies (not just day-of-week)
- No external API calls, no latency, no failure modes
- Full build passing, zero regressions

---

## 8. What Still Remains Weak / Not Addressed

**1. The main line still references only the dominant signal.**
If a user has both high stress AND high gratitude (mixed week), the card only describes the dominant signal. The mixed week pattern is not represented in the text.

**2. No temporal detail.**
The sentence doesn't say anything about which days were heavier or lighter. "Esta semana trajo más carga" doesn't tell the user whether Monday was worse than Friday. Day-of-week pattern detection exists in `InsightPatternCard` but is not used in the mini card text.

**3. The card text still says nothing truly personalized.**
All sentences are still generic templates — they just now depend on the delta magnitude instead of the day of the week. A user with delta +3 sees the same text as every other user with delta +3. There is no "you mentioned feeling overwhelmed on Tuesday" level of specificity.

**4. No WMI-02 AI stage yet.**
The `confidence: 'low'` path from `MiniInsightResult` is computed but not yet used to trigger any AI enhancement. This is reserved for a future stage.

**5. `WeeklyInsightPanel` (full AI insight) is unchanged.**
The gap between manual AI insight generations is still the full-size `WeeklyInsightPanel` component showing "Generate insight" prompt. WMI-01 only improves the compact card. The broader interim-state experience between AI generation cycles was not addressed.

**6. Chat-only vs journal-only texts are identical.**
All sentences apply regardless of data source. A journal-based insight could reference different framing than a chat-based one. The `sourceLabel` prop is available in the card but not used to differentiate the mini insight text.
