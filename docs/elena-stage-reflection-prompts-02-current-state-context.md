# Stage RP-02: Current-State Context Injection
**Elena — Dynamic Reflection Prompt System**
Last Updated: 2026-03-19T00:00:00Z
Status: Implemented

---

## 1. Goal

Make the reflection prompt aware not only of the past journal entry (Stage RP-01), but also of the user's **current recent emotional state**, so the prompt can reference change over time.

Target prompt quality:
- "La vez pasada sonaba muy pesado. Esta semana parece un poco más ligero. ¿Qué cambió?"
- "Veo señales parecidas a las de hace unos días. ¿Sientes que esto sigue igual o se movió algo?"
- "La vez anterior había más calma. ¿Qué crees que hizo la diferencia?"

---

## 2. Audit: What Current-State Data Was Already Available

### 2.1 `chat_signal_daily_agg` (available, real)

The most reliable current-state signal. Already fetched in `JournalPage.tsx` via `fetchSignals()` at page mount from the past 7 days. The fetch returns rows with:

```
signal_type: 'stress' | 'anxiety' | 'positive' | 'gratitude'
score: number (aggregated weight per day)
```

**Status before RP-02:** Used only to compute `starterPromptGroup` (stress vs positive totals). The dominant signal per type was never stored separately.

**Used in RP-02:** Yes. Extended to compute `currentDominantSignal` from the same query.

### 2.2 `mood_weekly_insights` (available via hook, stale)

Fetched via `useLatestInsightAt()` (5-min stale time). Contains `signal_meta.chat?.dominant` and `signal_meta.journal?.dominant`. More coarse-grained than the daily agg; covers a prior week window, not the current one.

**Used in RP-02:** No. The `chat_signal_daily_agg` is more current (7-day window from today) and is already in memory. Weekly insights are still appropriate for RP-03/RP-04 when broader trend context is needed.

### 2.3 `mood_logs` (not used)

Mood log rows (emoji + optional encrypted note). Would require a new query. Not used — the chat signal agg provides sufficient directional evidence without additional async overhead.

### 2.4 Decrypted journal entry content (past, available)

Already available from Stage RP-01. `detectSignal(content)` from `reflectionPrompt.ts` classifies the past entry into: `stress | anxiety | positive | gratitude | neutral`.

---

## 3. Design Decisions

### 3.1 No new API calls

The `chat_signal_daily_agg` fetch in `fetchSignals()` is already being made at page mount. RP-02 simply adds a `signalTotals` accumulator to the existing loop — zero additional queries.

### 3.2 Minimum score threshold

A `currentDominantSignal` is only set if the dominant signal has a total score >= 3 across the past 7 days. Below that, the signal is treated as noise and `currentDominantSignal` remains null. The system falls back to RP-01 behavior cleanly.

### 3.3 Separate effect for prompt generation

Before RP-02, `generateReflectionPrompt()` was called inline inside the decrypt effect (which depends on `[user?.id, profile?.id]`). The chat signals load in a separate effect (depends on `[user]`). These two effects run independently at mount and may complete in any order.

**RP-02 separates concerns:**
1. Decrypt effect → sets `reflectionContent` + `reflectionDaysAgo` (no longer calls `generateReflectionPrompt`)
2. `fetchSignals()` → additionally sets `currentDominantSignal`
3. New prompt effect → depends on `[reflectionContent, reflectionDaysAgo, currentDominantSignal]`

This ensures the prompt is (re)generated whenever the current signal becomes available, regardless of which effect completes first.

### 3.4 Graceful fallback

If `currentDominantSignal` is null (no sufficient chat signal evidence), `buildDeltaResult()` is never called and `generateReflectionPrompt()` returns a RP-01 variant exactly as before. No degradation.

---

## 4. Delta Classification Logic

**File:** `src/lib/reflectionDelta.ts`

```
Signal families:
  Heavy: stress | anxiety
  Light: positive | gratitude

Classfication:
  past=Heavy, current=Light → improved
  past=Light, current=Heavy → worsened
  past=Heavy, current=Heavy → similar   (e.g., stress → anxiety)
  past=Light, current=Light → similar   (e.g., positive → gratitude)
  past=same, current=same   → null      (no delta to surface)
  either=neutral            → null      (insufficient evidence)
```

Returning `null` means "fall back to RP-01 variants."

---

## 5. Delta-Aware Prompts (Spanish, 3 variants per direction)

### improved
| # | Prompt |
|---|--------|
| 0 | La vez pasada sonaba muy pesado. Esta semana parece un poco más ligero. ¿Qué cambió? |
| 1 | Hay algo distinto en el tono de esta semana comparado con entonces. ¿A qué se debe? |
| 2 | Algo ha mejorado desde aquella entrada. ¿Qué crees que hizo la diferencia? |

### worsened
| # | Prompt |
|---|--------|
| 0 | La vez anterior había más calma. ¿Qué crees que hizo la diferencia? |
| 1 | Aquel momento positivo, ¿sigue siendo un recurso ahora que las cosas pesan más? |
| 2 | La energía de entonces contrasta con esta semana. ¿Qué ha pasado? |

### similar
| # | Prompt |
|---|--------|
| 0 | Veo señales parecidas a las de hace unos días. ¿Sientes que esto sigue igual o se movió algo? |
| 1 | El patrón parece continuar desde aquella entrada. ¿Lo notas tú también? |
| 2 | Algo de entonces sigue presente esta semana. ¿Es lo mismo o hay matices nuevos? |

Variant index uses the same `Math.abs(Math.round(daysAgo) - 6) % 3` formula as RP-01 for consistency.

---

## 6. Files Created

| File | Purpose |
|------|---------|
| `src/lib/reflectionDelta.ts` | Delta direction type, `classifyDelta()`, `buildDeltaResult()`, all 9 delta prompt variants (3 directions × 3 variants) and their insert starters |

---

## 7. Files Modified

| File | Change |
|------|--------|
| `src/lib/reflectionPrompt.ts` | Added `import { buildDeltaResult }` from reflectionDelta; added `currentSignal?: ReflectionPromptSignal` parameter to `generateReflectionPrompt()`; call `buildDeltaResult()` before falling back to RP-01 variants; updated module comment |
| `src/pages/JournalPage.tsx` | Added `import type { ReflectionPromptSignal }`; added `reflectionDaysAgo` and `currentDominantSignal` state; removed inline `generateReflectionPrompt()` call from decrypt effect (stores `daysAgo` only); extended `fetchSignals()` to compute `currentDominantSignal` from `signalTotals` with MIN_SCORE=3 guard; added derived prompt-generation effect `[reflectionContent, reflectionDaysAgo, currentDominantSignal]`; updated reset effect to also clear `reflectionDaysAgo` |

---

## 8. Data Source Used

**Primary:** `chat_signal_daily_agg` table — 7-day window from today, columns `signal_type` and `score`. Already fetched at page mount via the existing `fetchSignals()` effect. No new DB queries introduced.

**Classification of past entry:** keyword-based `detectSignal()` from RP-01, unchanged.

---

## 9. What Is Still Missing for RP-03 and RP-04

### RP-03: Richer Past-Entry Metadata

`fetchReflectionCandidates()` currently selects only `id`, `created_at`, `content_enc`. The following fields are available in `journal_entries` but not fetched:

- `tags` — could strengthen or replace keyword-based signal detection on the past entry
- `trigger_reason` — pre-classified at save time (e.g., "weekly_insight", "manual")
- `emotion_score_at_creation` — 0–100 numeric valence; if available, could replace keyword heuristics entirely for signal detection on the past entry

**Impact for RP-03:** Extending the SELECT to include these fields would make signal detection on the past entry more reliable, especially for entries written in English or using metaphorical language that evades keyword matching.

### RP-04: AI-Generated Prompts

The `aiOverride?: { promptText, insertStarter }` slot in `generateReflectionPrompt()` is already in place. RP-04 would:

1. Call an edge function (e.g., `journal-prompts` or a new `reflection-prompt-ai`) with the decrypted past entry excerpt + current dominant signal
2. Pass the result as `aiOverride` to bypass all rule-based logic

Token cost is the main constraint. An opt-in trigger (e.g., only for users with remaining budget) or a debounce after save is recommended.

### RP-04 also missing: per-direction confidence

The current delta system is binary (delta / no delta). A future improvement could weight the delta by the magnitude of the score difference (e.g., past score=2 vs current score=15 is a stronger "improved" signal than past=3 vs current=4). This would allow AI prompts to express the degree of change more accurately.

---

## 10. Behavioral Summary

| Scenario | Behavior |
|----------|---------|
| Past=stress, current=positive, score≥3 | Delta "improved" prompt: "La vez pasada sonaba muy pesado..." |
| Past=positive, current=anxiety, score≥3 | Delta "worsened" prompt: "La vez anterior había más calma..." |
| Past=stress, current=anxiety, score≥3 | Delta "similar" prompt: "Veo señales parecidas..." |
| Current signal score < 3 | Falls back to RP-01 variant (past signal only) |
| Past signal = neutral | Falls back to RP-01 neutral variant |
| No chat signal data | currentDominantSignal=null → RP-01 fallback |
| Past = current signal | classifyDelta returns null → RP-01 fallback |
