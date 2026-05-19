/*
  # Admin Token Cost Report RPC

  ## Summary
  Adds a flexible `admin_token_cost_report` function that aggregates token usage
  and estimated cost over a date range, grouped by one of four dimensions.
  Replaces (and is distinct from) the existing `admin_token_usage_report` which
  is kept for backwards compatibility with the old TokenUsagePage.

  ## New Function: `admin_token_cost_report(p_from, p_to, p_group_by)`

  ### Parameters
  | Param        | Type | Default | Description                              |
  |--------------|------|---------|------------------------------------------|
  | p_from       | date | —       | Inclusive start date                     |
  | p_to         | date | —       | Inclusive end date                       |
  | p_group_by   | text | 'day'   | Grouping dimension: day/user/feature/plan|

  ### Return columns
  | Column       | Type          | Description                              |
  |--------------|---------------|------------------------------------------|
  | group_label  | text          | Date, email, operation, or plan_key      |
  | calls        | bigint        | Number of token_usage rows in group      |
  | total_tokens | bigint        | Sum of total_tokens                      |
  | cost_usd     | numeric(18,8) | Estimated USD cost (model-based pricing) |

  ### Cost model (gpt-4o-mini default rates)
  - gpt-4o       : $5.00/1M prompt + $15.00/1M completion
  - gpt-4o-mini  : $0.15/1M prompt + $0.60/1M completion
  - fallback     : $5.00/1M total_tokens

  ## Security
  - SECURITY DEFINER, search_path = public
  - Admin check: caller must exist in app_admins (by user_id OR email)
  - REVOKE ALL from PUBLIC; GRANT to authenticated (RPC is called via JWT)

  ## Notes
  1. group_by = 'plan' joins token_usage with profiles to get plan_key.
     Users with no profile row are bucketed as 'unknown'.
  2. All dates are UTC. The p_from/p_to boundaries are inclusive on both ends.
  3. The function raises an exception for invalid p_group_by values.
*/

DROP FUNCTION IF EXISTS public.admin_token_cost_report(date, date, text);

CREATE OR REPLACE FUNCTION public.admin_token_cost_report(
  p_from      date,
  p_to        date,
  p_group_by  text DEFAULT 'day'
)
RETURNS TABLE (
  group_label  text,
  calls        bigint,
  total_tokens bigint,
  cost_usd     numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_email text;
BEGIN
  -- ── Admin guard ─────────────────────────────────────────────────────────────
  SELECT au.email::text INTO v_caller_email
    FROM auth.users au
   WHERE au.id = auth.uid();

  IF NOT EXISTS (
    SELECT 1 FROM app_admins adm
     WHERE adm.user_id = auth.uid()
        OR (adm.email IS NOT NULL AND lower(adm.email::text) = lower(v_caller_email))
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_group_by NOT IN ('day', 'user', 'feature', 'plan') THEN
    RAISE EXCEPTION 'invalid p_group_by: must be day, user, feature, or plan';
  END IF;

  -- ── Shared cost expression (reused in each branch) ───────────────────────
  -- We build the query per-branch to avoid dynamic SQL complexity.

  IF p_group_by = 'day' THEN
    RETURN QUERY
    SELECT
      date_trunc('day', tu.created_at)::date::text               AS group_label,
      COUNT(*)::bigint                                            AS calls,
      SUM(tu.total_tokens)::bigint                               AS total_tokens,
      SUM(
        CASE tu.model
          WHEN 'gpt-4o' THEN
            (tu.prompt_tokens * 5.0 + tu.completion_tokens * 15.0) / 1000000.0
          WHEN 'gpt-4o-mini' THEN
            (tu.prompt_tokens * 0.15 + tu.completion_tokens * 0.60) / 1000000.0
          ELSE tu.total_tokens * 5.0 / 1000000.0
        END
      )::numeric(18, 8)                                           AS cost_usd
    FROM public.token_usage tu
    WHERE tu.created_at >= p_from::timestamptz
      AND tu.created_at <  (p_to + INTERVAL '1 day')
    GROUP BY date_trunc('day', tu.created_at)::date
    ORDER BY 1 DESC;

  ELSIF p_group_by = 'user' THEN
    RETURN QUERY
    SELECT
      COALESCE(au.email::text, tu.user_id::text)                 AS group_label,
      COUNT(*)::bigint                                            AS calls,
      SUM(tu.total_tokens)::bigint                               AS total_tokens,
      SUM(
        CASE tu.model
          WHEN 'gpt-4o' THEN
            (tu.prompt_tokens * 5.0 + tu.completion_tokens * 15.0) / 1000000.0
          WHEN 'gpt-4o-mini' THEN
            (tu.prompt_tokens * 0.15 + tu.completion_tokens * 0.60) / 1000000.0
          ELSE tu.total_tokens * 5.0 / 1000000.0
        END
      )::numeric(18, 8)                                           AS cost_usd
    FROM public.token_usage tu
    LEFT JOIN auth.users au ON au.id = tu.user_id
    WHERE tu.created_at >= p_from::timestamptz
      AND tu.created_at <  (p_to + INTERVAL '1 day')
    GROUP BY COALESCE(au.email::text, tu.user_id::text)
    ORDER BY 4 DESC;

  ELSIF p_group_by = 'feature' THEN
    RETURN QUERY
    SELECT
      tu.operation::text                                          AS group_label,
      COUNT(*)::bigint                                            AS calls,
      SUM(tu.total_tokens)::bigint                               AS total_tokens,
      SUM(
        CASE tu.model
          WHEN 'gpt-4o' THEN
            (tu.prompt_tokens * 5.0 + tu.completion_tokens * 15.0) / 1000000.0
          WHEN 'gpt-4o-mini' THEN
            (tu.prompt_tokens * 0.15 + tu.completion_tokens * 0.60) / 1000000.0
          ELSE tu.total_tokens * 5.0 / 1000000.0
        END
      )::numeric(18, 8)                                           AS cost_usd
    FROM public.token_usage tu
    WHERE tu.created_at >= p_from::timestamptz
      AND tu.created_at <  (p_to + INTERVAL '1 day')
    GROUP BY tu.operation
    ORDER BY 4 DESC;

  ELSE
    -- p_group_by = 'plan'
    RETURN QUERY
    SELECT
      COALESCE(p.plan_key, 'unknown')::text                      AS group_label,
      COUNT(*)::bigint                                            AS calls,
      SUM(tu.total_tokens)::bigint                               AS total_tokens,
      SUM(
        CASE tu.model
          WHEN 'gpt-4o' THEN
            (tu.prompt_tokens * 5.0 + tu.completion_tokens * 15.0) / 1000000.0
          WHEN 'gpt-4o-mini' THEN
            (tu.prompt_tokens * 0.15 + tu.completion_tokens * 0.60) / 1000000.0
          ELSE tu.total_tokens * 5.0 / 1000000.0
        END
      )::numeric(18, 8)                                           AS cost_usd
    FROM public.token_usage tu
    LEFT JOIN public.profiles p ON p.id = tu.user_id
    WHERE tu.created_at >= p_from::timestamptz
      AND tu.created_at <  (p_to + INTERVAL '1 day')
    GROUP BY COALESCE(p.plan_key, 'unknown')
    ORDER BY 4 DESC;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_token_cost_report(date, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_token_cost_report(date, date, text) TO authenticated;

-- ── Top-20 users helper for the TokenCosts admin page ────────────────────────
DROP FUNCTION IF EXISTS public.admin_top_users_by_cost(date, date, int);

CREATE OR REPLACE FUNCTION public.admin_top_users_by_cost(
  p_from    date,
  p_to      date,
  p_limit   int DEFAULT 20
)
RETURNS TABLE (
  user_label   text,
  calls        bigint,
  total_tokens bigint,
  cost_usd     numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_email text;
BEGIN
  SELECT au.email::text INTO v_caller_email
    FROM auth.users au
   WHERE au.id = auth.uid();

  IF NOT EXISTS (
    SELECT 1 FROM app_admins adm
     WHERE adm.user_id = auth.uid()
        OR (adm.email IS NOT NULL AND lower(adm.email::text) = lower(v_caller_email))
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(au.email::text, tu.user_id::text)                   AS user_label,
    COUNT(*)::bigint                                              AS calls,
    SUM(tu.total_tokens)::bigint                                 AS total_tokens,
    SUM(
      CASE tu.model
        WHEN 'gpt-4o' THEN
          (tu.prompt_tokens * 5.0 + tu.completion_tokens * 15.0) / 1000000.0
        WHEN 'gpt-4o-mini' THEN
          (tu.prompt_tokens * 0.15 + tu.completion_tokens * 0.60) / 1000000.0
        ELSE tu.total_tokens * 5.0 / 1000000.0
      END
    )::numeric(18, 8)                                             AS cost_usd
  FROM public.token_usage tu
  LEFT JOIN auth.users au ON au.id = tu.user_id
  WHERE tu.created_at >= p_from::timestamptz
    AND tu.created_at <  (p_to + INTERVAL '1 day')
  GROUP BY COALESCE(au.email::text, tu.user_id::text)
  ORDER BY cost_usd DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_top_users_by_cost(date, date, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_top_users_by_cost(date, date, int) TO authenticated;
