/*
  # Admin Plan Limits Management RPCs

  ## Summary
  Adds two SECURITY DEFINER admin RPCs to read and update token plan budgets
  from the `token_plan_limits` table without direct SQL access. Both functions
  are callable by authenticated admins only (app_admins guard).

  ## New Functions

  ### 1. `admin_get_token_plan_limits()`
  Returns all rows from `token_plan_limits` ordered by plan_key.
  Includes the journal_storage_bytes reference derived from the existing
  `journal_storage_bytes_for_plan()` pure mapping function (read-only context).

  Returns per row:
    plan_key              text      -- 'starter' | 'pro' | 'power'
    daily_token_limit     int       -- current daily cap
    monthly_token_limit   int       -- current monthly cap
    journal_storage_bytes bigint    -- bytes allowed for this plan (read-only)
    updated_at            timestamptz

  ### 2. `admin_update_token_plan_limits(p_plan_key, p_daily, p_monthly)`
  Validates inputs and updates a single plan row.

  Validation rules:
    - p_plan_key must be in ('starter', 'pro', 'power')
    - p_daily must be > 0
    - p_monthly must be >= p_daily (monthly cap cannot be less than daily cap)

  Returns the updated row (same shape as admin_get_token_plan_limits).

  ## Security
  - Both functions: SECURITY DEFINER, search_path = public
  - Admin check: EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
  - RAISE EXCEPTION 'not authorized' if caller is not in app_admins
  - REVOKE from PUBLIC, GRANT EXECUTE to authenticated

  ## Notes
  1. These RPCs give the admin UI a safe, validated write path so limits can
     be changed without direct DB access.
  2. check_token_budget() reads token_plan_limits on every call, so updates
     are reflected for all users on the next budget check — no cache to flush.
  3. journal_storage_bytes is read-only here; it is managed by
     journal_storage_bytes_for_plan() and the plan_key trigger.
*/

-- ── 1. admin_get_token_plan_limits ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_get_token_plan_limits()
RETURNS TABLE (
  plan_key              text,
  daily_token_limit     int,
  monthly_token_limit   int,
  journal_storage_bytes bigint,
  updated_at            timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM app_admins WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
    SELECT
      tpl.plan_key,
      tpl.daily_token_limit,
      tpl.monthly_token_limit,
      public.journal_storage_bytes_for_plan(tpl.plan_key) AS journal_storage_bytes,
      tpl.updated_at
    FROM public.token_plan_limits tpl
    ORDER BY
      CASE tpl.plan_key
        WHEN 'starter' THEN 1
        WHEN 'pro'     THEN 2
        WHEN 'power'   THEN 3
        ELSE 99
      END;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_token_plan_limits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_token_plan_limits() TO authenticated;

-- ── 2. admin_update_token_plan_limits ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_update_token_plan_limits(
  p_plan_key text,
  p_daily    bigint,
  p_monthly  bigint
)
RETURNS TABLE (
  plan_key              text,
  daily_token_limit     int,
  monthly_token_limit   int,
  journal_storage_bytes bigint,
  updated_at            timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM app_admins WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_plan_key NOT IN ('starter', 'pro', 'power') THEN
    RAISE EXCEPTION 'invalid plan_key: must be starter, pro, or power';
  END IF;

  IF p_daily <= 0 THEN
    RAISE EXCEPTION 'p_daily must be greater than 0';
  END IF;

  IF p_monthly < p_daily THEN
    RAISE EXCEPTION 'p_monthly must be >= p_daily';
  END IF;

  UPDATE public.token_plan_limits
  SET
    daily_token_limit   = p_daily::int,
    monthly_token_limit = p_monthly::int,
    updated_at          = now()
  WHERE plan_key = p_plan_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_key not found: %', p_plan_key;
  END IF;

  RETURN QUERY
    SELECT
      tpl.plan_key,
      tpl.daily_token_limit,
      tpl.monthly_token_limit,
      public.journal_storage_bytes_for_plan(tpl.plan_key) AS journal_storage_bytes,
      tpl.updated_at
    FROM public.token_plan_limits tpl
    WHERE tpl.plan_key = p_plan_key;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_token_plan_limits(text, bigint, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_token_plan_limits(text, bigint, bigint) TO authenticated;
