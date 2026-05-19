/*
  # Schedule maintenance jobs with pg_cron

  ## Summary
  Enables the pg_cron extension and registers two daily cron jobs that call the
  existing PostgreSQL maintenance functions directly. This replaces the need for
  an external HTTP caller to trigger the edge functions and means no service-role
  key management is required inside the database.

  ## Approach
  Rather than calling the edge functions over HTTP (which would require storing the
  service role key or CRON_SECRET inside the database), the cron jobs call the
  underlying PostgreSQL RPCs directly:

  - `rollup_token_usage_for_day`    — already used by rollup-token-usage edge function
  - `rollup_token_usage_missing_days` — gap-fill, also called by the edge function
  - `purge_old_crisis_events`       — called by purge-crisis-events edge function

  The edge functions remain intact and callable manually or via external tooling.

  ## New Jobs

  | Job name                       | Schedule       | UTC time | What it calls                                                      |
  |-------------------------------|----------------|----------|--------------------------------------------------------------------|
  | `maintenance_rollup_tokens`   | `0 2 * * *`    | 02:00    | `rollup_token_usage_for_day(yesterday)` + gap-fill for 7 days     |
  | `maintenance_purge_crisis`    | `0 3 * * *`    | 03:00    | `purge_old_crisis_events()`                                        |

  ## New Functions

  - `public.cron_rollup_token_usage()` — wrapper that mirrors the edge function's
    guard logic (checks `admin_settings.token_rollup_enabled`) before running the
    rollup RPCs. Returns a JSONB result for logging in cron.job_run_details.

  - `public.cron_purge_crisis_events()` — thin wrapper that calls the purge RPC
    and returns a JSONB result.

  ## Safety
  - Both wrappers are idempotent: running twice in the same day is safe.
    `rollup_token_usage_for_day` uses INSERT ... ON CONFLICT DO UPDATE, so
    re-running only overwrites with the same data.
  - `purge_old_crisis_events` deletes rows older than the configured retention window,
    so re-running when nothing is expired is a no-op.
  - If the `token_rollup_enabled` admin_settings flag is set to 'false', the rollup
    job exits early with `{"skipped": true}` (same behaviour as the edge function).

  ## Extension Notes
  - pg_cron is schema-aware: all cron tables live in the `cron` schema.
  - Run history is available via `SELECT * FROM cron.job_run_details ORDER BY start_time DESC`.
  - Jobs survive database restarts; they are stored in `cron.job`.
*/

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Enable pg_cron
-- ────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Wrapper: token usage rollup
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cron_rollup_token_usage()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enabled      text;
  v_yesterday    date := (CURRENT_DATE - INTERVAL '1 day')::date;
  v_gap_rows     int  := 0;
  v_gap_detail   jsonb := '[]'::jsonb;
  v_gap_rec      record;
BEGIN
  SELECT value INTO v_enabled
  FROM public.admin_settings
  WHERE key = 'token_rollup_enabled';

  IF v_enabled IS DISTINCT FROM 'true' THEN
    RAISE LOG 'cron_rollup_token_usage: disabled by admin_settings, skipping';
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'token_rollup_enabled=false');
  END IF;

  PERFORM public.rollup_token_usage_for_day(v_yesterday);

  FOR v_gap_rec IN
    SELECT processed_day, raw_rows
    FROM public.rollup_token_usage_missing_days(7)
    WHERE processed_day <> v_yesterday
  LOOP
    v_gap_rows := v_gap_rows + 1;
    v_gap_detail := v_gap_detail || jsonb_build_object(
      'processed_day', v_gap_rec.processed_day,
      'raw_rows', v_gap_rec.raw_rows
    );
  END LOOP;

  IF v_gap_rows > 0 THEN
    RAISE LOG 'cron_rollup_token_usage: gap-fill recovered % day(s)', v_gap_rows;
  END IF;

  RETURN jsonb_build_object(
    'ok',            true,
    'primary_day',   v_yesterday,
    'gap_days_filled', v_gap_rows,
    'gap_detail',    v_gap_detail
  );
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'cron_rollup_token_usage: error: %', SQLERRM;
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Wrapper: crisis events purge
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cron_purge_crisis_events()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted int := 0;
  v_rec     record;
BEGIN
  SELECT deleted_count INTO v_rec FROM public.purge_old_crisis_events();
  v_deleted := COALESCE(v_rec.deleted_count, 0);
  RAISE LOG 'cron_purge_crisis_events: deleted % rows', v_deleted;
  RETURN jsonb_build_object('ok', true, 'deleted_count', v_deleted);
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'cron_purge_crisis_events: error: %', SQLERRM;
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Remove any pre-existing jobs with the same name (idempotent)
-- ────────────────────────────────────────────────────────────────────────────

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname IN ('maintenance_rollup_tokens', 'maintenance_purge_crisis');

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Schedule the jobs
-- ────────────────────────────────────────────────────────────────────────────

SELECT cron.schedule(
  'maintenance_rollup_tokens',
  '0 2 * * *',
  $job$SELECT public.cron_rollup_token_usage();$job$
);

SELECT cron.schedule(
  'maintenance_purge_crisis',
  '0 3 * * *',
  $job$SELECT public.cron_purge_crisis_events();$job$
);
