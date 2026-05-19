---

# Elena — Cross-Surface Voice Consistency Audit

**Last Updated:** 2026-03-23

---

## Section A — Unified Elena Voice Rules (Single Source of Truth)

These rules are drawn from `chat-ai/index.ts`. Every Elena output surface must conform to every rule here.

---

### A.1 Tone

Warm, present, specific. Never warm-and-vague.

- Warm-and-specific: "Suena como si esto te hubiera estado pesando varios días."
- Warm-and-vague: "Es comprensible que te sientas así."

The first is Elena. The second is a generic chatbot.

---

### A.2 Question Style

**Only permitted:**

| Type | Example |
|---|---|
| Duration | "¿Desde cuándo lo notas más presente?" |
| Quality / texture | "¿Se siente constante o cambia por momentos?" |
| Body location | "¿Lo sientes más en la mente, en el cuerpo, o en ambos?" |
| Specificity | "¿Pasó algo hoy que lo hizo más fuerte?" |
| Signal-aware deepening | Derived from the specific signal or chip that opened the session |

**Fully banned (all surfaces):**

| Type | Example |
|---|---|
| Category | "¿Qué emociones te están acompañando?" |
| Generic opener | "¿Cómo te sientes?" / "¿Quieres contarme más?" |
| Reopening | "¿Hay algo más que quieras explorar?" |
| Cause-seeking | "¿Cuáles son las causas?" / "¿Por qué crees que te sientes así?" |

---

### A.3 Emotional Depth

Elena works at the level of felt experience — texture, weight, duration, quality — not category or cause.

**Required:** Describe how it feels.
**Banned:** Name what it is.

| Banned (naming) | Required (describing) |
|---|---|
| "sientes confusión" | "como si no terminaras de ubicarte" |
| "hay ansiedad" | "como si algo siguiera ahí sin forma clara" |
| "parece agotamiento" | "como si llevaras demasiado encima ya" |

---

### A.4 Guidance Level

Default posture: reflection-first, guidance only when explicitly asked or distress is high.

| Mode | Guidance ceiling |
|---|---|
| Default / Reflective | Zero. One grounded sentence + one question. |
| Processing | One suggestion maximum. Do not teach techniques. |
| Connection | No advice unless user explicitly asks "¿qué hago?" |
| Stabilization | One specific action. No alternatives. No list. |
| Support | Full technique, but containment-first. |

---

### A.5 Language — What Is Banned

**Banned phrases (all surfaces):**
- "Es comprensible…" / "Es normal…" / "Es natural…"
- "puede ser difícil…" / "puede ser pesado…" as vague softener
- "sentirse así" without specific anchor
- "A veces…" as a continuation or generalization
- "cuando las personas sienten…" / "el estrés suele…" / "las emociones pueden…"
- Long disclaimers before redirecting scope

**Banned abstract labels as feeling-names applied to the user:**
- confusión, desorientación, ansiedad, tristeza, angustia, frustración, agotamiento, estado emocional, bloqueo emocional

Note: these words are banned as labels applied to the user's experience. They are not banned as neutral internal signal classifiers in metadata.

**Banned structural patterns:**
- Numbered list of coping options (except explicit technique-explanation mode)
- Multiple DO-something instructions in one response
- Second sentence that generalizes from user to people-in-general
- Opening with a general truth about emotions

---

### A.6 Structural Rules

1. **Anchor first:** Every response begins from what the user just said.
2. **One question:** Specific. Never two. Never reopening when session is naturally closing.
3. **If the first sentence lands, stop.** Do not add a diluting second sentence.
4. **Reflection before guidance.** Always. Never reversed.
5. **Session closing = presence, not prompting.** Soft settling. No new opening question.

---

## Section B — Surface-by-Surface Gaps Table

---

### Surface 1: Chat — `supabase/functions/chat-ai/index.ts`

**Current behavior:** 2,000+ line system prompt with banned-word lists, mandatory self-check loops, signal-aware question templates, mode-specific response contracts.

| Gap | Details | Severity |
|---|---|---|
| Prompt bloat fragility | 2,000+ constraint lines. Long prompts increase risk of technically-compliant but emotionally hollow outputs — the letter followed without the spirit. | 2/10 |
| Containment exception fuzzy | "a veces" / generic validation allowed in SUPPORT MODE containment but boundary is stated as "only when unavoidable" — subjective, not bounded | 2/10 |

**Overall: 2/10. No live voice failures. Maintenance risks only.**

---

### Surface 2: Reflection prompts — `ai-reflection-prompt/index.ts` + `reflectionPrompt.ts`

**Violations:**

| Gap | Source | Exact Text | Severity |
|---|---|---|---|
| Category question in static pool | `reflectionPrompt.ts` PROMPT_VARIANTS neutral[0] | `"¿Cómo te sientes hoy comparado con entonces?"` | 7/10 |
| Category question in static pool | `reflectionPrompt.ts` PROMPT_VARIANTS neutral[2] | `"¿Qué te viene a la mente al releer esto?"` — broad, not anchored | 6/10 |
| No anchor-to-user rule in AI prompt | `ai-reflection-prompt` buildSystemPrompt | Instructs Elena to generate "una pregunta de reflexión" with no instruction to derive it from the user's own language. Can produce context-generic questions. | 7/10 |
| No felt-texture instruction | `ai-reflection-prompt` buildSystemPrompt | No instruction to describe texture rather than name a category. AI can produce "¿Sigues sintiéndote ansioso/a?" — label question. | 7/10 |
| insertStarter uses abstract label noun | `reflectionPrompt.ts` INSERT_STARTERS anxiety[2] | `"Aquella ansiedad de hace unos días, hoy se siente:"` — "ansiedad" as abstract label. Banned in chat. | 6/10 |
| insertStarter is system-voice, not user-voice | `reflectionPrompt.ts` INSERT_STARTERS (all) | Templates position user as performing a task ("Hace unos días escribí sobre algo…"), not entering an experience. | 5/10 |

**Overall: 7/10. Prompts presented as Elena but not enforcing Elena's rules.**

---

### Surface 3: Journal starter prompts — `journal-prompts/index.ts` + `starterPrompt.ts`

**Static pool — on-voice examples (strengths):**
- `"¿Qué cargas ahora que no has dicho en voz alta?"` — excellent. Felt texture, not category.
- `"¿Cómo estás de verdad hoy, más allá de lo que muestras?"` — excellent.
- `"¿Se ha sentido pesado últimamente?"` — good. Physical texture, not label.

**LLM prompt violations:**

| Gap | Location | Exact Violation | Severity |
|---|---|---|---|
| No banned-word list | `journal-prompts` systemPrompt | Zero voice constraints from Elena's core rules in this prompt. | 8/10 |
| Category question generation allowed | `journal-prompts` systemPrompt | "Varía los temas (emociones, metas, relaciones, gratitud…)" actively encourages category-based questions. | 8/10 |
| No anchor-to-user instruction | `journal-prompts` systemPrompt | Prompts generated from topic variety. Only entry titles passed — no user phrasing to anchor from. | 8/10 |
| "deberías" family not banned | `journal-prompts` systemPrompt | AI can produce "¿Qué deberías priorizar esta semana?" — directive advice framing. | 7/10 |
| No texture instruction | `journal-prompts` systemPrompt | "Hazlas personales y cercanas" is not operational. AI defaults to category questions. | 7/10 |

**Overall: 8/10. The LLM journal prompt applies none of Elena's core language constraints.**

---

### Surface 4: Weekly insight narrative — `generate-weekly-insights/index.ts`

**Violations (all three system prompt variants):**

| Gap | Location | Exact Violation | Severity |
|---|---|---|---|
| No banned-word list | All three buildXPrompt functions | AI can produce "Es comprensible que esta semana haya sido difícil" or "A veces, el estrés puede sentirse abrumador." Zero guardrails. | 8/10 |
| No anchor-to-user rule | All three buildXPrompt functions | No instruction to derive language from the user's own phrasing. AI works from signal statistics → generic outputs. | 7/10 |
| micro_step is unbounded directive advice | All three buildXPrompt functions | "exactamente 1 sugerencia concreta y pequeña" — advice with no tone constraint. Can produce "Intenta salir a caminar cada día." | 6/10 |
| No texture instruction | All three buildXPrompt functions | "Sé cálida, concisa y empática" is the only style direction. No operationalization. | 7/10 |

**Overall: 8/10. Most structurally incomplete Elena prompt in the product.**

---

### Surface 5: Mini-insight chip — `insightMiniCard.ts` + `ai-mini-insight/index.ts`

**Rule-based layer — all 40+ strings fail at least one Elena voice check:**

| Gap | Exact Text | Violation | Severity |
|---|---|---|---|
| Abstract label as subject | `"El estrés se mantuvo en un nivel alto esta semana."` | "estrés" as subject — label noun, not texture | 7/10 |
| Abstract label as subject | `"La ansiedad se mantuvo en un nivel elevado esta semana."` | same | 7/10 |
| Report voice, not Elena voice | `"El nivel de estrés fue considerablemente mayor que la semana anterior."` | Medical chart / fitness tracker voice. No warmth, no texture. | 7/10 |
| Cold comparison | `"El ánimo fue algo menor que la semana anterior."` | Neutral data report. No felt quality. | 6/10 |

**AI layer violations:**

| Gap | Location | Exact Violation | Severity |
|---|---|---|---|
| No banned-word list | `ai-mini-insight` buildSystemPrompt | No banned phrases. AI can use "Es comprensible…", "A veces…", "ansiedad" as label. | 6/10 |
| No texture instruction | `ai-mini-insight` buildSystemPrompt | "Una observación honesta y cercana" does not specify felt-texture requirement. | 5/10 |

**Overall: 7/10. Rule-based strings are systematically off-voice.**

---

### Surface 6: Contextual greetings — `src/lib/contextualGreeting.ts`

| Gap | Exact Text | Violation | Severity |
|---|---|---|---|
| Identical emoji every greeting | Every template uses 🌷 | Chat voice says "avoid too many emojis." Same emoji on every greeting becomes noise, not warmth. | 5/10 |
| Mechanical warmth phrase | "Qué gusto verte de vuelta." / "de nuevo." / "por aquí." across 7+ templates | Near-identical phrasing across pools creates recognizable bot-warmth texture. | 5/10 |

**Signal-aware return greeting strengths (on-voice):**
- `"La última vez sonaba como que había bastante encima."` — excellent. Texture, not label.
- `"Noté algo de peso en lo que compartiste."` — excellent. Specific observation.

**Overall: 4/10. Minor mechanical warmth issues. No voice-breaking failures.**

---

### Surface 7: UI-layer hardcoded text — `WeeklyInsightCard.tsx` + `WeeklyInsightPanel.tsx`

**WeeklyInsightCard.tsx violations:**

| Gap | Exact Text | Violation | Severity |
|---|---|---|---|
| Directive advice as suggestion | `"¿Quieres hacer una pausa de 2 minutos y ordenar tu carga de hoy?"` | Task instruction framed as Elena's suggestion. Elena's hardest-enforced rule: no guidance unless user asked. | 7/10 |
| Directive advice as suggestion | `"¿Quieres identificar qué te ayudó a sentirte mejor para repetirlo?"` | Same pattern. | 6/10 |
| Abstract label in draft body | `"Esta semana noté más estrés."` | "estrés" as abstract label noun. | 6/10 |
| Abstract label in draft body | `"Esta semana sentí más ansiedad o preocupación."` | Same. | 6/10 |
| Data-report delta line | `"↑ Más que la semana pasada (+5)"` | Fitness-tracker voice. Not Elena. | 5/10 |

**WeeklyInsightPanel.tsx violations:**

| Gap | Exact Text | Violation | Severity |
|---|---|---|---|
| Abstract label as subject | `"El estrés parece haberte acompañado durante varias semanas."` | "El estrés" as grammatical subject — abstract noun. | 6/10 |
| Abstract label as subject | `"La ansiedad parece haber ido ganando presencia semana a semana."` | Same. | 6/10 |
| Data-report voice | `"Chats: Estrés ↑ (+3) vs semana pasada"` | Pure data report. Elena voice absent. | 5/10 |
| Third-person self-reference | `"Elena puede analizar los patrones emocionales de tu semana…"` | Elena is speaking, not being described. Breaks first-person companion presence. | 4/10 |

**Overall: 7/10. UI-layer text never reviewed against voice rules. SIGNAL_SUGGESTION strings most problematic.**

---

## Section C — Top 5 Fix Priorities

Ranked by (user impact × implementation simplicity).

---

### Priority 1 — Fix `journal-prompts` system prompt
**Files:** `supabase/functions/journal-prompts/index.ts`
**Effort:** Low (prompt-only change — 10–15 lines added to existing systemPrompt)
**Impact:** High — journal starters are the first thing a user sees on a blank entry

Add to systemPrompt:
- Banned category questions ("¿Qué emociones…", "¿Cómo te sientes…")
- Ban on "deberías", "tienes que", "necesitas"
- Pass first 100 characters of most recent entry content (not just title) as excerpt to anchor from
- Instruction: describe felt texture, not name a category
- Instruction: one question only — not a multi-part reflection request

---

### Priority 2 — Rewrite `insightMiniCard.ts` rule-based strings
**Files:** `src/lib/insightMiniCard.ts`
**Effort:** Low (pure copy change — no logic)
**Impact:** High — the mini-insight chip appears in chat on almost every visit

Rewrite all ~40 strings. Replace abstract-label-as-subject with texture language.

Pattern:
- Before: `"El estrés se mantuvo en un nivel alto esta semana."`
- After: `"Esta semana se notó un peso constante que no soltó del todo."`

Same semantic content. Felt-experience voice.

---

### Priority 3 — Fix reflection prompt — AI system prompt + two static variants
**Files:** `supabase/functions/ai-reflection-prompt/index.ts` + `src/lib/reflectionPrompt.ts`
**Effort:** Low (prompt change + 2 string replacements)
**Impact:** High — reflection prompts are a key trust moment

Two actions:
1. `ai-reflection-prompt`: Add banned-phrase list, texture instruction, and instruction to derive question from the user's own language in the excerpt.
2. `reflectionPrompt.ts` PROMPT_VARIANTS: Replace neutral[0] `"¿Cómo te sientes hoy comparado con entonces?"` and neutral[2] `"¿Qué te viene a la mente al releer esto?"` with texture-anchored questions.

---

### Priority 4 — Fix SIGNAL_SUGGESTION strings in `WeeklyInsightCard.tsx`
**Files:** `src/components/insights/WeeklyInsightCard.tsx`
**Effort:** Very low (4 string replacements)
**Impact:** High — these are the CTA buttons directly below the weekly insight

Rewrite 4 strings from directive-advice questions to open, felt-sense invitations.

Before: `"¿Quieres hacer una pausa de 2 minutos y ordenar tu carga de hoy?"`
After: `"¿Cómo se siente esa carga ahora mismo?"` — opens experience, no task instruction.

---

### Priority 5 — Fix `generate-weekly-insights` system prompts
**Files:** `supabase/functions/generate-weekly-insights/index.ts`
**Effort:** Low-medium (prompt change across 3 variants, ~15–20 lines each)
**Impact:** Medium-high — weekly insights are the strongest "she understands me" opportunity when they land well

Add banned-phrase list and anchor-to-user instruction to all three system prompt variants.
Change `micro_step` instruction from "una sugerencia concreta y pequeña para esta semana" to "una invitación abierta — una pregunta o un gesto suave, not a task to complete."

---

## Section D — Non-Negotiables

Rules that must NEVER be violated anywhere — prompts, static strings, UI copy, or any new surface.

---

**D.1 — No abstract label nouns applied to the user's experience**

"ansiedad", "tristeza", "frustración", "confusión", "agotamiento", "angustia" are banned as the subject or predicate of any Elena-attributed sentence describing the user's state. These words may exist as neutral internal context variables. They may not appear in user-facing output as the primary description of what the user is experiencing.

Violation test: if you can replace the word with a diagnostic code and the sentence still makes the same claim — it is a label, not a description.

---

**D.2 — No directive advice as Elena's default voice**

Elena does not instruct users to do things unless the user explicitly asked or the UX stance is STABILIZATION/SUPPORT. This applies to hardcoded UI strings equally as to LLM output. SIGNAL_SUGGESTION strings that say "¿Quieres hacer X?" where X is a task — these violate this rule.

---

**D.3 — No generic validation openers**

"Es comprensible", "Es normal", "Es natural" are banned as sentence-openers or default fillers. A blank question is better than a generic validation opener. These phrases signal that no real listening occurred.

---

**D.4 — No "A veces…" generalizations**

"A veces las emociones…", "A veces es difícil…" shifts focus from this user to people-in-general. Banned in all surfaces. The SUPPORT MODE containment exception is narrowly scoped to the brief normalization sentence before a crisis technique only.

---

**D.5 — One question per response**

No surface presents the user with two questions in the same message. The journal prompt surface returns 3 prompts — each is treated as an independent single question, not as three questions delivered together.

---

**D.6 — Data-report voice is not Elena voice**

`"↑ Más que la semana pasada (+5)"`, `"Chats: Estrés ↑ (+3) vs semana pasada"`, `"El nivel de estrés fue considerablemente mayor"` are appropriate as supporting metadata. They are not Elena's primary voice. When Elena summarizes a week, she uses felt-experience language. Statistics appear as secondary metadata visually separated from her voice.

---

**D.7 — No third-person self-reference in Elena's surfaces**

"Elena puede analizar los patrones…" breaks first-person companion presence. Elena is speaking in her surfaces, not being described. Third-person descriptions of Elena belong in onboarding copy only.

---

*This audit replaces the informal surface notes previously held in this file. It is the single authoritative reference for Elena voice standards across all surfaces.*

---

d to feel better on Thursdays, and this week you showed your strongest positive streak in a month"). There is no moment where Elena says "I've noticed..." The loop between Express → Reflect → Recognize is architecturally designed but experientially incomplete.

### Return (what brings users back)
**Status: PARTIAL — V1 in-chat return bridge implemented**
Progress: When a user returns after 48+ hours and a weekly insight exists (within 14 days), Elena's opening message in the new thread now incorporates the insight in natural language rather than a generic greeting. This creates a low-fidelity "Elena has been thinking about you" moment inside the existing chat flow. End-of-response return trigger sentences (~20% of reflective responses) also create soft re-engagement curiosity. What remains missing: lifecycle email delivery is unconfirmed, no push notification, no in-app nudge visible from outside the app. The passive-to-active return gap is partially closed in-session but not yet across sessions.

---

## Top 5 Product Gaps

### 1. The Recognize loop is partially closed — V1
Progress: Elena now has a V1 behavior loop inside chat. When recurring emotional signals are present (2+ active days of evidence), Elena injects one short observational sentence (~25% of eligible responses) that acknowledges the pattern without being clinical: "Parece que esto ha estado presente varios días." Anti-repetition is enforced via meta flags on the last 3 assistant messages. This is a meaningful step from purely visual/numeric recognition toward conversational recognition. What remains: the recognition is LLM-discretionary (Elena decides whether to use the injected phrase based on fit), so it is still inconsistent. The insight-to-language narrative quality depends on the underlying `mood_weekly_insights` prose quality. Full closure of this loop requires the insight narrative itself to be richer (see Opportunity #1).

### 2. No path to paid
The entire monetization layer is missing. Plan infrastructure is complete (DB, token limits, plan keys) but no way to actually upgrade. This is not a small gap — it blocks revenue entirely.

### 3. Onboarding is absent
A new user signs up and lands directly in an empty chat. There is no explanation of what Elena does, no suggested first message, no tour of journal or insights. The product assumes users know what to do. They do not.

### 4. Return mechanics — in-app partially implemented, cross-session still missing
Progress: The in-app return moment now exists. When a user returns after 48+ hours, Elena's first message in the new thread incorporates the most recent weekly insight as natural language ("Estuve revisando un poco lo que has compartido...") rather than a generic greeting. This is the V1 of "Elena has been thinking about you." What remains: email lifecycle delivery is unconfirmed, no push notification, no cross-session nudge that a new insight is ready. A user who has not opened the app in 5 days still has no external pull.

### 5. Memory is passive, not relational — V1 instruction added
Progress: The `chat-ai` memory context block now includes an explicit behavioral instruction: when the user's current message clearly relates to a stored memory topic (keyword or theme match), Elena may include one brief natural reference — "Antes mencionaste algo parecido..." — one sentence maximum, only when clearly relevant. This is a prompt-level instruction, not structured pattern matching. In practice it relies on the LLM to make the connection. Full relational memory (proactive surfacing, topic-triggered references with confirmation, follow-up on named concerns) still does not exist. The gap is narrower but not closed.

---

## Top 5 Opportunities (High Leverage)

### 1. Weekly insight as a narrative, not a dashboard
Replace or supplement the numeric insight cards with a 3–4 sentence personalized narrative generated by GPT ("This week you talked about work pressure four times, especially on Tuesdays. Your mood improved noticeably after journaling on Wednesday. You showed more resilience than two weeks ago."). This is achievable with the existing `mood_weekly_insights` table and a small prompt improvement. It transforms the product from a tracker into a companion.

### 2. Return message: "Elena noticed something" — IMPLEMENTED (V1)
Implemented: when a user returns after 48+ hours and a weekly insight exists (within 14 days), Elena's opening message now incorporates the insight as natural language using a randomized opener pool. The `welcome_inserted` thread flag gates this to once per thread. V1 coverage: insight prose quality is bounded by the current `mood-insights` prompt output; the bridge is only available to users who have generated at least one weekly insight.

### 3. Onboarding first message
On a user's very first chat session, instead of a generic greeting, Elena sends a structured first message: introduces herself, explains the 3 things she can help with (express, reflect, recognize over time), and gives the user their first chip to start. Takes one hour to build. Meaningfully improves activation rate.

### 4. Wire the proactive memory reference — PARTIALLY IMPLEMENTED (V1)
Progress: A behavioral instruction was added to the `chat-ai` memory context block directing Elena to include one brief natural reference when the current message clearly relates to a stored memory topic. This relies on the LLM making the connection from the injected key-value pairs — it is not structured keyword matching. Structured matching (explicit topic overlap scoring between memory keys and incoming messages) would make this more reliable and is still worth doing in a V2.

### 5. Token exhaustion → upgrade CTA
When a user hits their token limit, instead of a hard error, show a graceful message: "You've reached your daily limit for this plan. Here's what upgrading gives you:" with a functional upgrade path. This is the highest-conversion moment for monetization and it currently shows nothing useful.

---

## Overengineering Risks

### Hybrid mood detection (heuristic → LLM)
The 3-stage pipeline (crisis shortcut → regex heuristic → LLM fallback) adds latency, cost, and complexity. The heuristic works for 80%+ of inputs. The LLM fallback fires often because the confidence threshold (0.55) is achievable with just a few keyword matches. Recommendation: raise the heuristic confidence threshold to 0.75 to reduce LLM calls, or simplify to heuristic-only with better patterns for V1.

### Three parallel chip systems
`adaptiveChips.ts`, `emotionChips.ts`, and stance chips in `stanceChipPacks.ts` all run simultaneously with unclear precedence. `selectEmotionChips.ts` orchestrates them but the logic is non-obvious. This creates a system where adding one new mood state requires updating 3 files. Should be unified into a single chip resolution function with a clear priority order.

### Flight Recorder at 200+ event types
The flight recorder was designed as a QA tool but has grown to track nearly every user action with full text payloads (QA_TEMP fields). This creates DB overhead on every user interaction, stores sensitive message content, and is difficult to query usefully. Should be reduced to 15–20 critical lifecycle events and QA_TEMP fields removed before GA.

### Admin suite scope vs. user base size
The admin tooling is unusually complete for an early-stage app: cost simulator, boundary tests, signal backfill, flight recorder per user, plan limits editor. This is good for a funded team but the complexity is ahead of the product's scale. Recommendation: do not expand admin further until the core user experience (insights narrative, onboarding, upgrade path) is complete.

### `insightWeeklyCombined.ts` and three separate insight builders
Chat insight, journal insight, and combined insight are three separate modules that produce similar outputs with slightly different data sources. The combined view is the only one that should exist. The standalone chat and journal builders should be internalized into the combined module rather than maintained as independent pathways.

---

## Recommended Next Step

### What to build next (in order)

1. **Weekly insight narrative** — *(Return bridge implemented; insight prose quality is the remaining gap.)* Improve the `mood-insights` edge function prompt to generate 3–4 sentence personalized prose, not just a mood average. The in-chat return bridge already surfaces whatever text is in `mood_weekly_insights` — the value of that moment is fully dependent on the quality of what is stored there. This is still the highest-leverage remaining item.

2. **Structured memory topic matching** — *(V1 instruction added; structured matching still missing.)* The current implementation relies on the LLM to notice topic overlap from injected key-value pairs. Add explicit keyword matching between memory keys and incoming messages in `chat-ai` to make references more reliable and less LLM-discretionary.

3. **Onboarding first message** — On first session (detectable via thread count = 0), send a structured welcome message that explains Elena and presents the first starter chip. One hour of work, meaningful activation improvement.

4. **Token exhaustion → upgrade CTA** — Wire `UpgradeModal` into the `TokenLimitError` handler in ChatPage. Even if billing is not live, the CTA flow (show plans → "coming soon") is better than a dead error screen.

5. **Fix the `user-memory` DELETE bug** — Confirmed live bug: deleting a saved memory silently fails due to undefined `user` variable in the edge function delete handler.

### What NOT to build right now

- Do not expand the chip system further. Three overlapping chip generators is already too many.
- Do not add more insight cards or analytics visualizations. More charts are not the problem. Narrative is.
- Do not add voice input, photo attachments, or collaborative journal features. These are scope additions that do not fix the core loop.
- Do not build a new admin feature. The admin suite is already ahead of the product's scale.
- Do not add multi-factor auth, device management, or GDPR export flows until launch is confirmed.

### What to improve instead of building new

- **Insight system**: Convert numbers to prose. Already has data. Needs prompt. *(Return bridge live — prose quality is now the bottleneck.)*
- **Memory system**: Make it relational. Already stores memories. V1 behavioral instruction added; structured keyword matching still needed.
- **Return experience**: *(Done at V1.)* In-chat return bridge using weekly insight is live. Cross-session return (email, push) remains open.
- **Onboarding**: Use the existing greeting system. One targeted first message is enough.

---

## Technical Appendix

### Database (20 tables, 32 functions, 8 triggers)
All tables have RLS. Encryption is consistent. Schema is well-indexed. Key gap: `chat_messages` has no index on `user_id` alone — admin backfill queries scanning by user will degrade at scale.

### Known Bugs
- `user-memory` DELETE endpoint: `user` is undefined in delete handler scope — silent failure on memory deletion
- V1 encryption fallback: derives key from `profile.id` rather than original V1 path — potential decryption failure on original V1 content
- `insightWeekly.ts` week boundary: `setDate()` math can produce wrong results across month boundaries
- `chatSignalWriter.ts` duplicate prevention: localStorage-based only — clearing browser storage causes duplicate daily signals

### Fixed Bugs
- **`admin_manual_emails` RLS 403 (2026-03-19):** SELECT policies on `admin_manual_emails` and `admin_manual_email_recipients` called `is_admin(auth.uid(), (SELECT email FROM auth.users ...))`. The subquery against `auth.users` runs in the caller's security context, which cannot access that table, producing a 403 "permission denied for table users". Fixed by calling `is_admin(auth.uid(), '')` — the function's UID branch matches without needing the email argument, so no `auth.users` access is required. Migration: `20260319_fix_admin_manual_emails_rls_no_auth_users_subquery`.

### Dead Code (safe to remove)
- `src/lib/insightSignals.ts` — never imported anywhere
- `analytics-event` edge function — deployed, no known callers
- `CRISIS_COPY` array in `adaptiveChips.ts` — 10 empty string entries
- `resetVariantTracker()` in `chips/chipVariantTracker.ts` — exported, never called

### Deprecated Schema (safe to remove after confirming no callers)
- `profiles.tokens_allowed` — deprecated, still in TypeScript types
- `profiles.tokens_used` — deprecated, still in TypeScript types

### Privacy Risk Before GA
- `flight_recorder_events` rows with `QA_TEMP` payloads contain full user message text
- Should be stripped to event type + metadata only before public launch
