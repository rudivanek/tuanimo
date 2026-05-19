# Stage RP-04: AI Override for Reflection Prompts
**Elena — Dynamic Reflection Prompt System**
Last Updated: 2026-03-19T22:00:00Z
Status: Implemented

---

## 1. Goal

Add an optional AI-generated reflection prompt layer that produces a single contextual Spanish prompt when structured signal evidence is strong enough, while preserving the full RP-01/RP-02/RP-03 rule-based engine as the default fallback.

The AI layer is an enhancement, not a replacement. If AI fails, is rate-limited, or the gating conditions are not met, the user always receives a rule-based prompt from the prior stages.

---

## 2. Architecture: Override Slot (Pre-existing)

The `aiOverride` parameter slot was designed into `generateReflectionPrompt()` at the RP-01 stage and left unconnected until RP-04. No changes were made to `reflectionPrompt.ts` in this stage.

```typescript
generateReflectionPrompt(
  content,
  daysAgo,
  aiOverride ?? undefined,   // ← RP-04: this slot is now populated
  currentDominantSignal,
  metaSignal
)
```

When `aiOverride` is present, the function short-circuits all rule-based logic (signal detection, delta comparison, variant selection) and returns the AI-generated prompt directly.

---

## 3. AI Gating Conditions (Strict)

AI is only attempted when ALL of the following are true:

| Condition | Rationale |
|-----------|-----------|
| `reflectionContent.length >= 80` | Minimum content to provide useful excerpt to the model |
| `metaSignal === 'stress' OR 'anxiety'` OR `(metaSignal !== null AND currentDominantSignal !== null AND currentDominantSignal !== metaSignal)` | At least one meaningful structured signal must be present; AI is only useful when we have characterizable emotional context |
| Candidate not already fetched this session (ref guard) | Prevents duplicate AI calls on re-renders |

**What does NOT trigger AI:**
- Entries with `metaSignal === null` (manual entries, insight entries — no structured signal)
- Entries with positive/gratitude signal and no delta (rule-based prompts for those states are already high quality)
- Entries where `reflectionContent.length < 80`
- Any failure state (falls through silently to rule-based)

**Result:** For the majority of users in a given session, the rule-based engine runs. AI is reserved for cases where the emotional context is clear and a personalized prompt provides measurable value.

---

## 4. Context Sent to AI (Minimal and Safe)

The edge function receives a minimal payload:

```typescript
{
  excerpt: reflectionContent.slice(0, 200),  // first 200 chars only
  daysAgo: number,
  pastSignal: 'stress' | 'anxiety',          // from structured metadata
  currentSignal: string | null,              // from 7-day chat signal agg
  deltaDirection: 'improved' | 'worsened' | 'similar' | null
}
```

**Deliberately excluded:**
- Full entry content (truncated at 200 chars for safety and latency)
- User identity, name, or personal metadata beyond what is in the excerpt
- Entry ID or any persistent identifier sent to the model
- Full conversation history

The 200-char excerpt gives the model enough flavor to produce a contextual prompt without risk of exposing full private content in logs.

---

## 5. Edge Function: `ai-reflection-prompt`

**Model:** `gpt-4o-mini`
**Temperature:** 0.8
**Max tokens:** 150
**Response format:** `json_object`

**System prompt behavior:**
- Describes the past emotional context (past signal label in plain Spanish)
- Optionally adds current signal comparison
- Optionally adds delta framing ("las cosas parecen haber mejorado")
- Enforces strict constraints: one question, max 28 words, no clinical language, no directives

**Expected output:**
```json
{ "promptText": "...", "insertStarter": "..." }
```

**Token budget:** Enforced via `check_token_budget` RPC before calling OpenAI. If budget is exceeded, the function returns 402 — the client catches this silently and falls back to rule-based.

**Token logging:** Logged to `token_usage` table with `operation = 'ai_reflection_prompt'` via `EdgeRuntime.waitUntil()` (non-blocking).

**No crisis detection.** Past journal entries were already processed at the time of creation. Crisis logging at this stage would be redundant and incorrect (the excerpt is historical, not current).

---

## 6. Fallback Behavior (Complete)

Every failure path produces a rule-based prompt — no broken UI, no empty state:

| Failure | Behavior |
|---------|----------|
| Gate conditions not met | Effect returns early; rule-based prompt shown immediately |
| `generateAIReflectionPrompt()` throws (network, auth, 5xx) | Caught silently; `aiReflectionOverride` stays null; rule-based prompt shown |
| Token budget exceeded (402) | Caught silently; rule-based prompt shown |
| OpenAI unavailable (503) | Caught silently; rule-based prompt shown |
| Parse failure (malformed JSON from model) | 500 returned from edge function; caught silently; rule-based shown |
| Incomplete response (missing fields) | 500 returned from edge function; caught silently; rule-based shown |
| Component unmounts before response arrives | `cancelled` flag blocks `setAiReflectionOverride` call |

---

## 7. Async Behavior and Timing

**On-demand, parallel, non-blocking.**

The AI fetch fires in a `useEffect` as soon as `reflectionContent`, `reflectionDaysAgo`, and `reflectionCandidate` are all set. This typically happens within 1–2 seconds of the journal page load (after decryption). The effect is not awaited by the render — the rule-based prompt is shown immediately and replaced seamlessly when the AI response arrives (causing one re-render via `setAiReflectionOverride` → `setReflectionPromptResult`).

A ref guard (`aiOverrideFetchedRef`) prevents duplicate calls. The effect re-runs if `currentDominantSignal` changes (from the concurrent chat signal fetch), but the guard prevents a second API call once the first has been dispatched.

**Typical latency:** 400–800ms for `gpt-4o-mini`. The user sees the rule-based prompt for this window, then it is replaced by the AI prompt. The transition is invisible — no loading spinner, no "AI enhanced" badge — just the best available prompt is shown.

---

## 8. Files Created

| File | Purpose |
|------|---------|
| `supabase/functions/ai-reflection-prompt/index.ts` | Edge function: validates JWT, enforces budget, calls GPT-4o-mini, logs tokens, returns `{ promptText, insertStarter }` |

---

## 9. Files Modified

| File | Change |
|------|--------|
| `src/lib/api.ts` | Added `AIReflectionPromptRequest` interface, `AIReflectionPromptResponse` interface, and `generateAIReflectionPrompt()` function following existing `getJournalPrompts` pattern |
| `src/pages/JournalPage.tsx` | Added `generateAIReflectionPrompt` to imports; added `classifyDelta` import; added `aiReflectionOverride` state; added `aiOverrideFetchedRef` ref; added AI fetch effect with gate logic; updated Effect 3 to pass `aiReflectionOverride ?? undefined`; updated reset effect to clear override state and ref |

---

## 10. Exact AI Gating Conditions (Code-Level)

```typescript
const metaSignal = classifySignalFromMetadata(reflectionCandidate);
const isHeavyPast = metaSignal === 'stress' || metaSignal === 'anxiety';
const hasCrossSignal = metaSignal !== null
  && currentDominantSignal !== null
  && currentDominantSignal !== metaSignal;

if (!isHeavyPast && !hasCrossSignal) return;   // skip AI
if (reflectionContent.length < 80) return;      // skip AI
if (aiOverrideFetchedRef.current === candidate.id) return; // already fetched
```

---

## 11. What Still Remains Weak After RP-04

**1. Manual entries have no structured signal — AI is never triggered for them.**
The gate requires `metaSignal` to be non-null, which means `origin='chat'` entries only. Manual entries (likely the majority for most users) continue to use keyword heuristics from RP-01. There is no structured emotional signal captured for manual entries at save time.

**2. The 200-char excerpt may not represent the most emotionally relevant part.**
The excerpt is always the beginning of the entry. If the most emotionally loaded content is in the middle or end of the entry, the model may receive a weaker signal than is actually available. A future stage could extract the most emotionally dense paragraph instead.

**3. No user-visible feedback that AI was used.**
The prompt appears identically whether it came from the rule-based engine or the AI model. This is intentional for now (transparency without complexity), but means there is no way to A/B test or measure AI prompt acceptance rate vs. rule-based.

**4. `currentDominantSignal` race window.**
If `currentDominantSignal` loads after the reflection content (possible in slow network conditions), the AI fetch fires without it. The ref guard prevents a second call when the signal arrives. In practice, the chat signal query is fast and usually resolves before decryption completes, but it is not guaranteed.

**5. No caching.**
Each journal page load that meets gate conditions fires a new AI request. For a user who loads the journal page twice in the same session while the reflection card is visible (e.g., navigates away and back), the ref guard prevents the second fetch within the same component mount — but if the component remounts (full page reload), the AI is called again.
