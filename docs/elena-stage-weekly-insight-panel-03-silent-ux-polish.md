# Stage WIP-03: Silent Auto-Generation UX Polish
**Elena — Weekly Insight Panel, Silent Generation UX**
Last Updated: 2026-03-19T23:55:00Z
Status: Implemented

---

## 1. UX Side-Effect Audit

### 1.1 Behaviors in `handleGenerateInsight()` that are manual-only concerns

| Line | Behavior | Manual intent | Silent impact (pre-fix) |
|------|----------|---------------|------------------------|
| 338 | `weeklyPanelRef.current?.scrollIntoView(...)` on generation start | Scroll user to panel they just clicked into | Could jolt user away from current scroll position ~500ms after page load |
| 354 | `weeklyPanelRef.current?.scrollIntoView(...)` on success | Bring result into view for the user who triggered it | Could scroll user away from wherever they are ~3–6s after page load |
| 332 | `trackEvent('insights_generate_weekly_clicked', ...)` | Analytics: user-initiated click | Misattributed event — inflates "clicked" count with auto-generated events |

### 1.2 Behaviors intentionally kept for silent generation

| Behavior | Reason kept |
|----------|-------------|
| `setIsGeneratingInsight(true)` → skeleton | Real state, not fake. Panel truthfully shows it is computing. |
| `setJustGenerated(true)` → brief highlight flash | Subtle. Signals to the user that the panel just refreshed. Positive UX. |
| `weeklyGenError` on failure | User needs to know it failed and see the manual retry button. |
| `qc.invalidateQueries` for token budget | Token budget display must update regardless of who triggered generation. |

### 1.3 Pre-fix verdict

Both `scrollIntoView` calls were problematic for auto-generation. The analytics event was additionally misleading. The `justGenerated` flash was already acceptable. No other UX side effects were present.

---

## 2. Implementation

### 2.1 Change made

`handleGenerateInsight` gained an optional `silent` parameter (`boolean`, default `false`):

```typescript
const handleGenerateInsight = async (silent = false) => {
```

**When `silent === true`:**
- Both `scrollIntoView` calls are skipped
- Analytics fires `insights_generate_weekly_auto` (instead of `insights_generate_weekly_clicked`)
- `source` in event props is `'auto'` (instead of `'insights'`)

**When `silent === false` (manual, existing behavior):**
- No change to any existing behavior

### 2.2 Auto-generation call site (WIP-02 effect)

Changed from:
```typescript
handleGenerateInsight();
```
To:
```typescript
handleGenerateInsight(true);
```

### 2.3 What was not changed

- All nine WIP-02 gating conditions: unchanged
- localStorage guard: unchanged
- `autoGenAttemptedRef`: unchanged
- `setJustGenerated(true)` flash: kept for both paths
- Error handling: unchanged

---

## 3. How Manual vs Silent Generation Now Differ

| Behavior | Manual (`silent=false`) | Silent (`silent=true`) |
|----------|------------------------|------------------------|
| Scroll to panel on start | Yes | No |
| Scroll to panel on success | Yes | No |
| Analytics event name | `insights_generate_weekly_clicked` | `insights_generate_weekly_auto` |
| Event `source` prop | `'insights'` | `'auto'` |
| Skeleton while generating | Yes | Yes |
| `justGenerated` highlight on success | Yes | Yes |
| Error banner on failure | Yes | Yes |
| Token budget invalidation | Yes | Yes |

---

## 4. Files Created

| File | Purpose |
|------|---------|
| `docs/elena-stage-weekly-insight-panel-03-silent-ux-polish.md` | This document |

## 5. Files Modified

| File | Change |
|------|--------|
| `src/pages/InsightsPage.tsx` | `handleGenerateInsight(silent = false)` — both `scrollIntoView` calls gated behind `!silent`; analytics event name and `source` prop branched on `silent`; auto-gen call site passes `true` |

---

## 6. What Still Remains Weak After WIP-03

### 6.1 `justGenerated` flash fires even for silent generation
The brief gold/highlight flash on the panel after success is kept for both paths. For most users this is a good signal ("the panel just updated"). If product decides the flash is too visible for a "silent" flow, it can be suppressed with `if (!silent) setJustGenerated(true)`. Not done here by design.

### 6.2 No suppression of the generating skeleton
When silent auto-generation starts, `isGeneratingInsight = true` and `WeeklyInsightPanel` shows a skeleton. This is intentional — real work is happening. But a user who arrives and sees the skeleton with no clear cause might find it momentarily confusing. The stale-banner-to-skeleton transition is the clearest visual narrative we have. No mitigation is warranted.

### 6.3 Analytics event `insights_generate_weekly_success` is shared
Both manual and silent paths emit the same success event (`insights_generate_weekly_success`). The `source` prop (`'auto'` vs `'insights'`) distinguishes them but requires filtering. A separate event name for silent success would be cleaner but adds noise to the event taxonomy. Left as-is.

### 6.4 No visual indicator that generation is happening "in the background"
The panel simply shows its skeleton, which is correct. There is no toast, no progress bar, no banner. This is intentional for a silent flow. If the LLM call is slow (>8s), the user may notice the skeleton but not understand why. The stale banner disappears when the skeleton appears (since the skeleton replaces it). On failure, the stale banner and error message reappear. This is already acceptable UX.
