/*
  # Scaffold: token_usage_daily_rollup + backfill RPC

  ## Summary
  Pre-aggregates raw token_usage rows into a compact daily summary keyed by
  (user_id, rollup_day, operation, model). This table is NOT yet used by any
  production query — it is scaffolded now so the backfill RPC can be tested
  and wired in when the raw table reaches ~1M rows.

  ## When to switch
  - token_usage approaches 1-5M rows (check with: SELECT COUNT(*) FROM token_usage)
  - admin_token_cost_report EXPLAIN shows rows > 100k in a 30-day window
  - At that point, replace the FROM token_usage scan in admin RPCs with
    a GROUP BY on token_usage_daily_rollup

  ## New Table: token_usage_daily_rollup
  | Column            | Type           | Description                              |
  |-------------------|----------------|------------------------------------------|
  | user_id           | uuid           | FK → auth.users(id)                      |
  | rollup_day        | date           | UTC calendar day                         |
  | operation         | text           | Feature name (chat, journal_prompts, ...) |
  | model             | text           | OpenAI model (gpt-4o, gpt-4o-mini, ...)  |
  | calls             | int            | Number of API calls in this bucket       |
  | prompt_tokens     | int            | Sum of prompt tokens                     |
  | completion_tokens | int            | Sum of completion tokens                 |
  | total_tokens      | int            | Sum of total tokens                      |
  | cost_usd          | numeric(18,8)  | Pre-computed USD cost                    |
  | updated_at        | timestamptz    | Last rollup timestamp for this bucket    |
  PRIMARY KEY: (user_id, rollup_day, operation, model)

  ## New Function: rollup_token_usage_for_day(p_day)
  - Called by: service_role (admin cron or manual backfill)
  - Uses INSERT ... ON CONFLICT DO UPDATE (upsert) — safe to re-run
  - p_day = date to aggregate (can be any past day, including today)
  - Returns void

  ## New Function: rollup_token_usage_range(p_from, p_to)
  - Iterates p_from..p_to inclusive, calling rollup for each day
  - Useful for initial backfill of historical data

  ## Security
  - RLS enabled; no user-facing policies (internal table)
  - service_role bypasses RLS for all writes
  - Admin reads should go through admin RPCs, not direct table access

  ## Notes
  1. The rollup is not automatically populated — an admin must call
     rollup_token_usage_for_day(yesterday) daily (e.g. via pg_cron or edge function).
  2. Today's data must still be read from raw token_usage (rollup is T-1).
  3. Cost formula matches admin_token_cost_report exactly.
  4. Primary key ensures at most one row per (user, day, operation, model) bucket.
*/

-- ── 1. Rollup table ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.token_usage_daily_rollup (
  user_id            uuid           NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rollup_day         date           NOT NULL,
  operation          text           NOT NULL,
  model              text           NOT NULL,
  calls              int            NOT NULL DEFAULT 0,
  prompt_tokens      int            NOT NULL DEFAULT 0,
  completion_tokens  int            NOT NULL DEFAULT 0,
  total_tokens       int            NOT NULL DEFAULT 0,
  cost_usd           numeric(18, 8) NOT NULL DEFAULT 0,
  updated_at         timestamptz    NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, rollup_day, operation, model),
  CONSTRAINT chk_rollup_calls  CHECK (calls           >= 0),
  CONSTRAINT chk_rollup_tokens CHECK (total_tokens    >= 0)
);

ALTER TABLE public.token_usage_daily_rollup ENABLE ROW LEVEL SECURITY;

-- Admin-only read policy (no public read)
CREATE POLICY "service_role can manage token_usage_daily_rollup"
  ON public.token_usage_daily_rollup
  FOR SELECT
  TO service_role
  USING (true);

-- Indexes for rollup queries
CREATE INDEX IF NOT EXISTS token_usage_daily_rollup_day_idx
  ON public.token_usage_daily_rollup (rollup_day DESC);

CREATE INDEX IF NOT EXISTS token_usage_daily_rollup_user_day_idx
  ON public.token_usage_daily_rollup (user_id, rollup_day DESC)
  INCLUDE (total_tokens, cost_usd, calls);

CREATE INDEX IF NOT EXISTS token_usage_daily_rollup_operation_day_idx
  ON public.token_usage_daily_rollup (operation, rollup_day DESC)
  INCLUDE (total_tokens, cost_usd, calls);

-- ── 2. Single-day rollup RPC ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rollup_token_usage_for_day(p_day date)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.token_usage_daily_rollup
    (user_id, rollup_day, operation, model,
     calls, prompt_tokens, completion_tokens, total_tokens, cost_usd,
     updated_at)
  SELECT
    tu.user_id,
    p_day                                                         AS rollup_day,
    tu.operation,
    tu.model,
    COUNT(*)::int                                                 AS calls,
    SUM(tu.prompt_tokens)::int                                    AS prompt_tokens,
    SUM(tu.completion_tokens)::int                                AS completion_tokens,
    SUM(tu.total_tokens)::int                                     AS total_tokens,
    SUM(
      CASE tu.model
        WHEN 'gpt-4o' THEN
          (tu.prompt_tokens * 5.0 + tu.completion_tokens * 15.0) / 1000000.0
        WHEN 'gpt-4o-mini' THEN
          (tu.prompt_tokens * 0.15 + tu.completion_tokens * 0.60) / 1000000.0
        ELSE tu.total_tokens * 5.0 / 1000000.0
      END
    )::numeric(18, 8)                                             AS cost_usd,
    now()                                                         AS updated_at
  FROM public.token_usage tu
  WHERE tu.created_at >= p_day::timestamptz
    AND tu.created_at <  (p_day + 1)::timestamptz
  GROUP BY tu.user_id, tu.operation, tu.model
  ON CONFLICT (user_id, rollup_day, operation, model) DO UPDATE SET
    calls             = EXCLUDED.calls,
    prompt_tokens     = EXCLUDED.prompt_tokens,
    completion_tokens = EXCLUDED.completion_tokens,
    total_tokens      = EXCLUDED.total_tokens,
    cost_usd          = EXCLUDED.cost_usd,
    updated_at        = now();
$$;

REVOKE ALL ON FUNCTION public.rollup_token_usage_for_day(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rollup_token_usage_for_day(date) TO service_role;

-- ── 3. Range backfill RPC ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rollup_token_usage_range(p_from date, p_to date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day date := p_from;
BEGIN
  WHILE v_day <= p_to LOOP
    PERFORM public.rollup_token_usage_for_day(v_day);
    v_day := v_day + 1;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.rollup_token_usage_range(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rollup_token_usage_range(date, date) TO service_role;

COMMENT ON TABLE public.token_usage_daily_rollup IS
  'Daily pre-aggregation of token_usage by (user, day, operation, model). '
  'Scaffold only — not yet used by production RPCs. Switch admin RPCs to '
  'use this table when raw token_usage exceeds ~1M rows. '
  'Populate with: SELECT rollup_token_usage_range(''2024-01-01'', yesterday::date);';
