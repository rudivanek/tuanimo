# Elena Onboarding — Stage 04: First-Week Return Loop
**Scope:** Chat greeting continuity for returning users during Days 2–7. No new systems.
Last Updated: 2026-03-19T03:00:00Z
Status: Implemented and verified (build passes)

---

## Goal

Between Day 2 and Day 6, Elena should give the user a subtle reason to return even before a full weekly insight is available.

The user should feel:
- Elena remembers me
- something is gently building here
- it is worth checking back in

---

## Task 1 — Return Experience Audit

### What currently happens (pre-implementation)

The chat greeting at the start of each new thread is handled by `insertWelcomeMessage` in `ChatPage.tsx`, which calls functions in `src/lib/contextualGreeting.ts`.

**Current decision tree for new users Day 2–6:**

```
hoursAbsent >= 48?
  YES → getInsightSnippetForReturn()  (queries mood_weekly_insights)
       → insightSnippet present?
             YES → buildReturnGreetingWithInsight()   [specific, warm]
             NO  → buildContextualGreeting()           [generic fallback]
  NO  → buildContextualGreeting()                      [generic]
```

**The gap:** For new users in the first week, `mood_weekly_insights` is empty — no weekly analysis has run yet. So `insightSnippet` is always null, and the greeting falls back to:

> "Hola Sofia 🌷
> Qué gusto verte de nuevo.
> ¿Cómo te has sentido desde la última vez?"

This is warm but generic. The app has real emotional signal data stored in `chat_signal_daily_agg` (the same data that drives the Insights page pill) but this was never consulted during the greeting.

### What each data source does currently

| Data source | Used in greeting? | Status |
|---|---|---|
| `chat_messages.created_at` | Yes — for hoursAbsent | Active |
| `mood_weekly_insights` | Yes — for insight snippet | Active but empty in week 1 |
| `chat_signal_daily_agg` | Never | Unused in greeting |
| User profile name | Yes | Active |
| Journal entries / reflection memory | No | Siloed to JournalPage only |

### Why this mattered

A returning user on Day 3, who talked about stress the day before, received the same generic "Qué gusto verte" as a Day 1 user. There was no signal that Elena had noticed anything. The continuity promise was broken at the greeting level.

---

## Task 2 — Minimal Improvement Implemented

### Chosen approach: chat signal continuity line as fallback greeting

Added two new exported functions to `src/lib/contextualGreeting.ts`:

#### `getChatSignalForReturn()`

Queries `chat_signal_daily_agg` for the past 7 days. Sums the score per signal type. Returns the dominant type if its total score >= 2, otherwise null.

```typescript
export async function getChatSignalForReturn(): Promise<{ type: string; score: number } | null>
```

Uses the same RLS-gated query that InsightsPage uses — no new DB work. RLS ensures each user only sees their own rows.

#### `buildReturnGreetingWithSignal(name, signalType)`

Picks one soft one-line acknowledgment from a per-signal set, wraps it in the standard Elena greeting format.

```typescript
export function buildReturnGreetingWithSignal(name: string | null, signalType: string): string
```

**Signal line copy (two variants per type, picked at random):**

| Signal | Lines |
|---|---|
| `positive` | "La última vez había algo de ligereza en lo que contabas." / "Noté algo de ánimo en tus últimas palabras." |
| `stress` | "La última vez sonaba como que había bastante encima." / "Noté algo de peso en lo que compartiste." |
| `anxiety` | "Noté algo de inquietud en lo que compartiste." / "Había algo de preocupación en tus últimas palabras." |
| `gratitude` | "Había algo de gratitud en lo que contabas." / "Noté algo de reconocimiento en tus palabras anteriores." |

**Example greeting output (stress signal):**
```
Hola Sofia 🌷

La última vez sonaba como que había bastante encima.

¿Cómo te sientes hoy?
```

### Modified decision tree (post-implementation)

```
hoursAbsent >= 48?
  YES → getInsightSnippetForReturn()  (queries mood_weekly_insights)
       → insightSnippet present?
             YES → buildReturnGreetingWithInsight()           [full insight, warm]
             NO  → hoursAbsent <= 168? (still in first-week window)
                   YES → getChatSignalForReturn()
                         → signalData present (score >= 2)?
                               YES → buildReturnGreetingWithSignal()  [soft continuity]
                               NO  → buildContextualGreeting()         [generic fallback]
                   NO  → buildContextualGreeting()                     [generic fallback]
  NO  → buildContextualGreeting()                                      [generic]
```

---

## Task 3 — Subtlety Preserved

**Why this doesn't feel like a feature:**
- It's one short sentence, not a paragraph
- It doesn't label or diagnose ("I detected stress") — it uses a softer observational tone ("sonaba como que había bastante encima")
- It ends with "¿Cómo te sientes hoy?" — a genuine open question, not a prompt toward a feature

**Natural gates already in place (no extra logic needed):**

1. `welcome_inserted` DB flag — the greeting fires once per chat thread. A user can't see this line repeatedly in the same thread. Each new thread is a new conversation.
2. `hoursAbsent >= 48` — only fires if the user genuinely returned after 2+ days
3. `hoursAbsent <= 168` — constrained to the first-week range (PAST_WEEK bucket). After day 7, the LONG_ABSENCE path takes over and weekly insights typically exist anyway
4. `signalData.score >= 2` — minimum threshold prevents noise from a single casual message
5. `insightSnippet` priority — as soon as weekly insights are generated, this path is bypassed entirely. The signal line is a week-1-only fallback

---

## Task 4 — No Feature Pushing

The greeting does not mention Insights, Journal, or any other section. It doesn't suggest "go check your patterns" or "you should write this down." It simply acknowledges what was shared, then opens a question. The user decides where to take it.

---

## Task 5 — Microcopy Review

No existing copy was changed. The existing PAST_WEEK templates are already reasonable:

```
'Hola {name} 🌷\n\nQué gusto verte de nuevo.\n\n¿Cómo te has sentido desde la última vez?'
'Hola {name} 🌷\n\nMe da gusto verte por aquí.\n\n¿Qué ha pasado desde la última vez que hablamos?'
'Hola {name} 🌷\n\nAquí estoy para escucharte.\n\n¿Cómo te ha ido estos días?'
'Hola {name} 🌷\n\nVolviste 😊\n\n¿Cómo te sientes hoy?'
```

These remain as the fallback when no signal is present. They're warm enough to stand on their own.

---

## Files Modified

| File | Change |
|---|---|
| `src/lib/contextualGreeting.ts` | Added `EARLY_RETURN_SIGNAL_LINES`, `getChatSignalForReturn()`, `buildReturnGreetingWithSignal()` |
| `src/pages/ChatPage.tsx` | Updated import + `insertWelcomeMessage` to use signal fallback |

## Files Created
- `docs/elena-stage-onboarding-04-first-week-return-loop.md`

---

## Trigger Conditions

The signal continuity greeting fires when ALL of:
- New chat thread opened (thread is empty, `welcome_inserted` is false)
- `hoursAbsent >= 48` (user has been away 2+ days)
- `hoursAbsent <= 168` (still within the first-week window)
- `insightSnippet === null` (no weekly insight exists yet)
- `chat_signal_daily_agg` has data with dominant signal score >= 2

---

## Why This Over Larger Alternatives

**Considered and rejected:**
- Reflection memory integration in chat (journal entries 6-8 days old) — requires passing journal data into the greeting flow across page contexts; too much cross-concern for a subtle improvement
- Adaptive starter prompt in chat — would require UI component changes; out of scope
- Cross-thread session memory — architectural change; would require storing session summaries
- Delta detection (improved/worsened) — requires comparing two data points; data may not be available in week 1

**Why the signal line was chosen:**
- Data already exists in `chat_signal_daily_agg` (populated by InsightsPage during normal use)
- No new DB tables, migrations, or queries of new types
- Two function additions in one file + three-line logic change in another
- Naturally bounded to week 1 by existing time thresholds
- Falls back silently if no signal is strong enough

---

## Next Steps

1. **Post-week-1 signal continuity** — Once weekly insights are generating, the signal line is bypassed. The `buildReturnGreetingWithInsight` path takes over, which is appropriate.
2. **Journal reflection in chat** — Resurfacing a 6-8 day old journal entry in the chat greeting remains a future opportunity (see `reflectionMemory.ts`).
3. **Dev testing flag** — `elena_dev_force_insight_greeting` localStorage key already exists for forcing the insight path. A similar flag could be added for forcing the signal path during development.
