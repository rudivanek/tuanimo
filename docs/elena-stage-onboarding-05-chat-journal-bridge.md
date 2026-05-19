# Elena Onboarding — Stage 05: Chat-to-Journal Bridge
**Scope:** `DiaryDraftSuggestion` microcopy + `diaryDraft.ts` template. No new systems.
Last Updated: 2026-03-19T03:30:00Z
Status: Implemented and verified (build passes)

---

## Goal

When a user is already expressing something meaningful in chat, moving to the journal should feel like a natural next step — not a feature switch. The user should feel: "This is worth sitting with" — not "I am being moved to another tool."

---

## Task 1 — Audit: Current Transition

### Trigger conditions (unchanged)

`DiaryDraftSuggestion` appears when ALL of the following are true:

- `!isSending` — user is not mid-send
- `!!latestCounselorMsg` — Elena has responded at least once
- `userMsgCount >= 3` — user has sent 3+ messages
- `crisisLvl < 2` — not in high crisis state
- `diarySuggEval.shouldSuggest` — emotional signal threshold met:
  - `heaviness >= 3` (heavy emotion keywords in last 8 messages), OR
  - `heaviness >= 1 AND repetition >= 3` (repeating meaningful token + some heaviness)
- `!blockedByCooldown` — not within 24h of a dismiss or creation for this thread
- `!linkedEntry` — no existing journal link for this thread

### What was wrong with the previous copy

**Label** — rendered in small all-caps (`uppercase tracking-wide`), it read like a UI widget category:
- "UN MOMENTO PARA ESCRIBIR" — too instructional, sounds like a CTA header
- "QUIZÁ VALGA LA PENA ANOTARLO" — slightly mechanical
- "REFLEXIÓN SUGERIDA" — worst: sounds like a feature name, not a moment

**Body copy** — used transactional language ("guardarlo", "podemos guardarlo"):
- Heavy: "Si te parece, puedes guardarlo tal como está y seguir explorándolo con más calma después." — the word "guardarlo" (save it) emphasizes the action, not the continuity
- Repetition: "Este tema ha estado apareciendo varias veces. Si quieres, podemos guardarlo para que puedas verlo mejor después." — clinical observation ("ha estado apareciendo varias veces") + archive framing
- Default: "Si quieres, podemos guardarlo para que puedas leerlo con más calma. Puedes editarlo o dejarlo ir cuando quieras." — too many options, too operational

**Button** — "Sí, lo guardo por ahora" — "guardo" (I save) is a file-management word. "Por ahora" (for now) sounds like hedging.

**Dismiss** — "Ahora no, gracias" — fine but the "gracias" reads slightly formal.

**Draft template** in `generateDiaryDraft()`:
- Ends with "Un pequeño paso: Hoy puedo hacer una cosa..." and "Nota para mí: Está bien sentir todo esto." — these two sections feel like a CBT worksheet, not a personal journal. A user who just had an emotional conversation doesn't need structured action prompts.
- Titles like "Necesito sentirme acompañado/a" are too vulnerable for a title — they put the user's need in the subject line before they've chosen to own it.

### Where emotional momentum was lost

The transition broke at two points:
1. The suggestion card itself felt like a utility widget ("REFLEXIÓN SUGERIDA") rather than an extension of the conversation
2. The draft journal entry landed the user in a structured worksheet rather than an open page seeded with their own words

---

## Task 2 — Micro-Timing

No changes to the trigger conditions. The existing thresholds (`heaviness >= 3`, `userMsgCount >= 3`, `!!latestCounselorMsg`) already ensure the suggestion only appears after substantive emotional exchange. Changing these would risk either showing too early (shallow conversations) or too late (missing the moment). The existing design is correct.

---

## Task 3 — Microcopy Changes

### `src/components/DiaryDraftSuggestion.tsx`

#### Label text

Removed `uppercase tracking-wide` CSS classes from the label `<p>` — the label now renders in sentence case at 11px muted, which reads as gentle context rather than a widget header.

| Reason | Before | After |
|---|---|---|
| heaviness | "Un momento para escribir" (ALL CAPS) | "Para darte un poco más de espacio" |
| repetition | "Quizá valga la pena anotarlo" (ALL CAPS) | "Algo que sigue presente" |
| default | "Reflexión sugerida" (ALL CAPS) | "Para seguir pensando" |

#### Body text

| Reason | Before | After |
|---|---|---|
| heaviness | "Si te parece, puedes guardarlo tal como está y seguir explorándolo con más calma después." | "A veces ayuda escribir esto cuando ya no hay que explicarlo — solo seguir pensando con más calma." |
| repetition | "Este tema ha estado apareciendo varias veces. Si quieres, podemos guardarlo para que puedas verlo mejor después." | "Esto sigue apareciendo en la conversación. Escribirlo podría ayudarte a verlo con más claridad." |
| default | "Si quieres, podemos guardarlo para que puedas leerlo con más calma. Puedes editarlo o dejarlo ir cuando quieras." | "Si quieres, puedes escribir esto con más calma en tu diario. No tiene que estar ordenado." |

Key shifts:
- Removed "guardarlo" (save it) → framing is now about writing/thinking, not filing
- Removed "podemos guardarlo para que puedas verlo mejor después" → removed the archive framing
- Added continuation language ("seguir pensando", "seguir apareciendo", "con más calma")
- Removed "Puedes editarlo o dejarlo ir cuando quieras" — too many option-statements, creates friction instead of flow

#### Button text

| Before | After |
|---|---|
| "Sí, lo guardo por ahora" | "Escribirlo con calma" |
| "Guardando…" (loading) | "Abriendo…" (loading) |

The new button reads as an activity ("escribirlo"), not a save action. "Con calma" echoes the body copy, creating a single consistent tone.

#### Dismiss text

| Before | After |
|---|---|
| "Ahora no, gracias" | "Ahora no" |

Simpler. The "gracias" added formality that felt slightly awkward after an emotional exchange.

---

## Task 4 — Light Contextualisation

The `reason` prop already provides two dimensions of context (`heaviness` vs `repetition`), and the new body copy uses this to adapt the message. No additional AI calls or props added.

The `isHeavy` path now says "A veces ayuda escribir esto cuando ya no hay que explicarlo" — the phrase "ya no hay que explicarlo" implicitly acknowledges that the user has already been explaining something heavy. This is contextual without requiring any new data.

The `isRepetition` path says "Esto sigue apareciendo en la conversación" — a soft mirror of the pattern the system detected.

---

## Task 5 — Reduce Friction Into Journal

### `src/lib/diaryDraft.ts` — Template simplification

#### Titles

| Condition | Before | After |
|---|---|---|
| `uxIntensity >= 3` | "Un momento difícil hoy" | "Lo que pesó hoy" |
| `PROCESSING` | "Reflexionando sobre lo que siento" | "Lo que tengo en la mente" |
| `CONNECTION` | "Necesito sentirme acompañado/a" | "Buscando compañía" |
| default | "Lo que llevo hoy" | "Lo que llevo hoy" (unchanged) |

Rationale:
- "Un momento difícil hoy" → "Lo que pesó hoy": shorter, less declarative, less definitive about what the session was
- "Reflexionando sobre lo que siento" → "Lo que tengo en la mente": simpler, more genuine, less meta
- "Necesito sentirme acompañado/a" → "Buscando compañía": less confessional as a title before the user has chosen to own it

#### Template content

Removed the two prescriptive closing sections that made the draft feel like a CBT worksheet:

**Removed:**
```
Un pequeño paso: Hoy puedo hacer una cosa, aunque sea imperfecta, que me acerque a sentirme mejor.

Nota para mí: Está bien sentir todo esto. Estoy trabajando en ello.
```

**Kept:**
```
Lo que está pasando: [summary from last 3 user messages]

Cómo me siento: Me siento [emotion]. Mis emociones han estado [intensity].

Lo que podría necesitar: [need phrase].
```

Rationale: The first three sections are grounded in actual content from the conversation. The last two sections were affirmations/instructions that felt pre-written and disconnected. A user landing in their journal after an emotional chat session should find a starting point that feels like their own words — not a worksheet to complete.

### Continuity from chat (unchanged behavior)

The journal already auto-opens to the correct draft via `sessionStorage['diaryAutoOpen']`. JournalPage detects this, switches to the drafts tab, and `handleSelectEntry` opens the entry. No change needed here — the UX of landing is already correct.

---

## Files Modified

| File | Change |
|---|---|
| `src/components/DiaryDraftSuggestion.tsx` | Microcopy: labels, body, button, dismiss; removed uppercase CSS from label |
| `src/lib/diaryDraft.ts` | Titles softened; removed two prescriptive closing sections from template |

---

## Before / After Summary

### The suggestion card

**Before:**
```
UN MOMENTO PARA ESCRIBIR (ALL-CAPS header)
Si te parece, puedes guardarlo tal como está y seguir explorándolo con más calma después.
[Sí, lo guardo por ahora]  [Ahora no, gracias]
```

**After:**
```
Para darte un poco más de espacio
A veces ayuda escribir esto cuando ya no hay que explicarlo — solo seguir pensando con más calma.
[Escribirlo con calma]  [Ahora no]
```

### The draft entry (heaviness path)

**Before title:** "Un momento difícil hoy"
**After title:** "Lo que pesó hoy"

**Before content ends with:**
```
...
Un pequeño paso: Hoy puedo hacer una cosa, aunque sea imperfecta, que me acerque a sentirme mejor.

Nota para mí: Está bien sentir todo esto. Estoy trabajando en ello.
```

**After content ends with:**
```
...
Lo que podría necesitar: un momento de calma y orden en mis pensamientos.
```

Clean stop. The user's journal is now a starting point for reflection, not a filled-in form.

---

## Why This Over Larger Alternatives

**Considered and rejected:**
- New AI generation step to create contextual suggestion text: adds latency + cost, creates failure mode
- Separate "transition screen" between chat and journal: adds navigation step, increases switching feeling
- More granular reason-specific body copy (using keyword from repetition): risks sounding surveillance-like ("Noté que llevas días hablando de tu trabajo")
- Changing the trigger threshold: risks either too-early or too-late appearance; existing thresholds are correct

**Why microcopy + template was the right focus:**
- The trigger timing is already correct
- The emotional content was already there (the existing system detects real signals)
- The gap was entirely in tone and framing: the suggestion felt like a file-management action, not a continuation of a conversation
- Fixing the words required no new system, no new data, no new components
