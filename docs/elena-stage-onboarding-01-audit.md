# Elena Onboarding Audit — Stage 01
**First-User Journey: Day 1–7 Experience**
Last Updated: 2026-03-19T00:00:00Z
Status: Audit complete. Foundation fixes implemented.

---

## 1. Full Journey Audit — Step by Step

### 1.1 Landing into the app

**File:** `src/pages/LandingPage.tsx`

**What the user sees:**
- Clean landing page, "Un lugar para lo que sientes", brief feature list, two CTAs: "Iniciar sesión" + "Abrir app"
- Three feature rows (journal, chat, insights) with honest, warm copy
- Privacy/disclaimer section
- No registration flow — only a login form

**What the user does:**
- Clicks "Iniciar sesión" → `LoginPage.tsx`

**What works well:**
- Copy is warm and non-clinical. Sets honest expectations.
- The distinction between "journal", "chat", and "insights" is communicated before first login.
- Privacy disclosure is present and honest.

**What is broken or missing:**
- **No self-registration path.** `LoginPage.tsx` renders login fields only — no "Crear cuenta" link or flow is present. New users cannot register themselves. This is likely intentional (closed access / admin-provisioned), but if intended to be self-serve, this is a critical gap.
- **Landing page and login use two names.** Landing says "Tu Ánimo", login says "Tu-Animo.app" — minor brand inconsistency.
- **"Abrir app" CTA** is ambiguous. It leads to `/app` which redirects logged-out users to login anyway. It reads like there is a guest mode, but there is not.

---

### 1.2 First chat session

**Files:** `src/pages/ChatPage.tsx`, `src/lib/contextualGreeting.ts`, `src/lib/welcomeMessages.ts`

**What the user sees:**
1. Elena's welcome message (from `contextualGreeting.ts`, `FIRST_TIME` variants):
   - "Hola [name] 🌷\n\nEstoy aquí para escucharte.\n\n¿Cómo te sientes hoy?"
   - Name personalization works IF profile has `first_name` or `full_name`
2. A first-time welcome banner with 4 Spanish starter prompts:
   - "Hoy me siento…", "No dejo de pensar en…", "Algo me preocupa y no sé por qué", "Quiero entender mejor lo que siento"
3. Input with placeholder "Cuéntame lo que sientes o lo que tienes en mente…"
4. **A "Tono:" dropdown** — defaults to Calma, allows Energética/Reflexiva/Serena/Joven
5. The sidebar with "Nueva conversación" button visible on desktop

**What the user does:**
- Reads the welcome message
- Clicks a starter prompt (fills input, does NOT auto-send — user must press Enter/Send)
- Or types directly and sends

**What works well:**
- Welcome message is warm and immediate
- Name personalization when available creates a minimal but real "it knows me" moment
- 4 starter prompts reduce blank-page anxiety effectively
- Chips appear after Elena's first response, contextualized to the emotional signal detected — this IS personalized from message 1

**Where it is generic or emotionally flat:**
- **Starter prompts are incomplete starters.** "Hoy me siento…" fills the input but leaves the user to complete the thought. This is intentional but could be smoother.
- **The tone selector is unexplained.** A first-time user has no idea why they are choosing a conversation tone before speaking. There is no tooltip, no intro text, no explanation. It reads like a UI toggle without context.
- **After sending first message, Elena's intelligence is invisible** until her first response. There is no feedback that something intelligent is happening during the AI call.
- **First-time welcome banner only shows when `isFirstTimeUser === true` AND `userMsgCount === 0`.** Once the user sends their first message, the banner disappears and is never shown again. That's correct behavior, but there is no subsequent "here's what you can do" moment.

**Where Elena's intelligence is not visible enough:**
- The adaptive chips (`selectEmotionChips()`) are contextually smart, but they only appear AFTER Elena's first response. There is nothing pre-response that signals "Elena is different from a generic chatbot."
- The `InsightActivationChip` ("Elena está empezando a ver patrones en lo que escribes") only appears once evidence has been built — not Day 1.

---

### 1.3 First journal entry

**Files:** `src/pages/JournalPage.tsx`, `src/components/journal/GuidedStarterPrompt.tsx`, `src/lib/starterPrompt.ts`

**What the user sees:**
- Journal entry editor with a guided starter prompt rendered via `GuidedStarterPrompt`
- Starter prompt text is selected from `PROMPT_GROUPS` based on chat signal context (`resolvePromptGroup`)
- Two actions: "Otra pregunta" (now fixed) / "Ahora no" (now fixed)

**What was broken (fixed in this stage):**
- `starterPrompt.ts` — ALL 15 prompts were in English while the entire app is in Spanish. This was a complete language break.
- `GuidedStarterPrompt.tsx` — Buttons said "Try another" / "Not now" in English.

**What works well:**
- Signal-aware prompt routing (`resolvePromptGroup`) uses chat signals to select stress/positive/general prompts — this is real personalization even on journal entry creation
- `DiaryDraftSuggestion` bridges chat → journal with a contextually-generated draft (after 3 user messages + emotional threshold)
- `JournalChatOriginBanner` shows when a journal entry came from a chat — good cross-surface continuity

**Where it is generic or emotionally flat:**
- **Journal empty state has no CTA guidance.** The first time a user opens the journal and hasn't saved any entries, there is no explicit "here's how to start" message beyond the GuidedStarterPrompt. The progress card (`JournalProgressCard`) is invisible until `saved30d > 0`.
- **`ReflectionMemoryCard`** — the reflection comparison feature (RP-02/03) is powerful but invisible to users who have fewer than 1+ saved entries.
- **No explanation of the journal purpose on first visit.** Users coming directly to the journal (not via chat suggestion) get no "why" context.

**Where Elena's intelligence is not visible enough:**
- The signal-aware prompt routing is invisible — users don't know why they got a specific prompt
- Reflection memory feature only activates after multiple journal entries

---

### 1.4 First insight exposure

**Files:** `src/pages/InsightsPage.tsx`, `src/components/insights/WeeklyInsightPanel.tsx`, `src/components/insights/WeeklyInsightCard.tsx`

**What the user sees on day 1–3:**
- Mood emoji logging area (5 emojis, daily)
- A progress message from `getInsightProgressMessage()`:
  - Level `low`: "Los patrones emergen con unas pocas reflexiones más." (now fixed from English)
  - Level `some`: "Elena está empezando a detectar patrones en lo que escribes." (now fixed)
- Empty or near-empty `WeeklyInsightPanel` (no insight yet, or insight with minimal data)
- Empty `StreakCard`, empty `MoodDistributionCard`
- The `InsightActivationChip` is NOT shown here — it appears in ChatPage once evidence is sufficient

**What works well:**
- The mood emoji logging is immediately usable and visible on first visit
- The 5-emoji scale with Spanish labels is clear
- Progress message gives honest, calibrated expectations for day 1 users

**Where it is generic or emotionally flat:**
- **No onboarding nudge on first visit.** A first-time user who navigates directly to Insights sees mostly empty cards. There is no "here's how this works" tooltip or scaffolding.
- **Weekly insight requires a full week.** The first meaningful AI narrative arrives after 7+ days of data. There is no intermediate milestone that shows something is being built.
- **The `WeeklyInsightPanel` empty state** says "Elena puede analizar los patrones emocionales de tu semana y generar un resumen personalizado." with a "Generar insight de esta semana" button — but for a user with 0 days of data, generating an insight makes no sense and would produce empty/garbage output. There is no guard preventing this on the UI side.

**Where Elena's intelligence is not visible enough:**
- The journey from "I just opened Insights" to "I feel like Elena understands me" requires 7+ days minimum
- No micro-progress signal in days 1–3 besides the progress message text

---

### 1.5 First weekly loop / return experience

**Files:** `src/lib/contextualGreeting.ts`, `supabase/functions/generate-weekly-insights/index.ts`

**After 48+ hours absent:**
- `buildContextualGreeting()` checks `lastChatAt` timestamp
- If `hoursAbsent >= 48`: calls `getInsightSnippetForReturn()` which looks for a recent weekly insight
- If found: uses `buildReturnGreetingWithInsight()` to bring the insight back into chat:
  - "Hola [name] 🌷\n\nEstuve revisando un poco lo que has compartido.\n\n[insight snippet]\n\n¿Cómo te sientes hoy?"

**What works well:**
- The insight-return greeting is the strongest retention feature in the app. It creates a direct "Elena was thinking about me" moment.
- It reuses the most recent insight (within 14 days) — no new API call required
- The opener is randomized from 4 variants to avoid feeling mechanical

**Where it breaks:**
- **This feature is completely invisible for week-1 users.** `getInsightSnippetForReturn()` queries `mood_weekly_insights` — if no insight has been generated, this returns null and falls back to a plain contextual greeting. A first-time user returning after 48h gets a generic "¿Cómo te sientes hoy?" — not the personalized bridge.
- **Weekly insight generation requires the cron to have run.** If the user signs up mid-week, the first weekly insight arrives at the next Monday cron run at the earliest.
- **No explicit "come back" incentive at end of first session.** When a user closes the app after their first chat or journal entry, nothing tells them what they will see when they return.

---

## 2. Retention Gap Analysis

### 2.1 Time to first meaningful moment
- **First partial personalization:** ~30 seconds (name in welcome greeting, adaptive chips after first message)
- **First "Elena understands me" moment:** Requires at minimum 3 user messages → chip suggestions start feeling contextual. Most users experience this in session 1.
- **First AI narrative about me specifically:** Requires 7+ days. This is a fundamental structural gap for week-1 retention.

### 2.2 Time to first personalized moment
- Chat chips are contextualized to emotional signal within the first response. This is fast.
- Journal starter prompts use chat signal context — this personalization works but was invisible to the user (no explanation of why a specific question was suggested).
- Insights page has no personalization on day 1.

### 2.3 Friction points

**Chat → Journal bridge:**
- `DiaryDraftSuggestion` requires 3 user messages + emotional signal (`shouldSuggest = true`)
- For most users this is achievable in first session, but the threshold means light users never see it
- When it DOES appear, it is well-designed (contextual reason, animated, easy to dismiss)
- The `ChatLinkedJournalBanner` that appears after a draft is created is an excellent continuity signal

**Journal → Insights bridge:**
- No explicit link from journal to insights exists in the journal page
- The `InsightActivationChip` in ChatPage is the main bridge, but requires evidence build
- A user who only uses the journal has no signal that insights are being built from their writing

### 2.4 Natural return loop in first week
The app creates a weak return loop in week 1:
- There is no push notification or email reminder in days 1–3 (email lifecycle is configured separately)
- The insight-return greeting (the strongest return hook) does not fire until there IS an insight — which requires a full week minimum
- The `InsightActivationChip` is the only in-app signal that evidence is accumulating — it fires once the evidence threshold is crossed, which takes days
- **Verdict:** Week-1 users who don't form a habit in sessions 1–2 have no pull mechanism to return. The return loop fully activates in week 2.

---

## 3. High-ROI Improvements

### A. Quick Wins (low effort, high impact)

**A1. Translate English strings to Spanish** *(IMPLEMENTED in this stage)*
- `src/lib/starterPrompt.ts` — all 15 journal starter prompts were in English
- `src/components/journal/GuidedStarterPrompt.tsx` — "Try another" / "Not now" buttons
- `src/pages/InsightsPage.tsx` — `getInsightProgressMessage()` return strings
- `src/pages/ChatPage.tsx` — "Conversations here help Elena build Insights over time."
- **Impact:** Language consistency is a trust signal. English strings in a Spanish app break immersion and signal "unfinished" to users.

**A2. Explain the tone selector on first use**
- Add a one-line tooltip or hint on first chat: "Elige el estilo de conversación que prefieras."
- The selector is visible on every session but unexplained. First-time users don't know why they're choosing it.
- Effort: 1 line of UI copy.

**A3. Add a brief first-visit nudge in Insights**
- When `hasAnyData === false` AND `hasEvidenceGrace === false`, show a single gentle sentence explaining what Insights are and how they accumulate.
- Something like: "Cada día que chates o registres tu ánimo, Elena aprende a verte mejor. Los patrones suelen aparecer después de la primera semana."
- This sets honest expectations and explains why the page looks sparse.

### B. Medium Effort

**B1. First-time journal visit CTA**
- When the journal has 0 saved entries, show a minimal "¿Por dónde empezar?" section with 2–3 entry prompts more visible than the `GuidedStarterPrompt` (which requires an entry already open)
- Reduces blank-page anxiety before the first draft is created

**B2. Surface a "your first week" micro-progress signal**
- During days 1–6, show a small "En camino a tu primer insight semanal" progress indicator somewhere in Insights or the bottom nav badge
- Creates anticipation and a concrete return reason

**B3. Journal → Insights nudge**
- When a user has 3+ saved journal entries but has never opened Insights, add a soft indicator on the Diario tab pointing toward Insights
- The journal → insights path is currently invisible

### C. Larger Strategic Upgrades

**C1. Day-0 onboarding flow (1–3 screens)**
- After first login, before opening Chat: show a 2–3 screen micro-tour explaining Chat / Journal / Insights
- Collect name (if not already in profile) to enable personalization from message 1
- Effort: medium. Payoff: significant reduction in "what is this?" confusion

**C2. Early-week insight substitute**
- Before the first weekly AI insight is available (days 1–6), generate a lighter "mini-insight" from the current week's chat signals and mood logs
- WeeklyInsightCard already does this for combined signals — the gap is that it requires enough data first
- Could be as simple as: a single sentence summarizing the dominant signal seen so far this week

**C3. Return incentive at end of first session**
- After the first chat session ends (e.g., user is inactive for 2+ minutes), show a subtle message: "Vuelve mañana — Elena recuerda lo que compartiste hoy."
- Creates an explicit expectation of continuity

---

## 4. Foundation Changes Implemented

Only the following were implemented, as they are minimal, foundational, and unblock user trust:

| Fix | File | Impact |
|---|---|---|
| Translate 15 journal starter prompts | `src/lib/starterPrompt.ts` | Language trust, coherence |
| Translate "Try another" / "Not now" | `src/components/journal/GuidedStarterPrompt.tsx` | Language trust |
| Translate 3 insight progress messages | `src/pages/InsightsPage.tsx` | Language trust |
| Translate 1 chat area fallback string | `src/pages/ChatPage.tsx` | Language trust |

No structural or architectural changes were made. All other improvements are documented as recommendations above.

---

## 5. Strict Output Report

### Files created
- `docs/elena-stage-onboarding-01-audit.md`

### Files modified
| File | Change |
|---|---|
| `src/lib/starterPrompt.ts` | All 15 PROMPT_GROUPS entries translated from English to Spanish |
| `src/components/journal/GuidedStarterPrompt.tsx` | "Try another" → "Otra pregunta", "Not now" → "Ahora no", `aria-label` updated |
| `src/pages/InsightsPage.tsx` | All 3 `getInsightProgressMessage` return strings translated to Spanish |
| `src/pages/ChatPage.tsx` | 1 English fallback string in input area translated to Spanish |

### Current first-user strengths
1. Warm, name-personalized welcome greeting from message 0
2. First-time starter prompts reduce blank-page anxiety immediately
3. Adaptive chips contextualized to emotional signal from message 1
4. DiaryDraftSuggestion bridges chat → journal with contextual timing
5. ChatLinkedJournalBanner and JournalChatOriginBanner provide cross-surface continuity
6. Insight-return greeting (after 48h absence + existing insight) is a strong retention hook
7. Signal-aware journal starter prompts use chat data for minor personalization

### Current first-user weaknesses
1. **No self-registration path** — users must be provisioned externally
2. **No week-1 return loop** — insight-return greeting requires a weekly insight that only exists after 7+ days
3. **No onboarding tour or explanation** of the three surfaces (Chat / Diario / Insights)
4. **Tone selector is unexplained** — visible to all users but never contextualized
5. **Insights page is empty and unscaffolded** for day-1 users
6. **Journal empty state has no CTA** guidance before first entry
7. **Time to first AI narrative about the user:** 7+ days minimum — no intermediate milestone

### Top 3 next implementation steps

1. **Add a one-line first-visit explainer to the Insights page** (day-0 users with no data) — explains what to expect, why it's empty, how long until insights appear. ~10 lines of UI. No new logic required.

2. **Add a tooltip/hint for the tone selector** — 1 sentence on first chat explaining what it does. Could use a simple localStorage-gated first-time tooltip. Removes "mysterious UI element" confusion.

3. **Build a minimal onboarding flow (2 screens)** — shown once after first login. Screen 1: "Hola, soy Elena" + brief explanation of Chat/Diario/Insights. Screen 2: "¿Cómo te llamas?" (name collection). Both screens gate the full app. This alone would close the biggest gap: users reaching Chat without understanding what Elena is or how it grows with them.
