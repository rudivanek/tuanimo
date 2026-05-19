/*
  # Add rollup admin settings and gap-fill RPC

  ## Summary
  Seeds three new admin_settings keys that control rollup scheduling and the
  safe-cutover threshold for admin reporting. Also adds a gap-fill RPC that
  can be called by the scheduled edge function or manually to recover from
  missed nightly runs.

  ## New admin_settings Keys

  | key                                      | default      | meaning                                                 |
  |------------------------------------------|--------------|---------------------------------------------------------|
  | token_rollup_enabled                     | true         | Master switch; false disables rollup writes + cutover   |
  | token_rollup_schedule_utc                | 0 3 * * *    | Cron expression (for documentation / edge fn reference) |
  | token_reports_use_rollup_threshold_rows  | 1000000      | Min token_usage rowcount before admin reports use rollup|

  ## New Function: rollup_token_usage_missing_days(p_days_back int DEFAULT 7)

  Iterates from (TODAY - p_days_back) to yesterday (T-1) and calls
  rollup_token_usage_for_day() for each day that has raw token_usage rows.
  Days with no activity are silently skipped.

  Returns TABLE(processed_day date, raw_rows bigint) — one row per day that
  was actually rolled up, so the caller can see exactly what was recovered.

  ### Idempotency
  rollup_token_usage_for_day uses INSERT ... ON CONFLICT DO UPDATE, so both
  functions are fully safe to re-run. A second call just re-computes the
  same aggregates and overwrites with the same (or updated) values.

  ## Security
  rollup_token_usage_missing_days is SECURITY DEFINER, restricted to service_role.
*/

-- ── 1. Seed admin_settings (safe, idempotent) ─────────────────────────────────
INSERT INTO public.admin_settings (key, value)
VALUES
  ('token_rollup_enabled',                    'true'),
  ('token_rollup_schedule_utc',               '0 3 * * *'),
  ('token_reports_use_rollup_threshold_rows', '1000000')
ON CONFLICT (key) DO NOTHING;

-- ── 2. Gap-fill RPC ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rollup_token_usage_missing_days(
  p_days_back int DEFAULT 7
)
RETURNS TABLE(processed_day date, raw_rows bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day       date;
  v_raw_count bigint;
BEGIN
  IF p_days_back < 1 OR p_days_back > 365 THEN
    RAISE EXCEPTION 'p_days_back must be between 1 and 365, got %', p_days_back;
  END IF;

  v_day := CURRENT_DATE - p_days_back;

  WHILE v_day < CURRENT_DATE LOOP
    SELECT COUNT(*) INTO v_raw_count
    FROM public.token_usage tu
    WHERE tu.created_at >= v_day::timestamptz
      AND tu.created_at <  (v_day + 1)::timestamptz;

    IF v_raw_count > 0 THEN
      PERFORM public.rollup_token_usage_for_day(v_day);
      processed_day := v_day;
      raw_rows      := v_raw_count;
      RETURN NEXT;
    END IF;

    v_day := v_day + 1;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.rollup_token_usage_missing_days(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rollup_token_usage_missing_days(int) TO service_role;

COMMENT ON FUNCTION public.rollup_token_usage_missing_days(int) IS
  'Gap-fill helper: rolls up the past p_days_back days (default 7) for any day '
  'that has raw token_usage rows but may have missed its nightly job. '
  'Idempotent — safe to call multiple times. Called by the rollup-token-usage '
  'edge function after the primary T-1 rollup.';
