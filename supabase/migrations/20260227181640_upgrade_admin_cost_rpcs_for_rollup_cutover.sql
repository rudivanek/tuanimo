/*
  # Upgrade admin_token_cost_report and admin_top_users_by_cost with rollup cutover

  ## Summary
  Rewrites both admin reporting RPCs to automatically switch between the raw
  token_usage table and the pre-aggregated token_usage_daily_rollup table.
  Budget enforcement (check_token_budget) is NOT touched.

  ## Cutover Logic
  Before executing any query both functions evaluate three conditions:
    1. admin_settings.token_rollup_enabled = 'true'
    2. admin_settings.token_reports_use_rollup_threshold_rows <= COUNT(token_usage)
    3. At least one row exists in token_usage_daily_rollup

  All three must be true for the rollup path to activate. If any condition
  fails the functions fall back to the existing raw-table queries unchanged.

  ## Hybrid Today Handling
  The rollup table covers completed days (rollup_day < CURRENT_DATE).
  When the rollup path is active and the report range includes today:
    - Historical days  → token_usage_daily_rollup
    - Today (T+0)      → token_usage (raw, always)
  Results from both sources are UNION ALL'd and re-aggregated so totals
  match the raw-only path within rounding of pre-stored cost_usd values.

  ## Changed Functions
  - public.admin_token_cost_report(p_from, p_to, p_group_by)
  - public.admin_top_users_by_cost(p_from, p_to, p_limit)

  ## Unchanged
  - check_token_budget — always reads raw token_usage
  - rollup write functions — untouched
  - All other RPCs
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. admin_token_cost_report
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_token_cost_report(
  p_from     date,
  p_to       date,
  p_group_by text DEFAULT 'day'
)
RETURNS TABLE(group_label text, calls bigint, total_tokens bigint, cost_usd numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_email  text;
  v_use_rollup    boolean := false;
  v_threshold     bigint;
  v_raw_count     bigint;
BEGIN

-- ── Admin guard ──────────────────────────────────────────────────────────────
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

-- ── Rollup eligibility check ─────────────────────────────────────────────────
SELECT value::bigint INTO v_threshold
FROM public.admin_settings
WHERE key = 'token_reports_use_rollup_threshold_rows';

v_threshold := COALESCE(v_threshold, 1000000);

SELECT COUNT(*) INTO v_raw_count FROM public.token_usage;

IF v_raw_count >= v_threshold
   AND EXISTS (SELECT 1 FROM public.admin_settings WHERE key = 'token_rollup_enabled' AND value = 'true')
   AND EXISTS (SELECT 1 FROM public.token_usage_daily_rollup LIMIT 1)
THEN
  v_use_rollup := true;
END IF;

-- ── Queries ──────────────────────────────────────────────────────────────────

IF v_use_rollup THEN

  IF p_group_by = 'day' THEN
    RETURN QUERY
    SELECT sub.gl, SUM(sub.c)::bigint, SUM(sub.t)::bigint, SUM(sub.cu)::numeric
    FROM (
      SELECT r.rollup_day::text AS gl, SUM(r.calls) AS c,
             SUM(r.total_tokens) AS t, SUM(r.cost_usd) AS cu
      FROM public.token_usage_daily_rollup r
      WHERE r.rollup_day >= p_from
        AND r.rollup_day <  CURRENT_DATE
        AND r.rollup_day <= p_to
      GROUP BY r.rollup_day
      UNION ALL
      SELECT CURRENT_DATE::text, COUNT(*), SUM(tu.total_tokens),
        SUM(CASE tu.model
          WHEN 'gpt-4o'      THEN (tu.prompt_tokens * 5.0  + tu.completion_tokens * 15.0) / 1000000.0
          WHEN 'gpt-4o-mini' THEN (tu.prompt_tokens * 0.15 + tu.completion_tokens *  0.60) / 1000000.0
          ELSE tu.total_tokens * 5.0 / 1000000.0 END)
      FROM public.token_usage tu
      WHERE tu.created_at >= CURRENT_DATE::timestamptz
        AND tu.created_at <  (CURRENT_DATE + 1)::timestamptz
        AND (p_to >= CURRENT_DATE)
      GROUP BY CURRENT_DATE::text
    ) sub(gl, c, t, cu)
    GROUP BY sub.gl
    ORDER BY sub.gl DESC;

  ELSIF p_group_by = 'user' THEN
    RETURN QUERY
    SELECT sub.gl, SUM(sub.c)::bigint, SUM(sub.t)::bigint, SUM(sub.cu)::numeric
    FROM (
      SELECT COALESCE(au.email::text, r.user_id::text) AS gl,
             SUM(r.calls) AS c, SUM(r.total_tokens) AS t, SUM(r.cost_usd) AS cu
      FROM public.token_usage_daily_rollup r
      LEFT JOIN auth.users au ON au.id = r.user_id
      WHERE r.rollup_day >= p_from
        AND r.rollup_day <  CURRENT_DATE
        AND r.rollup_day <= p_to
      GROUP BY r.user_id, au.email
      UNION ALL
      SELECT COALESCE(au.email::text, tu.user_id::text),
             COUNT(*), SUM(tu.total_tokens),
        SUM(CASE tu.model
          WHEN 'gpt-4o'      THEN (tu.prompt_tokens * 5.0  + tu.completion_tokens * 15.0) / 1000000.0
          WHEN 'gpt-4o-mini' THEN (tu.prompt_tokens * 0.15 + tu.completion_tokens *  0.60) / 1000000.0
          ELSE tu.total_tokens * 5.0 / 1000000.0 END)
      FROM public.token_usage tu
      LEFT JOIN auth.users au ON au.id = tu.user_id
      WHERE tu.created_at >= CURRENT_DATE::timestamptz
        AND tu.created_at <  (CURRENT_DATE + 1)::timestamptz
        AND (p_to >= CURRENT_DATE)
      GROUP BY COALESCE(au.email::text, tu.user_id::text)
    ) sub(gl, c, t, cu)
    GROUP BY sub.gl
    ORDER BY SUM(sub.cu) DESC;

  ELSIF p_group_by = 'feature' THEN
    RETURN QUERY
    SELECT sub.gl, SUM(sub.c)::bigint, SUM(sub.t)::bigint, SUM(sub.cu)::numeric
    FROM (
      SELECT r.operation::text AS gl,
             SUM(r.calls) AS c, SUM(r.total_tokens) AS t, SUM(r.cost_usd) AS cu
      FROM public.token_usage_daily_rollup r
      WHERE r.rollup_day >= p_from
        AND r.rollup_day <  CURRENT_DATE
        AND r.rollup_day <= p_to
      GROUP BY r.operation
      UNION ALL
      SELECT tu.operation::text, COUNT(*), SUM(tu.total_tokens),
        SUM(CASE tu.model
          WHEN 'gpt-4o'      THEN (tu.prompt_tokens * 5.0  + tu.completion_tokens * 15.0) / 1000000.0
          WHEN 'gpt-4o-mini' THEN (tu.prompt_tokens * 0.15 + tu.completion_tokens *  0.60) / 1000000.0
          ELSE tu.total_tokens * 5.0 / 1000000.0 END)
      FROM public.token_usage tu
      WHERE tu.created_at >= CURRENT_DATE::timestamptz
        AND tu.created_at <  (CURRENT_DATE + 1)::timestamptz
        AND (p_to >= CURRENT_DATE)
      GROUP BY tu.operation
    ) sub(gl, c, t, cu)
    GROUP BY sub.gl
    ORDER BY SUM(sub.cu) DESC;

  ELSE
    -- p_group_by = 'plan'
    RETURN QUERY
    SELECT sub.gl, SUM(sub.c)::bigint, SUM(sub.t)::bigint, SUM(sub.cu)::numeric
    FROM (
      SELECT COALESCE(p.plan_key, 'unknown')::text AS gl,
             SUM(r.calls) AS c, SUM(r.total_tokens) AS t, SUM(r.cost_usd) AS cu
      FROM public.token_usage_daily_rollup r
      LEFT JOIN public.profiles p ON p.id = r.user_id
      WHERE r.rollup_day >= p_from
        AND r.rollup_day <  CURRENT_DATE
        AND r.rollup_day <= p_to
      GROUP BY COALESCE(p.plan_key, 'unknown')
      UNION ALL
      SELECT COALESCE(p.plan_key, 'unknown')::text, COUNT(*), SUM(tu.total_tokens),
        SUM(CASE tu.model
          WHEN 'gpt-4o'      THEN (tu.prompt_tokens * 5.0  + tu.completion_tokens * 15.0) / 1000000.0
          WHEN 'gpt-4o-mini' THEN (tu.prompt_tokens * 0.15 + tu.completion_tokens *  0.60) / 1000000.0
          ELSE tu.total_tokens * 5.0 / 1000000.0 END)
      FROM public.token_usage tu
      LEFT JOIN public.profiles p ON p.id = tu.user_id
      WHERE tu.created_at >= CURRENT_DATE::timestamptz
        AND tu.created_at <  (CURRENT_DATE + 1)::timestamptz
        AND (p_to >= CURRENT_DATE)
      GROUP BY COALESCE(p.plan_key, 'unknown')
    ) sub(gl, c, t, cu)
    GROUP BY sub.gl
    ORDER BY SUM(sub.cu) DESC;

  END IF;

ELSE
-- ── Raw path (original logic, unchanged) ─────────────────────────────────────

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

END IF;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. admin_top_users_by_cost
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_top_users_by_cost(
  p_from  date,
  p_to    date,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(user_label text, calls bigint, total_tokens bigint, cost_usd numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_email  text;
  v_use_rollup    boolean := false;
  v_threshold     bigint;
  v_raw_count     bigint;
BEGIN

-- ── Admin guard ──────────────────────────────────────────────────────────────
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

-- ── Rollup eligibility check ─────────────────────────────────────────────────
SELECT value::bigint INTO v_threshold
FROM public.admin_settings
WHERE key = 'token_reports_use_rollup_threshold_rows';

v_threshold := COALESCE(v_threshold, 1000000);

SELECT COUNT(*) INTO v_raw_count FROM public.token_usage;

IF v_raw_count >= v_threshold
   AND EXISTS (SELECT 1 FROM public.admin_settings WHERE key = 'token_rollup_enabled' AND value = 'true')
   AND EXISTS (SELECT 1 FROM public.token_usage_daily_rollup LIMIT 1)
THEN
  v_use_rollup := true;
END IF;

-- ── Queries ──────────────────────────────────────────────────────────────────

IF v_use_rollup THEN
  RETURN QUERY
  SELECT sub.ul, SUM(sub.c)::bigint, SUM(sub.t)::bigint, SUM(sub.cu)::numeric
  FROM (
    SELECT COALESCE(au.email::text, r.user_id::text) AS ul,
           SUM(r.calls) AS c, SUM(r.total_tokens) AS t, SUM(r.cost_usd) AS cu
    FROM public.token_usage_daily_rollup r
    LEFT JOIN auth.users au ON au.id = r.user_id
    WHERE r.rollup_day >= p_from
      AND r.rollup_day <  CURRENT_DATE
      AND r.rollup_day <= p_to
    GROUP BY r.user_id, au.email
    UNION ALL
    SELECT COALESCE(au.email::text, tu.user_id::text),
           COUNT(*), SUM(tu.total_tokens),
      SUM(CASE tu.model
        WHEN 'gpt-4o'      THEN (tu.prompt_tokens * 5.0  + tu.completion_tokens * 15.0) / 1000000.0
        WHEN 'gpt-4o-mini' THEN (tu.prompt_tokens * 0.15 + tu.completion_tokens *  0.60) / 1000000.0
        ELSE tu.total_tokens * 5.0 / 1000000.0 END)
    FROM public.token_usage tu
    LEFT JOIN auth.users au ON au.id = tu.user_id
    WHERE tu.created_at >= CURRENT_DATE::timestamptz
      AND tu.created_at <  (CURRENT_DATE + 1)::timestamptz
      AND (p_to >= CURRENT_DATE)
    GROUP BY COALESCE(au.email::text, tu.user_id::text)
  ) sub(ul, c, t, cu)
  GROUP BY sub.ul
  ORDER BY SUM(sub.cu) DESC
  LIMIT p_limit;

ELSE
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
END IF;

END;
$function$;
