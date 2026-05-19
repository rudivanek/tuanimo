/*
  # Weekly Insights Cron: Switch to DB-generated passphrase auth

  ## Summary
  Replaces the empty `weekly_insights_service_key` placeholder with a proper
  cron passphrase pattern. A UUID is generated once at migration time and stored
  in `admin_settings`. The cron SQL wrapper reads this passphrase and passes it
  as an `x-cron-passphrase` header to the edge function. The edge function
  validates it using its own service role client — no manual secret configuration
  required.

  ## Changes
  - Removes the `weekly_insights_service_key` admin_settings row (no longer needed)
  - Inserts `weekly_insights_cron_passphrase` with a freshly generated UUID
  - Recreates `cron_generate_weekly_insights()` to use passphrase instead of service key
  - Reschedules the pg_cron job (same Monday 04:00 UTC schedule)

  ## Security
  The passphrase is a random UUID stored in admin_settings. Only postgres superusers
  can read admin_settings via SQL. The edge function validates the passphrase by
  reading admin_settings using its own service role key (env var). This avoids
  storing the service role key anywhere in the database.
*/

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Remove the old service-key placeholder row
-- ────────────────────────────────────────────────────────────────────────────

DELETE FROM public.admin_settings WHERE key = 'weekly_insights_service_key';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Insert a generated passphrase (idempotent — only inserts if missing)
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO public.admin_settings (key, value)
VALUES ('weekly_insights_cron_passphrase', gen_random_uuid()::text)
ON CONFLICT (key) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Recreate the cron wrapper using the passphrase
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cron_generate_weekly_insights()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enabled    text;
  v_passphrase text;
  v_url        text := 'https://uoeuhxzwyanutdxqiemp.supabase.co/functions/v1/generate-weekly-insights';
  v_request_id bigint;
BEGIN
  SELECT value INTO v_enabled
  FROM public.admin_settings
  WHERE key = 'weekly_insights_enabled';

  IF v_enabled IS DISTINCT FROM 'true' THEN
    RAISE LOG 'cron_generate_weekly_insights: disabled, skipping';
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'weekly_insights_enabled=false');
  END IF;

  SELECT value INTO v_passphrase
  FROM public.admin_settings
  WHERE key = 'weekly_insights_cron_passphrase';

  IF v_passphrase IS NULL OR v_passphrase = '' THEN
    RAISE LOG 'cron_generate_weekly_insights: passphrase not set, skipping';
    RETURN jsonb_build_object('ok', false, 'skipped', true, 'reason', 'passphrase_not_configured');
  END IF;

  SELECT net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',       'application/json',
      'x-cron-passphrase',  v_passphrase
    ),
    body    := '{}'::jsonb
  ) INTO v_request_id;

  RAISE LOG 'cron_generate_weekly_insights: dispatched request_id=%', v_request_id;
  RETURN jsonb_build_object('ok', true, 'dispatched', true, 'request_id', v_request_id);

EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'cron_generate_weekly_insights: error: %', SQLERRM;
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Reschedule (remove then re-add for idempotency)
-- ────────────────────────────────────────────────────────────────────────────

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'maintenance_weekly_insights';

SELECT cron.schedule(
  'maintenance_weekly_insights',
  '0 4 * * 1',
  $job$SELECT public.cron_generate_weekly_insights();$job$
);
