# Stage RP-03: Stronger Past-Entry Signal Detection Using Structured Metadata
**Elena — Dynamic Reflection Prompt System**
Last Updated: 2026-03-19T21:00:00Z
Status: Implemented

---

## 1. Goal

Replace keyword heuristics as the primary signal-detection method for past journal entries with structured metadata that was already being written to the database at entry-save time.

Keyword heuristics remain available as a fallback for entries where structured metadata is absent (manual entries written directly in the journal editor).

---

## 2. Audit: What Metadata Exists on Journal Entries

The `journal_entries` table already has these columns beyond the core fields:

| Column | Type | Description |
|--------|------|-------------|
| `emotion_score_at_creation` | integer, nullable | Heaviness score at time of chat-to-journal suggestion. Set only for `origin='chat'` entries. |
| `trigger_reason` | text, nullable | Textual reason for suggestion: e.g. `'heaviness>=3'`, `'repetition>=3_with_heaviness>=1'`, `'weekly_insight'` |
| `origin` | text, default `'manual'` | How the entry was created: `'manual'` \| `'chat'` \| `'insights'` |
| `tags` | text[], default `'{}'` | Array of tag strings. For chat entries: AI-generated topic tags. For insight entries: `['Insight']`. For manual entries: user-entered. |

---

## 3. Strict Assessment of Reliability Per Field

### `emotion_score_at_creation`

**Reliability: HIGH — but only for chat-originated entries.**

This is a numeric heaviness score computed by `evaluateDiarySuggestion()` from `emotionHeuristics.ts`. It counts heavy-burden keyword matches across the user's recent chat messages. A score >= 3 was the threshold that triggered the journal suggestion.

- Score >= 1: some heaviness detected → `stress` signal with high confidence
- Score = 0: no heaviness detected → this does NOT mean positive; it means heavy keywords were absent. Do not classify.
- **NULL: not set for manual or insight entries.** This covers the majority of entries for most users.

### `trigger_reason`

**Reliability: MEDIUM — useful as a secondary corroborator.**

Values observed in production:
- `'heaviness>=3'` → clear stress indicator
- `'repetition>=3_with_heaviness>=1'` → repeated heavy theme → anxiety-like pattern
- `'weekly_insight'` → not an emotional signal; generic label for insight-origin entries
- NULL → manual entries; no signal

Only populated for `origin='chat'` and `origin='insights'` entries. For entries where `emotion_score_at_creation` is already set, `trigger_reason` adds the distinction between stress (single heaviness event) and anxiety (repetition + heaviness pattern).

### `tags`

**Reliability: LOW — not used for classification in RP-03.**

Tags for chat entries are AI-generated topical labels (e.g., "trabajo", "familia", "amigos"). They are topic-focused, not emotion-focused. Tags for insight entries are always `['Insight']` — useless for signal detection. Tags for manual entries are user-typed free text.

Tags were audited and excluded. They do not reliably encode emotional polarity or intensity.

### `origin`

**Reliability: informational only.**

`origin='chat'` confirms that `emotion_score_at_creation` and `trigger_reason` were likely set (since only the chat flow populates them). `origin='manual'` confirms they are NULL. Not used directly in classification, but the NULL-check on `emotion_score` is equivalent.

---

## 4. What Was NOT Available (Critical Gaps)

**Manual entries have zero structured emotional metadata.** This is the primary entry type for many users. For these entries, RP-03 falls back to keyword heuristics identically to RP-01 behavior.

**No structured positive/gratitude metadata exists.** The heaviness score only captures heavy/negative states. There is no equivalent capture for calm, gratitude, or positive states. Keyword heuristics remain the only method for detecting `positive` and `gratitude` signals regardless of entry origin.

**`emotion_score_at_creation` is a heaviness dimension only.** It cannot distinguish stress from anxiety (both are "heavy"). The `trigger_reason` field provides partial disambiguation: `'repetition'` in the reason string implies a rumination/anxiety pattern; plain `'heaviness'` implies stress.

---

## 5. Signal Priority Order (as Implemented)

```
1. metaSignal from classifySignalFromMetadata()        ← RP-03 (highest priority)
   a. emotion_score >= 1                 → 'stress'
   b. trigger_reason contains 'repetition' + 'heaviness' → 'anxiety'
   c. trigger_reason contains 'heaviness' → 'stress'
   d. all other trigger_reason values    → null (fall through)

2. keyword heuristics from detectSignal(content)       ← RP-01 fallback
   Spanish keyword matching against 5 signal vocabularies
   Falls back to 'neutral' if no keywords match

3. delta-aware prompts from buildDeltaResult()         ← RP-02 (applied after signal is resolved)
   Uses the resolved past signal (from step 1 or 2) + currentDominantSignal

4. aiOverride (not yet wired)                          ← RP-04 (future)
   Bypasses all rule-based logic when provided
```

The key change vs. RP-01/RP-02: **step 1 now runs before step 2.** `metaSignal` replaces `detectSignal(content)` when structured data is present. The delta comparison in RP-02 uses the resolved signal from whichever step ran, so RP-02 automatically benefits from the improved RP-03 classification.

---

## 6. Accuracy Improvements

| Entry type | Before RP-03 | After RP-03 |
|-----------|-------------|-------------|
| Chat-origin, high heaviness (score >= 3) | Depends on whether keywords appear in entry text after encryption/decryption | Directly uses `emotion_score_at_creation` — no text needed |
| Chat-origin, repetition + heaviness | May classify as 'stress' even if anxiety is more accurate | `trigger_reason` check now returns 'anxiety' for repetitive-heaviness pattern |
| Chat-origin, score = 0 | May extract positive/neutral from text; depends on entry content | Falls through to keyword heuristics (same as before) |
| Manual entry | Keyword heuristics | Keyword heuristics (unchanged) |
| Insight-origin entry | Keyword heuristics on entry body | `trigger_reason = 'weekly_insight'` returns null → keyword fallback (same result, explicit path) |

**Most meaningful improvement:** Chat-originated heavy entries no longer require keyword presence in the decrypted text. The score was captured at the time the entry was suggested, when the signal was strongest. By the time the entry is surfaced for reflection (6–8 days later), the text may not contain the original keywords if the user edited it.

---

## 7. Files Created

None. RP-03 is entirely additive to existing files.

---

## 8. Files Modified

| File | Change |
|------|--------|
| `src/lib/reflectionMemory.ts` | Extended `ReflectionCandidate` type with 4 new fields: `emotion_score`, `trigger_reason`, `origin`, `tags`; updated SELECT in `fetchReflectionCandidates()` to fetch `emotion_score_at_creation, trigger_reason, origin, tags`; mapped fields in return |
| `src/lib/reflectionPrompt.ts` | Added `EntryMetaSignals` exported type; added `classifySignalFromMetadata(meta)` exported function; added optional `metaSignal?: ReflectionPromptSignal` as 5th parameter to `generateReflectionPrompt()`; changed signal resolution to `metaSignal ?? detectSignal(content)`; updated module comment |
| `src/pages/JournalPage.tsx` | Added `classifySignalFromMetadata` to import; updated prompt generation effect to compute `metaSignal` from `reflectionCandidate` and pass it as 5th arg; added `reflectionCandidate` to effect dependency array |

---

## 9. Exact Metadata Fields Used

| Field | Source column | Used when | Maps to |
|-------|--------------|-----------|---------|
| `emotion_score` | `emotion_score_at_creation` | `>= 1` and not null | `'stress'` |
| `trigger_reason` | `trigger_reason` | contains 'repetition' + 'heaviness' | `'anxiety'` |
| `trigger_reason` | `trigger_reason` | contains 'heaviness' only | `'stress'` |
| `origin` | `origin` | informational only, not used in classification | — |
| `tags` | `tags` | not used (unreliable, excluded) | — |

---

## 10. What Still Remains for RP-04 AI Override

**1. No structured signal for positive or gratitude states.**
All positive/gratitude classification still depends on keyword heuristics. There is no saved score for positive chat sessions — the chat evaluation only measures heaviness/burden, not wellbeing or gratitude. An AI model in RP-04 could analyze the entry text and produce a more accurate positive/gratitude classification.

**2. Manual entries are still keyword-only.**
The majority of entries for most users are `origin='manual'`. These have NULL for `emotion_score_at_creation` and `trigger_reason`. For these entries, RP-03 provides no improvement. AI-based classification (RP-04) would help here by analyzing decrypted content semantically rather than via keyword lists.

**3. No magnitude signal for the delta engine.**
The delta comparison in RP-02 is binary: a signal direction exists or it doesn't. With RP-04, the AI could quantify the degree of change (e.g., a score of 7 vs. 2 represents a larger shift than 4 vs. 3) and calibrate the prompt language accordingly.

**4. The `aiOverride` slot is wired but not called.**
`generateReflectionPrompt()` accepts `aiOverride?: { promptText, insertStarter }` as its 3rd parameter. RP-04 would call an edge function (passing the decrypted entry excerpt + `currentDominantSignal` + resolved `metaSignal`) and pass the result as `aiOverride`. This would bypass all rule-based logic and produce fully contextual Spanish prompts.
