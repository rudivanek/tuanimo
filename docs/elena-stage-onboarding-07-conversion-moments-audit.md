# Elena Onboarding — Stage 07: Conversion Moments Audit
**Scope:** Audit of all upgrade/billing exposure + one minimal copy fix in `ChatPage.tsx`.
Last Updated: 2026-03-19T05:00:00Z
Status: Audit complete. One change implemented and verified (build passes).

---

## Context

Elena is a Spanish-language emotional wellness chat and journaling app. Conversion moments must be evaluated against an unusually high bar: users are often in emotionally open states. Any upgrade prompt that reads as transactional, mechanical, or poorly timed risks destroying the trust the product has carefully built.

---

## Files Audited

| File | What was checked |
|---|---|
| `src/components/UpgradeModal.tsx` | Full modal content, plan list, copy, trigger |
| `src/components/HeaderTokenBudget.tsx` | Always-visible budget widget + dropdown |
| `src/components/JournalStorageBanner.tsx` | 80%/critical storage warning |
| `src/components/TokenUsageSection.tsx` | Settings page usage dashboard |
| `src/pages/ChatPage.tsx` | Token exhaustion UX (banner, placeholder, button states) |
| `src/pages/JournalPage.tsx` | Token + storage limit states |
| `src/pages/InsightsPage.tsx` | Token limit gate on insight generation |
| `src/hooks/useTokenStatus.ts` | Budget data model |
| `src/lib/api.ts` | TokenBudgetError class and server messages |

---

## Task 1 — Current Conversion Moment Inventory

### CM-1: Journal Storage Warning Banner

**File:** `src/components/JournalStorageBanner.tsx`
**Trigger:** 80–99% of journal storage used (`state === 'warning'`) or 100% (`state === 'critical'`)
**Placement:** Inline at top of journal storage manage panel (JournalPage)
**Copy (warning):** "Casi sin espacio" — "Mejora tu plan" / "Administrar entradas"
**Copy (critical):** "Sin espacio disponible" — blocks new entries
**Pattern:** Amber inline banner with progress bar; no modal
**CTA:** "Mejora tu plan" → opens UpgradeModal
**Emotional context:** User is actively managing journaling — medium emotional weight, practical mindset

### CM-2: UpgradeModal (journal storage path)

**File:** `src/components/UpgradeModal.tsx`
**Trigger:** User clicks "Mejora tu plan" from journal storage banner
**Pattern:** Full-screen modal (bottom sheet mobile, centered desktop). Dismissible.
**Content:** 3-column plan comparison (Starter / Pro / Power). Pro marked "Popular."
**CTA state:** All paid plans show "Próximamente" — no purchase path active
**Footer:** "Los planes de pago estarán disponibles pronto. Mientras tanto, libera espacio eliminando entradas antiguas."
**Emotional context:** User has exhausted storage — mild frustration, task mindset

### CM-3: HeaderTokenBudget widget

**File:** `src/components/HeaderTokenBudget.tsx`
**Trigger:** Always visible in header once user has any token activity
**Pattern:** Small passive text ("Hoy X/Y · Mes X/Y") + expandable dropdown
**Color coding:** Green → Amber (80%) → Red (100%)
**Dropdown shows:** Plan badge, budget bars with percentages, reset times, "Ver detalles →" link to settings
**Emotional context:** Passive ambient — non-intrusive

### CM-4: Chat token exhaustion (before change)

**File:** `src/pages/ChatPage.tsx`
**Trigger:** `isTokenExhausted === true` (from `useTokenStatus`)
**Three affected areas:**
1. Input placeholder: `'Modo solo lectura — límite de tokens alcanzado'`
2. Inline banner: "Modo solo lectura — Puedes ver tus conversaciones existentes, pero no enviar nuevos mensajes hasta que se restablezca tu ciclo o aumentes tu plan."
3. New thread button tooltip: "Límite de tokens alcanzado — puedes leer tus conversaciones, pero no enviar nuevos mensajes."
**Pattern:** Disabled input + amber banner
**Emotional context:** **Highest risk** — user may be mid-meaningful-conversation, emotionally open, expecting Elena to respond

### CM-5: Journal token exhaustion

**File:** `src/pages/JournalPage.tsx`
**Trigger:** `isTokenExhausted === true`
**Pattern:** "Modo solo lectura" span + disabled textareas, title, tags, buttons
**Emotional context:** **High risk** — user opened their journal to write something

### CM-6: Insights token gate

**File:** `src/pages/InsightsPage.tsx`
**Trigger:** `tokenLimitError !== null`
**Pattern:** Error banner + disabled generate button
**Emotional context:** Post-reflective — user wants an "aha" moment, gets blocked

### CM-7: Settings / TokenUsageSection

**File:** `src/components/TokenUsageSection.tsx`
**Trigger:** User navigates to `/app/settings`
**Pattern:** Read-only dashboard (budget bars, reset times, cost breakdown). No upgrade CTA.
**Emotional context:** Self-directed review — low emotional weight

---

## Task 2 — Earned Conversion Moment Mapping

### After a meaningful chat exchange
**Rating: WEAK for now / worth testing later**
The user is emotionally open after a good exchange. An upgrade prompt here would interrupt the continuity we have been actively building. Any CTA would feel transactional and break tone. The current product priority is deepening trust, not capitalizing on it immediately.

### After journal continuity is felt (linked entry banner)
**Rating: TOO EARLY / avoid**
The user just reconnected with something they wrote. This is a micro-emotional moment. Surfacing "upgrade your plan" here is jarring.

### When Insights begin to feel useful
**Rating: STRONG — worth testing in a later stage**
The moment a user sees their second or third insight and recognizes a pattern Elena has detected is a genuine "aha" moment — the product has earned something. A soft "with Pro you'd get [extended history / deeper patterns]" shown subtly at that moment would feel earned. Not yet implemented, not yet active plans to trigger against. Flag for future stage.

### On return, once Elena clearly remembers the user
**Rating: STRONG — worth testing in a later stage**
When a returning user arrives and Elena's contextual greeting references something from a past session, that is the highest trust signal. A soft nudge here ("your history is building...") could connect naturally to a plan pitch. Again — not now.

### At usage limits (token daily, token monthly)
**Rating: BEST CURRENT MOMENT — but execution was broken**
Users who hit their daily or monthly token limits are the highest-intent users — they have clearly found value, used the full allocation, and want more. This is the most natural upgrade moment. However, the current copy was clinical and cold, and no actual purchase path exists yet ("Próximamente"). The copy was also framing the limit as a permanent wall ("modo solo lectura") rather than a temporary pause ("Elena volverá mañana"). This was the one fixable thing.

### At 80% token usage (proactive)
**Rating: STRONG CANDIDATE — postpone to later stage**
The journal storage system shows an 80% warning with a proactive "Mejora tu plan" CTA. Tokens have no equivalent — users hit 100% with no prior warning. Adding a similar proactive 80% token banner would be high-value but requires new UI and should be done as a dedicated stage, not here.

---

## Task 3 — Single Implemented Change

### Rationale

The highest-impact, lowest-risk improvement in the codebase was the token exhaustion language in `ChatPage.tsx`.

The old copy was clinical, framed the state as an ongoing wall ("mode solo lectura"), referenced an upgrade path that doesn't exist ("o aumentes tu plan"), and gave no temporal frame to the user.

The new copy:
- Gives temporal frame: "Elena volverá mañana" / "Elena volverá el próximo mes"
- Uses first name ("Elena") making it feel personal and relational
- Removes mechanical language ("modo solo lectura", "ciclo")
- Removes the non-functional upgrade nudge ("o aumentes tu plan") — since plans are "Próximamente"
- Reframes block as a temporary pause, not a wall
- Differentiates daily vs monthly reason (uses `tokenExhaustReason` from `useTokenStatus`)

### What Changed

**File:** `src/pages/ChatPage.tsx`

**Line 91 — added `tokenExhaustReason` to destructuring:**
```typescript
const { isTokenExhausted, reason: tokenExhaustReason } = useTokenStatus();
```

**Token exhaustion banner (was):**
```
Modo solo lectura — Puedes ver tus conversaciones existentes, pero no enviar
nuevos mensajes hasta que se restablezca tu ciclo o aumentes tu plan.
```

**Token exhaustion banner (now, daily):**
```
El espacio de hoy se ha llenado.
Puedes seguir leyendo tus conversaciones — Elena volverá mañana.
```

**Token exhaustion banner (now, monthly):**
```
El espacio de este mes se ha llenado.
Puedes seguir leyendo tus conversaciones — Elena volverá el próximo mes.
```

**Input placeholder (was):**
```
Modo solo lectura — límite de tokens alcanzado
```

**Input placeholder (now, daily):**
```
Elena volverá mañana…
```

**Input placeholder (now, monthly):**
```
Elena volverá el próximo mes…
```

**New thread button tooltip (was):**
```
Límite de tokens alcanzado — puedes leer tus conversaciones, pero no enviar nuevos mensajes.
```

**New thread button tooltip (now, daily):**
```
El espacio de hoy se ha llenado — Elena volverá mañana.
```

**New thread button tooltip (now, monthly):**
```
El espacio de este mes se ha llenado — puedes leer tus conversaciones.
```

### What was NOT touched
- `tokenLimitError` banner (per-request error from server — requires server-side change, left as-is)
- `JournalPage.tsx` token exhaustion states — would be a second change
- `InsightsPage.tsx` token gate — same
- `UpgradeModal.tsx` — plans not active yet, not the right time
- `JournalStorageBanner.tsx` — copy is already functional, no trust concern

---

## Task 4 — Trust Protection Assessment

### Active trust risks found

| Moment | Risk Level | Issue | Status |
|---|---|---|---|
| Chat token exhaustion banner | **HIGH** | Clinical "Modo solo lectura" during vulnerable conversation. Implied upgrade to non-functional plan. | **Fixed** |
| Chat input placeholder at limit | **HIGH** | "Modo solo lectura — límite de tokens alcanzado" — technical and cold | **Fixed** |
| Journal read-only at token limit | **MEDIUM** | Disabling journal textareas without warm explanation. User opens journal to process feelings, finds it locked. | Recommend next |
| UpgradeModal with "Próximamente" on all plans | **LOW** | Non-functional CTA creates expectation gap, but it's only shown on deliberate user action | No change needed |
| InsightsPage blocked | **LOW** | Less emotionally vulnerable context than chat/journal | No change needed |

### Patterns that protect trust (keep these)

- Journal 80% storage warning is proactive — gives user agency before hitting the wall. Good.
- HeaderTokenBudget is passive and ambient — non-intrusive. Good.
- No upgrade modals appear unprompted in any emotional flow. Good.
- UpgradeModal is only opened via explicit user click ("Mejora tu plan"). Good.
- TokenUsageSection in settings is purely informational, no CTA. Good.

---

## Task 5 — Prioritization

### Conversion moments to use now (or keep active)

1. **Journal storage warning at 80%** — proactive, practical context, user has agency. The "Mejora tu plan" CTA is appropriate here. Keep.
2. **Chat token exhaustion** — highest-intent users at natural pause. Copy now fixed to be Elena-native. When payment is live, this is the place to add a soft "amplía tu espacio" link. Not yet.
3. **Settings / TokenUsageSection** — correct place for plan details. If/when payment is live, an upgrade CTA here is natural and low-friction.

### Conversion moments to avoid now

1. **After a meaningful chat exchange** — too early, interrupts trust loop.
2. **In or near the linked journal banner** — emotionally sensitive bridge moment, no CTA.
3. **During or after a crisis-level conversation** — never.
4. **First session / first few messages** — user has not felt enough value yet.

### Conversion ideas to postpone until later (prioritized order)

1. **Proactive 80% token warning** — Mirror the journal storage banner pattern. When daily usage hits 80%, show a quiet ambient notice (not modal, not banner). "Queda poco espacio de hoy — tu historial sigue guardado." This plants the seed. If user hits 100%, the temporal copy is already there. Implement as a dedicated stage when payment is near-launch.

2. **Insights-gate soft nudge** — When user sees their 3rd+ insight and the "aha" is clearly there, show a subtle line: "Con más historial, Elena puede detectar patrones más profundos." This is not an upgrade CTA — it's value education. Convert it to a CTA only once payment is live.

3. **Return-user earned moment** — When Elena's contextual greeting references a past session (i.e., memory is clearly working), user is in a high-trust state. A very soft "tu historial con Elena está creciendo" that links to plan benefits (extended history, more storage) could feel earned here. Postpone until after plans are active.

---

## Output Summary

### Files audited
9 files (see list above)

### Files modified
`src/pages/ChatPage.tsx` — token exhaustion copy only

### Current conversion strengths
- Journal storage warning is well-timed (proactive at 80%, user has agency)
- UpgradeModal only triggers on explicit user action
- HeaderTokenBudget is ambient and non-intrusive
- No upgrade prompts appear inside emotional flows unprompted
- Plans gated behind "Próximamente" prevent premature purchase pressure

### Current conversion weaknesses
- Token exhaustion copy was clinical and cold (now fixed)
- No proactive token warning at 80% (journal has this, tokens do not)
- Journal read-only state at token limit has no warm explanation
- No upgrade path anywhere once payment is live (needs dedicated stage)

### Best earned upgrade moments
1. At token limit (daily/monthly) — highest-intent users, now with Elena-native framing
2. Journal 80% storage — already working well
3. Post-insight "aha" moment — future stage

### Worst upgrade moments
1. During or after a meaningful chat exchange — never
2. Inside or next to crisis resources — never
3. First session — never
