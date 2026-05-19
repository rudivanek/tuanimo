/*
  # Stage 4A — Chat Signal Daily Aggregates

  ## Summary
  Creates a table and upsert RPC to persist daily aggregated chat signals per user.
  This enables cross-session trend analysis of dominant emotional/topical signals
  extracted from the chat without re-processing raw messages every time.

  ## New Tables

  ### `chat_signal_daily_agg`
  Stores one row per user per date per signal type.
  - `id`            — surrogate primary key
  - `user_id`       — owner (references auth.users)
  - `signal_date`   — local calendar date the aggregate covers (YYYY-MM-DD)
  - `signal_type`   — signal label, e.g. "anxiety", "grief", "loneliness"
  - `score`         — aggregated weight/score (0–1 float)
  - `message_count` — number of user messages that contributed to this aggregate
  - `created_at`    — first write timestamp
  - `updated_at`    — last write timestamp (auto-maintained by trigger)

  Unique constraint on `(user_id, signal_date, signal_type)` guarantees
  exactly one row per user/day/signal combination.

  ## New RPC

  ### `upsert_chat_signal_daily_agg`
  Upserts a single daily aggregate row for the calling authenticated user.
  Parameters:
  - `p_signal_date`    date
  - `p_signal_type`    text
  - `p_score`          numeric
  - `p_message_count`  int

  Returns `void`. Auth-guarded — raises exception if caller is not authenticated.

  ## Security
  - RLS enabled on `chat_signal_daily_agg`
  - SELECT policy: users can read their own rows
  - INSERT policy: users can insert their own rows
  - UPDATE policy: users can update their own rows
  - DELETE policy: users can delete their own rows
  - RPC is SECURITY DEFINER with explicit `auth.uid()` guard
  - `search_path` locked to `public` on the RPC
*/

-- ============================================================
-- 1. Table
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_signal_daily_agg (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_date   date        NOT NULL,
  signal_type   text        NOT NULL,
  score         numeric     NOT NULL DEFAULT 0,
  message_count integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chat_signal_daily_agg_unique UNIQUE (user_id, signal_date, signal_type)
);

-- ============================================================
-- 2. updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION set_chat_signal_daily_agg_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'trg_chat_signal_daily_agg_updated_at'
      AND event_object_table = 'chat_signal_daily_agg'
  ) THEN
    CREATE TRIGGER trg_chat_signal_daily_agg_updated_at
      BEFORE UPDATE ON chat_signal_daily_agg
      FOR EACH ROW EXECUTE FUNCTION set_chat_signal_daily_agg_updated_at();
  END IF;
END $$;

-- ============================================================
-- 3. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_chat_signal_daily_agg_user_date
  ON chat_signal_daily_agg (user_id, signal_date DESC);

CREATE INDEX IF NOT EXISTS idx_chat_signal_daily_agg_user_type_date
  ON chat_signal_daily_agg (user_id, signal_type, signal_date DESC);

-- ============================================================
-- 4. RLS
-- ============================================================

ALTER TABLE chat_signal_daily_agg ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own chat signal aggregates"
  ON chat_signal_daily_agg
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat signal aggregates"
  ON chat_signal_daily_agg
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat signal aggregates"
  ON chat_signal_daily_agg
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat signal aggregates"
  ON chat_signal_daily_agg
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 5. Upsert RPC
-- ============================================================

CREATE OR REPLACE FUNCTION upsert_chat_signal_daily_agg(
  p_signal_date   date,
  p_signal_type   text,
  p_score         numeric,
  p_message_count integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO chat_signal_daily_agg (
    user_id,
    signal_date,
    signal_type,
    score,
    message_count
  )
  VALUES (
    v_user_id,
    p_signal_date,
    p_signal_type,
    p_score,
    p_message_count
  )
  ON CONFLICT (user_id, signal_date, signal_type)
  DO UPDATE SET
    score         = EXCLUDED.score,
    message_count = EXCLUDED.message_count,
    updated_at    = now();
END;
$$;
