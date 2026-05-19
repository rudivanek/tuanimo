# Stage WMI-02: AI Enhancement for Weekly Mini Insight
**Elena — Weekly Insight Card Optional AI Override**
Last Updated: 2026-03-19T23:00:00Z
Status: Implemented

---

## 1. Goal

Add an optional AI-generated one-sentence Spanish mini-insight that overrides the WMI-01 rule-based text when confidence is high. The rule-based engine remains the default and fallback at all times.

---

## 2. WMI-01 Readiness Audit

### Confidence classification (pre-existing from WMI-01)

`buildWeeklyMiniInsight()` already returns a `confidence` field:

| Basis | Confidence | Trigger |
|-------|------------|---------|
| `recovery` | `high` | stress/anxiety down ≥3 AND positive/gratitude up |
| `delta_large` | `high` | \|delta\| ≥ 5 (stress/anxiety) or ≥ 4 (positive) |
| `delta_moderate` | `medium` | \|delta\| 2–4 |
| `level` (gratitude high) | `high` | weekTotals.gratitude ≥ 6 |
| `level` (others) | `medium` or `low` | near-zero delta |
| `fallback` | `low` | no dominant signal |

**AI gate: `confidence === 'high'`**

This targets the most evidenced states: recovery patterns, large directional shifts, and sustained gratitude. Medium and low confidence cases stay fully rule-based.

### Context available at card render time

All of the following is available from the existing `WeeklyInsightSummary` prop and component state — no additional data fetching required:

- `dominantThisWeek`: the dominant signal type
- `change[dominantThisWeek]`: the delta vs previous week (integer)
- `ruleResult.basis`: why the rule engine chose its sentence
- `sourceLabel`: data source ('Chats' | 'Diario' | 'Mixto' | undefined)

---

## 3. AI Gating Conditions (Exact)

```typescript
if (!cacheKey || ruleResult.confidence !== 'high') {
  setAiText(null);
  return;
}
```

AI is skipped when:
- `dominantThisWeek` is null
- `ruleResult.confidence !== 'high'` (medium, low, or fallback)
- Session cache hit: same signal+delta seen this browser session → cached text reused, no API call

AI proceeds when:
- `confidence === 'high'` (recovery, large delta, or sustained gratitude)
- No session cache for this signal+delta combination
- Not already in flight for this cache key (ref guard)

---

## 4. Exact Context Sent to AI

```typescript
{
  dominantSignal: dominantThisWeek,         // 'stress' | 'anxiety' | 'positive' | 'gratitude'
  delta: dominantDelta,                      // Math.round(change[dominantThisWeek])
  basis: ruleResult.basis,                   // 'recovery' | 'delta_large' | 'delta_moderate' | 'level'
  sourceLabel: sourceLabel ?? null,          // 'Chats' | 'Diario' | 'Mixto' | null
}
```

**Deliberately excluded:** no user entry content, no conversation history, no personal identifiers beyond JWT authorization. The entire payload is derived from pre-aggregated signal counts.

The edge function translates these into natural Spanish context descriptions for the system prompt:
- `dominantSignal` → "estrés o carga", "ansiedad o preocupación", etc.
- `delta` → "aumentó considerablemente (+8)", "bajó (-4)", etc.
- `basis` → "Se detecta un patrón de recuperación...", "El cambio fue notable.", etc.
- `sourceLabel` → "Datos basados en conversaciones de la semana.", etc.

---

## 5. Edge Function: `ai-mini-insight`

**Model:** gpt-4o-mini
**Temperature:** 0.8
**Max tokens:** 80 (one short sentence)
**Response format:** `json_object` → `{ "text": "..." }`

**Token budget:** enforced via `check_token_budget` RPC before calling OpenAI. Budget exceeded → 402 → client catches silently.

**Token logging:** `token_usage` table, `operation = 'ai_mini_insight'`, via `EdgeRuntime.waitUntil()` (non-blocking).

**Prompt constraints enforced:**
- Maximum 20 words
- No diagnoses
- No "deberías" / no directives
- No clinical language
- One observation, not advice

**User message to model:** `"Genera el resumen de esta semana."` — minimal, all context in system prompt.

---

## 6. Async Behavior and Caching

**On-demand. Parallel. Session-cached.**

- Rule-based text rendered immediately on first render (no perceived latency)
- AI fetch starts in `useEffect` when confidence is high
- When AI response arrives (~400–700ms), `setAiText(result.text)` triggers one silent re-render
- Session cache: `sessionStorage.getItem(`mini_insight_${dominantThisWeek}_${dominantDelta}`)` — subsequent card renders (page navigations) within the same browser session hit the cache instantly with no API call
- Cache key: `dominantSignal + delta` — invalidates when the week's dominant signal or delta changes
- No user-visible loading state, spinner, or "AI enhanced" indicator

---

## 7. Fallback Behavior (Complete)

Every failure path leaves `aiText` as `null`. `mainLine = aiText ?? ruleResult.text` then resolves to the rule-based sentence.

| Failure | Behavior |
|---------|----------|
| `confidence !== 'high'` | Effect returns early, `setAiText(null)`, rule-based text shown |
| Network error | Caught silently, rule-based text stays |
| Token budget exceeded (402) | `handleApiResponse` throws `TokenLimitError`, caught silently |
| OpenAI unavailable (503) | Caught silently |
| JSON parse failure | Edge function returns 500, caught silently |
| Incomplete response | Edge function returns 500, caught silently |
| Component unmounts before response | `cancelled = true` blocks `setAiText` |

---

## 8. Files Created

| File | Purpose |
|------|---------|
| `supabase/functions/ai-mini-insight/index.ts` | Edge function: JWT auth, budget check, GPT-4o-mini call (max 80 tokens), token logging, returns `{ text }` |
| `docs/elena-stage-weekly-mini-insight-02-ai-enhancement.md` | This document |

## 9. Files Modified

| File | Change |
|------|--------|
| `src/lib/api.ts` | Added `AIMiniInsightRequest`, `AIMiniInsightResponse` interfaces, `generateAIMiniInsight()` function |
| `src/components/insights/WeeklyInsightCard.tsx` | Added `useEffect`, `useRef` imports; `generateAIMiniInsight` import; `aiText` state; `aiFetchedKeyRef` ref; `ruleResult` and `dominantDelta` pre-hook computations; AI fetch effect; `mainLine = aiText ?? ruleResult.text` |

---

## 10. What Still Remains Weak After WMI-02

**1. All `confidence === 'high'` users at the same signal+delta see the same AI text.**
The AI receives only aggregated signal data — no personal content. Two users both with stress delta +6 will receive prompts from the same system prompt context. They may differ slightly due to model temperature (0.8) but there is no true personalization.

**2. Session cache is not cross-device or persistent.**
`sessionStorage` is cleared on tab/browser close. A user who opens the app fresh each day pays the AI fetch cost on each visit (within the high-confidence gate). No server-side caching exists.

**3. `sourceLabel` affects the system prompt context but not the cache key.**
If a user's data source changes from 'Chats' to 'Mixto' but the signal and delta are the same, the session cache returns the Chats-based AI text. This is an acceptable edge case — source transitions within a single week are rare.

**4. The card shows no indication of which text source was used.**
Both rule-based and AI-generated text appear identically. No measurement of relative acceptance or quality exists.

**5. `WeeklyInsightPanel` full AI insight generation is unchanged.**
The gap between weekly AI generation cycles still shows the "Generate insight" button. WMI-02 only improves the compact card's main line — not the full panel experience.

**6. Budget exhaustion is silent.**
If a user has hit their token limit, the AI call fails silently and they see the rule-based text. There is no notification that AI was unavailable due to budget. This is intentional for now (avoids noisy UI) but means high-usage users never know they've been downgraded.
