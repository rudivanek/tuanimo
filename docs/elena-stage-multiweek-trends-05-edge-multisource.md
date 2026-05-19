# Stage Multi-Week Trends 05: Multi-Source Trend Injection into Weekly AI Insight Generation
**Elena — Extending the Edge Function Trend Pipeline to Journal and Mood Sources**
Last Updated: 2026-03-19T00:00:00Z
Status: Implemented and deployed

---

## 1. Audit — State Before Trends-05

### 1.1 The gap

After Trends-04, the client-side `multiWeekTrend` (in `InsightsPage.tsx`) used all three sources: chat agg, journal entries, and mood logs. But the edge function `generate-weekly-insights` still computed trend context from chat agg only.

This meant:
- A journal-only user visiting Insights would see a trend line (client-side, Trends-03) reflecting their journal signals
- But that same user's weekly AI insight would receive no trend context at all (edge function chat-only)
- Elena's spoken narrative was inconsistent with the system's own detection

### 1.2 Current edge function trend pipeline (before this change)

```
fetchMultiWeekChatSignals()   →   ChatSignalRow[]
                               ↓
buildWeekSlicesEdge(rows, weekEndDate, 4)
                               ↓
detectTrendsEdge(slices)
                               ↓
buildMultiWeekTrendContext(trends, weeksWithData)   →   trendContext string injected into prompt
```

`fetchMultiWeekChatSignals` fetched only `chat_signal_daily_agg` for the 28-day window. No mood or journal data entered this pipeline.

### 1.3 Data availability in the edge function environment

The edge function runs in Deno with service-role DB access. It can query any table. Key observations:
- **Mood logs** (`mood_logs.local_date`, `.emoji`) — plaintext, easy to convert via emoji mapping
- **Journal entries** (`journal_entries.title`, `.saved_at`, `.tags`) — `title` and `tags` are stored unencrypted; full `content` is encrypted and NOT usable. Tags/title-only matching is consistent with how the client-side `matchSignals` function works.
- **No imports from client code** — Deno cannot import `src/lib/insightWeeklyJournal.ts`. The keyword lists and emoji mapping must be mirrored in the edge function.

---

## 2. Design Decisions

### 2.1 Same merge strategy as Trends-04

The edge function now mirrors the client: convert all three sources to the same `ChatSignalRow` shape (`{ signal_date, signal_type, score }`) and merge them additively. The existing `buildWeekSlicesEdge` and `detectTrendsEdge` functions are unchanged — they receive a richer input but apply the same logic.

### 2.2 Keyword lists duplicated — intentionally

`SIGNAL_KEYWORDS_EDGE` is a verbatim copy of `SIGNAL_KEYWORDS` from `insightWeeklyJournal.ts`. This duplication is accepted because:
- The edge function is a separate runtime — imports from `src/` are not available
- The keyword lists are short and stable (not likely to change frequently)
- Divergence risk is low; if the lists need updating, both places must be updated

This trade-off is documented here so future maintainers know to keep them in sync.

### 2.3 `matchSignalsEdge` mirrors `matchSignals` exactly

Same token normalization (lowercase, strip non-Spanish characters, split on whitespace), same keyword inclusion check. Produces identical results for the same input on both client and server.

### 2.4 Journal date bucketing uses UTC slice

The client-side `matchSignals` uses `localDateStr(new Date(entry.saved_at))` which applies the browser's local timezone. The edge function uses `entry.saved_at.slice(0, 10)` which is the UTC date.

For users in non-UTC timezones, entries created near midnight may land in a different week bucket between client and server. This is an accepted limitation — trend analysis over 4-week windows is not sensitive to single-day mismatches.

### 2.5 Score weights are identical to Trends-04

| Source | Score |
|---|---|
| Chat (from `chat_signal_daily_agg`) | As stored — weighted by message count |
| Journal keyword match | 1 per matched signal per entry |
| Mood log: 😊 | positive, 1.0 |
| Mood log: 🙂 | positive, 0.5 |
| Mood log: 😟 | stress, 0.5 |
| Mood log: 😔 | stress, 1.0 |
| Mood log: 😐 | skipped |

### 2.6 Two new DB queries per user, run in parallel

The existing `Promise.all` was extended from 4 to 6 concurrent queries:
- `fetchMoodTrendRows` — `mood_logs` for the full 28-day trend window
- `fetchJournalSignalRows` — `journal_entries` (title, saved_at, tags) for the 28-day window

These queries are fast (small row counts, indexed on `user_id`) and run in parallel with the existing queries — no serial latency added.

Note: `fetchMoodTrendRows` queries the full 28-day window, which overlaps with the existing `currentResult` and `priorResult` mood queries (current week + prior week). There is minor redundancy. The trade-off was chosen to avoid restructuring the existing mood fetch logic.

### 2.7 `trendContext` prompt injection is unchanged

`buildMultiWeekTrendContext` and `buildMultiWeekTrendContext` are not modified. The only change is what rows they receive. The same `STRONG_DELTA_EDGE = 3` threshold gates injection. The same Spanish sentences are used.

---

## 3. Implementation

### 3.1 New constants and functions added to `generate-weekly-insights/index.ts`

**`SIGNAL_KEYWORDS_EDGE`** — keyword lists mirroring `insightWeeklyJournal.ts`:
- 4 signal types: `gratitude`, `anxiety`, `stress`, `positive`
- Spanish keywords only

**`matchSignalsEdge(tags, title)`** — mirrors `matchSignals`:
- Returns `Array<"positive" | "stress" | "anxiety" | "gratitude">`
- Same token normalization and inclusion matching

**`MOOD_EMOJI_SIGNAL_EDGE`** — mirrors `MOOD_EMOJI_SIGNAL` from `insightTrends.ts`:
- 4 emoji entries → signal + score

**`convertMoodLogsToSignalRows(logs)`** — converts `MoodLog[]` to `ChatSignalRow[]`

**`JournalEntryEdge`** interface — minimal shape for DB rows: `{ title, saved_at, tags }`

**`fetchMoodTrendRows(svc, userId, since, before)`** — queries `mood_logs` and converts via `convertMoodLogsToSignalRows`

**`fetchJournalSignalRows(svc, userId, since, before)`** — queries `journal_entries` (title, saved_at, tags), applies `matchSignalsEdge`, returns `ChatSignalRow[]`

### 3.2 Changes to `generateInsightForUser`

`Promise.all` extended to 6 queries:
```typescript
const [currentResult, priorResult, chatSignals, multiWeekRows, moodTrendRows, journalTrendRows] = await Promise.all([
  ...existing 4 queries...,
  fetchMoodTrendRows(svc, userId, trendWindowStart, weekEndDate),
  fetchJournalSignalRows(svc, userId, trendWindowStart, weekEndDate),
]);
```

Merged rows:
```typescript
const allTrendRows = [...multiWeekRows, ...moodTrendRows, ...journalTrendRows];
```

`activeTrendSources` — tracks which sources contributed rows (used in `signalMeta`):
```typescript
const activeTrendSources = [
  ...(multiWeekRows.length > 0 ? ["chat"] : []),
  ...(moodTrendRows.length > 0 ? ["mood"] : []),
  ...(journalTrendRows.length > 0 ? ["journal"] : []),
];
```

`buildWeekSlicesEdge` now receives `allTrendRows` instead of `multiWeekRows`.

### 3.3 `signalMeta` now records `trend_sources`

```typescript
signalMeta = {
  sources: [...],        // existing — describes which source drove the weekly insight
  mood_days: ...,        // existing
  chat: ...,             // existing
  trend_sources: activeTrendSources,   // NEW — which sources fed the trend pipeline
  trend_context_injected: true,        // existing (if applicable)
  trend_weeks_with_data: weeksWithData // existing (if applicable)
}
```

---

## 4. Data Sources Now Used in the Edge Function

| Source | Table | Fields queried | Window | Used for |
|---|---|---|---|---|
| Chat agg | `chat_signal_daily_agg` | `signal_type, score, signal_date` | 28 days (trend) + current week (summary) | Both trend and weekly summary |
| Mood logs | `mood_logs` | `local_date, emoji` | 28 days (trend) + current week + prior week (summary) | Trend context + mood-based narrative |
| Journal entries | `journal_entries` | `title, saved_at, tags` | 28 days (trend only) | Trend context only |

Journal entries contribute only to trend context — not to the weekly narrative (which uses mood + chat signals). This is correct: the edge function doesn't have access to journal content (encrypted), only to structural signals.

---

## 5. Conflict Handling

No conflicts exist — sources are additive. The same `MIN_DELTA_EDGE = 1.5` and `STRONG_DELTA_EDGE = 3` thresholds apply. Sources accumulate per (date, signal_type) bucket. Chat data still dominates when present due to its higher score magnitude.

---

## 6. What Improved

**Consistency between UI and AI narrative:**
- Client-side trend detection (Trends-04) and server-side trend injection now use the same three sources
- A journal-only user who sees a stress trend line in the UI will now also receive trend context in their AI-generated weekly insight

**Coverage for journal-only users:**
Journal entries with keyword-matched titles or tags now feed the trend pipeline in the edge function, enabling trend-aware AI insights for users who don't chat.

**Coverage for mood-only users:**
4+ weeks of mood log data with consistent positive or negative emoji patterns will now produce trend context in the AI prompt.

---

## 7. What Still Remains Weak

### 7.1 Keyword lists are duplicated

`SIGNAL_KEYWORDS_EDGE` in the edge function must be kept in sync with `SIGNAL_KEYWORDS` in `insightWeeklyJournal.ts`. There is no compile-time enforcement of this. If one is updated without the other, client and server will detect different signals from the same journal entry.

### 7.2 Journal trend uses UTC date, client uses local date

Minor day-boundary mismatch for non-UTC users. Acceptable for 4-week trend analysis but technically inconsistent.

### 7.3 Mood queries are partially redundant

`fetchMoodTrendRows` covers the full 28-day window, overlapping with `currentResult` (current week mood) and `priorResult` (prior week mood). This results in two mood queries that together cover 14 days also covered by the trend query. No data correctness issue, but 2 of the 6 queries in `Promise.all` are narrowly redundant. Could be consolidated in a future cleanup.

### 7.4 Journal entries feed trend context only, not the weekly narrative

The AI narrative prompt (`buildMoodPrompt`, `buildChatOnlyPrompt`) still uses only mood emoji stats and chat signal summaries. Journal entry content is encrypted — it cannot contribute to narrative generation without client-side decryption. This is a hard architectural constraint, not a bug.

### 7.5 Mood logs only contribute `positive` and `stress` to trends

Same limitation as Trends-04: emoji alone cannot distinguish anxiety from stress or gratitude from general positivity. `anxiety` and `gratitude` trend detection in the edge function still depends entirely on chat signals and journal keyword matches.
