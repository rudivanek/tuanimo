# Elena Onboarding — Stage 03: Insights First Exposure
**Scope:** InsightsPage copy and early-state UX. No new systems, no new data logic.
Last Updated: 2026-03-19T02:00:00Z
Status: Implemented and verified (build passes)

---

## Goal

When a new or early-stage user opens the Insights page before enough data exists, the page should feel intentional, warm, and motivating — not empty or broken.

The user should understand:
1. Why the page is still quiet
2. What Elena is gradually building
3. Why returning matters (connection to the Stage 02 chat promise about patterns)

---

## Changes Made

### Task 1 — Improved Empty / Early Insights State

**File modified:** `src/pages/InsightsPage.tsx`
**Area:** `isVeryEarlyState` block (fired when `isChatAggLoaded && !isLoadingJournal && !hasAggData && !hasJournalData`)

**Before:**
```
Con el tiempo irás viendo patrones aquí.
Todo empieza con lo que escribes.
```
(Sparse. No explanation. No warmth. No direction.)

**After:**
```
Elena todavía te está conociendo.

Con unas cuantas conversaciones o entradas más, empezarán a aparecer aquí los primeros patrones en lo que sientes. No tienes que hacer nada distinto.

Si quieres seguir, puedes:
  [Hablar con Elena]  o  [Escribir en el diario]
```

Why this works:
- "Elena todavía te está conociendo" is honest and warm — not an error, not a feature gap
- "No tienes que hacer nada distinto" reduces pressure and removes the "I have to do something" friction
- The phrase "los primeros patrones en lo que sientes" directly echoes the Stage 02 chat insight seed line, making the two moments feel connected
- Two soft CTA links to Chat and Journal give a natural forward path without being pushyCondition: fires only when `isVeryEarlyState === true` (no chat aggregate data AND no journal saves in 30d AND both data sources have finished loading).

---

### Task 2 — Soft Next-Step CTA

**File modified:** `src/pages/InsightsPage.tsx`
**Area:** Inside the `isVeryEarlyState` block

Implemented as two inline text-links rather than buttons, to keep the tone conversational:

```tsx
<button onClick={() => navigate('/app/chat')}>
  Hablar con Elena
</button>
o
<button onClick={() => navigate('/app/journal')}>
  Escribir en el diario
</button>
```

Styled with `text-sage-strong hover:underline` — matches Elena's action micro-copy style throughout the app. No aggressive upsell language. No icon. No border. Just a natural, low-pressure nudge.

---

### Task 3 — Alignment with Stage 02 Chat Promise

The Stage 02 chat insight seed said:
> "A veces, cuando volvemos a hablar varios días, empiezan a aparecer patrones…"

The new early-state copy says:
> "Con unas cuantas conversaciones o entradas más, empezarán a aparecer aquí los primeros patrones en lo que sientes."

The two messages use the same language ("patrones", "aparecer"), creating a coherent loop:
- Chat: Elena plants the seed that patterns are coming
- Insights: the page confirms it's where they will show up
- Neither message overpromises or sets a specific timeline

The progress pill ("some" level) was also left intact:
> "Elena está empezando a detectar patrones en lo que escribes."

This shows once there IS some data (but not enough for full insights), and continues the same narrative thread.

**De-duplication improvement:** The 'low' progress pill (sage-colored box) was previously shown at the same time as `isVeryEarlyState`, which created a redundant double-message. Fixed with `!isVeryEarlyState &&` wrapper on the progress message block — so the pill is suppressed when the expanded early-state block is visible.

---

### Task 4 — Tone / Microcopy Audit

**File modified:** `src/pages/InsightsPage.tsx`

| Location | Before | After | Reason |
|---|---|---|---|
| Header subtitle | "Rastrea tu bienestar emocional" | "Lo que Elena va construyendo con tus reflexiones" | Generic dashboard label → Elena-voiced description |
| Arrived-with-new-insight banner | "New insight from your recent reflections." | "Nuevo insight de tus últimas reflexiones." | English text in a Spanish-first app |
| Some-data-not-enough copy | "Con más días irán apareciendo temas aquí." | "Con unos días más, Elena podrá mostrarte los primeros patrones claros." | Previous copy was impersonal and slightly vague |

---

## Files Modified

| File | Change |
|---|---|
| `src/pages/InsightsPage.tsx` | All 4 tasks — see details above |

## Files Created
- `docs/elena-stage-onboarding-03-insights-first-exposure.md`

---

## Early-State Conditions Reference

| Condition | What shows |
|---|---|
| `isVeryEarlyState === true` | Expanded warm block: "Elena todavía te está conociendo…" + two CTA links. Progress pill suppressed. |
| Some data exists but evidence below threshold (`!isVeryEarlyState && !hasEnoughInsightEvidence`) | 'some' progress pill ("Elena está empezando a detectar…") + subtle "Con unos días más…" line |
| Evidence threshold met (`hasEnoughInsightEvidence === true`) | 'strong' small muted text ("Tus reflexiones están ayudando a Elena…"). Normal page content visible. |
| Arrived with new insight AND evidence ok | "Nuevo insight de tus últimas reflexiones." banner near header |

---

## What Was Not Changed

- No insight-generation logic modified
- No charts, scores, or metrics changed
- No new components created
- No new DB tables or queries
- No onboarding modal or overlay
- Page layout and card order unchanged
- `getInsightProgressMessage` function logic unchanged (only rendering condition updated)

---

## Next Steps

1. **Insights page — after first insight appears** — the "moment of first real insight" is still abrupt. A brief congratulatory micro-line could acknowledge the milestone ("Ya tienes tu primer patrón.")
2. **Return motivation** — after 3–5 sessions, the page has no "you've been consistent" acknowledgment beyond StreakCard
3. **Journal first-entry empty state** — currently has a generic placeholder; same treatment as Insights would help
