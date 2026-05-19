# Elena — Reflection Prompts — Stage RP-01: Foundation
**Status:** Implemented
**Date:** 2026-03-19
**Scope:** Adaptive reflection prompt engine — rule-based foundation with AI upgrade path

---

## 1. Audit: Reflection Prompt Flow (Pre-Implementation)

### 1.1 End-to-End Flow Before This Stage

```
reflectionMemory.ts
  └─ getReflectionCandidateForSession(userId)
       ├─ fetchReflectionCandidates(): entries 6–8 days old, >120 bytes, non-draft
       ├─ pickReflectionCandidate(): scores by recency (70%) + richness (30%)
       └─ returns ReflectionCandidate { id, created_at, content: content_enc }

JournalPage.tsx (useEffect)
  └─ decryptForUser(candidate.content, profile)
       └─ sets: reflectionCandidate, reflectionContent

JournalPage.tsx (render)
  └─ <ReflectionMemoryCard
       title={getReflectionTitle(createdAt)}  ← "From X days ago" (ENGLISH)
       content={reflectionContent}
       onReflect → buildReflectionStarter()   ← "A week ago I wrote: ..." (ENGLISH)
     />
       └─ renders hardcoded: "How does today compare?" (ENGLISH — static for all users)
```

### 1.2 What Data Was Available at Render Time

| Data | Available | Used |
|---|---|---|
| `reflectionCandidate.created_at` | Yes | Only for title label |
| `reflectionCandidate.id` | Yes | Suppression only |
| `reflectionContent` (decrypted text) | Yes | Display only — NOT analyzed |
| Entry tags | No (not fetched by reflectionMemory) | Not used |
| Entry `trigger_reason` | No (not fetched) | Not used |
| Entry `emotion_score_at_creation` | No (not fetched) | Not used |
| Chat signals (`chat_signal_daily_agg`) | Yes (fetched for starterPrompt) | Not used in reflection |
| `progress.topTrigger30d` | Yes (in JournalPage state) | Not used in reflection |

### 1.3 What Was Missing

1. **No content analysis.** The decrypted entry text was available but never examined. The same prompt appeared regardless of whether the entry was about stress, gratitude, or a positive moment.

2. **Hardcoded English.** The entire reflection flow was in English — the card prompt, the button labels, the insert starter, the modal subtitle, and the chip activation text — while the rest of the app is fully in Spanish.

3. **No adaptive insert starter.** `buildReflectionStarter()` always produced: `"A week ago I wrote:\n"${excerpt}"\n\nToday, this feels:\n"`. No signal-awareness, no Spanish.

4. **No upgrade path to AI.** There was no slot to inject an AI-generated prompt in the future without rewriting the call site.

---

## 2. Implementation Plan

### 2.1 Chosen Architecture: Hybrid Engine in a Standalone Module

A new `src/lib/reflectionPrompt.ts` module handles all prompt generation. It is called once, after decryption, in `JournalPage.tsx`. The result (`ReflectionPromptResult`) is stored in state and passed down to the card.

**Why standalone module:**
- Keeps JournalPage free of signal detection logic
- Makes the engine independently testable
- Provides a clean import surface for future components (e.g., chat-linked reflection prompts)

**Why not extend `reflectionMemory.ts`:**
- `reflectionMemory.ts` deals with encrypted content; it does not have access to decrypted text
- Mixing encryption concerns with prompt generation would create an unclean dependency
- The separation is intentional and correct

**Why rule-based first:**
- Zero latency — no API call, no loading state
- Works offline
- Sufficient quality for a first release
- The AI override slot (`aiOverride` parameter) means no refactor is needed when AI is added

### 2.2 Signal Detection Strategy

Uses the same keyword vocabulary domain as `insightWeeklyJournal.ts` (stress, anxiety, gratitude, positive). Applied to the full decrypted entry text via `content.toLowerCase().includes(keyword)`. The highest keyword-count signal wins. Falls back to `neutral` if no keywords match.

**Known limitation:** Shallow match only. Metaphorical language, uncommon phrasing, or entries written in English will often fall through to `neutral`. This is acceptable for Stage RP-01.

### 2.3 Variant Rotation Strategy

Three variants per signal type. Index = `Math.abs(daysAgo - 6) % 3`. Since the lookback window is 6–8 days, this produces indices 0, 1, or 2 based on the exact day count. The same user will see a different variant on different sessions depending on which day within the window the entry falls, without any persistent state.

---

## 3. Files Created

### `src/lib/reflectionPrompt.ts` (NEW)

**Exports:**
- `type ReflectionPromptSignal = 'stress' | 'anxiety' | 'gratitude' | 'positive' | 'neutral'`
- `type ReflectionPromptResult = { signal, promptText, insertStarter }`
- `function generateReflectionPrompt(content, daysAgo?, aiOverride?): ReflectionPromptResult`

**Internal:**
- `SIGNAL_KEYWORDS` — Spanish keyword lists per signal (stress: 19 terms, anxiety: 16, gratitude: 12, positive: 19)
- `PROMPT_VARIANTS` — 3 variants per signal × 5 signals = 15 prompts
- `INSERT_STARTERS` — 3 variants per signal × 5 signals = 15 starters
- `detectSignal(content)` — keyword scorer, returns highest-scoring signal or `'neutral'`

---

## 4. Files Modified

### `src/components/journal/ReflectionMemoryCard.tsx`
- Added `prompt: string` to props (required — no default)
- `{prompt}` replaces the hardcoded "How does today compare?"
- Button text: "Ahora no" / "Ver original" / "Reflexionar"

### `src/components/journal/ReflectionViewerModal.tsx`
- "Past reflection · read-only" → "Reflexión pasada · solo lectura"
- "Use this reflection" → "Usar esta reflexión"

### `src/components/InsightActivationChip.tsx`
- "Elena is starting to see patterns in your writing." → "Elena está empezando a ver patrones en lo que escribes."
- "See what Elena found" → "Ver lo que encontró Elena"
- aria-label "Dismiss" → "Cerrar"

### `src/pages/JournalPage.tsx`
| Change | Detail |
|---|---|
| New import | `generateReflectionPrompt`, `ReflectionPromptResult` from `../lib/reflectionPrompt` |
| New state | `reflectionPromptResult: ReflectionPromptResult \| null` |
| Decryption effect | Computes `daysAgo` from `candidate.created_at`; calls `generateReflectionPrompt(trimmed, daysAgo)`; stores result |
| Candidate reset effect | Also resets `reflectionPromptResult` to null when candidate is null |
| `getReflectionTitle()` | Returns Spanish: "Hace X días" or "Hace aproximadamente una semana" |
| `buildReflectionStarter(src, insertStarter?)` | Accepts optional `insertStarter`; uses it as header; falls back to "Hace unos días escribí:\n" |
| `handleReflect()` | Passes `reflectionPromptResult?.insertStarter` to `buildReflectionStarter` |
| `ReflectionMemoryCard` JSX | Passes `prompt={reflectionPromptResult?.promptText ?? fallback}` |
| Pattern hint text | "Cada entrada ayuda a Elena a reconocer patrones con el tiempo." |
| Post-save nudge text | "Tu entrada reciente puede haber contribuido a un nuevo insight." |

---

## 5. What Is Working After This Stage

- Reflection card prompt is contextually matched to the emotional signal of the past entry
- Prompt and insert starter are in Spanish for all 5 signal archetypes
- "Reflexionar" produces a Spanish-language insert that frames the past entry with the correct emotional context
- All UI text in the reflection flow is now in Spanish (card, modal, chip)
- Engine is synchronous, zero-latency, no new API calls
- AI override slot is in place for future enhancement

---

## 6. What Still Needs to Be Done (Next Steps)

### Stage RP-02: Current-State Context Injection
- At prompt-generation time, read the current week's dominant chat signal from the already-fetched `chat_signal_daily_agg` data
- If the past signal and current signal differ, generate a delta-aware prompt: e.g., past = stress, current = positive → "Parece que las cosas han mejorado. ¿Qué cambió?"
- This requires passing a `currentSignal?: ReflectionPromptSignal` parameter to `generateReflectionPrompt`

### Stage RP-03: Richer Entry Metadata
- Extend `fetchReflectionCandidates()` to also fetch `tags`, `trigger_reason`, and `emotion_score_at_creation`
- Use `trigger_reason` as a stronger signal than keyword matching (it's already classified at save-time)
- Use `emotion_score_at_creation` to detect valence without keyword matching

### Stage RP-04: AI-Generated Prompts (Optional)
- Add an edge function that takes the past entry's content, the detected signal, and the current signal context
- Returns a single-sentence Spanish prompt
- Wire result into `generateReflectionPrompt(content, daysAgo, aiOverride)` — no refactor needed

### Localization Review (Remaining)
- Audit `src/pages/InsightsPage.tsx` for any remaining English strings
- Confirm `src/components/insights/WeeklyInsightPanel.tsx` static footer text is consistent
