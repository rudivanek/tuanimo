# Elena V1 — First User Testing Checklist & Event Audit
## Stage 32

---

## PART 1 — FIRST USER TESTING CHECKLIST

---

### A. First launch

**What to do**
- Create a new account and open the app for the first time.
- Do not pre-fill any data, do not log chat signals, do not create any journal entries.

**What Elena should display**
- The Chat page opens by default.
- A welcome message from Elena appears in the conversation thread, using a contextual greeting.
- Three navigation tabs are visible: Chat, Journal, Insights.
- The bottom of the chat input area shows a helper line: "Conversations here help Elena build Insights over time."
- Suggestion chips appear below Elena's welcome message.

**What to pay attention to**
- Does the welcome message feel warm and personal, or generic?
- Is the helper line visible but unobtrusive?
- Does the user naturally start typing, or do they look confused about what to do?
- Does the user notice the three navigation tabs immediately?

**Possible failure signs**
- Welcome message is empty or shows an error.
- User cannot find where to type.
- User navigates directly to Insights before writing anything (measure how often this happens).

---

### B. First chat session

**What to do**
- Send 3–5 messages to Elena. Include something moderately personal (e.g., "I've been feeling stressed about work").
- Observe how Elena responds and what appears below each response.

**What Elena should display**
- Elena responds in a supportive, non-clinical tone.
- After each Elena response, 2–3 suggestion chips appear below the message.
- After the user's 3rd message, a diary hint may appear ("This sounds like something worth writing about" type nudge) if the conversation qualifies.
- The helper line at the bottom of the composer remains visible while evidence is below threshold.

**What to pay attention to**
- Do chips feel relevant to what the user said?
- Does the user click chips spontaneously, or ignore them?
- When the diary hint appears, does the user understand what it's suggesting?
- Does the tone feel supportive, or clinical and robotic?

**Possible failure signs**
- Chips do not appear at all (check that message has `chips` array).
- Chips feel generic or mismatched to the emotional content.
- Diary hint appears too early (before real substance) or too late (never appears).
- User feels they need to keep the conversation going but doesn't know what to say.

---

### C. First journal entry

**What to do**
- Navigate to the Journal tab.
- Start a new entry without typing anything yet.
- Observe what appears above the textarea.
- Write a short entry (at least a sentence or two) and save it.

**What Elena should display**
- A GuidedStarterPrompt card appears above the textarea — a soft suggestion in italic text with three options: insert it, try another, or dismiss.
- The prompt should reflect the emotional tone of recent chat (stress / positive / general grouping).
- If no chat signals exist yet, a general prompt appears.
- Below the textarea, a helper line reads: "Every entry helps Elena notice patterns over time."
- After saving, the entry appears in the left sidebar.
- If a recent insight exists, a post-save nudge appears for ~8 seconds: "Your recent entry may have contributed to a new insight."

**What to pay attention to**
- Does the user notice the starter prompt? Do they use it, ignore it, or feel confused by it?
- Does "Try another" feel useful, or does the user not notice it?
- Does "Not now" feel like the right label for dismissing?
- Does the helper line at the bottom register at all, or is it too small?
- Does the user understand the sidebar is their entry history?

**Possible failure signs**
- Starter prompt doesn't appear (check: isNewEntry, content === '', not dismissed).
- Starter prompt appears AFTER the user has already started typing (should be blocked by contentRef guard).
- User clicks "Insert" but the text doesn't land in the textarea.
- After saving, the sidebar doesn't update.
- Post-save nudge appears when it shouldn't (no insight yet).

---

### D. First visit to Insights

**What to do**
- Navigate to the Insights tab immediately after first launch (before writing much).
- Observe what the page looks like with little to no data.

**What Elena should display**
- A "How Insights works" explanatory card appears at the top, explaining that patterns emerge over time.
- A progress message below it: "Patterns emerge after a few more reflections."
- The Weekly Insight Panel is visible but shows a placeholder (no insight yet) with a generate button.
- Most content cards (mood calendar, streak, distributions) are NOT shown yet — the page is intentionally minimal.

**What to pay attention to**
- Does the user understand why there's not much to see yet?
- Does the explanation feel helpful or dismissive ("nothing here yet")?
- Does the user feel motivated to come back, or does this early state feel like a dead end?
- Is the page layout clean and uncluttered, or confusingly empty?

**Possible failure signs**
- The "How Insights works" card does not appear.
- The user sees a blank page with no guidance at all.
- The user tries to generate a weekly insight immediately (without data) — observe what happens.
- User feels the app is broken because there's "nothing there."

---

### E. Second-day return

**What to do**
- Come back the next day. Open the app fresh (new session).
- Send 2–3 messages in chat. Write one journal entry.

**What Elena should display**
- The welcome message reflects that the user has returned (contextual greeting variant for returning users).
- The GuidedStarterPrompt appears again in Journal on a new entry (session reset).
- The ReflectionMemoryCard does NOT appear yet (requires 6–8 day old entries — too early).
- The Journal progress card may start appearing after the first saved entry from yesterday is now visible.
- The Insights helper line may update: "Elena is starting to notice themes in your writing." (if some evidence exists).

**What to pay attention to**
- Does the user feel recognized as a returning user?
- Is there visible progress (entry count, something slightly different on Insights)?
- Does the user notice any change from Day 1?

**Possible failure signs**
- Welcome message is identical to Day 1 (no contextual variation).
- Journal progress card doesn't appear despite entries existing.
- Insights page looks exactly the same as Day 1 (no change in messaging level).

---

### F. Day 3–5 usage

**What to do**
- Continue sending chat messages and writing journal entries across multiple sessions.
- Aim for at least 2 journal entries across 2 distinct calendar days, or chat signals score of 3+ across 2+ days.

**What Elena should display**
- Insights progress messaging upgrades: "Your reflections are helping Elena build a clearer picture over time."
- The Weekly Insight Panel may show a real insight if generated.
- The Journal progress card shows 7-day and 30-day counts with real numbers.
- The bottom helper lines (Chat + Journal) disappear or change once evidence threshold is crossed.
- The insight activation chip appears on Chat or Journal page: "Elena is starting to see patterns in your writing." with a "See what Elena found" button.

**What to pay attention to**
- At what point does the activation chip appear? Does it feel premature or well-timed?
- Does the disappearance of the helper lines feel like a natural milestone or go unnoticed?
- Do users understand that their writing is being used to build the Insights section?

**Possible failure signs**
- Activation chip appears too early (on Day 1, first session — should be suppressed).
- Activation chip appears but the Insights page is still mostly empty when the user clicks through.
- Helper lines never disappear (threshold not being crossed correctly).
- Weekly insight generation fails or returns a generic/unhelpful insight.

---

### G. First insight activation moment

**What to do**
- Observe the session when evidence first crosses the threshold (or simulate it).
- The activation chip should appear on either ChatPage or JournalPage.

**What Elena should display**
- A horizontal chip banner: Sparkles icon + "Elena is starting to see patterns in your writing." + "See what Elena found" button + X dismiss.
- The chip is visible but not intrusive — positioned above the main content area.
- Clicking "See what Elena found" navigates to /insights.
- Dismissing (X) hides the chip for the current cycle.

**What to pay attention to**
- Does the user notice the chip at all?
- Does the user click it immediately, or keep writing first?
- When they reach Insights after clicking, is the page meaningfully populated?
- Does dismissing feel safe (will it come back if dismissed)?

**Possible failure signs**
- Chip appears but the Insights page is still in the "empty / very early" state — the chip created a false promise.
- Chip appears multiple times on the same session (should be suppressed by `LS_SHOWN_KEY`).
- Chip appears again after being dismissed (should not re-appear in current cycle).
- User doesn't see the chip because it's visually too subtle.

---

### H. First ReflectionMemory moment

**What to do**
- Return to Journal approximately 6–8 days after writing the first entry (or simulate time passing).
- Create a new entry and observe what appears above the textarea.

**What Elena should display**
- The ReflectionMemoryCard appears above the textarea (in place of GuidedStarterPrompt).
- Title: "From X days ago" (e.g., "From 7 days ago").
- A preview of the entry content (up to 220 characters).
- Three actions: "Not now," "View original," "Reflect on this."
- The question: "How does today compare?"

**What to pay attention to**
- Does the user recognize the entry as their own writing?
- Does "From 7 days ago" give enough context, or does the user need more?
- Do users click "View original" to read it fully, or go straight to "Reflect on this"?
- Does "Not now" feel like the right label — does the user understand it won't suppress forever?
- When "Reflect on this" inserts the starter text, does the format feel natural?

**Possible failure signs**
- ReflectionMemoryCard doesn't appear (check: entry is 6–8 days old, > 120 bytes, not suppressed).
- ReflectionMemoryCard AND GuidedStarterPrompt both appear simultaneously (should be mutually exclusive).
- Inserted reflection starter text feels robotic or awkward.
- User dismisses immediately without reading — the card feels like a distraction.

---

### I. After visiting Insights

**What to do**
- After the user visits Insights for the first time with real data:
  - Check if the activation chip disappears from Chat/Journal.
  - Save a journal entry and check if the post-save insight nudge appears.
  - Navigate back and forth between surfaces.

**What Elena should display**
- Activation chip no longer shows on Chat or Journal (cycle ends when Insights visited with enough evidence).
- On InsightsPage: The first real insight is visible in the Weekly Insight Panel.
- A "New insight from your recent reflections." chip at the top of Insights (if arrived from the activation chip or post-save nudge).
- If evidence is strong: Insight Pattern Card and Weekly Insight Card both visible.

**What to pay attention to**
- Does the Insights page feel rewarding for a first visit after real use?
- Does the insight text feel personal and relevant, or generic?
- Do the "Save to journal" and "Reflect on this" CTAs on Insights feel natural?
- Is the source attribution ("Based on 5 days of chat") trustworthy or confusing?

**Possible failure signs**
- Activation chip still shows after visiting Insights (cycle should have ended).
- Insights page feels underwhelming — the first real insight is too generic.
- The "Micro step" in the insight feels preachy or too prescriptive.
- User can't find their way back to Chat or Journal from Insights.

---

### J. Edge cases / failure-state checks

**What to do and what to observe**

| Scenario | What should happen | What to watch for |
|---|---|---|
| User opens Insights immediately with no data | "How Insights works" explanation + minimal layout | Is the page understandable, or does it feel empty/broken? |
| User sends one message then opens Insights | Progress message: "Patterns emerge after a few more reflections" | Does the user understand they need more evidence? |
| User writes one journal entry, returns next day | Progress card shows 1 entry, no reflection card yet (too early) | Does the user feel progress? |
| User dismisses GuidedStarterPrompt | Prompt disappears, session-local only | Does the user feel they missed something? |
| User dismisses activation chip | Chip hidden, cycle still active | Does the user understand they can still go to Insights? |
| User visits Insights directly (no chip) | Chip cycle ends via `LS_SEEN_KEY` | Does the chip stop appearing correctly? |
| User writes entry exactly 7 days after first entry | ReflectionMemoryCard should appear | Does the card appear correctly with the right entry? |
| User is in private browsing (no localStorage) | App should still function; chips/activation fall back gracefully | No crashes, no blank states, no broken UI |
| User is on token limit | Read-only mode shown in Chat; Journal still works | Is read-only mode clear but not alarming? |
| User generates weekly insight with no data | Error or placeholder state, not a crash | Does the error state feel handled, not broken? |
| Starter prompt appears after user has already typed | Should NOT appear (contentRef guard) | If it appears, that's a regression |

---

## PART 2 — EVENT AUDIT (DOCUMENTATION ONLY — NO ANALYTICS IMPLEMENTED)

This is a human-readable audit of key interactions, their significance, and what success/risk looks like. No tracking code should be added.

---

### 1. User opens Chat first

**Where**: ChatPage, initial app load
**Why it matters**: Most likely entry path; sets the first impression of Elena's tone and purpose.
**What success looks like**: User reads the welcome message, sends a message within 60 seconds.
**What a risky outcome looks like**: User reads the welcome message, doesn't know what to say, and closes the app or navigates away.

---

### 2. User sends first message

**Where**: ChatPage, message composer
**Why it matters**: First real signal of engagement; quality of Elena's first response determines whether the user continues.
**What success looks like**: Elena's response feels relevant, warm, and prompts the user to share more.
**What a risky outcome looks like**: Elena's response feels generic, deflecting, or too clinical — user doesn't send a second message.

---

### 3. User opens Journal first

**Where**: JournalPage, from nav tab
**Why it matters**: Some users prefer writing to conversation; this is their primary surface.
**What success looks like**: User sees GuidedStarterPrompt, clicks a prompt or starts writing directly.
**What a risky outcome looks like**: User sees a blank editor with no guidance and doesn't know what to write.

---

### 4. User sees GuidedStarterPrompt

**Where**: JournalPage, above textarea, on new entry with no content
**Why it matters**: First moment where Elena shows emotional intelligence — the prompt should feel tailored, not generic.
**What success looks like**: User pauses, reads the prompt, and either inserts it or writes something similar.
**What a risky outcome looks like**: User ignores it entirely, or doesn't notice it at all (font too small, too muted).

---

### 5. User clicks "Try another prompt"

**Where**: JournalPage, GuidedStarterPrompt component
**Why it matters**: Shows whether the prompt grouping (stress/positive/general) is working — users try another when the first one doesn't fit.
**What success looks like**: Second prompt feels notably different and one of the two prompts lands.
**What a risky outcome looks like**: All prompts feel the same; user clicks "Try another" multiple times and still dismisses without inserting.

---

### 6. User inserts starter prompt

**Where**: JournalPage, GuidedStarterPrompt → inserts text into textarea
**Why it matters**: The key conversion moment for the GuidedStarterPrompt feature — user transforms a suggestion into active writing.
**What success looks like**: Text lands cleanly in textarea, cursor positioned at end, user continues writing immediately.
**What a risky outcome looks like**: Text doesn't land, cursor ends up in wrong place, or user deletes the inserted text immediately.

---

### 7. User writes manual journal entry without starter prompt

**Where**: JournalPage, textarea
**Why it matters**: Shows whether the product supports organic, unguided writing as well as prompted writing.
**What success looks like**: User writes at least 2–3 sentences, saves the entry, feels the process was easy.
**What a risky outcome looks like**: User writes a very short entry (< 20 words) or abandons mid-write — may indicate insufficient entry-level support.

---

### 8. User opens Insights very early (no data)

**Where**: InsightsPage, first session or first day
**Why it matters**: Sets expectations for what Insights will become; a confusing empty state kills future motivation.
**What success looks like**: User reads "How Insights works," understands the value prop, feels curious rather than disappointed.
**What a risky outcome looks like**: User sees a sparse page, feels the feature isn't working, and never returns to Insights.

---

### 9. User sees progress message

**Where**: InsightsPage, progress messaging section
**Why it matters**: These messages bridge the "no data yet" gap — they must feel encouraging, not condescending.
**What success looks like**: User reads the message, nods, and continues using the app to build evidence.
**What a risky outcome looks like**: User reads "Patterns emerge after a few more reflections" and finds it vague or hollow — doesn't understand what "a few more" means.

---

### 10. User crosses insight threshold

**Where**: Background — computed at next session open on ChatPage or JournalPage
**Why it matters**: The threshold crossing is the eligibility gate for the activation chip; timing matters.
**What success looks like**: Threshold is crossed naturally after 2–3 days of normal use.
**What a risky outcome looks like**: Threshold is never crossed despite genuine use (check scoring logic for edge cases), or is crossed on Day 1 from minimal activity.

---

### 11. User sees activation chip

**Where**: ChatPage or JournalPage, horizontal banner below header
**Why it matters**: This is Elena's signal to the user that something worth seeing has been built for them. First moment of "personalized product."
**What success looks like**: User notices the chip, feels curious, clicks "See what Elena found" within the same session.
**What a risky outcome looks like**: User doesn't notice the chip (too subtle); or notices it but dismisses it without visiting Insights; or visits Insights and finds it underwhelming.

---

### 12. User opens Insights from chip

**Where**: InsightActivationChip → navigates to /insights
**Why it matters**: The "payoff" moment — Elena's first real-world demonstration of intelligence. First impression of the Insights page with real data.
**What success looks like**: Insights page shows a real weekly insight, a pattern card, and progress messaging that reflects actual use. User spends 30+ seconds reading.
**What a risky outcome looks like**: Insights page still looks minimal or shows only generic content — chip created an expectation that wasn't met.

---

### 13. User sees first real insight

**Where**: InsightsPage, WeeklyInsightPanel and/or WeeklyInsightCard
**Why it matters**: The most important product moment in the early experience — this is Elena demonstrating that she learned something specific about this user.
**What success looks like**: The insight text references something recognizable (stress, a theme, a pattern) that the user knows they wrote about. User says "that's actually right."
**What a risky outcome looks like**: Insight feels generic, could apply to anyone, user says "that could be about anyone." Or the insight is technically correct but worded in a way that feels clinical.

---

### 14. User sees ReflectionMemory card

**Where**: JournalPage, above textarea, 6–8 days after first entry
**Why it matters**: The first time Elena "remembers" the user. If this moment lands, it strongly establishes the "Elena knows me" feeling that drives long-term retention.
**What success looks like**: User pauses, reads the excerpt, feels a small emotional response ("oh, I was really stressed about that"), and either reflects or reads the original.
**What a risky outcome looks like**: User reads the excerpt and finds it meaningless (entry was too short, too generic, or the excerpt is cut awkwardly). User dismisses immediately.

---

### 15. User clicks "View original"

**Where**: ReflectionMemoryCard → opens ReflectionViewerModal
**Why it matters**: Indicates the user found the excerpt interesting enough to read the full entry — this is a strong engagement signal.
**What success looks like**: Modal opens cleanly, full entry is readable, user either re-reads it fully or clicks "Reflect on this" from the modal.
**What a risky outcome looks like**: Modal feels visually cluttered, or the full entry reads poorly (was a short/messy first entry), or user can't find the close button.

---

### 16. User clicks "Reflect on this" (from card or modal)

**Where**: ReflectionMemoryCard / ReflectionViewerModal
**Why it matters**: The conversion event for the reflection feature — user actively engages with their past self.
**What success looks like**: Starter text inserts cleanly, user continues writing a reflection that references the original. Session has real narrative depth.
**What a risky outcome looks like**: Starter text format ("A week ago I wrote: … Today, this feels:") feels too structured or robotic. User deletes it and starts over.

---

### 17. User returns to Journal after a few days

**Where**: JournalPage, Day 4+ return
**Why it matters**: Tests whether the product has established a habit loop — do users come back voluntarily?
**What success looks like**: User opens Journal, sees their entry history in the sidebar, sees the progress card with real numbers, and writes a new entry without prompting.
**What a risky outcome looks like**: User opens Journal but closes it quickly — the existing entries in the sidebar don't motivate them to write again.

---

### 18. User sees helper lines disappear after enough evidence

**Where**: ChatPage and JournalPage bottom composer area
**Why it matters**: The disappearance of helper lines is a quiet signal that Elena has "enough" — the product transitions from onboarding to established use.
**What success looks like**: User doesn't notice the disappearance (seamless), or notices it and feels a subtle sense of progress.
**What a risky outcome looks like**: User doesn't notice at all (helper lines were so small they weren't registering), which means they also never read the onboarding guidance those lines provided.

---

## PART 3 — KEY PRODUCT QUESTIONS TO VALIDATE WITH REAL USERS

These are the most important open questions Elena should validate in the first real user testing sessions.

**About the core value proposition**
1. Do users understand that Chat and Journal both feed Insights — or do they treat them as completely separate features?
2. Do users feel the app becomes more personal over time, or does it feel the same on Day 5 as it did on Day 1?
3. Is the value of the Insights section understood before a real insight is generated — or does the page feel like a "coming soon" placeholder?

**About the first-week experience**
4. What is the first moment where a user feels "Elena actually knows me"? When does that moment happen — Day 2? Day 7? Does it happen at all?
5. Does the low-evidence Insights state frustrate users (perceived emptiness) or reassure them (product is building something for them)?
6. Do users who start with Journal have a meaningfully different first-week experience than users who start with Chat?

**About specific features**
7. Does the GuidedStarterPrompt feel supportive (helpful nudge) or generic (boilerplate filler)? Do users who use it write more than users who don't?
8. Does the ReflectionMemory card feel helpful or intrusive? Does it disrupt the writing flow, or enhance it?
9. Is the first insight activation chip noticed? Is "Elena is starting to see patterns" clear, or does it feel vague? Does clicking it lead to a satisfying Insights visit?
10. Does the weekly insight text feel specific enough to the user's actual experience — or does it feel like it could have been written for anyone?

**About retention signals**
11. What brings users back on Day 2 and Day 3 — Chat, Journal, or Insights? Or nothing (they churn)?
12. Do users understand that the product improves with consistent use — or does it feel like a static tool?
13. After seeing their first real insight, do users feel motivated to write more? Or does the insight feel like a conclusion rather than an invitation to continue?

---

## PART 4 — TINY FIX APPLIED

### Removed leftover `console.debug` from JournalPage.tsx

**File**: `src/pages/JournalPage.tsx`
**What was removed**: A `console.debug('debug journal insight interaction policy:', {...})` statement that fired on every render of JournalPage, logging internal state (insight timestamp, interaction flags, justSaved) to the browser console.
**Why it was removed**: This would expose internal implementation details in browser DevTools during real user testing sessions. It was labeled "debug" and was not guarded by any development-only flag.
**Behavioral impact**: None. The log had no effect on the runtime behavior of the page.

No other fixes were applied.

---

## SUMMARY

**A. First User Testing Checklist** — Sections A–J above cover all seven days of early use, organized by milestone rather than by date.

**B. Event Audit** — 18 key product interactions documented with expected outcome and risk signal for each.

**C. Key product questions** — 13 concrete validation questions grouped by theme, covering the value proposition, first-week progression, and specific feature behavior.

**D. Tiny fix applied** — Removed one leftover `console.debug` statement from JournalPage.tsx that would have exposed internal state in browser DevTools during real user sessions.

**E. Runtime behavior unchanged** — The removed `console.debug` had no effect on page behavior. No features, thresholds, analytics, schema, or visible UX were modified.
