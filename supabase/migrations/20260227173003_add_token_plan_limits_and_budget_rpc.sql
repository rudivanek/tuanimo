/*
  # Token Plan Limits + Budget Enforcement RPC

  ## Summary
  Introduces plan-based token budgets (daily and monthly windows) as an
  enforceable cost guardrail. The `check_token_budget` SECURITY DEFINER
  function is the single gate called by every AI edge function before
  making an OpenAI API call.

  ## New Table: `token_plan_limits`
  Single source of truth for per-plan token budgets.
  | Column               | Type    | Description                              |
  |----------------------|---------|------------------------------------------|
  | plan_key             | text PK | 'starter' | 'pro' | 'power'              |
  | daily_token_limit    | int     | Max tokens per calendar day (UTC)        |
  | monthly_token_limit  | int     | Max tokens per calendar month (UTC)      |
  | updated_at           | tstz    | Last manual edit timestamp               |

  Seeded defaults:
  | plan     | daily   | monthly   |
  |----------|---------|-----------|
  | starter  |  50,000 |   500,000 |
  | pro      | 200,000 | 2,000,000 |
  | power    | 500,000 | 5,000,000 |

  ## New Function: `check_token_budget(p_user_id)`
  - SECURITY DEFINER + search_path = public
  - Reads user plan_key from profiles
  - Looks up daily/monthly limits from token_plan_limits
  - Sums token_usage for today (UTC) and current calendar month (UTC)
  - Returns:
      allowed         boolean   -- true = OK to call the model
      daily_used      int       -- tokens consumed today
      daily_limit     int       -- plan's daily cap
      monthly_used    int       -- tokens consumed this month
      monthly_limit   int       -- plan's monthly cap
      reason          text      -- 'OK' | 'DAILY_LIMIT_REACHED' | 'MONTHLY_LIMIT_REACHED'
  - Callable by: service_role (edge functions)

  ## Security
  - RLS enabled on token_plan_limits; only service_role can SELECT
    (plan limits are internal — users should not be able to read them directly)
  - check_token_budget is SECURITY DEFINER; REVOKE from PUBLIC
  - No user-facing data is exposed through these objects

  ## Notes
  1. To change a plan's budget:
       UPDATE token_plan_limits
          SET daily_token_limit = 100000, monthly_token_limit = 1000000,
              updated_at = now()
        WHERE plan_key = 'starter';
  2. Edge functions should treat a NULL result from check_token_budget
     as "allowed" (fail open) to avoid blocking users on DB errors.
  3. The existing flat tokens_allowed / tokens_used cap in profiles is
     preserved; check_token_budget is an additional windowed guard.
*/

-- ── 1. token_plan_limits table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.token_plan_limits (
  plan_key             text PRIMARY KEY,
  daily_token_limit    int  NOT NULL DEFAULT 50000,
  monthly_token_limit  int  NOT NULL DEFAULT 500000,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_token_plan_limits_plan_key
    CHECK (plan_key IN ('starter', 'pro', 'power')),
  CONSTRAINT chk_token_plan_limits_daily  CHECK (daily_token_limit   > 0),
  CONSTRAINT chk_token_plan_limits_monthly CHECK (monthly_token_limit > 0)
);

ALTER TABLE public.token_plan_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role can manage token_plan_limits"
  ON public.token_plan_limits
  FOR SELECT
  TO service_role
  USING (true);

-- ── 2. Seed plan budgets ──────────────────────────────────────────────────────
INSERT INTO public.token_plan_limits (plan_key, daily_token_limit, monthly_token_limit, updated_at)
VALUES
  ('starter',  50000,   500000,  now()),
  ('pro',      200000,  2000000, now()),
  ('power',    500000,  5000000, now())
ON CONFLICT (plan_key) DO NOTHING;

-- ── 3. check_token_budget RPC ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_token_budget(p_user_id uuid)
RETURNS TABLE (
  allowed        boolean,
  daily_used     int,
  daily_limit    int,
  monthly_used   int,
  monthly_limit  int,
  reason         text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_key       text;
  v_daily_limit    int;
  v_monthly_limit  int;
  v_daily_used     int;
  v_monthly_used   int;
  v_day_start      timestamptz;
  v_month_start    timestamptz;
BEGIN
  -- Get user's plan (default starter if profile missing)
  SELECT COALESCE(p.plan_key, 'starter')
    INTO v_plan_key
    FROM public.profiles p
   WHERE p.id = p_user_id;

  IF v_plan_key IS NULL THEN
    v_plan_key := 'starter';
  END IF;

  -- Get plan limits (fallback to starter defaults if plan row missing)
  SELECT tpl.daily_token_limit, tpl.monthly_token_limit
    INTO v_daily_limit, v_monthly_limit
    FROM public.token_plan_limits tpl
   WHERE tpl.plan_key = v_plan_key;

  IF v_daily_limit IS NULL THEN
    v_daily_limit   := 50000;
    v_monthly_limit := 500000;
  END IF;

  -- Time window boundaries (UTC)
  v_day_start   := date_trunc('day',   now() AT TIME ZONE 'UTC');
  v_month_start := date_trunc('month', now() AT TIME ZONE 'UTC');

  -- Compute daily usage
  SELECT COALESCE(SUM(tu.total_tokens), 0)::int
    INTO v_daily_used
    FROM public.token_usage tu
   WHERE tu.user_id    = p_user_id
     AND tu.created_at >= v_day_start;

  -- Compute monthly usage
  SELECT COALESCE(SUM(tu.total_tokens), 0)::int
    INTO v_monthly_used
    FROM public.token_usage tu
   WHERE tu.user_id    = p_user_id
     AND tu.created_at >= v_month_start;

  -- Enforce daily limit first
  IF v_daily_used >= v_daily_limit THEN
    RETURN QUERY SELECT
      false,
      v_daily_used,
      v_daily_limit,
      v_monthly_used,
      v_monthly_limit,
      'DAILY_LIMIT_REACHED'::text;
    RETURN;
  END IF;

  -- Enforce monthly limit
  IF v_monthly_used >= v_monthly_limit THEN
    RETURN QUERY SELECT
      false,
      v_daily_used,
      v_daily_limit,
      v_monthly_used,
      v_monthly_limit,
      'MONTHLY_LIMIT_REACHED'::text;
    RETURN;
  END IF;

  -- All clear
  RETURN QUERY SELECT
    true,
    v_daily_used,
    v_daily_limit,
    v_monthly_used,
    v_monthly_limit,
    'OK'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.check_token_budget(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_token_budget(uuid) TO service_role;

-- ── 4. Index to speed up daily/monthly aggregate queries ─────────────────────
CREATE INDEX IF NOT EXISTS token_usage_user_created_brin_idx
  ON public.token_usage USING brin (user_id, created_at);
