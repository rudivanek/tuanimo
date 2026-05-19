/*
  # Add (user_id, created_at) index to chat_messages

  ## Problem
  The chat_messages table has an index on (thread_id, created_at) for normal
  thread loading, but no index that covers user_id. Every SELECT against
  chat_messages carries an implicit WHERE user_id = auth.uid() from the RLS
  policy ("Users can read own messages"). Without a user_id index, that filter
  cannot be used to narrow the scan, forcing Postgres to read far more rows
  than needed as the table grows.

  ## Affected queries (real patterns found in the codebase)

  1. ChatSignalBackfillPage — scans chat_messages filtered by:
       sender = 'user'  +  created_at BETWEEN dayStart AND dayEnd
     plus the implicit RLS user_id equality. Runs once per day in a loop over
     a user-selected date range (up to 30 iterations per run).

  2. InsightsPage — scans chat_messages filtered by:
       sender = 'user'  +  created_at >= now() - 7 days
     plus the implicit RLS user_id equality. Runs on every Insights page load.

  Neither query filters by thread_id, so the existing
  chat_messages_thread_created_idx is unused for these paths.

  ## Chosen index: (user_id, created_at)
  - user_id is an equality predicate from RLS — leads the composite key,
    reducing the scan to a single user's rows immediately.
  - created_at is a range predicate + ORDER BY — second column lets Postgres
    satisfy the range filter and the sort in a single index scan without a
    separate Sort node.
  - A plain (user_id) index would still need a re-sort on created_at.
    The composite eliminates that extra step for both identified query shapes.

  ## Changes
  - Adds index chat_messages_user_created_idx on (user_id, created_at) if it
    does not already exist. Safe to re-run; no data is modified.
*/

CREATE INDEX IF NOT EXISTS chat_messages_user_created_idx
  ON public.chat_messages (user_id, created_at);
