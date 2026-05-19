# Elena (Tu-Animo.app) — Feature Documentation

Version: 3.2
Last Updated: 2026-03-20T13:00:00Z

---

## 1. Routing Architecture

### 1.1 Public Landing Page at `/`

A new minimal marketing landing page has been added at `/`. It is accessible to all visitors without authentication and serves as the public entry point to the application.

The landing page includes:
- A sticky header with the Tu-Animo.app logo and two CTA buttons: "Iniciar sesión" (→ `/login`) and "Abrir app" (→ `/app`)
- A hero section with headline, subheadline, and primary/secondary CTA buttons
- A three-card benefits section highlighting emotional support, privacy, and personal insights
- A features section detailing Chat with Elena, Personal Journal, and Weekly Insights
- A call-to-action section at the bottom
- A simple footer with copyright

**File:** `src/pages/LandingPage.tsx`

### 1.2 Login Page at `/login`

The existing login form (previously served at `/`) has been moved to `/login`. Authenticated users who visit `/login` are automatically redirected to `/app/chat`.

**File:** `src/pages/LoginPage.tsx`

### 1.3 App Routes under `/app`

All authenticated application routes now live under the `/app` prefix:

| Route | Page |
|---|---|
| `/app` | Redirects to `/app/chat` |
| `/app/chat` | Chat with Elena |
| `/app/journal` | Personal journal |
| `/app/insights` | Weekly insights |
| `/app/settings` | User settings |
| `/app/admin` | Admin panel |
| `/app/admin/simulator` | Cost simulator |
| `/app/admin/token-usage` | Token usage analytics |
| `/app/admin/token-costs` | Token costs report |
| `/app/admin/users` | User management |
| `/app/admin/crisis-events` | Crisis events log |
| `/app/admin/plan-limits` | Plan limits configuration |
| `/app/admin/boundary-tests` | Boundary/adversarial tests |
| `/app/admin/chat-signal-backfill` | Chat signal backfill tool |
| `/app/admin/flight-recorder` | Flight recorder QA tool |
| `/app/admin/email-lifecycle` | Email lifecycle manager |

### 1.4 Route Protection

- `ProtectedRoute`: Unauthenticated users are redirected to `/login`
- `AdminRoute`: Unauthenticated users redirected to `/login`; non-admin authenticated users redirected to `/app/chat`
- Catch-all route: Authenticated users go to `/app/chat`; unauthenticated users go to `/`

### 1.5 Netlify SPA Routing

A `netlify.toml` file has been added to enable deep-link support on Netlify. All routes (e.g., `/app/chat`, `/app/journal`) are correctly served on page refresh.

**File:** `netlify.toml`

---

## 2. Navigation Updates

All internal navigation across the application has been updated to reflect the new `/app/*` route prefix:

- `src/components/Layout.tsx` — bottom nav bar links updated to `/app/chat`, `/app/journal`, `/app/insights`, `/app/settings`, `/app/admin`
- `src/pages/InsightsPage.tsx` — navigate calls updated to `/app/journal` and `/app/chat`
- `src/pages/JournalPage.tsx` — setLocation calls updated to `/app/chat`, `/app/journal`, `/app/insights`
- `src/pages/ChatPage.tsx` — setLocation calls updated to `/app/journal`, `/app/insights`
- `src/pages/AdminPage.tsx` — admin nav card hrefs updated to `/app/admin/*`
- All admin sub-pages — back links to admin panel updated to `/app/admin`

---

## 3. Chat — First-Time User Welcome Experience

### 3.1 Overview

When a user opens `/app/chat` for the very first time (i.e., they have never sent a message before), a calm welcome block is shown inline within the chat area. The goal is to make the initial experience feel emotionally safe, guided, and personal — without adding onboarding flows, modals, or multi-step prompts.

### 3.2 First-Time Detection

On mount, a lightweight Supabase query counts the number of `sender = 'user'` messages associated with the authenticated user across all threads. If the count is `0`, the user is classified as first-time.

```
SELECT count(*) FROM chat_messages WHERE user_id = $1 AND sender = 'user' LIMIT 1
```

- State: `isFirstTimeUser: boolean | null` — `null` while loading, `true` if no prior messages, `false` otherwise.
- The welcome block is shown when `isFirstTimeUser === true` AND `userMsgCount === 0` AND `!isLoading`.
- As soon as the user sends their first message, `isFirstTimeUser` is set to `false` optimistically, immediately removing the block without waiting for a server round-trip.

### 3.3 Welcome Block Content

The welcome block appears in the chat scroll area, below any existing messages (including Elena's contextual greeting) and above the chat input.

**Headline:**
> Estoy aquí para escucharte.

**Supporting text:**
> Puedes escribir lo que tengas en mente. No necesitas explicarlo perfecto.

**Soft suggestion chips (clickable, fill input only — do not auto-send):**
- "Hoy me siento…"
- "No dejo de pensar en…"
- "Algo me preocupa y no sé por qué"
- "Quiero entender mejor lo que siento"

Clicking a suggestion chip fills the chat input with the suggestion text and focuses the cursor at the end of the input. The user can then edit or send as they choose.

### 3.4 Behavior After First Message

- The welcome block is removed immediately when the user sends their first message (optimistic `setIsFirstTimeUser(false)` call).
- Normal chat flow continues without interruption.
- The block never reappears, even if the user creates new chat threads.

### 3.5 Visual Style

- Minimal: plain text headline, muted subtext, soft bordered chips.
- No icons, no heavy borders, no bright colors.
- Consistent with the application's calm, premium tone.
- Chips use `border-app-border`, `bg-app-surface`, and on hover subtle sage accent — same styling language as the rest of the UI.

**File modified:** `src/pages/ChatPage.tsx`

---

## 4. Chat — Insights Availability Reminder

### 4.1 Overview

When new insights are available and the user has not yet viewed or dismissed them, a small calm banner is shown above the chat input bar. It replaces the previous English-language chip. The goal is to surface insights passively and non-intrusively, matching the app's calm, supportive tone.

### 4.2 Display Conditions

The reminder is shown only when ALL of the following are true:

| Condition | Detail |
|---|---|
| New insights exist | `latestInsight?.created_at` is non-null |
| Insights are unread | `hasNewInsightsSinceLastView(latestInsight.created_at)` returns `true` |
| Not dismissed | User has not clicked the dismiss (×) button for the current insight cycle |
| Not recently interacted | User has not navigated to Insights via this banner during the current insight cycle |

Both "dismissed" and "interacted" states are tracked in `localStorage`, keyed to the insight's `created_at` timestamp. When the insight cycle resets (a new insight is generated), both flags are automatically cleared.

### 4.3 Reminder Content

The banner renders as a single slim row above the input bar:

- **Text:** "Hay algo que podrías querer ver sobre ti."
- **Action button:** "Ver insights" — navigates to `/app/insights`, marks the banner as interacted
- **Dismiss button:** × — hides the banner for the current insight cycle

### 4.4 Behavior

- Clicking "Ver insights" records the interaction in `localStorage` (key: `insight_shortcut_interacted_at:<timestamp>`), sets `insightsPageSource = 'chat_cta'` in `sessionStorage`, and navigates to `/app/insights`. The banner will not reappear for this insight cycle.
- Clicking × records a dismissal in `localStorage` (key: `chat_insight_chip_dismissed_at:<timestamp>`). The banner will not reappear for this insight cycle.
- If the user navigates away and returns, both states are re-read from `localStorage` and the banner only shows if neither flag is set.
- When a new insight is generated (new `created_at`), both flags are cleared and the banner becomes eligible to show again.

### 4.5 Visual Style

- Minimal one-line bar, same `bg-app-surface / border-t border-app-border` as the rest of the input area chrome.
- Muted body text (`text-app-muted`, 12.5px).
- "Ver insights" uses the sage accent color with a hover darkening — no icon, no pill, no border.
- Dismiss button is a plain × icon, no background.
- No animations, no popups, no aggressive visual treatment.

**File modified:** `src/pages/ChatPage.tsx`

---

## 5. Empty States — Journal & Insights

### 5.1 Overview

All empty states across the app were redesigned to feel calm, intentional, and human. Icons were removed. Instructional phrasing was replaced with gentle, conversational Spanish. White space was increased to give the screen room to breathe.

### 5.2 Journal — Entries Tab (no entries)

**Condition:** `visibleEntries.length === 0` when `tab !== 'drafts'`

**Content:**
- Headline: "Puedes empezar con algo simple."
- Three soft prompt starters rendered as lightly styled buttons:
  - "Hoy me siento…"
  - "Algo que no dejo de pensar…"
  - "Una cosa que agradezco hoy…"

**Behavior:** Clicking any prompt calls `handleNewEntry()` and pre-fills the journal editor with that prompt text after a `setTimeout(0)` to allow state to settle.

**Design:** Vertically centered, `py-16` padding, `max-w-[260px]` column of buttons, muted text and thin border — no icons, no bold headers.

### 5.3 Journal — Drafts Tab (no drafts)

**Condition:** `visibleEntries.length === 0` when `tab === 'drafts'`

**Content:**
- "Aún no hay borradores."
- Smaller helper text: "Puedes crear uno desde un chat con 'Convertir a diario'."

**Design:** Same centered layout, two lines of muted text, no icon.

### 5.4 Insights — Very Early State (no chat or journal data at all)

**Condition:** `isVeryEarlyState` — chat aggregation loaded, journal loaded, no data in either

**Content:**
- "Con el tiempo irás viendo patrones aquí."
- "Todo empieza con lo que escribes."

**Design:** `py-14` centered column, headline at 14px muted, sub-line at 12.5px more faded. No card border, no icon.

### 5.5 Insights — Low Evidence State (some data but not enough for full insights)

**Condition:** `!hasEnoughInsightEvidence && !isVeryEarlyState`

**Content:**
- "Con más días irán apareciendo temas aquí."

**Design:** Single centered line, `text-app-muted/55`, 12px.

**Files modified:**
- `src/pages/JournalPage.tsx`
- `src/pages/InsightsPage.tsx`

---

## 6. Authenticated Home Redirect

### 6.1 Overview

When a logged-in user navigates to `/`, they are automatically redirected to `/app/chat` instead of seeing the landing page. Unauthenticated users continue to see the landing page normally.

### 6.2 Implementation

A `HomeRoute` component was added in `src/App.tsx`. It reads auth state from `useAuth()`:

- While auth is loading: renders the loading spinner (`LoadingScreen`)
- If a user session exists: redirects to `/app/chat`
- If no session: renders `LandingPage`

The `/` route now uses `HomeRoute` instead of `LandingPage` directly.

### 6.3 Conditions

- Redirect only fires if `user` is truthy (authenticated session present)
- No redirect if `loading` is still true (avoids flash of landing page)
- Does not affect `/login` or any other route

---

## 7. Behavior Loop Activation — Recognition, Return Trigger, Insight Bridge, Memory Reference

### 7.1 Overview

Four lightweight behavioral enhancements to the Elena chat loop were added to make the app feel like it pays attention over time. These changes do not introduce new UI, new tables, or new flows. They operate entirely within the existing chat pipeline and reuse existing signal, memory, and insight data.

---

### 7.2 Recognition (Pattern Awareness in Chat Responses)

**What it does:** Occasionally, when Elena detects a recurring emotional pattern in the user's history, she weaves one short observational sentence into her response — e.g. "Parece que esto ha estado presente varios días."

**Where it lives:** `supabase/functions/chat-ai/index.ts`

**How it works:**
- Two helper functions were added: `checkRecognitionEligible()` and `buildRecognitionBlock()`
- `checkRecognitionEligible()` returns `true` approximately 25% of the time when:
  - The prior context has `recurringThemes` (≥2 active days of evidence) or a `dominantTheme`
  - None of the last 3 assistant messages carry `meta.recognition_used = true`
  - Prior context is not suppressed for this turn
- When eligible, `buildRecognitionBlock()` injects a conditional instruction block into the system prompt containing a phrase pool of 5 variants and strict rules (max 15 words, observational tone only, omit if not naturally relevant)
- After the response, `meta.recognition_used = true` is stamped on the assistant message — this flag is stored in `chat_messages.meta` (jsonb) and read by the eligibility check on the next turn

**Anti-repetition:** The `meta.recognition_used` flag on the last 3 assistant messages prevents recognition from firing on consecutive turns. The phrase pool rotates naturally via LLM selection.

**Safety:** Recognition is disabled when `suppressPriorContext` is active (prior context was used in the last 3 turns), and the injected instructions explicitly require the sentence to be omitted if the message does not naturally connect to the theme.

---

### 7.3 Return Trigger (Soft Curiosity Sentence)

**What it does:** At the end of some reflective responses, Elena adds one quiet sentence that creates gentle open-endedness — e.g. "Tal vez vale la pena volver a esto más adelante."

**Where it lives:** `supabase/functions/chat-ai/index.ts`

**How it works:**
- Two helper functions were added: `checkReturnTriggerEligible()` and `buildReturnTriggerBlock()`
- `checkReturnTriggerEligible()` returns `true` approximately 20% of the time when:
  - `modeUsed` is `REFLECTION` (not CRISIS, BOUNDARY, or SUPPORT)
  - `uxStance` is not `STABILIZATION`
  - None of the last 3 assistant messages carry `meta.return_trigger_used = true`
- When eligible, `buildReturnTriggerBlock()` injects a conditional instruction block with a phrase pool of 4 variants and strict rules (max 15 words, soft tone only, at the end of the response, omit if it does not feel natural)
- After the response, `meta.return_trigger_used = true` is stamped on the assistant message

**Anti-repetition:** The `meta.return_trigger_used` flag on the last 3 assistant messages prevents the return trigger from appearing on consecutive turns.

**Safety:** Disabled entirely during CRISIS, BOUNDARY, SUPPORT modes and STABILIZATION stance. Elena's instructions require omission if the sentence does not fit naturally.

---

### 7.4 Weekly Insight → Chat Return Bridge

**What it does:** When a user returns after 48+ hours of absence and a recent weekly insight exists (generated within the last 14 days), Elena's opening message in the new thread incorporates the insight in natural language instead of a generic greeting — e.g. "Estuve revisando un poco lo que has compartido. [insight prose]. ¿Cómo te sientes hoy?"

**Where it lives:**
- `src/lib/contextualGreeting.ts` — new functions `getInsightSnippetForReturn()` and `buildReturnGreetingWithInsight()`
- `src/pages/ChatPage.tsx` — `insertWelcomeMessage()` modified to check hours-absent and call the new functions

**How it works:**
- `getInsightSnippetForReturn()` queries `mood_weekly_insights` for rows with `week_start_date` within the last 14 days, ordered descending. Returns up to 2 sentences (max 250 chars) with structural delimiters (`[[COMPARISON]]`, `[[MICRO_STEP]]`) stripped.
- `buildReturnGreetingWithInsight()` combines a name-aware greeting, a randomly selected opener from a pool of 4 variants, the insight snippet, and a closing question.
- In `insertWelcomeMessage()`, after fetching `lastChatAt`, hours-absent is computed. If ≥ 48 hours, the insight snippet is fetched. If a snippet exists, the insight-enriched greeting is used; otherwise, the standard contextual greeting is used as a fallback.
- The `welcome_inserted` flag on `chat_threads` (already existing) prevents this from firing more than once per thread — naturally session-safe.

**Data source:** `mood_weekly_insights` table — queried client-side via RLS-scoped Supabase client (no new DB tables or RPCs required).

---

### 7.5 Memory Reference Instruction

**What it does:** When the user has saved memories and the current message relates to a stored topic, Elena may add one brief reference such as "Antes mencionaste algo parecido..." or "Recuerdo que mencionaste..."

**Where it lives:** `supabase/functions/chat-ai/index.ts` — `memoryContext` string construction

**How it works:**
- The `memoryContext` block (injected into the system prompt when user memories exist) was enhanced with an explicit instruction: if the current message clearly relates to a stored memory topic (keyword or theme match), Elena may include one brief natural reference — one sentence maximum, only when clearly relevant, never forced.
- This is purely a prompt-level instruction. No new code path, no new DB queries, no new logic. The user memory data was already injected; this adds behavioral guidance for how to use it.

---

### 7.6 Files Changed

| File | Change |
|---|---|
| `supabase/functions/chat-ai/index.ts` | Added `checkRecognitionEligible`, `buildRecognitionBlock`, `checkReturnTriggerEligible`, `buildReturnTriggerBlock`; enhanced `memoryContext`; injected `recognitionBlock` + `returnTriggerBlock` into system prompt; stamped `recognition_used` + `return_trigger_used` meta flags |
| `src/lib/contextualGreeting.ts` | Added `extractInsightForChat`, `getInsightSnippetForReturn`, `buildReturnGreetingWithInsight`, `RETURN_INSIGHT_OPENERS` pool |
| `src/pages/ChatPage.tsx` | Updated import; modified `insertWelcomeMessage` to compute hours-absent and use insight-enriched greeting when returning after 48+ hours |

---

## 8. Dev-Only Behavior Loop Testing Panel

### 8.1 Overview

A minimal floating dev panel was added to ChatPage so developers can instantly trigger any behavior loop condition without waiting for real timing or creating test users. The panel is invisible in production builds — it only renders when `import.meta.env.DEV` is `true`.

No new DB tables, no new pages, no new admin tooling. Dev state lives entirely in `localStorage` and is cleared via a Reset button.

---

### 8.2 Dev Flags

Four `localStorage` keys control behavior loop forcing:

| Key | Behavior when set |
|---|---|
| `elena_dev_force_recognition` | Next response always includes the recognition instruction block, regardless of signal data or randomness |
| `elena_dev_force_return_trigger` | Next response always includes the return trigger closing sentence (in REFLECTION mode) |
| `elena_dev_force_insight_greeting` | New thread welcome message uses the insight-enriched greeting as if the user returned after 48+ hours |
| `elena_dev_force_memory_match` | Memory context block switches to a direct instruction telling Elena the current message is related to stored memories |

Flags persist until cleared. They have no effect in production (`devFlags` is `undefined` in non-DEV builds and the edge function treats a missing/empty `devFlags` object as all-off).

---

### 8.3 Dev Panel UI

**File:** `src/components/DevPanel.tsx`

A small collapsible panel fixed to `bottom: 12px, left: 12px`. The toggle button shows `⚙ DEV` in dark slate, or `⚙ DEV [ON]` in red when any flag is active. Expanding the panel shows four labelled checkboxes (one per flag) and a Reset All Flags button. A note at the bottom reminds the developer that flags take effect on the next message or new thread load.

The component reads and writes `localStorage` directly — no React state that persists beyond a session, no context, no store.

---

### 8.4 How Forcing Works per Behavior

**Force Recognition:** `checkRecognitionEligible()` in `chat-ai/index.ts` accepts a `force` parameter. When `true`, it returns `true` immediately, bypassing the signal check, anti-repetition check, and the 25% random gate. The recognition instruction block is always injected into the system prompt on that turn.

**Force Return Trigger:** `checkReturnTriggerEligible()` accepts a `force` parameter. When `true`, it bypasses anti-repetition and the 20% random gate. Crisis/boundary/support mode blocks are still enforced (the mode must be REFLECTION for the trigger to fire).

**Force Insight Greeting:** `insertWelcomeMessage()` in `ChatPage.tsx` checks `localStorage.getItem('elena_dev_force_insight_greeting')` before the hours-absent check. If the flag is set, it enters the same insight-fetch branch as a real 48h+ return.

**Force Memory Match:** The `memoryContext` string in `chat-ai/index.ts` switches from a permissive "if relevant" instruction to a direct "include a reference" instruction. If the user has no stored memories, a synthetic instruction is injected so the LLM still produces a memory-style sentence for testing.

---

### 8.5 Safety

- The `DevPanel` component renders only inside `{import.meta.env.DEV && <DevPanel />}` — stripped entirely from production bundles by Vite.
- `devFlags` is only populated in ChatPage when `import.meta.env.DEV` is `true`; in production the field is `undefined` and never sent to the edge function.
- The edge function treats a missing or empty `devFlags` object as all-off — no production risk if the field were somehow included.
- Crisis logic is fully unchanged. The return trigger `force` path still respects the CRISIS/BOUNDARY/SUPPORT mode block.

---

### 8.6 How to Use

1. Open `/app/chat` in dev mode
2. Click the `⚙ DEV` button in the bottom-left corner
3. Check one or more flags
4. For insight greeting: start a new thread — the welcome message will use the insight-enriched path
5. For recognition / return trigger / memory match: send any message — the next response will include the forced behavior
6. Click "Reset All Flags" to return to normal production behavior

---

### 8.7 Files Changed

| File | Change |
|---|---|
| `src/components/DevPanel.tsx` | New file — floating dev panel component |
| `src/lib/api.ts` | Added `DevFlags` interface; added `devFlags` parameter to `sendChatMessage`; included in request body |
| `supabase/functions/chat-ai/index.ts` | Added `DevFlags` interface to `ChatRequest`; added `force` param to `checkRecognitionEligible` and `checkReturnTriggerEligible`; reads `devFlags` from request body; updated `memoryContext` to handle `forceMemoryMatch` |
| `src/pages/ChatPage.tsx` | Imported `DevPanel` and `DevFlags`; reads localStorage flags and passes as `devFlags` to `sendChatMessage`; checks `forceInsightGreeting` flag in `insertWelcomeMessage`; renders `<DevPanel />` in DEV only |

---

## 9. Elena Voice Upgrade v1 — Reduce Generic, Increase Personal Feel

### 9.1 Overview

A focused prompt-layer update to Elena's response style. No logic, behavior loop, signals, memory, or DB changes were made. Only the system prompt instruction layer that guides how Elena writes her `reply` field was updated.

### 9.2 Problem Being Solved

Elena was defaulting to generic validation openers that create emotional distance:
- "Es normal sentirse así…"
- "Es comprensible…"
- "El estrés puede ser abrumador…"

These phrases feel interchangeable and template-like. They respond to a category of emotion, not to the specific person in front of Elena.

### 9.3 Changes Made

A new `VOICE & RESPONSE STYLE` block was inserted into the system prompt in `supabase/functions/chat-ai/index.ts`, placed between the `Communication Style` section and `Default Format for Emotional Content`.

The block defines six rules:

**ANCHOR IN THE USER'S OWN WORDS** — Every response must start from what was just said, not from general emotional theory. Preferred opening patterns: "Suena como…", "Parece que…", "Se siente como…", "Da la impresión de…", "Lo que describes suena a…"

**REDUCE GENERIC VALIDATION** — Explicit list of banned opener/filler phrases: "Es normal sentirse así", "Es comprensible", "Es natural" (outside SUPPORT MODE), "A veces las emociones…", "El estrés puede ser…", "Cuando X sucede, es común…". If no personal anchor is available, use a short curious question instead.

**REFLECTION BEFORE GUIDANCE** — Response order is enforced: (1) one short grounded observation anchored in what the user said, then (2) a gentle question or soft support only if natural. Direct bad/good examples included in the prompt.

**NO MINI LECTURES** — Elena must not explain how emotions, the body, or psychology work in general unless the user explicitly asks or SUPPORT MODE containment is active.

**SPECIFICITY RULE** — Even when the topic is common, the phrasing must feel like it refers to this person in this moment. Example pair included in the prompt to guide the LLM.

**SHORT IS MORE PERSONAL** — Explicit instruction: a two-sentence reply that mirrors the user's words feels more attentive than a five-sentence general reflection.

### 9.4 Behavior Loop Compatibility

All existing behavior blocks remain intact and are injected after the new VOICE block:
- `recognitionBlock` — still injected via `${recognitionBlock}`
- `returnTriggerBlock` — still injected via `${returnTriggerBlock}`
- `buildStanceInstruction` — still injected at end of prompt
- SUPPORT MODE containment rules — unchanged; "Es natural" is explicitly allowed inside SUPPORT MODE containment

### 9.5 Before / After Examples

**Example 1**
User: "He estado muy estresado estos días."
Before: "El estrés puede ser abrumador. Es normal sentirse así."
After: "Suena como si esto te hubiera estado pesando varios días."

**Example 2**
User: "No sé qué me pasa."
Before: "A veces es difícil identificar emociones…"
After: "Se siente como algo difícil de poner en palabras."

### 9.6 Files Changed

| File | Change |
|---|---|
| `supabase/functions/chat-ai/index.ts` | Inserted `VOICE & RESPONSE STYLE` block into system prompt between Communication Style and Default Format for Emotional Content |

---

### 9.7 Voice Upgrade v2 — Remove Abstraction + Remove Filler

A surgical follow-up to v1. Two new sub-rules were added to the existing `VOICE & RESPONSE STYLE` block and the `REFLECTION BEFORE GUIDANCE` and `SHORT IS MORE PERSONAL` rules were tightened.

**NO "A VECES…" AS A CONTINUATION** — Explicit ban on using "A veces…" as a default second-sentence filler (e.g., "A veces, esos momentos pueden sentirse muy pesados."). This pattern shifts focus from the specific user to people-in-general. Rule: if the first sentence lands, stop — do not add a second sentence that generalizes.

**NO ABSTRACT LABELS** — Explicit ban on translating the user's felt experience into clinical or conceptual categories. Banned phrases include: "confusión interna", "las causas del estrés", "ese estado emocional", "lo que describes refleja…", "estos momentos pueden…". Preferred alternatives (e.g., "Se siente como algo difícil de poner en palabras.") stay close to the raw experience.

**REFLECTION BEFORE GUIDANCE tightened** — Rule updated from "max 2 sentences" to "one strong sentence beats two sentences where the second dilutes the first." Before/after example pair updated to show the A veces drift pattern explicitly.

**FOLLOW-UP QUESTIONS sub-rule added** — Broad, clinical questions banned ("¿Qué emociones te están acompañando?", "¿Cuáles son las causas?"). Preferred: specific felt-experience questions ("¿Se siente constante o cambia por momentos?", "¿Desde cuándo lo notas más presente?", "¿Lo sientes más en la mente, en el cuerpo, o en ambos?").

**SHORT IS MORE PERSONAL updated** — Changed from "two-sentence reply" to "single sentence." Final principle: "Do not explain the feeling — meet it."

Before/After:

User: "He estado muy estresado estos días."
Before v2: "Suena como si el estrés te estuviera afectando bastante. A veces, esos momentos pueden sentirse muy pesados."
After v2: "Suena como si esto te hubiera estado pesando varios días."

User: "No sé qué me pasa."
Before v2: "Lo que describes suena a una confusión interna. A veces, es difícil identificar las causas de nuestro estrés."
After v2: "Se siente como algo difícil de poner en palabras."

---

### 9.8 Voice Enforcement Patch — Priority Constraints

**Problem solved:** The v1 and v2 style rules were placed mid-prompt (after 200+ lines of other instructions), meaning they could be overridden by earlier sections that implicitly encouraged generic validation or explanatory tone. Patterns like "A veces…" and abstract labels were still appearing because later instruction blocks lacked explicit priority.

**Changes made to `supabase/functions/chat-ai/index.ts`:**

**PRIORITY VOICE CONSTRAINTS block inserted at top of system prompt** — placed immediately after "Your purpose:" and before "RESPONSE LENGTH", making it the first content instruction Elena reads. Contains 7 numbered hard rules plus a mandatory SELF-CHECK with four specific pass/fail questions Elena must answer before outputting any emotional response. Explicitly exempts only CRISIS mode and SUPPORT MODE containment sentences.

**Conflict found and resolved — Core Traits:** The line "Use active listening and validation techniques" was subtly encouraging generic validation phrasing. Rewritten to: "Use active listening — mirror the user's exact experience, not general emotional descriptions."

**No other logic changed.** Routing, SUPPORT MODE, CRISIS handling, recognition/return trigger/insight bridge, and memory injection are all untouched.

**Why this stops "A veces…":** The SELF-CHECK is a pre-output gate — Elena must verify no sentence begins with "A veces", uses a clinical label, or describes emotions-in-general before the reply is allowed through. This converts a style preference into a blocking filter.

**Updated section in file:** Lines ~1440–1473 (PRIORITY VOICE CONSTRAINTS block) and ~1663 (Core Traits)

---

### 9.9 Voice Enforcement Patch v2 — Closing Remaining Leaks

**Problem solved:** Three categories of violations persisted after v1: generic validation phrases ("Es comprensible", "Es normal", "Es natural"), "a veces" appearing mid-sentence rather than only at sentence starts, and vague/repeated phrasing across turns.

**Changes made to `supabase/functions/chat-ai/index.ts`:**

**Rule 1 strengthened:** "A veces" ban expanded from start-of-sentence to anywhere in the response — start, middle, or end. The word is fully banned in all emotional responses. SUPPORT MODE containment is the only exception, and only when unavoidable.

**Rule 2 added (generic validation block):** "Es comprensible", "Es normal", "Es natural", "puede ser pesado/difícil", and "sentirse así" (unanchored) are now fully banned outside SUPPORT MODE containment. Explicit list with exact banned phrases so there is no ambiguity.

**Rule 9 added (grounding language):** Vague softeners ("te está afectando bastante", "puede ser pesado") replaced with weight-bearing alternatives ("esto te ha estado pesando", "se ha sentido constante", "no te ha soltado"). Language must describe this specific person's experience.

**Rule 10 added (repetition guard):** No repeated sentence, image, or phrasing within the same response or the immediately following response. If the current draft mirrors the previous reply, rewrite before outputting.

**SELF-CHECK extended to 6 gates:** Two new checks added — "Does the response contain any generic validation phrase?" and "Does any sentence repeat phrasing from the immediately previous response?" Both require rewrite before output.

**"Es natural" leak patched in LINK BOUNDARY SOFTENER:** The approved softener "Es natural buscar recursos externos" was replaced with "Tiene sentido querer algo ya preparado para esto." — which conveys the same warmth without triggering the banned phrase.

**Before/after example:**
User: "Llevo días sin poder dormir bien."
Before v2: "Es comprensible que te sientas agotado. A veces el cuerpo acumula tensión sin que nos demos cuenta."
After v2: "Suena como que el cansancio ya se instaló — no solo esta noche, sino varios días seguidos. ¿Hay algo que no para de darte vueltas cuando intentas descansar?"

**Updated section in file:** Lines ~1440–1490 (PRIORITY VOICE CONSTRAINTS block), ~1509–1515 (LINK BOUNDARY SOFTENER)

---

### 9.10 Single Prompt Enforcement — Unified Response Paths

**Problem solved:** Voice constraints were applied to the primary AI call but NOT to the retry path. When the main OpenAI call returned an empty response, a bare fallback prompt was used with no PRIORITY VOICE CONSTRAINTS, no SELF-CHECK, and no banned-phrase rules. This was the source of leaked "Es completamente normal", "Lamento que", and "A veces" responses.

**Response paths audited:**

Five distinct paths were identified:

1. **Primary AI call** (line ~1879) — used the full `systemPrompt` variable. Correctly constrained.
2. **Retry AI call** (line ~1914) — used a bare inline prompt with zero voice constraints. THIS was the leak source.
3. **Last-resort hardcoded fallback** (line ~1980) — triggered only when both AI calls return empty. Uses a neutral, constraint-safe string. Acceptable as-is.
4. **Budget limit response** (line ~893) — administrative 402 error, not an emotional response. No change needed.
5. **HTTP error response** (line ~2147) — system error only, not a conversational reply. No change needed.

**Fix applied — retry prompt (critical):**

The inline bare retry system prompt was replaced with the already-constructed `systemPrompt` variable, which contains all PRIORITY VOICE CONSTRAINTS, SELF-CHECK gates, FORBIDDEN PHRASES, and response style rules. The retry now runs through identical constraints as the primary call:

```
Before: { role: "system", content: "You are Elena, a warm and empathetic emotional support companion. Respond in Spanish..." }
After:  { role: "system", content: systemPrompt }
```

**Fix applied — BOUNDARY MODE phrase leak:**

The BOUNDARY MODE allowed micro-acknowledgment list contained `"Es natural querer saber eso."` — directly contradicting the PRIORITY VOICE CONSTRAINTS ban on "Es natural...". Replaced with `"Entiendo que quieras saber más sobre eso."` which carries the same warmth without using banned vocabulary.

**Why generic phrases will no longer appear:**

Every AI call — primary and retry — now uses the same `systemPrompt` that contains the PRIORITY VOICE CONSTRAINTS block with explicit named-phrase bans and the 6-gate SELF-CHECK. There is no code path that reaches the user without passing through these constraints.

**Updated section in file:** Lines ~1914–1918 (retry messages array), ~1149 (BOUNDARY MODE allowed phrases)

---

### 9.11 Voice Constraint — Name vs. Describe (Rule 4b)

**Rule added:** Elena must never name a feeling with an abstract noun label. Instead of identifying what the emotion is called, she must describe what that emotion feels like.

**Why this matters:**

Naming a feeling ("sientes confusión", "hay desorientación") places the user outside their experience — they observe it as a category. Describing how it feels ("como si no encontraras dónde pararte", "como si el suelo no estuviera del todo firme") puts them inside it. The description creates presence; the label creates distance.

**Banned patterns:**
- "sientes confusión"
- "hay desorientación"
- "eso genera ansiedad"
- "se nota la frustración"
- "parece agotamiento"

**Preferred — describe experiential or physical texture:**
- "como si no encontraras dónde pararte"
- "como si cada cosa estuviera en el lugar equivocado"
- "como si supieras que algo no va bien pero no pudieras nombrarlo"
- "como si el suelo no estuviera del todo firme"
- "como si hubiera demasiado que procesar al mismo tiempo"

**Edge case:** If the user named their own feeling, Elena does not repeat the label back. Instead she reflects the quality — the weight, texture, or movement of it.

**Also updated:** "desorientación" added to the banned clinical labels in rule 4. The SELF-CHECK now includes an explicit gate for naming vs. describing.

**Updated section in file:** Lines ~1463–1473 (rule 4b), ~1456 (rule 4 label list), ~1499–1500 (SELF-CHECK gates)

---

### 9.12 SELF-CHECK Converted to Mandatory Blocking Rewrite Loop

**Change:** The SELF-CHECK section was redesigned from a passive checklist into a hard rewrite gate.

**Previous behaviour:** SELF-CHECK listed seven items with "→ Remove/Rewrite" instructions. Because it read like a reminder, the model could produce a response that partially failed and still return it.

**New behaviour:**

- The section is now titled "SELF-CHECK — MANDATORY BLOCKING LOOP"
- The opening declares explicitly: *"This is not a checklist. It is a rewrite gate."*
- If ANY check fails, the response MUST NOT be returned
- The model MUST rewrite the entire response and re-run ALL checks from CHECK 1
- The loop continues until every check passes
- Partial compliance is explicitly named as not allowed

**Six named checks (not bullet points):**

| Check | What it tests |
|---|---|
| CHECK 1 | "a veces" anywhere in the response |
| CHECK 2 | Generic validation phrases (Es comprensible, Es normal, etc.) |
| CHECK 3 | General emotion explanations (las emociones pueden…) |
| CHECK 4 | Feeling labels — any abstract noun naming a feeling |
| CHECK 5 | First sentence anchored in user's actual words |
| CHECK 6 | Repetition of phrasing from previous response |

**CHECK 4 strengthened:** The question changed from "does the response name a feeling?" to "does ANY word in the response label a feeling with an abstract noun?" — with an explicit banned word list (confusión, desorientación, ansiedad, tristeza, angustia, frustración, agotamiento, estado emocional, bloqueo emocional) and inline FAIL/PASS examples:

- FAIL: "sientes confusión", "hay desorientación", "eso genera ansiedad", "parece tristeza"
- PASS: "como si no terminaras de ubicarte", "como si algo no encajara del todo", "como si hubiera ruido o peso sin forma clara"

**Why violations can no longer pass through:**

The original SELF-CHECK had no enforcement instruction — it said what to do if something was wrong but did not state that the response was blocked until fixed. The new version opens with an explicit block instruction and closes with a reminder that reaching the output with any unresolved check blocks the response entirely. The rewrite-and-restart framing prevents incremental compliance where one item is fixed while others are left.

**Labeling fully eliminated:**

Feeling labels are now caught at two layers: rule 4 / 4b in the PRIORITY VOICE CONSTRAINTS (drafting-time prohibition) and CHECK 4 in the SELF-CHECK (output-time gate). A label must pass both layers to reach the user — which it cannot, by design.

**Updated section in file:** Lines ~1495–1536 (full SELF-CHECK block replacement)

---

### 9.13 SELF-CHECK Scope Extended to Full Response String (Including Question)

**Problem addressed:** The follow-up question at the end of Elena's responses was treated as outside the SELF-CHECK scope. The reflection sentence passed all checks, but the question could still contain a banned feeling label (e.g., "¿…esta confusión?") and be returned without triggering a rewrite.

**Change:** A SCOPE declaration was added immediately after the opening line of the SELF-CHECK block.

> SCOPE: Every check applies to the COMPLETE output string — reflection sentence, follow-up question, and every additional line. No part of the response is exempt. The question is not a separate zone. It is part of the response and must pass every check.

The BEFORE instruction was also updated:

> BEFORE outputting ANY emotional response, run every check below **against the full text**.
> If ANY check fails in ANY part of the response **(including the question)** → the response MUST NOT be returned.

**How full-response validation is enforced:**

The SCOPE line explicitly names the question as part of the response string, not a separate element. The BEFORE instruction now says "against the full text" and adds "(including the question)" inside the fail condition. The model has no ambiguity about whether the question is covered — it is stated directly and unambiguously.

**Why questions can no longer leak labels:**

Previously, the checks were framed as "does any sentence…" which a model could interpret as applying only to the main body. The new SCOPE statement pre-empts that interpretation by listing the question alongside the reflection sentence as an explicit target. A question containing "confusión" fails CHECK 4 the same way a reflection sentence does.

**Both reflection + question confirmed checked:**

- Reflection sentence: covered by CHECKs 1–6 as before
- Follow-up question: now explicitly named in SCOPE and in the fail condition of the blocking instruction
- Any additional lines: also named in SCOPE

**Bad / Good examples added to prompt:**

- BAD: "¿…esta confusión?"
- GOOD: "¿Se siente más como algo que no termina de encajar, o más como peso constante?"

**Updated section in file:** Lines ~1497–1505 (SCOPE + BEFORE block inside SELF-CHECK)

---

### 9.14 Deterministic Post-Generation Banned-Label Guard (Code Layer)

**Problem addressed:** The SELF-CHECK is a prompt-level instruction — it relies on the model following its own rules. If the model slips a banned label through (e.g., "confusión" in the question), nothing in the previous architecture stops it from reaching the user.

**Change:** A deterministic code-level filter was added to `supabase/functions/chat-ai/index.ts` that runs after the model response is received and finalized, before it is returned to the client.

**Two new artifacts added at the top of the function:**

```typescript
const BANNED_LABEL_WORDS: string[] = [
  "confusión", "confusion",
  "desorientación", "desorientacion",
  "ansiedad", "tristeza", "angustia",
  "frustración", "frustracion",
  "agotamiento", "bloqueo emocional", "estado emocional",
];

function containsBannedLabel(text: string): boolean {
  const lower = text.toLowerCase();
  return BANNED_LABEL_WORDS.some((word) => lower.includes(word));
}
```

**Post-generation guard logic (inserted after reply is finalized):**

1. `containsBannedLabel(aiResponse.reply)` is called against the full reply string — reflection sentence and question included.
2. If a banned word is found, a single guard retry is triggered with the system prompt plus a `CRITICAL OVERRIDE` instruction appended, explicitly naming all banned words and demanding a full rewrite.
3. If the retry reply is clean (non-empty and passes `containsBannedLabel`), it replaces the original reply and its token usage is logged.
4. If the retry is also tainted or the API call fails, a safe hardcoded fallback is used: "Algo en lo que dijiste se quedó resonando. ¿Cómo lo sentiste en ese momento?"

**Why this is a stronger guarantee than the prompt layer alone:**

The model cannot override this check. It runs in TypeScript after the model has already responded. No matter what the model outputs, the code will catch any string from `BANNED_LABEL_WORDS` and trigger a retry or fallback. The prompt SELF-CHECK and this code guard are complementary — the prompt layer prevents most violations; the code layer catches any that slip through.

**Logged signals for observability:**

- `[chat-ai] Banned label detected in model output — retrying once` with a 120-char snippet
- `[chat-ai] Guard retry produced clean reply`
- `[chat-ai] Guard retry still tainted — using safe fallback` with a 120-char snippet
- `[chat-ai] Guard retry API call failed — using safe fallback`

**Updated section in file:** Lines ~2045–2090 (post-generation guard block in `chat-ai/index.ts`)

---

## 10. Admin Manual Email Sender

### 10.1 Overview

A new admin-only tool that allows admin users to send plain-text emails through the existing Resend integration. Available at **Admin > Emails > Envío Manual**. Not connected to the lifecycle email system — this is a standalone, manually triggered tool.

Supports three audience modes:
- **Un usuario** — select exactly one recipient from a searchable dropdown
- **Varios usuarios** — select one or more recipients with a searchable multi-select and chip display
- **Todos los usuarios** — send to all users with a valid non-empty email (deleted profiles excluded)

### 10.2 Database

**Migration:** `20260319_create_admin_manual_emails.sql`

Two new tables:

**`admin_manual_emails`** — parent record per send job:
- `id`, `created_at`, `created_by_admin_id`, `audience_type` (single|multiple|all)
- `subject`, `body_text`, `status` (draft|sending|sent|partial_failed|failed)
- `recipient_count`, `success_count`, `failure_count`

**`admin_manual_email_recipients`** — one row per individual email sent:
- `manual_email_id` (FK → admin_manual_emails, cascade delete)
- `user_id`, `email`, `send_status` (pending|sent|failed)
- `resend_message_id`, `error_message`, `sent_at`

Both tables have RLS enabled. Only authenticated admins (via `is_admin()` RPC) can SELECT. INSERT/UPDATE is performed exclusively by the service role inside the edge function.

Indexes on `created_at DESC`, `created_by_admin_id`, and `manual_email_id` for efficient history and join queries.

### 10.3 Edge Function — `admin-send-manual-email`

**File:** `supabase/functions/admin-send-manual-email/index.ts`
**Auth:** `verify_jwt: false` — performs own admin check using the `isAdminUser()` pattern (replicates email-lifecycle pattern)

Responsibilities in order:
1. Authenticate request via Bearer token
2. Verify requester is admin via `is_admin()` RPC
3. Validate payload: subject required, bodyText required, audienceType must be valid, userId count must match audienceType rules
4. Resolve recipients:
   - For `all`: lists all auth.users via `auth.admin.listUsers`, cross-references profiles to exclude deleted users, deduplicates emails
   - For `single`/`multiple`: resolves by user IDs from auth.users and profiles
5. Creates parent record in `admin_manual_emails` (status: `sending`)
6. Sends each email individually via Resend plain-text (`text` field, not `html`)
7. Logs each recipient result in `admin_manual_email_recipients`
8. Updates final status and counts in parent record: `sent` / `failed` / `partial_failed`
9. Returns structured JSON: `{ ok, emailRecordId, recipientCount, successCount, failureCount, status }`

One failed recipient does NOT abort the entire send. Each failure is logged individually.

### 10.4 Frontend

**New files:**
- `src/pages/admin/AdminManualEmailPage.tsx` — main page
- `src/components/admin/ManualEmailHistory.tsx` — history table component

**Route:** `/app/admin/manual-email` (AdminRoute — admin-only)

**Nav card** added to AdminPage.tsx: "Envío Manual de Emails" with `MailPlus` icon.

**Page sections:**
- **Header** — title, description, back button to admin hub
- **Audience selector** — 3-column pill-style button group (Un usuario / Varios usuarios / Todos)
- **User picker** — searchable dropdown with chip display for multi-select; auto-populates from `admin_list_users()` RPC; for "Todos" shows info box with eligible count
- **Email form** — subject input (200 char max) with counter; plain-text textarea with character count and monospace font
- **Review panel** — live preview of audience, subject, and body; shown only when at least one field has content
- **Send button** — disabled when form is incomplete or request is in-flight; shows spinner during send
- **Confirmation modal** — shown for `multiple` and `all` audience types; displays recipient count, subject, and extra warning for "all users" sends; cannot be dismissed during send
- **Result banner** — dismissable inline banner showing success/partial/error after send
- **History section** — `ManualEmailHistory` component showing last 50 sends with date, audience type, subject, total/ok/error counts, and status badge; auto-refreshes after successful send

**Updated files:**
- `src/App.tsx` — import + route added
- `src/pages/AdminPage.tsx` — `MailPlus` icon imported, nav card added

---

## 11. Adaptive Reflection Prompt Engine — Foundation (Stage RP-01)

### 11.1 Overview

The Reflection Memory system surfaces a past journal entry (~1 week old) above the editor in the Journal page. Previously, the call-to-action prompt was a static hardcoded English string: "How does today compare?" for all users and all entry types.

This stage replaces that static string with a dynamic, Spanish-language prompt that is contextually matched to the emotional signal of the past entry.

### 11.2 New File: `src/lib/reflectionPrompt.ts`

**Purpose:** Core adaptive prompt engine. Classifies the emotional signal of a past journal entry and returns a matching Spanish reflection prompt and editor insert starter.

**Exported types:**
- `ReflectionPromptSignal` — `'stress' | 'anxiety' | 'gratitude' | 'positive' | 'neutral'`
- `ReflectionPromptResult` — `{ signal: ReflectionPromptSignal; promptText: string; insertStarter: string }`

**Exported function:**
- `generateReflectionPrompt(content: string, daysAgo?: number, aiOverride?: { promptText: string; insertStarter: string }): ReflectionPromptResult`

**Signal detection:** Keyword matching against a Spanish vocabulary list shared with the same domain as `insightWeeklyJournal.ts`. Signals detected: `stress`, `anxiety`, `gratitude`, `positive`. Falls back to `neutral` if no keywords match. The highest-scoring signal wins.

**Prompt variants:** 3 natural Spanish prompts per signal type. Variant index is selected by `Math.abs(daysAgo - 6) % 3` so the same user sees different phrasing across sessions without persistent state.

**Insert starters:** Each signal type and variant has a matching insert starter used when the user clicks "Reflexionar". The starter is injected into the editor before the entry excerpt.

**AI override slot:** The function accepts an optional `aiOverride` parameter. Passing it bypasses rule-based logic entirely. This is the hook for a future AI-generated prompt without any refactor.

**Signal → prompt examples:**

| Signal | Example promptText |
|---|---|
| stress | "¿Esa carga sigue sintiéndose igual de pesada hoy?" |
| anxiety | "¿Esa preocupación sigue presente hoy?" |
| gratitude | "¿Qué otras cosas pequeñas agradeces hoy?" |
| positive | "¿Ese ánimo sigue contigo?" |
| neutral | "¿Cómo te sientes hoy comparado con entonces?" |

### 11.3 Modified Files

**`src/components/journal/ReflectionMemoryCard.tsx`**
- Added required `prompt: string` prop to `ReflectionMemoryCardProps`
- Replaced hardcoded "How does today compare?" with `{prompt}`
- Fixed button labels: "Not now" → "Ahora no", "View original" → "Ver original", "Reflect on this" → "Reflexionar"

**`src/components/journal/ReflectionViewerModal.tsx`**
- Fixed "Past reflection · read-only" → "Reflexión pasada · solo lectura"
- Fixed "Use this reflection" → "Usar esta reflexión"

**`src/components/InsightActivationChip.tsx`**
- Fixed "Elena is starting to see patterns in your writing." → "Elena está empezando a ver patrones en lo que escribes."
- Fixed "See what Elena found" → "Ver lo que encontró Elena"
- Fixed aria-label "Dismiss" → "Cerrar"

**`src/pages/JournalPage.tsx`**
- Added imports: `generateReflectionPrompt`, `ReflectionPromptResult`
- Added state: `reflectionPromptResult: ReflectionPromptResult | null`
- In the decryption effect: computes `daysAgo` from `candidate.created_at` and calls `generateReflectionPrompt(trimmed, daysAgo)`, storing the result in state
- Resets `reflectionPromptResult` to null alongside `reflectionDismissed` / `reflectionCollapsed` when candidate changes
- Updated `getReflectionTitle()` to return Spanish: "Hace X días" / "Hace aproximadamente una semana"
- Updated `buildReflectionStarter(src, insertStarter?)` to accept optional `insertStarter` from the engine. Falls back to "Hace unos días escribí:\n" if none provided. The insert format is now: `${insertStarter}\u201c${excerpt}\u201d\n\n`
- `handleReflect()` now passes `reflectionPromptResult?.insertStarter` to `buildReflectionStarter`
- `ReflectionMemoryCard` now receives `prompt={reflectionPromptResult?.promptText ?? fallback}`
- Fixed "Every entry helps Elena notice patterns over time." → "Cada entrada ayuda a Elena a reconocer patrones con el tiempo."
- Fixed post-save nudge text: "Your recent entry may have contributed to a new insight." → "Tu entrada reciente puede haber contribuido a un nuevo insight."

### 11.4 What Is Working After This Stage

- Reflection card shows a Spanish prompt that is semantically matched to the emotional content of the past entry
- "Reflexionar" inserts a Spanish-language starter into the editor that references the correct emotional context
- All text in the reflection flow (card, modal, chip) is now in Spanish
- The engine is zero-latency (no API calls, pure in-memory keyword detection)
- The AI override slot is ready for future enhancement

### 11.5 What Is NOT Yet Done (Next Steps)

- The `ReflectionCandidate` type in `reflectionMemory.ts` does not yet include a pre-computed `promptResult` field. The result is computed after decryption in JournalPage. Storing it on the candidate would require passing the decrypted content into `reflectionMemory.ts`, which currently deals only with encrypted blobs. This is intentional — encryption concerns are kept separate.
- No current-state context was injected into the prompt at this stage. **Implemented in RP-02** (Section 12).
- Keyword detection is the same depth as `insightWeeklyJournal.ts` — shallow, no semantic understanding. Entries written in uncommon vocabulary or metaphorical language will fall through to `neutral`. Addressed in RP-03 via richer entry metadata.
- AI override slot exists but is not wired to any backend. Planned for RP-04.

---

## 12. Adaptive Reflection Prompt Engine — Current-State Context Injection (Stage RP-02)

### 12.1 Overview

Stage RP-02 extends the reflection prompt engine to compare the emotional signal from the past journal entry against the user's current dominant chat signal (from the past 7 days). When the direction is clear (improved / worsened / similar), a delta-aware Spanish prompt is generated instead of the generic RP-01 variant.

Example outputs:
- **improved:** "La vez pasada sonaba muy pesado. Esta semana parece un poco más ligero. ¿Qué cambió?"
- **worsened:** "La vez anterior había más calma. ¿Qué crees que hizo la diferencia?"
- **similar:** "Veo señales parecidas a las de hace unos días. ¿Sientes que esto sigue igual o se movió algo?"

### 12.2 New File: `src/lib/reflectionDelta.ts`

**Exported types:**
- `DeltaDirection` — `'improved' | 'worsened' | 'similar'`

**Exported functions:**
- `classifyDelta(past, current): DeltaDirection | null` — returns null when either signal is neutral, or when past === current (no meaningful delta). Classifies heavy→light as improved, light→heavy as worsened, same-family as similar.
- `buildDeltaResult(past, current, variantIndex): ReflectionPromptResult | null` — full result with `promptText` and `insertStarter`; returns null if no delta is classifiable.

**9 delta prompt variants:** 3 directions × 3 variants each. All Spanish, all short and conversational.

### 12.3 Modified Files

**`src/lib/reflectionPrompt.ts`**
- Added `import { buildDeltaResult }` from `reflectionDelta`
- Added `currentSignal?: ReflectionPromptSignal` as 4th parameter to `generateReflectionPrompt()`
- If `currentSignal` is provided and `buildDeltaResult()` returns a result, that delta result is returned. Otherwise falls back to RP-01 variants unchanged.

**`src/pages/JournalPage.tsx`**
- Added `import type { ReflectionPromptSignal }` from `reflectionPrompt`
- Added state: `reflectionDaysAgo: number | null` — stores computed days-ago from decrypt effect
- Added state: `currentDominantSignal: ReflectionPromptSignal | null` — derived from `chat_signal_daily_agg` in `fetchSignals()`
- Decrypt effect no longer calls `generateReflectionPrompt()` directly — only stores content + daysAgo
- `fetchSignals()` extended: accumulates `signalTotals` per type; sets `currentDominantSignal` to the top signal if its total score >= 3, otherwise null
- New derived effect `[reflectionContent, reflectionDaysAgo, currentDominantSignal]` calls `generateReflectionPrompt()` after both past and current signals are available
- Reset effect also clears `reflectionDaysAgo` when candidate is null

### 12.4 Data Source

`chat_signal_daily_agg` — already fetched at page mount. No new queries. The `signalTotals` accumulator was added inside the existing `for` loop. Minimum score threshold = 3 to avoid acting on noise.

### 12.5 Fallback Guarantees

| Condition | Behavior |
|---|---|
| `currentDominantSignal` is null (no data or score < 3) | RP-01 fallback |
| Past or current signal is `neutral` | RP-01 fallback |
| Past === current signal | RP-01 fallback |
| Chat signals load after decryption | Prompt recomputed by derived effect when `currentDominantSignal` state updates |
| Chat signals never load (network error) | RP-01 fallback (error path does not set `currentDominantSignal`) |

### 12.6 What Is NOT Yet Done (Next Stages)

**RP-03 — Richer past-entry metadata: Implemented in Section 13.**
`fetchReflectionCandidates()` now fetches `emotion_score_at_creation`, `trigger_reason`, `origin`, and `tags`. Structured metadata is used as the primary signal source; keyword heuristics fall back only when metadata is absent.

**RP-04 — AI-generated prompts: Implemented in Section 14.**
The `aiOverride` slot in `generateReflectionPrompt()` is now populated by the `ai-reflection-prompt` edge function when gate conditions are met. The edge function receives a 200-char excerpt, `pastSignal`, `currentSignal`, and `deltaDirection`, and returns a custom Spanish prompt and insert starter.

---

## 13. Adaptive Reflection Prompt Engine — Structured Signal Detection (Stage RP-03)

### 13.1 Overview

Stage RP-03 makes the past-entry signal classification more reliable by preferring structured metadata that was already recorded at entry-save time (`emotion_score_at_creation`, `trigger_reason`) over keyword heuristics applied to decrypted text. Keywords remain as fallback for manual entries where structured data is absent.

This is entirely transparent to the user — Spanish prompts remain unchanged in language and format. The improvement is in accuracy: a chat-origin entry that was triggered by high heaviness now reliably produces a `stress`-signal prompt even if the user later edited the text to remove burden-related words.

### 13.2 Critical Audit Findings

| Field | Reliability | Coverage |
|-------|------------|----------|
| `emotion_score_at_creation` | High for classification purposes | Chat-origin entries only (~subset of all entries) |
| `trigger_reason` | Medium — adds stress vs. anxiety distinction | Chat-origin + insight entries |
| `tags` | Low — topic-oriented, not emotion-oriented | All entries, but excluded as unreliable |
| `origin` | Informational only | All entries |

**Key limitation:** Manual entries (`origin='manual'`) have NULL for both `emotion_score_at_creation` and `trigger_reason`. For these entries RP-03 provides no improvement over RP-01. This is the majority of entries for many users.

**No positive/gratitude metadata exists.** The heaviness score only captures negative/heavy states. Keyword heuristics remain the sole classification method for `positive` and `gratitude` signals.

### 13.3 Signal Priority Order (Full Stack)

```
1. aiOverride (RP-04, not yet wired) — bypasses all rule-based logic
2. metaSignal from classifySignalFromMetadata() (RP-03)
   a. emotion_score >= 1 → 'stress'
   b. trigger_reason contains 'repetition' + 'heaviness' → 'anxiety'
   c. trigger_reason contains 'heaviness' → 'stress'
   d. otherwise → null (fall through)
3. keyword heuristics detectSignal(content) (RP-01 fallback)
4. delta-aware prompts from buildDeltaResult() (RP-02, applied after signal resolved)
```

### 13.4 New Exported API in `reflectionPrompt.ts`

**`EntryMetaSignals` type:**
```typescript
type EntryMetaSignals = {
  emotion_score?: number | null;
  trigger_reason?: string | null;
  origin?: string | null;
  tags?: string[] | null;
}
```

**`classifySignalFromMetadata(meta: EntryMetaSignals): ReflectionPromptSignal | null`:**
Returns a signal if structured evidence is sufficient; returns null to trigger keyword fallback.

**`generateReflectionPrompt()` — 5th parameter added:**
`metaSignal?: ReflectionPromptSignal` — when provided, bypasses keyword heuristics. Signal resolution is now: `metaSignal ?? detectSignal(content)`.

### 13.5 Files Modified

| File | Change |
|------|--------|
| `src/lib/reflectionMemory.ts` | `ReflectionCandidate` type extended with `emotion_score`, `trigger_reason`, `origin`, `tags`; `fetchReflectionCandidates()` SELECT extended to include these 4 columns |
| `src/lib/reflectionPrompt.ts` | `EntryMetaSignals` type exported; `classifySignalFromMetadata()` function exported; `metaSignal?` added as 5th param to `generateReflectionPrompt()`; signal resolution uses `metaSignal ?? detectSignal(content)` |
| `src/pages/JournalPage.tsx` | Imports `classifySignalFromMetadata`; prompt generation effect computes `metaSignal` from `reflectionCandidate` and passes it; `reflectionCandidate` added to effect dependency array |

### 13.6 What Is NOT Yet Done (RP-04)

- No structured positive/gratitude metadata — keyword heuristics are the only method for light signals
- Manual entries remain keyword-only (majority entry type for many users)
- Delta magnitude: the RP-02 comparison is binary (direction only); no score differential is used
- `aiOverride` slot is now connected — see Section 14 for RP-04

---

## 14. Adaptive Reflection Prompt Engine — AI Override (Stage RP-04)

### 14.1 Overview

Stage RP-04 activates the `aiOverride` slot that was pre-designed in RP-01. When gate conditions are met, a new edge function (`ai-reflection-prompt`) is called asynchronously. If successful, it replaces the rule-based prompt with a single GPT-4o-mini–generated Spanish reflection prompt tailored to the emotional context.

The rule-based engine (RP-01 through RP-03) remains the default. AI is an enhancement layer only.

### 14.2 AI Gating Conditions

AI is only attempted when:
- `reflectionContent.length >= 80` (meaningful past entry)
- `metaSignal` is `'stress'` or `'anxiety'` (heavy past state confirmed via structured metadata), OR there is a cross-signal delta (`metaSignal` and `currentDominantSignal` are both set and differ)
- The candidate has not already had an AI call dispatched this session (ref guard)

Manual entries, insight entries, and positive/neutral entries without a delta do not trigger AI.

### 14.3 Context Sent to AI

```
excerpt          : first 200 chars of decrypted entry
daysAgo          : integer
pastSignal       : 'stress' | 'anxiety'
currentSignal    : string | null (from 7-day chat signal agg)
deltaDirection   : 'improved' | 'worsened' | 'similar' | null
```

Full entry content is never sent. No user identity beyond the JWT authorization is sent.

### 14.4 Edge Function

**Slug:** `ai-reflection-prompt`
**Model:** gpt-4o-mini, temperature 0.8, max_tokens 150
**Auth:** JWT (same pattern as journal-prompts)
**Budget:** `check_token_budget` RPC enforced
**Logging:** `token_usage` table, `operation = 'ai_reflection_prompt'`
**Response:** `{ promptText: string, insertStarter: string }`

### 14.5 Async / Timing Behavior

The AI fetch runs in a `useEffect` triggered when reflection content + candidate are ready. The rule-based prompt is shown immediately. When the AI response arrives (~400–800ms), `setAiReflectionOverride` triggers a re-render that replaces the prompt. No loading indicator is shown. Failures are silent — rule-based prompt remains.

### 14.6 Fallback Chain

All failure paths (network error, budget exceeded, parse failure, incomplete response, component unmount) leave `aiReflectionOverride` as null. Effect 3 then uses `undefined` for the override slot and generates a rule-based prompt normally.

### 14.7 Files Modified / Created

| File | Change |
|------|--------|
| `supabase/functions/ai-reflection-prompt/index.ts` | New edge function |
| `src/lib/api.ts` | `generateAIReflectionPrompt()` function + request/response interfaces |
| `src/pages/JournalPage.tsx` | AI override state + ref, AI fetch effect, Effect 3 updated, reset effect updated |

### 14.8 What Remains Weak

- Manual entries never receive AI override (no structured signal at save time)
- 200-char excerpt is always the start of the entry (not the most emotionally relevant section)
- No visible distinction between AI-generated and rule-based prompts
- Potential race window: if `currentDominantSignal` loads after content, it may not be included in the AI payload
- No per-session caching across page reloads

---

## 15. Weekly Mini Insight Card — Data-Driven Text Engine (Stage WMI-01)

### 15.1 Problem Addressed

The `WeeklyInsightCard` previously displayed a main insight sentence chosen from a static list of 3 variants per signal type, rotated by day-of-week. These sentences were generic ("Esta semana se siente más pesada de lo normal") regardless of whether the actual delta was +1 or +10. Only the delta comparison line below was real data.

### 15.2 What Was Built

**New engine: `src/lib/insightMiniCard.ts`**

`buildWeeklyMiniInsight(summary: WeeklyInsightSummary): MiniInsightResult`

Produces a magnitude-aware sentence from the existing `WeeklyInsightSummary`. No new data fetching. Pure rule-based logic operating on `weekTotals`, `change`, and `dominantThisWeek`.

Logic priority per signal:
1. Recovery: stress/anxiety fell AND positive/gratitude rose → recovery framing
2. Large delta (≥5 for stress/anxiety, ≥4 for positive): "considerablemente mayor/menor"
3. Moderate delta (2–4): directional sentence
4. Near-zero delta: absolute level sentence (high/moderate/low)

**`MiniInsightResult` type:**
```typescript
{ text: string; basis: MiniInsightBasis; confidence: 'high' | 'medium' | 'low' }
```
The `confidence` field is a forward hook for a future WMI-02 AI override stage.

### 15.3 Files Modified

| File | Change |
|------|--------|
| `src/lib/insightMiniCard.ts` | New: rule-based mini insight engine |
| `src/components/insights/WeeklyInsightCard.tsx` | Removed `SIGNAL_MAIN_LINES` and day-of-week rotation; integrated `buildWeeklyMiniInsight()` |
| `src/lib/insightWeekly.ts` | Exported `SignalType` and `SignalTotals` |

### 15.4 What Remains Weak

- Sentences still generic at the same delta level (all users with delta +3 see the same text)
- No cross-signal mention in mixed weeks
- No day-level detail (no "Monday was heavier")
- No chat/journal source differentiation in the text
- WMI-02 AI override: now implemented — see Section 16
- `WeeklyInsightPanel` (full AI insights) unchanged

---

## 16. Weekly Mini Insight Card — AI Enhancement (Stage WMI-02)

### 16.1 Overview

Stage WMI-02 activates optional AI generation for the `WeeklyInsightCard` main line when the WMI-01 rule engine returns `confidence === 'high'`. The AI produces a single warm, non-clinical Spanish sentence. All failures fall back silently to the rule-based text from WMI-01.

### 16.2 AI Gating

AI is attempted only when `buildWeeklyMiniInsight().confidence === 'high'`, which occurs for:
- Recovery pattern (stress/anxiety fell while positive/gratitude rose)
- Large delta (|delta| ≥ 5 for stress/anxiety, ≥ 4 for positive)
- Sustained gratitude (weekTotals.gratitude ≥ 6)

Medium/low confidence and missing dominant signal → rule-based only.

### 16.3 Context Sent to AI

Signal aggregates only — no user content:
```
dominantSignal, delta (integer), basis, sourceLabel
```

### 16.4 Edge Function

**Slug:** `ai-mini-insight`
**Model:** gpt-4o-mini, temperature 0.8, max_tokens 80
**Response:** `{ text: string }` — one Spanish sentence, max 20 words
**Budget:** `check_token_budget` enforced
**Logging:** `token_usage` table, `operation = 'ai_mini_insight'`

### 16.5 Async / Caching

On-demand, parallel, session-cached (`sessionStorage` keyed by `dominantSignal + delta`). Rule-based text shown immediately; replaced silently when AI arrives. Cache prevents repeated calls within a browser session.

### 16.6 Files Modified / Created

| File | Change |
|------|--------|
| `supabase/functions/ai-mini-insight/index.ts` | New edge function |
| `src/lib/api.ts` | `generateAIMiniInsight()` + request/response interfaces |
| `src/components/insights/WeeklyInsightCard.tsx` | AI state + fetch effect + session cache + `mainLine = aiText ?? ruleResult.text` |

### 16.7 What Remains Weak

- All users at same signal+delta receive same AI context (no true per-user personalization)
- Session cache only — no persistence across browser restarts
- No user-visible indicator of AI vs rule-based text
- `WeeklyInsightPanel` full insight experience: see Section 17

---

## 17. WeeklyInsightPanel — Audit and Foundation (Stage WIP-01)

### 17.1 Panel Architecture

`WeeklyInsightPanel` is the primary weekly AI insight display. It renders in three distinct content states:

| State | Content |
|-------|---------|
| Generating | Skeleton + "Generando insight…" |
| Error | Red error box |
| Has insight | Week label, comparison, main text, micro-step, copy/save actions |
| Empty (no insight) | Placeholder + "Generar insight de esta semana" button |
| Stale (previous week) | Amber banner + old content |

### 17.2 Staleness Detection

`isStale` is computed from `latestInsight.week_start_date !== currentWeekStart`. `currentWeekStart` is the local calendar Sunday of the current week (fixed from UTC bug).

When stale: an amber notice appears above the old insight with a "Generar ahora" button wired to `handleGenerateInsight`.

### 17.3 Empty State Improvement

Empty state now includes an actionable "Generar insight de esta semana" button, replacing the static placeholder sentence.

### 17.4 Timezone Fix

`currentWeekStart` computation was using `toISOString()` (UTC), which failed in UTC- timezones on Sunday evenings. Fixed to use local date parts (`getFullYear()`, `getMonth()`, `getDate()`).

### 17.5 Files Modified

| File | Change |
|------|--------|
| `src/components/insights/WeeklyInsightPanel.tsx` | `currentWeekStart` + `onGenerate` props; stale banner; improved empty state |
| `src/pages/InsightsPage.tsx` | Fixed `currentWeekStart` timezone; passed new props |

### 17.6 What Was Remaining After WIP-01

No automatic insight generation. The user must actively click to generate each week. WIP-02 (below) resolves this.

---

### 17.7 WIP-02: Silent Auto-Generation on Page Load

**Stage:** WIP-02
**File:** `src/pages/InsightsPage.tsx`

**What it does:** When the user opens the Insights page and has a stale weekly insight (from a previous week) with sufficient evidence, the page silently triggers `handleGenerateInsight()` without any user action. The panel enters the standard generating skeleton, then shows the new insight on success.

**Nine gating conditions (all must be true):**
1. `isInsightsLoaded` — DB query resolved; `latestInsight` reflects real state
2. `isChatAggLoaded` — Chat signal agg resolved; evidence is accurate
3. `user` authenticated
4. `!isGeneratingInsight`
5. `!tokenLimitError`
6. `hasEvidenceWithGrace` — sufficient signal evidence
7. `isStaleWeek` — `latestInsight` exists AND its `week_start_date` is not current week
8. `autoGenAttemptedRef.current === false` — not already attempted in this session
9. `localStorage['insights:autoGenWeek'] !== currentWeekStart` — not auto-generated this week

**Scope decision:** Auto-generation only fires for the stale case (prior insight exists, new week). The null/empty case (no insight ever) is excluded — new users use the WIP-01 empty state CTA.

**Guard write order:** Both session ref and localStorage guard are written BEFORE `handleGenerateInsight()` is called, ensuring that even a failed attempt does not retry automatically.

**Failure behavior:** On error, `weeklyGenError` is displayed in the panel, stale banner remains, manual "Generar ahora" button stays available. No retry, no loop.

**Remaining weak after WIP-02** (before WIP-03):
- Scroll-to-panel behavior inherited by auto-generation — resolved in WIP-03
- No live subscription to cron-generated insights (requires page reload to see cron insight)
- Multi-tab race condition possible but negligible in practice

---

### 17.8 WIP-03: Silent Auto-Generation UX Polish

**Stage:** WIP-03
**File:** `src/pages/InsightsPage.tsx`

**What it does:** Prevents silent auto-generation from inheriting manual-click UX behaviors. `handleGenerateInsight` now accepts `silent = false`. The auto-generation call site passes `true`.

**Exact behavior changes when `silent === true`:**
- Both `scrollIntoView` calls are skipped (start and success)
- Analytics fires `insights_generate_weekly_auto` instead of `insights_generate_weekly_clicked`
- `source` prop is `'auto'` instead of `'insights'`

**Unchanged for both paths:** skeleton while generating, `justGenerated` highlight on success, error banner on failure, token budget invalidation.

**Remaining weak:**
- `insights_generate_weekly_success` event is shared by both paths (distinguished only by `source` prop)
- No live subscription to cron-generated insights
- Multi-tab race condition possible but negligible in practice

---

## 18. Multi-Week Trend Awareness

### 18.1 Foundation (Trends-01)

**Stage:** Multi-Week Trends 01
**Files:** `src/lib/insightTrends.ts` (new), `src/pages/InsightsPage.tsx`, `src/components/insights/WeeklyInsightPanel.tsx`

**What it adds:** A trend detection layer that computes 4-week rolling signal trends from already-loaded `chatAggRows` (no new DB query).

**New module `insightTrends.ts` exports:**
- `buildWeekSlices(rows, numWeeks = 4)` — slices 30-day chat signal rows into N weekly buckets; returns `WeekSlice[]` with signal totals and day-count per week
- `detectMultiWeekTrends(slices)` — returns `MultiWeekTrend` with per-signal `direction` (rising/falling/stable), `delta`, and `sustained` flag

**Honesty constraints:**
- `|totalDelta| < 1.5` → always `stable`; no trend claim for minor fluctuation
- `sustained: true` requires 3+ weeks AND consistent direction in all week-over-week comparisons
- `weeksWithData < 2` → no trends returned

**`InsightsPage.tsx`:** Adds `multiWeekTrend` useMemo derived from `chatAggRows`, passed to `WeeklyInsightPanel` as optional prop.

**`WeeklyInsightPanel.tsx`:** Accepts `multiWeekTrend` prop; no rendering yet.

**What is now detectable (was not before):**
- Stress/anxiety rising across 3–4 consecutive weeks (sustained)
- Positive signal recovering over multiple weeks
- Gratitude building as a sustained pattern
- Net direction for each of the 4 signals across a 28-day window

**Remaining weak:**
- No UI rendering from trend data (foundation only)
- Chat-only source (mood logs not included in multi-week trends)
- AI context injection exists in cron path only (see 18.2)
- No volatility/alternating-week detection
- Trend recomputed on every load (no persistence)

### 18.2 Weekly Generation Injection (Trends-02)

**Stage:** Multi-Week Trends 02
**Files:** `supabase/functions/generate-weekly-insights/index.ts`

**What it adds:** Multi-week trend context injected into the AI prompt when evidence is strong enough. The edge function now fetches a 28-day window of `chat_signal_daily_agg` alongside existing mood log queries (added to the same `Promise.all` — no serial latency).

**New functions in the edge function:**
- `fetchMultiWeekChatSignals` — fetches raw daily signal rows for the 28-day window
- `buildWeekSlicesEdge` — mirrors client-side `buildWeekSlices` (edge functions cannot import client modules)
- `detectTrendsEdge` — mirrors `detectMultiWeekTrends` with identical thresholds
- `buildMultiWeekTrendContext` — produces Spanish trend sentences, or empty string when evidence is weak

**"Strong enough" gate:** `weeksWithData >= 2` AND per-signal `|delta| >= 3` OR `sustained = true`. Weak signals are suppressed.

**Graceful degradation:** Empty string from `buildMultiWeekTrendContext` is a no-op in both prompt builders. Generation is 100% unchanged for users with sparse history.

**AI framing:** Trend context ends with "Menciona esta tendencia sólo si encaja de forma natural — no lo fuerces." The AI is explicitly allowed to ignore it.

**Auditability:** `signal_meta` gains `trend_context_injected: true` and `trend_weeks_with_data: n` when context is injected.

**Remaining weak:**
- Mood logs not included in trend computation (chat-only source)
- Client-triggered generation path (`mood-insights` function) not yet updated
- AI incorporation is not verifiable after generation
- `comparison` field still implicitly week-to-week only
- No UI indicator that an insight reflects a multi-week pattern (addressed in 18.3)

### 18.3 Subtle UI Trend Surfacing (Trends-03)

**Stage:** Multi-Week Trends 03
**Files:** `src/components/insights/WeeklyInsightPanel.tsx`

**What it adds:** A single subtle italic line rendered below the main weekly insight text when a strong multi-week trend qualifies. No badge, no chart, no label — just a small contextual observation that reads as part of the narrative.

**New items in `WeeklyInsightPanel.tsx`:**
- `TREND_STRONG_DELTA = 3` — same threshold as Trends-02
- `TREND_LINES` — lookup table of warm Spanish phrases per signal × direction × sustained/clear
- `getStrongTrendLine(trend)` — pure function: returns one sentence or `null`
- `multiWeekTrend` destructured in component; `trendLine` computed once in render

**Rendering:** `<p className="text-[11px] text-app-muted/70 italic leading-relaxed">{trendLine}</p>` — the most visually subordinate element in the card. Only shown when `trendLine !== null`.

**Selection logic:** Among qualifying signals, sustained trends take priority; among non-sustained, highest `|delta|` wins. At most one sentence is ever shown.

**Graceful degradation:** `getStrongTrendLine` returns `null` when evidence is weak. The component renders nothing — no visual change.

**Remaining weak:**
- Trend data is chat-only; mood-only users never see the trend line (partially addressed in 18.4)
- Client-side week anchor uses "today", edge function uses "weekEndDate" — bucket boundaries differ by up to 6 days
- Trend line may occasionally echo what the AI already said (minor semantic overlap)
- Trend line is not included when saving to journal
- No signal-salience weighting (sustained stress treated as more prominent than larger positive delta)

### 18.4 Multi-Source Trend Awareness (Trends-04)

**Stage:** Multi-Week Trends 04
**Files:** `src/lib/insightWeeklyJournal.ts`, `src/lib/insightTrends.ts`, `src/pages/InsightsPage.tsx`

**What it adds:** Extends the multi-week trend pipeline to include journal entries and mood logs as signal sources, not just chat data. Previously, `multiWeekTrend` returned `null` for any user with no chat activity.

**Data sources now used:**

| Source | Signals | Score |
|---|---|---|
| Chat agg (`chat_signal_daily_agg`) | positive, stress, anxiety, gratitude | Weighted (can be 5–30+ per week) |
| Journal entries (`savedEntries30d`) | positive, stress, anxiety, gratitude | 1 per matched keyword per entry |
| Mood logs (`moodLogs`) | positive, stress only | 0.5–1.0 per log |

**New functions:**
- `extractJournalAggRows(entries)` — exported from `insightWeeklyJournal.ts`; converts journal entries to `AggRow[]` via keyword matching on tags + title
- `buildMultiSourceAggRows(chatRows, journalEntries, moodLogs)` — exported from `insightTrends.ts`; merges all three sources into unified `AggRow[]`
- `MoodLogLite` type — minimal shape for mood log inputs in `insightTrends.ts`

**Merge strategy:** Additive. Scores from all sources accumulate per (date, signal_type) bucket. No priority branching. The `TREND_STRONG_DELTA = 3` threshold acts as a natural filter.

**No new DB queries.** All three sources are already loaded in `InsightsPage` state.

**Coverage improved:** Journal-only and mood-only users now receive multi-week trend awareness in the UI (Trends-03 trend line) and in AI context injection (Trends-02), subject to threshold gates.

**Remaining weak:**
- Mood logs only map to `positive` and `stress` (emoji cannot distinguish anxiety from general negativity)
- Journal keyword matching only covers tags and title (full encrypted content not scanned)
- Trends-02 edge function still builds trend context from chat data only — journal/mood trends do not yet reach the AI prompt (addressed in 18.5)
- Score inflation risk for highly active users (all three sources active simultaneously)
- No source attribution in the trend line — user cannot tell whether a trend came from chat, journal, or mood

### 18.5 Multi-Source Trend Injection into Edge Function (Trends-05)

**Stage:** Multi-Week Trends 05
**Files:** `supabase/functions/generate-weekly-insights/index.ts`

**What it adds:** Extends the edge function's trend pipeline to use the same three sources as the client (Trends-04), eliminating the inconsistency between the UI trend line and the AI-generated narrative.

**Problem solved:** Before this stage, a journal-only or mood-only user could see a trend line in the Insights UI (client-side, Trends-03/04) but receive an AI weekly insight with no trend awareness — because the edge function only queried `chat_signal_daily_agg`.

**New functions added to edge function:**

| Function | Purpose |
|---|---|
| `SIGNAL_KEYWORDS_EDGE` | Mirror of `SIGNAL_KEYWORDS` from `insightWeeklyJournal.ts` |
| `matchSignalsEdge(tags, title)` | Mirror of `matchSignals` — keyword detection on journal metadata |
| `MOOD_EMOJI_SIGNAL_EDGE` | Mirror of `MOOD_EMOJI_SIGNAL` from `insightTrends.ts` |
| `convertMoodLogsToSignalRows(logs)` | Converts `MoodLog[]` → `ChatSignalRow[]` via emoji mapping |
| `fetchMoodTrendRows(svc, userId, since, before)` | Queries `mood_logs` for 28-day trend window |
| `fetchJournalSignalRows(svc, userId, since, before)` | Queries `journal_entries` (title, saved_at, tags) for 28-day trend window |

**Merge strategy:** All three source rows are merged into `allTrendRows` before passing to `buildWeekSlicesEdge`. Additive scoring — same `STRONG_DELTA_EDGE = 3` threshold gates prompt injection.

**No existing prompt logic changed.** `buildMultiWeekTrendContext` and all prompt builders are unchanged. Only the input to the trend pipeline changes.

**`signal_meta` now records `trend_sources`:** Array of `"chat"`, `"mood"`, `"journal"` reflecting which sources contributed rows to the trend computation. Useful for future analytics.

**Two new parallel DB queries per user:** `fetchMoodTrendRows` and `fetchJournalSignalRows` run in the existing `Promise.all` — no serial latency added.

**Remaining weak:**
- Keyword lists are duplicated between edge function and `insightWeeklyJournal.ts` — must be kept in sync manually
- Journal trend dates use UTC slice; client uses local timezone — minor mismatch near midnight for non-UTC users
- Mood queries are partially redundant (28-day trend window overlaps with per-week mood fetches)
- Journal contributes to trend context only, not the weekly narrative (full content is encrypted and unavailable)
- Mood logs only contribute `positive` and `stress` to trends — `anxiety` and `gratitude` still require chat or journal keyword signals

---

## 19. First-User Experience — Onboarding Audit (Stage 01)

**Full audit document:** `docs/elena-stage-onboarding-01-audit.md`
**Scope:** Day 1–7 first-user journey across Chat, Journal, and Insights.

### 19.1 Foundation Fixes Implemented

Four English-language strings were found and translated to Spanish. These were silent trust-breakers for Spanish-only users:

| File | Fix |
|---|---|
| `src/lib/starterPrompt.ts` | All 15 journal guided prompts translated from English to Spanish |
| `src/components/journal/GuidedStarterPrompt.tsx` | "Try another" → "Otra pregunta", "Not now" → "Ahora no" |
| `src/pages/InsightsPage.tsx` | 3 insight progress messages translated (low/some/strong levels) |
| `src/pages/ChatPage.tsx` | "Conversations here help Elena build Insights over time." → Spanish |

### 19.2 First-User Strengths

- Name-personalized welcome greeting from session 0 (when profile has `first_name`)
- Adaptive suggestion chips contextualized to emotional signal from message 1
- `DiaryDraftSuggestion` bridges chat → journal with contextual timing (after 3 user messages + emotional threshold)
- `ChatLinkedJournalBanner` and `JournalChatOriginBanner` create cross-surface continuity
- Return greeting with insight snippet (after 48h absence) is the strongest retention hook in the system
- Signal-aware journal starter prompts use chat data for early personalization

### 19.3 First-User Weaknesses

| Issue | Severity | Stage where it bites |
|---|---|---|
| No self-registration path | Critical | Before Day 1 |
| No onboarding tour or intro to Chat/Diario/Insights | High | Day 1 |
| Tone selector unexplained to first-time users | Medium | Day 1 |
| Insights page empty and unscaffolded on day 1 | High | Day 1–3 |
| Journal empty state has no "start here" CTA | Medium | Day 1–2 |
| Week-1 return loop is absent (insight-return requires 7+ days) | High | Day 2–6 |
| Time to first AI narrative about the user: 7+ days minimum | High | Week 2 |

### 19.4 Top 3 Next Implementation Steps

1. **Insights page first-visit explainer** — When user has no data yet, show a single paragraph explaining what Insights are, why they're empty now, and when they will appear. No new logic — pure UI copy addition.

2. **Tone selector first-time hint** — Show a one-line tooltip or label next to the tone dropdown explaining what it affects, gated by a `localStorage` first-seen flag.

3. **Minimal onboarding flow (2 screens)** — Shown once after first login. Screen 1: Who Elena is and what each tab does. Screen 2: Name collection (if `first_name` is empty). This closes the largest Day-1 gap: users arriving at Chat without understanding what they are building.

---

## 20. First-Session Experience Improvements (Stage 02)

**Full doc:** `docs/elena-stage-onboarding-02-first-session.md`
**Scope:** Chat-only improvements. No new pages, no new flows.

### 20.1 First Message Guidance (`contextualGreeting.ts`)

All 4 `FIRST_TIME` greeting variants now include a second paragraph before the closing question. The paragraph is a short, warm line that reduces blank-page anxiety:

- Variant 1: "Puedes contarme algo que tengas en la cabeza ahora mismo… no tiene que estar ordenado."
- Variant 2: "No necesitas saber bien qué decir — puedes empezar por lo que tengas en mente."
- Variant 3: "Puedes escribir lo que sea, tal como venga — no tiene que ser perfecto."
- Variant 4: "Puedes contarme algo de lo que tienes en mente, aunque no lo tengas del todo claro."

Fires on first-ever session only (`lastChatAt === null`). Return visitor variants (YESTERDAY / PAST_WEEK / LONG_ABSENCE) are unchanged.

### 20.2 First-Time Welcome Chips (`ChatPage.tsx`)

The `showFirstTimeWelcome` starter chips were replaced with 5 emotionally-inviting, first-person, open-ended completions:

| Before | After |
|---|---|
| "Hoy me siento…" | "Hoy me sentí…" |
| "No dejo de pensar en…" | "Algo que no me puedo sacar de la cabeza es…" |
| "Algo me preocupa y no sé por qué" | "Últimamente me está pesando…" |
| "Quiero entender mejor lo que siento" | "No sé por qué, pero me siento…" |
| _(new)_ | "Hay algo que me preocupa y es…" |

Trigger: `isFirstTimeUser === true` AND `userMsgCount === 0`. Global `SuggestionChips` system is unaffected.

### 20.3 Early Insight Seed (`ChatPage.tsx`)

After Elena's first-ever response to the user, one soft sentence is appended to the reply:

> "A veces, cuando volvemos a hablar varios días, empiezan a aparecer patrones… si en algún momento quieres, puedo ayudarte a verlos."

- Captured via `isFirstEverMessage = isFirstTimeUser === true` before state update
- Injected into `replyText` before encryption — stored in DB as part of Elena's message
- Guarded by `sessionStorage` key `elena_insight_seed_{userId}` to prevent repeat in same session
- No new component or UI element — purely a text appendage

### 20.4 DiaryDraftSuggestion Tone (`DiaryDraftSuggestion.tsx`)

Body copy and primary button label shifted from functional to conversational:

| Element | Before | After |
|---|---|---|
| Button label | "Crear borrador" | "Sí, lo guardo por ahora" |
| Loading state | "Preparando borrador…" | "Guardando…" |
| Body (heavy) | "…ayudarte a bajar la intensidad y ordenarlo con calma…" | "…guardarlo tal como está y seguir explorándolo con más calma después." |
| Body (repetition) | "Escribirlo podría ayudarte a verlo con más claridad…" | "Si quieres, podemos guardarlo para que puedas verlo mejor después." |
| Body (default) | "…convertir esto en un borrador de diario para ordenarlo…" | "…podemos guardarlo para que puedas leerlo con más calma…" |

No logic, triggers, or component structure changes.

---

## 21. Insights First-Exposure Improvements (Stage 03)

**Full doc:** `docs/elena-stage-onboarding-03-insights-first-exposure.md`
**Scope:** InsightsPage copy and early-state UX only. No new data logic.

### 21.1 Improved Empty State (`InsightsPage.tsx` — `isVeryEarlyState` block)

When `isVeryEarlyState === true` (no chat aggregate data AND no journal saves AND both data sources loaded), the page now shows a warm, connected explanation:

- **Headline:** "Elena todavía te está conociendo."
- **Body:** "Con unas cuantas conversaciones o entradas más, empezarán a aparecer aquí los primeros patrones en lo que sientes. No tienes que hacer nada distinto."
- **Soft CTA:** "Si quieres seguir, puedes: [Hablar con Elena] o [Escribir en el diario]"

The new copy directly echoes the Stage 02 chat insight seed line, creating a coherent two-moment loop: chat plants the promise, Insights page is where it resolves.

### 21.2 Soft Next-Step CTA (`InsightsPage.tsx`)

Two inline text-links inside the `isVeryEarlyState` block navigate to `/app/chat` and `/app/journal`. Styled as underline-on-hover `text-sage-strong` links — no borders, no icons, minimal visual weight.

### 21.3 Stage 02 Alignment (`InsightsPage.tsx`)

The 'some' data progress pill message was left intact: "Elena está empezando a detectar patrones en lo que escribes." — continues the same language thread from chat.

**De-duplication fix:** The 'low' progress pill was previously shown simultaneously with the early-state block (redundant). Fixed by wrapping the progress message render block with `!isVeryEarlyState &&`.

### 21.4 Tone / Microcopy Fixes (`InsightsPage.tsx`)

| Location | Before | After |
|---|---|---|
| Header subtitle | "Rastrea tu bienestar emocional" | "Lo que Elena va construyendo con tus reflexiones" |
| New-insight banner | "New insight from your recent reflections." | "Nuevo insight de tus últimas reflexiones." |
| Some-not-enough copy | "Con más días irán apareciendo temas aquí." | "Con unos días más, Elena podrá mostrarte los primeros patrones claros." |

---

## 22. First-Week Return Loop — Chat Signal Continuity Greeting (Stage 04)

**Full doc:** `docs/elena-stage-onboarding-04-first-week-return-loop.md`
**Scope:** `src/lib/contextualGreeting.ts` + `src/pages/ChatPage.tsx` greeting logic only.

### Problem Addressed

For new users in Days 2–6 of the app, the chat welcome greeting fell back to a generic "Qué gusto verte de nuevo. ¿Cómo te has sentido desde la última vez?" because `mood_weekly_insights` was empty (no weekly analysis had run yet). The `chat_signal_daily_agg` data — real emotional signal data already being stored — was never consulted in the greeting.

### 22.1 New Functions (`contextualGreeting.ts`)

**`getChatSignalForReturn()`**
Queries `chat_signal_daily_agg` for the past 7 days, sums scores by signal type, returns the dominant type if score >= 2. Uses existing RLS (no user_id filter needed). Returns null if no signal strong enough.

**`buildReturnGreetingWithSignal(name, signalType)`**
Builds a one-line soft continuity greeting from a per-signal set. Picks one of two variants at random.

Signal copy:
- `positive`: "La última vez había algo de ligereza en lo que contabas." / "Noté algo de ánimo en tus últimas palabras."
- `stress`: "La última vez sonaba como que había bastante encima." / "Noté algo de peso en lo que compartiste."
- `anxiety`: "Noté algo de inquietud en lo que compartiste." / "Había algo de preocupación en tus últimas palabras."
- `gratitude`: "Había algo de gratitud en lo que contabas." / "Noté algo de reconocimiento en tus palabras anteriores."

### 22.2 Logic Change (`ChatPage.tsx — insertWelcomeMessage`)

When `insightSnippet` is null AND `hoursAbsent <= 168` (still in week-1 window), the greeting now checks for a dominant chat signal and uses it for a soft continuity line instead of the generic fallback.

### 22.3 Trigger Conditions

All conditions must be true:
1. New chat thread opened (`welcome_inserted === false`)
2. `hoursAbsent >= 48` (returning after 2+ days)
3. `hoursAbsent <= 168` (still in first-week window)
4. `insightSnippet === null` (no weekly insight exists yet)
5. Dominant signal score >= 2 in past 7 days

When conditions are NOT met, falls back to existing `buildContextualGreeting()` — no change to existing behavior for established users.

---

## 23. Chat-to-Journal Bridge — Microcopy Refinement (Stage 05)

**Full doc:** `docs/elena-stage-onboarding-05-chat-journal-bridge.md`
**Scope:** `src/components/DiaryDraftSuggestion.tsx` + `src/lib/diaryDraft.ts`. No new systems.

### Problem Addressed

The `DiaryDraftSuggestion` component used functional/archival language ("guardarlo", "Sí, lo guardo por ahora", "REFLEXIÓN SUGERIDA") that made the transition to journal feel like a file-management action rather than a natural continuation of the conversation. The generated draft template ended with two CBT-worksheet sections ("Un pequeño paso", "Nota para mí") that felt pre-written and disconnected.

### 23.1 Microcopy Changes (`DiaryDraftSuggestion.tsx`)

| Element | Before | After |
|---|---|---|
| Label (heaviness) | "UN MOMENTO PARA ESCRIBIR" (ALL-CAPS) | "Para darte un poco más de espacio" |
| Label (repetition) | "QUIZÁ VALGA LA PENA ANOTARLO" (ALL-CAPS) | "Algo que sigue presente" |
| Label (default) | "REFLEXIÓN SUGERIDA" (ALL-CAPS) | "Para seguir pensando" |
| Label CSS | `uppercase tracking-wide` | Sentence case (classes removed) |
| Body (heaviness) | "Si te parece, puedes guardarlo tal como está..." | "A veces ayuda escribir esto cuando ya no hay que explicarlo — solo seguir pensando con más calma." |
| Body (repetition) | "Este tema ha estado apareciendo varias veces..." | "Esto sigue apareciendo en la conversación. Escribirlo podría ayudarte a verlo con más claridad." |
| Body (default) | "Si quieres, podemos guardarlo para que puedas leerlo..." | "Si quieres, puedes escribir esto con más calma en tu diario. No tiene que estar ordenado." |
| Primary button | "Sí, lo guardo por ahora" | "Escribirlo con calma" |
| Loading state | "Guardando…" | "Abriendo…" |
| Dismiss button | "Ahora no, gracias" | "Ahora no" |

### 23.2 Draft Template Changes (`diaryDraft.ts`)

**Titles softened:**
- `uxIntensity >= 3`: "Un momento difícil hoy" → "Lo que pesó hoy"
- `PROCESSING`: "Reflexionando sobre lo que siento" → "Lo que tengo en la mente"
- `CONNECTION`: "Necesito sentirme acompañado/a" → "Buscando compañía"
- default: "Lo que llevo hoy" (unchanged)

**Removed two prescriptive closing sections:**
- Removed: "Un pequeño paso: Hoy puedo hacer una cosa, aunque sea imperfecta..."
- Removed: "Nota para mí: Está bien sentir todo esto. Estoy trabajando en ello."

These sections felt like a CBT worksheet rather than a personal journal. The remaining three sections (Lo que está pasando / Cómo me siento / Lo que podría necesitar) are grounded in actual conversation content and provide a genuine starting point without over-structuring.

---

## 24. Session Behavior Loop Reinforcement (Stage 06)

**Full doc:** `docs/elena-stage-onboarding-06-behavior-loop-reinforcement.md`
**Scope:** `src/pages/ChatPage.tsx` (inline hint) + `src/components/ChatLinkedJournalBanner.tsx` (copy). No new systems.

### Problem Addressed

After a meaningful counselor response where `uxStance` is `PROCESSING` or `CONNECTION` with some emotional weight (`uxIntensity >= 1`), but before `DiaryDraftSuggestion` thresholds are met, no continuation cue existed. Sessions ended abruptly with only the SuggestionChips (action prompts) as the last visual element. Users with open, reflective states had no signal that it was okay to stay.

Additionally, the `ChatLinkedJournalBanner` used passive, archival language that felt like a filing notice rather than a conversation bridge.

### 24.1 Session Continuation Hint (`ChatPage.tsx`)

A single `<p>` element rendered at the bottom of the message area (before `DiaryDraftSuggestion`, after `ChatLinkedJournalBanner`). No new component.

**Trigger conditions:**
- `!isSending` — conversation has paused
- `!!latestCounselorId` — Elena has responded
- `userMsgCount >= 2` — minimum conversation depth
- `crisisLvl < 2` — not high crisis
- `!showDiaryHint` — diary hint not already showing
- `!linkedEntry` — no banner already present
- `uxStance === 'PROCESSING' || 'CONNECTION'` — reflective/relational stance
- `uxIntensity >= 1` — some emotional weight
- `continuationHintFiredRef.current === false` — **once per session** (useRef gate)

**Copy by stance:**
- `CONNECTION`: "Estoy aquí, sin prisa."
- `PROCESSING` (and default): "Puedes quedarte un poco más con esto."

**Dismissal:** Hides automatically when `isSending` or when `showDiaryHint` activates.

**Session gate:** `continuationHintFiredRef` (`useRef`) latches `true` on first trigger — resets on page reload (session scope), never persists to storage.

### 24.2 ChatLinkedJournalBanner Copy (`ChatLinkedJournalBanner.tsx`)

| Element | Before | After |
|---|---|---|
| Label | "DIARIO VINCULADO" (ALL-CAPS) | "Tu diario" (sentence case) |
| Body (draft) | "Hay un borrador creado desde esta conversación." | "Escribiste algo a partir de esta conversación." |
| Body (saved) | "Hay una reflexión guardada desde esta conversación." | "Guardaste una reflexión desde aquí." |
| CTA (draft) | "Abrir borrador" | "Ver borrador" |

---

## 25. Conversion Moments Audit + Token Exhaustion Copy Fix (Stage 07)

**Full doc:** `docs/elena-stage-onboarding-07-conversion-moments-audit.md`
**Scope:** Audit of all upgrade/billing exposure. One copy-only change in `src/pages/ChatPage.tsx`.

### Summary

A full audit of all 7 conversion moments in the product was conducted. The single most trust-damaging issue identified was the token exhaustion language in the chat UI — clinical, mechanical, and unaware of emotional context.

### 25.1 Audit Findings

**Active conversion moments:**
- CM-1: Journal storage warning banner (80%/critical) — well-timed, proactive
- CM-2: UpgradeModal — only on explicit click, shows "Próximamente" (no payment yet)
- CM-3: HeaderTokenBudget — passive ambient widget, non-intrusive
- CM-4: Chat token exhaustion — was clinical, now fixed
- CM-5: Journal token exhaustion — medium risk, flagged for future improvement
- CM-6: Insights token gate — low emotional risk
- CM-7: Settings usage dashboard — informational only

### 25.2 Change Implemented: Token Exhaustion Copy (`ChatPage.tsx`)

**Trigger detection:** Added `tokenExhaustReason` from `useTokenStatus()` hook to distinguish daily vs monthly limit.

| Element | Before | After (daily) | After (monthly) |
|---|---|---|---|
| Banner heading | "Modo solo lectura" | "El espacio de hoy se ha llenado." | "El espacio de este mes se ha llenado." |
| Banner body | "Puedes ver tus conversaciones… hasta que se restablezca tu ciclo o aumentes tu plan." | "Puedes seguir leyendo tus conversaciones — Elena volverá mañana." | "Puedes seguir leyendo tus conversaciones — Elena volverá el próximo mes." |
| Input placeholder | "Modo solo lectura — límite de tokens alcanzado" | "Elena volverá mañana…" | "Elena volverá el próximo mes…" |
| New thread tooltip | "Límite de tokens alcanzado — puedes leer tus conversaciones, pero no enviar nuevos mensajes." | "El espacio de hoy se ha llenado — Elena volverá mañana." | "El espacio de este mes se ha llenado — puedes leer tus conversaciones." |

**Key principle applied:** Reframe from permanent wall → temporary pause. Use first name ("Elena") to keep relational tone. Remove non-functional upgrade nudge. Give temporal frame so user knows when to return.

### 25.3 Conversion Prioritization

**Use now:** Journal storage 80% warning (keep), chat token exhaustion (fixed), settings plan info when payment activates.
**Avoid now:** Upgrade prompts in or after emotional conversations, after linked journal banner, during/after crisis, in first session.
**Postpone:** Proactive 80% token warning, insights-gate soft value education, return-user earned moment.

---

## 26. Micro-Synthesis Behavior Layer

**Scope:** System prompt only (`supabase/functions/chat-ai/index.ts`). No new components, database fields, or UI changes.

### Summary

A new optional behavior layer called "Micro-Synthesis" has been added to Elena's system prompt. It enables Elena to occasionally generate short, natural insight moments that weave together multiple things the user has said across a session — surfacing a subtle pattern, tension, or dynamic in a warm, tentative way.

### 26.1 Trigger Conditions

Micro-synthesis is an optional, infrequent behavior. Elena may only trigger it when:
- At least 3–5 user messages have accumulated in the current session
- A recognizable pattern, repetition, or emotional tension is detectable across multiple messages
- The user is not in crisis or high emotional distress
- A micro-synthesis has not already been triggered in the last few turns

### 26.2 Format and Constraints

- 2–4 sentences maximum
- Embedded naturally within a normal response — never announced or separated as a special block
- Triggered sparingly (not more than once every several turns)
- No absolute claims, no diagnoses, no clinical labels
- The user is never labeled or categorized

### 26.3 Tone and Phrasing

Micro-synthesis uses soft, tentative, conversational Spanish phrasing:
- "hay algo que se empieza a notar…"
- "por lo que has ido diciendo…"
- "da la sensación de que…"
- "como si…"
- "no sé si lo has pensado, pero…"

The goal is a subtle moment of recognition, not analysis. The tone must never feel clinical, report-like, or evaluative.

### 26.4 Implementation Location

Inserted as a named section `--- MICRO-SYNTHESIS BEHAVIOR ---` in the system prompt, positioned after the SUGGESTION CHIPS block and before the final JSON schema instructions (line ~1857 in `chat-ai/index.ts`).

---

## 27. Chip Timing and Visibility Intelligence

### 27.1 Overview

Chip visibility is now context-aware. Instead of generating chips after every AI response, the system evaluates the current conversation state and decides whether to show entry chips, follow-up chips, or no chips at all.

The principle: chips are scaffolding, not a constant layer. They appear when useful and step back when the conversation has its own momentum.

### 27.2 Chip Mode Resolver

**File:** `src/lib/chips/chipTiming.ts`

A single exported function `resolveChipMode()` takes three inputs:
- `messages` — the current conversation history
- `isCrisis` — whether the current AI response is a crisis response
- `followUpSignal` — whether a signal from a prior chip can drive follow-up chips

Returns one of three modes: `'entry'`, `'followup'`, or `'none'`.

### 27.3 Decision Rules

**Show no chips (`'none'`) when:**
- Crisis is active — chips are always suppressed in crisis
- The last 2 or more consecutive user messages were free-text (no chip used) AND each was at least 35 characters — the user has conversational momentum
- The conversation is past turn 5 AND the user has already sent at least one meaningful free-text reply

**Show follow-up chips (`'followup'`) when:**
- A chip signal exists from the prior user message (the user tapped a chip recently)
- The conversation is in its early phase (4 or fewer counselor turns so far)
- The user has not yet built free-text momentum (fewer than 2 consecutive meaningful free-text messages)

**Show entry chips (`'entry'`) when:**
- The conversation is in its early phase (4 or fewer counselor turns)
- OR the conversation stalled: the user's last message was very short (under 25 chars) and was not chip-triggered, even if mid-conversation (up to turn 8)

**Default for everything else:** `'none'` — chips are not shown in mid-to-late conversation unless stall is detected.

### 27.4 Thresholds

| Threshold | Value | Purpose |
|---|---|---|
| `FREE_TEXT_MOMENTUM_MIN_LENGTH` | 35 chars | Minimum message length to count as meaningful free text |
| `FREE_TEXT_RUN_CUTOFF` | 2 messages | Consecutive meaningful free-text messages that suppress chips |
| `EARLY_TURN_CUTOFF` | 4 counselor turns | Entry/follow-up chips only shown in first 4 counselor turns |
| `STALL_LENGTH` | 25 chars | Message shorter than this signals the user may be stuck |
| Max stall recovery turn | 8 | Chips can reappear on stall up to counselor turn 8 |

### 27.5 Integration Point

**File:** `src/pages/ChatPage.tsx` (send handler, ~line 968)

After determining `isCrisis` and `followUpSignal`, `resolveChipMode()` is called. If the result is `'none'`, `finalChips` is an empty array and no chip data is attached to the AI message. If `'entry'` or `'followup'`, the existing chip selection logic (`selectEmotionChips` or `getFollowUpChips`) runs as before.

### 27.6 Rhythm Outcome

- **Conversation start:** Entry chips appear to help users begin
- **After a chip tap:** Follow-up chips may appear once to deepen exploration
- **User starts writing freely:** Chips fade out naturally as momentum builds
- **Stall in mid-conversation:** Entry chips reintroduce softly as a gentle support rail
- **After micro-synthesis or strong question:** Chips are absent, giving the moment room to breathe

---

## 28. Chip Freshness and Repetition Control

### 28.1 Overview

Chip selection now includes a lightweight freshness layer that prevents the same chip from being shown or re-selected too frequently within a session. Chips are still chosen for emotional relevance first; freshness only determines ordering and selection among equally relevant candidates.

### 28.2 Freshness Logic Location

**File:** `src/lib/chips/chipFreshness.ts`

Two exported functions:
- `buildChipFreshnessContext(messages)` — scans the in-memory conversation to extract recently shown and recently selected chip IDs
- `applyChipFreshness(candidates, ctx, count)` — reorders candidates by freshness penalty and returns the top `count`

### 28.3 Recency Rules

**Recently shown suppression:**
The last 2 counselor messages that had chips attached are scanned. Any chip ID found in their `chipMetaLookup` receives a penalty of 1. It is still eligible to appear but is deprioritized in favor of unseen chips.

**Recently selected suppression:**
All user messages in the session that have a `chipMeta.id` are scanned. Any chip ID the user has previously tapped receives a penalty of 2. It is strongly deprioritized and only reappears if no fresher options remain.

**Scoring and ordering:**

| Penalty | Meaning |
|---|---|
| 0 | Fresh — not recently shown or selected |
| 1 | Recently shown in last 2 chip displays |
| 2 | Recently selected by the user this session |

Chips are sorted ascending by penalty. The top 3 are taken. If the entire pool is penalized, the least-penalized chips are still returned — no chip is permanently excluded.

### 28.4 Pool Expansion for Follow-Up Chips

`getFollowUpChips` is now called with `count=5` (full family pool) instead of 3, giving the freshness layer 5 candidates to rank before selecting the final 3. This maximizes variety within the signal family while keeping the displayed set at 3.

### 28.5 Integration Point

**File:** `src/pages/ChatPage.tsx` (send handler, ~line 982)

After `resolveChipMode()` confirms chips should appear and the candidate pool is assembled, `buildChipFreshnessContext(messages)` reads the current conversation and `applyChipFreshness(pool, ctx, 3)` returns the final 3 chips in freshness-preferred order.

### 28.6 Priority Order

1. Emotionally relevant (determined by `selectEmotionChips` / `getFollowUpChips` — unchanged)
2. Not recently shown (penalty 1 pushed down)
3. Not recently selected (penalty 2 pushed further down)
4. Variety within these constraints

### 28.7 Examples

**Entry chip freshness:**
Turn 1 shows chips A, B, C. User does not tap any and writes free text. Turn 3 (stall recovery) shows chips again. Chips A, B, C each have penalty 1. Chips D, E (same emotional tag, not recently shown) have penalty 0 — they appear first. Final display: D, E, A.

**Follow-up chip freshness:**
User tapped chip `fu_ow_1` ("Lo que más me pesa") in turn 2. The full `overwhelm` family of 5 is fetched. `fu_ow_1` gets penalty 2. The other 4 chips have penalty 0 or 1. The 3 chips returned never include `fu_ow_1` unless all others are also penalized.
