/*
  # Harden chat signal upsert: GREATEST semantics

  ## Summary
  Updates the `upsert_chat_signal_daily_agg` RPC so that concurrent or
  duplicate writes (from multiple tabs, page refreshes, or cleared browser
  storage) are always safe and never reduce the stored value.

  ## Problem
  The previous upsert used:
    score = EXCLUDED.score
    message_count = EXCLUDED.message_count
  — a plain last-write-wins overwrite. A duplicate write from a tab that had
  fewer messages loaded would silently replace a richer row with a lower score.

  ## Change
  The ON CONFLICT branch now uses:
    score         = GREATEST(existing, incoming)
    message_count = GREATEST(existing, incoming)

  This means any number of concurrent writes for the same (user, date, type)
  are idempotent: the row always keeps the highest score and message_count ever
  seen, regardless of write order.

  ## Impact
  - No schema changes — only the RPC body is replaced.
  - Existing rows are unaffected.
  - Existing callers need no changes; the RPC signature is identical.
  - ChatPage and InsightsPage can both write safely without double-counting.
*/

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
    score         = GREATEST(chat_signal_daily_agg.score, EXCLUDED.score),
    message_count = GREATEST(chat_signal_daily_agg.message_count, EXCLUDED.message_count),
    updated_at    = now();
END;
$$;
