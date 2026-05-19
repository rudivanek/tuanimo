/*
  # Admin Token Usage Report RPCs

  ## Summary
  Adds two SECURITY DEFINER RPC functions for admin-only token usage reporting.
  Both functions verify the caller exists in app_admins before returning any data.

  ## New Functions

  ### 1. admin_token_usage_report
  Aggregates token_usage rows by user per day, computing real cost from model pricing.
  - Params: p_user_id (nullable uuid), p_date_from (date), p_date_until (date, inclusive)
  - Returns: user_id, user_label (email), usage_date, total_tokens, total_cost_usd
  - Cost model:
      gpt-4o       : prompt $5/1M tokens + completion $15/1M tokens
      gpt-4o-mini  : prompt $0.15/1M tokens + completion $0.60/1M tokens
      fallback     : total_tokens * $5/1M

  ### 2. admin_list_users_with_usage
  Returns distinct users that have at least one token_usage row (for dropdown).
  - No params
  - Returns: user_id, user_label (email)

  ## Security
  - Both functions: SECURITY DEFINER, search_path = public
  - Admin check: EXISTS(SELECT 1 FROM app_admins WHERE user_id = auth.uid())
  - RAISE EXCEPTION 'not authorized' if caller is not an admin

  ## Notes
  1. token_usage has no cost_usd column — cost is derived from model + prompt/completion tokens.
  2. user_label falls back to user_id::text when auth.users email is not accessible.
  3. Date filter is inclusive on both ends: created_at >= p_date_from AND < p_date_until + 1 day.
*/

-- ─── 1. Main report function ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_token_usage_report(
  p_date_from  date,
  p_date_until date,
  p_user_id    uuid DEFAULT NULL
)
RETURNS TABLE (
  user_id        uuid,
  user_label     text,
  usage_date     date,
  total_tokens   bigint,
  total_cost_usd numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM app_admins WHERE app_admins.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    tu.user_id,
    COALESCE(au.email, tu.user_id::text)            AS user_label,
    date_trunc('day', tu.created_at)::date          AS usage_date,
    SUM(tu.total_tokens)::bigint                    AS total_tokens,
    SUM(
      CASE tu.model
        WHEN 'gpt-4o' THEN
          (tu.prompt_tokens     * 5.0   +
           tu.completion_tokens * 15.0) / 1000000.0
        WHEN 'gpt-4o-mini' THEN
          (tu.prompt_tokens     * 0.15  +
           tu.completion_tokens * 0.60) / 1000000.0
        ELSE
          tu.total_tokens * 5.0 / 1000000.0
      END
    )::numeric(18, 8)                               AS total_cost_usd
  FROM token_usage tu
  LEFT JOIN auth.users au ON au.id = tu.user_id
  WHERE
    tu.created_at >= p_date_from::timestamptz
    AND tu.created_at <  (p_date_until + INTERVAL '1 day')
    AND (p_user_id IS NULL OR tu.user_id = p_user_id)
  GROUP BY
    tu.user_id,
    au.email,
    date_trunc('day', tu.created_at)::date
  ORDER BY
    usage_date DESC,
    user_label  ASC;
END;
$$;

-- ─── 2. User list helper ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_list_users_with_usage()
RETURNS TABLE (
  user_id    uuid,
  user_label text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM app_admins WHERE app_admins.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT DISTINCT
    tu.user_id,
    COALESCE(au.email, tu.user_id::text) AS user_label
  FROM token_usage tu
  LEFT JOIN auth.users au ON au.id = tu.user_id
  ORDER BY user_label ASC;
END;
$$;
