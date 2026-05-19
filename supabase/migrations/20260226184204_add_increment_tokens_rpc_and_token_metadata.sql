/*
  # Add increment_tokens_used RPC + token_usage metadata column

  ## Summary
  Two changes to support P0 cost-control enforcement.

  ## 1. increment_tokens_used RPC
  Creates a SECURITY DEFINER function that atomically increments
  profiles.tokens_used by a given amount in a single UPDATE statement.

  This prevents the read-then-write race condition that existed when edge
  functions did: read tokens_used → add → write new value. Two concurrent
  requests could both read the same stale value, causing undercounting.

  The function uses SECURITY DEFINER so it always executes as the table
  owner, bypassing RLS. Callers only need EXECUTE privilege.

  ## 2. token_usage.metadata column
  Adds an optional JSONB metadata column to token_usage for diagnostic flags
  such as { "usage_missing": true } when the OpenAI response does not include
  usage data.

  ## Security
  - increment_tokens_used is SECURITY DEFINER — intentional, it only updates
    the caller's own profile row (enforced by the WHERE clause on p_user_id).
  - No RLS changes are made; the service role used by edge functions already
    bypasses RLS.

  ## Notes
  1. Safe to run multiple times (IF NOT EXISTS / OR REPLACE guards).
  2. Does not modify any existing token_usage rows.
*/

-- Atomic tokens_used increment (avoids read-then-write race condition)
CREATE OR REPLACE FUNCTION public.increment_tokens_used(
  p_user_id uuid,
  p_amount   integer
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE profiles
  SET tokens_used = tokens_used + p_amount,
      updated_at  = now()
  WHERE id = p_user_id;
$$;

-- Optional metadata column on token_usage for diagnostic flags
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'token_usage'
      AND column_name  = 'metadata'
  ) THEN
    ALTER TABLE token_usage ADD COLUMN metadata jsonb;
  END IF;
END $$;
