# Elena Onboarding — Stage 06: Behavior Loop Reinforcement
**Scope:** `ChatPage.tsx` (continuation hint logic + render) + `ChatLinkedJournalBanner.tsx` (copy).
Last Updated: 2026-03-19T04:00:00Z
Status: Implemented and verified (build passes)

---

## Goal

After a meaningful moment in chat, the user should naturally feel invited to continue a bit further — not because of a prompt or reward, but because something small signals that it's okay to stay.

The user should feel:
- "There's no hurry to leave."
- "I can keep going if I want."
- Not: "I've been notified."
- Not: "A feature was triggered."

---

## Task 1 — Audit: Natural End Moments

### Where sessions end without a continuation cue

**In chat:**
The visual bottom of the conversation is:
1. Last counselor message (with SuggestionChips if latest, FollowUpBox if applicable)
2. `ChatLinkedJournalBanner` (if a journal entry was linked)
3. `DiaryDraftSuggestion` (if signal thresholds met)
4. Scroll anchor

Between step 1 and step 3, there is a gap. If the conversation has emotional depth but doesn't yet meet the DiaryDraftSuggestion thresholds (heaviness >= 3, or repetition >= 3 with some heaviness), no continuation cue exists. The SuggestionChips on the latest message are action chips (emotion labels, topics) — they invite a next message but don't invite the user to *stay* with the current moment.

**Where emotional momentum exists but is not extended:**
- `uxStance === 'PROCESSING'` with `uxIntensity >= 1`: User is reflective, mid-exploration, no heavy signal yet. DiaryDraftSuggestion won't fire. Nothing invites continuation.
- `uxStance === 'CONNECTION'` with `uxIntensity >= 1`: User is feeling lonely/unseen, mid-disclosure. Same gap.
- These are the highest-value extension moments — the user is open but not overwhelmed.

**In journal → return to chat:**
The `ChatLinkedJournalBanner` already handles this via the linked entry state. However, its body copy read as functional:
- "Hay un borrador creado desde esta conversación." — passive, descriptive
- "Hay una reflexión guardada desde esta conversación." — passive, archival

The banner didn't feel like a continuation bridge — it felt like a filing cabinet label.

---

## Task 2 — Chat Continuation Hint

### Implementation

**File:** `src/pages/ChatPage.tsx`

**New state/ref added:**
```typescript
const continuationHintFiredRef = useRef(false);
const [showContinuationHint, setShowContinuationHint] = useState(false);
```

**Derived values added (after `showDiaryHint`):**
```typescript
const latestCounselorStance = latestCounselorMsg?.uxStance;
const latestCounselorIntensity = latestCounselorMsg?.uxIntensity ?? 0;
```

**Trigger effect:**
```typescript
useEffect(() => {
  if (continuationHintFiredRef.current) return;
  if (
    !isSending &&
    !!latestCounselorId &&
    userMsgCount >= 2 &&
    crisisLvl < 2 &&
    !showDiaryHint &&
    !linkedEntry &&
    (latestCounselorStance === 'PROCESSING' || latestCounselorStance === 'CONNECTION') &&
    latestCounselorIntensity >= 1
  ) {
    continuationHintFiredRef.current = true;
    setShowContinuationHint(true);
  }
}, [isSending, latestCounselorId, latestCounselorStance, latestCounselorIntensity, userMsgCount, crisisLvl, showDiaryHint, linkedEntry]);
```

**Dismissal effect:**
```typescript
useEffect(() => {
  if (isSending || showDiaryHint) setShowContinuationHint(false);
}, [isSending, showDiaryHint]);
```

**Rendered element (inline, no new component):**
```tsx
{showContinuationHint && (
  <p className="text-center text-[12.5px] text-app-muted py-3 px-4 animate-in fade-in duration-500">
    {latestCounselorStance === 'CONNECTION'
      ? 'Estoy aquí, sin prisa.'
      : 'Puedes quedarte un poco más con esto.'}
  </p>
)}
```

Placed just before `showDiaryHint` in the message area bottom zone.

### Trigger conditions summary

| Condition | Rationale |
|---|---|
| `!isSending` | Not mid-send — only when conversation has paused |
| `!!latestCounselorId` | Elena has responded at least once |
| `userMsgCount >= 2` | Enough exchange for the hint to feel earned |
| `crisisLvl < 2` | Not in high crisis — hint would be misplaced there |
| `!showDiaryHint` | DiaryDraftSuggestion already handles deeper signal; no overlap |
| `!linkedEntry` | Banner already present; no stacking |
| `uxStance === 'PROCESSING' \|\| 'CONNECTION'` | Emotional reflective stance — where continuation has value |
| `uxIntensity >= 1` | Some emotional weight — not a task/logistics chat |
| `continuationHintFiredRef.current === false` | **Once per session** — the ref latches `true` on first fire and never resets |

### Why once per session

The `continuationHintFiredRef` is a `useRef` (not `localStorage`) — it resets on page reload, which is exactly the right scope. Within a single session, showing the hint more than once would make it feel scripted. Across sessions, the user shouldn't feel "Elena always says this."

### Copy text

| Stance | Text |
|---|---|
| `CONNECTION` | "Estoy aquí, sin prisa." |
| `PROCESSING` (and other) | "Puedes quedarte un poco más con esto." |

**CONNECTION** → "I'm here, no rush." Mirrors the user's need for presence without agenda.
**PROCESSING** → "You can stay with this a little longer." Mirrors the reflective mode — invites dwelling, not action.

Both lines are:
- Not questions (no pressure)
- Not instructions ("debes seguir")
- Not encouragement clichés ("¡eso es un gran paso!")
- Soft enough to be ignored without friction

---

## Task 3 — Post-Journal Continuity (ChatLinkedJournalBanner)

### What the banner already does

When a chat thread has a linked journal entry, `ChatLinkedJournalBanner` renders at the bottom of the message area. This is the primary continuity mechanism between journal and chat.

### Copy improvements

**File:** `src/components/ChatLinkedJournalBanner.tsx`

| Element | Before | After |
|---|---|---|
| Label | "DIARIO VINCULADO" (ALL-CAPS) | "Tu diario" (sentence case, css `uppercase tracking-wide` removed) |
| Body (draft) | "Hay un borrador creado desde esta conversación." | "Escribiste algo a partir de esta conversación." |
| Body (saved) | "Hay una reflexión guardada desde esta conversación." | "Guardaste una reflexión desde aquí." |
| CTA (draft) | "Abrir borrador" | "Ver borrador" |

Key shifts:
- "Hay un borrador" (there is a draft) → "Escribiste algo" (you wrote something): personal, active, ownership
- "creado desde" (created from) → "a partir de" (from / as a result of): softer attribution
- "desde esta conversación" → "desde aquí": more natural, conversational
- "Abrir" (open) → "Ver" (see): gentler verb, less mechanical

---

## Task 4 — Over-Triggering Safeguards

| Safeguard | Mechanism |
|---|---|
| Once per session | `continuationHintFiredRef` latches `true` on first fire, never resets within page session |
| Only meaningful exchanges | `uxStance === 'PROCESSING' \|\| 'CONNECTION'` — filters out `PRACTICAL` and `STABILIZATION` |
| Only with some weight | `uxIntensity >= 1` — no hint for zero-weight conversations |
| Not in crisis | `crisisLvl < 2` — stabilization takes precedence |
| No overlap with diary hint | `!showDiaryHint` — if diary hint activates, continuation hint hides |
| Disappears on user send | Second effect: `if (isSending) setShowContinuationHint(false)` |
| Minimum conversation depth | `userMsgCount >= 2` — not after a single exchange |

---

## Task 5 — Microcopy Consistency

All new text follows Elena tone:

- **Not therapeutic cliché:** no "it's okay to feel this way," no "you're doing great"
- **Not instructional:** no "try to..." or "you should..."
- **Calm and non-urgent:** "sin prisa" (no rush), "un poco más" (a little longer)
- **Reflective:** staying-with, not moving-toward
- **Short:** 4-5 words max per line — enough to register, too short to feel heavy

---

## Files Modified

| File | Change |
|---|---|
| `src/pages/ChatPage.tsx` | Added `continuationHintFiredRef`, `showContinuationHint` state, `latestCounselorStance`, `latestCounselorIntensity` derived values, two `useEffect` hooks, one inline render element |
| `src/components/ChatLinkedJournalBanner.tsx` | Label copy + CSS, body copy (draft + saved), CTA copy (draft) |

---

## Why This Is Minimal

**No new component:** The continuation hint is a single `<p>` rendered inline in ChatPage.tsx.

**No new backend:** Uses existing `uxStance` and `uxIntensity` stored on every counselor message — no new data model.

**No new signal computation:** Reuses `latestCounselorStance`, `latestCounselorIntensity`, `userMsgCount`, `crisisLvl`, `showDiaryHint`, `linkedEntry` — all already computed in ChatPage.tsx.

**No new storage:** Session gating via `useRef` — no localStorage, no sessionStorage, no database writes.

**No new flow:** The hint renders at the natural bottom of the message area, alongside existing end-of-session elements. No new navigation, no new pages, no new modals.

---

## What Did Not Change

- Trigger thresholds for `DiaryDraftSuggestion` — untouched
- SuggestionChips behavior — untouched
- FollowUpBox — untouched
- Journal page — untouched
- Any backend logic — untouched
