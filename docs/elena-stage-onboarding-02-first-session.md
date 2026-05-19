# Elena Onboarding — Stage 02: First-Session Experience
**Scope:** Chat-only improvements to reduce time to first meaningful moment
Last Updated: 2026-03-19T00:00:00Z
Status: Implemented and verified (build passes)

---

## Goal

Within the first 2–3 minutes of using Elena for the first time, the user should:
1. Know what to say (blank-page anxiety eliminated)
2. Express something real (emotionally-inviting entry points)
3. Feel understood by Elena (insight seed sets up future value)

---

## Task 1 — First Message Guidance

**File modified:** `src/lib/contextualGreeting.ts`

**What changed:** Each of the 4 `FIRST_TIME` greeting variants now includes a second paragraph before the closing question. This reduces blank-page anxiety without creating a separate system message or UI block.

**Before:**
```
Hola {name} 🌷

Estoy aquí para escucharte.

¿Cómo te sientes hoy?
```

**After (variant 1 example):**
```
Hola {name} 🌷

Estoy aquí para escucharte.

Puedes contarme algo que tengas en la cabeza ahora mismo… no tiene que estar ordenado.

¿Cómo te sientes hoy?
```

**All 4 variants now include:**
| Variant | Follow-up line added |
|---|---|
| 1 | "Puedes contarme algo que tengas en la cabeza ahora mismo… no tiene que estar ordenado." |
| 2 | "No necesitas saber bien qué decir — puedes empezar por lo que tengas en mente." |
| 3 | "Puedes escribir lo que sea, tal como venga — no tiene que ser perfecto." |
| 4 | "Puedes contarme algo de lo que tienes en mente, aunque no lo tengas del todo claro." |

**Trigger:** Shown on first-ever chat session when `lastChatAt === null` (via `selectVariants(null)` → `FIRST_TIME`).

**Scope:** FIRST_TIME variants only. YESTERDAY, PAST_WEEK, and LONG_ABSENCE variants are unchanged.

---

## Task 2 — First-Time Chips

**File modified:** `src/pages/ChatPage.tsx`

**What changed:** The 4 starter chips shown in the `showFirstTimeWelcome` banner were replaced with 5 emotionally-inviting, first-person, open-ended starters.

**Before:**
```
'Hoy me siento…'
'No dejo de pensar en…'
'Algo me preocupa y no sé por qué'
'Quiero entender mejor lo que siento'
```

**After:**
```
'Hoy me sentí…'
'Algo que no me puedo sacar de la cabeza es…'
'Últimamente me está pesando…'
'No sé por qué, pero me siento…'
'Hay algo que me preocupa y es…'
```

**Key improvements:**
- Past tense ("me sentí") opens the door for narrative — less clinical than "me siento"
- "Algo que no me puedo sacar de la cabeza" directly names the experience of rumination
- "Me está pesando" is the most common vernacular for emotional weight in Spanish
- All 5 are incomplete sentences — user fills in the specific content, Elena responds to what's real
- 5 chips instead of 4 gives slightly more surface area without cluttering

**Trigger:** `showFirstTimeWelcome` — only shown when `isFirstTimeUser === true` AND `userMsgCount === 0` AND `!isLoading`. Disappears after first message is sent. The existing `SuggestionChips` component used for all other chip interactions is NOT affected.

---

## Task 3 — Early Insight Seed

**File modified:** `src/pages/ChatPage.tsx`

**What changed:** After Elena's first-ever response to the user (first message exchange), a single soft sentence about patterns is appended to the reply text.

**How it works:**
1. `const isFirstEverMessage = isFirstTimeUser === true` is captured at the start of `handleSendMessage`, before `setIsFirstTimeUser(false)` is called
2. After `replyText` is computed from the AI response, if `isFirstEverMessage === true` AND `sessionStorage` key `elena_insight_seed_{userId}` has not been set:
   - The seed line is appended to `replyText` with a paragraph break
   - The sessionStorage key is set to prevent repeat in same session
3. The augmented `replyText` is then encrypted and stored in the DB as usual — the seed becomes part of Elena's message content

**Seed line appended:**
```
A veces, cuando volvemos a hablar varios días, empiezan a aparecer patrones… si en algún momento quieres, puedo ayudarte a verlos.
```

**Trigger conditions:**
- ONLY fires when `isFirstTimeUser === true` at the moment the user sends (first-ever message in the app)
- ONLY fires once per session (sessionStorage key prevents repeat within tab session)
- ONLY fires once ever per user per browser (the key is `elena_insight_seed_{userId}`)
- Silent: no new UI element, no component, no indicator — it's part of Elena's reply

**Why this works:** The line is placed naturally at the end of Elena's first full response. It introduces the concept of patterns without explaining features. It is optative ("si en algún momento quieres") so it creates zero pressure. It plants a return reason without announcing it.

**Edge cases handled:**
- If `sessionStorage` fails (e.g., in incognito with storage blocked), the `try/catch` silently skips
- If the user opens a new tab, the sessionStorage check re-runs — they could see the seed again. This is acceptable: the seed is benign and the new tab represents a new session context

---

## Task 4 — DiaryDraftSuggestion Tone

**File modified:** `src/components/DiaryDraftSuggestion.tsx`

**What changed:** Body copy and primary button label updated to feel like a natural continuation of the conversation rather than a feature announcement.

### Body copy

**Heavy reason — before:**
> "Si te parece, poner esto por escrito puede ayudarte a bajar un poco la intensidad y ordenarlo con calma. Puedes editarlo o descartarlo después."

**Heavy reason — after:**
> "Si te parece, puedes guardarlo tal como está y seguir explorándolo con más calma después."

**Repetition reason — before:**
> "Este tema ha estado apareciendo varias veces. Escribirlo podría ayudarte a verlo con más claridad. Puedes editar o descartar el borrador cuando quieras."

**Repetition reason — after:**
> "Este tema ha estado apareciendo varias veces. Si quieres, podemos guardarlo para que puedas verlo mejor después."

**Default — before:**
> "Si te parece, podríamos convertir esto en un borrador de diario para ordenarlo con más claridad. Puedes editarlo o descartarlo después."

**Default — after:**
> "Si quieres, podemos guardarlo para que puedas leerlo con más calma. Puedes editarlo o dejarlo ir cuando quieras."

### Button label

**Before:** "Crear borrador" / "Preparando borrador…"
**After:** "Sí, lo guardo por ahora" / "Guardando…"

**aria-label — before:** "Crear borrador en el diario"
**aria-label — after:** "Guardar en el diario"

**Logic unchanged.** No trigger conditions, timing, or component structure was modified. Only copy.

---

## Files Modified

| File | Task | Change |
|---|---|---|
| `src/lib/contextualGreeting.ts` | 1 | 4 FIRST_TIME variants: added blank-page relief line before closing question |
| `src/pages/ChatPage.tsx` | 2 | First-time welcome chips: 4 generic → 5 emotionally-inviting starters |
| `src/pages/ChatPage.tsx` | 3 | `handleSendMessage`: insight seed injected into first-ever Elena response |
| `src/components/DiaryDraftSuggestion.tsx` | 4 | Body copy and button label shifted from functional to conversational tone |

## Files Created
- `docs/elena-stage-onboarding-02-first-session.md`

---

## Trigger Summary

| Change | When it fires | How often |
|---|---|---|
| FIRST_TIME greeting with follow-up line | First-ever chat session (no previous messages) | Once per user lifetime |
| First-time welcome chips (5 new) | `isFirstTimeUser === true` AND `userMsgCount === 0` | Once per user lifetime |
| Insight seed appended to Elena's reply | First message the user ever sends | Once per browser session (sessionStorage guard) |
| DiaryDraftSuggestion new copy | Same as before: 3 user messages + emotional threshold | No change to trigger |

---

## Next Steps

These changes reduce blank-page anxiety and plant an insight return seed. The remaining gaps from the Stage 01 audit are:

1. **Tone selector first-time hint** — the tone dropdown is still unexplained to first-time users
2. **Insights page first-visit empty state** — still has no scaffolding for day-0 users
3. **Minimal onboarding flow (2 screens)** — the largest structural gap; no screen currently explains the 3 surfaces before the user reaches Chat
