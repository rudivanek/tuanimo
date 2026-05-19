/*
  # Automatic Weekly Mood Insight Generation

  ## Summary
  Makes weekly mood insight generation automatic via a pg_cron job that fires
  every Monday at 04:00 UTC. This eliminates the dependency on users visiting
  the Insights page for insights to be generated.

  The existing user-triggered path (InsightsPage button) is fully preserved.

  ## Approach
  Because insight generation requires calling OpenAI (not possible from pure SQL),
  the pg_cron job uses `pg_net.http_post` to call the new `generate-weekly-insights`
  edge function. Auth uses the service role key stored in `admin_settings`.

  ## New Objects

  ### 1. Extension: pg_net
  Enables outbound HTTP calls from PostgreSQL, required for the cron-to-edge-function call.

  ### 2. Function: `get_users_needing_weekly_insight(p_week_start, p_week_end)`
  Returns user_ids that:
    - Have at least 1 mood_log entry in the given week window
    - Do NOT already have a mood_weekly_insights row for that week_start_date
  Used by the edge function to determine who needs a new auto-generated insight.

  ### 3. admin_settings rows
    - `weekly_insights_enabled`     = 'true'   — master on/off switch
    - `weekly_insights_service_key` = ''        — MUST be set to the Supabase service role key
                                                   (Dashboard > Project Settings > API > service_role)
  The cron job silently skips if the service key is empty or the switch is 'false'.

  ### 4. Function: `cron_generate_weekly_insights()`
  Thin pg_cron wrapper that:
    - Reads `weekly_insights_enabled` from admin_settings
    - Reads `weekly_insights_service_key` from admin_settings
    - If configured, dispatches a POST to the generate-weekly-insights edge function via pg_net
    - Returns JSONB result logged in cron.job_run_details

  ### 5. pg_cron job: `maintenance_weekly_insights`
  Schedule: `0 4 * * 1` — Every Monday at 04:00 UTC
  This fires after every week ends (Sunday night), processing the just-completed week.

  ## Eligibility Rules
  A user is eligible for auto-generation if:
    1. They have >= 1 mood_log row with local_date in [week_start, week_end)
    2. They do NOT have a mood_weekly_insights row for that week_start_date

  ## Idempotency
  - The edge function uses UPSERT with ignoreDuplicates=true on mood_weekly_insights
  - get_users_needing_weekly_insight filters out users who already have an insight
  - Running the cron job multiple times for the same week is safe: no duplicates created

  ## Manual Configuration Required
  After deployment, set the service role key in admin_settings:
    UPDATE public.admin_settings
    SET value = '<your-service-role-key>'
    WHERE key = 'weekly_insights_service_key';

  The service role key is found in: Supabase Dashboard > Project Settings > API > service_role secret
*/

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Enable pg_net for outbound HTTP from PostgreSQL
-- ────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_net;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. RPC: find users who need a weekly insight generated
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_users_needing_weekly_insight(
  p_week_start date,
  p_week_end   date
)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT ml.user_id
  FROM public.mood_logs ml
  WHERE ml.local_date >= p_week_start
    AND ml.local_date <  p_week_end
    AND NOT EXISTS (
      SELECT 1
      FROM public.mood_weekly_insights mwi
      WHERE mwi.user_id        = ml.user_id
        AND mwi.week_start_date = p_week_start
    );
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Admin settings: enable switch + service key placeholder
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO public.admin_settings (key, value)
VALUES
  ('weekly_insights_enabled',     'true'),
  ('weekly_insights_service_key', '')
ON CONFLICT (key) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Cron wrapper function
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cron_generate_weekly_insights()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enabled    text;
  v_svc_key    text;
  v_url        text := 'https://uoeuhxzwyanutdxqiemp.supabase.co/functions/v1/generate-weekly-insights';
  v_request_id bigint;
BEGIN
  SELECT value INTO v_enabled
  FROM public.admin_settings
  WHERE key = 'weekly_insights_enabled';

  IF v_enabled IS DISTINCT FROM 'true' THEN
    RAISE LOG 'cron_generate_weekly_insights: disabled by admin_settings, skipping';
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'weekly_insights_enabled=false');
  END IF;

  SELECT value INTO v_svc_key
  FROM public.admin_settings
  WHERE key = 'weekly_insights_service_key';

  IF v_svc_key IS NULL OR v_svc_key = '' THEN
    RAISE LOG 'cron_generate_weekly_insights: weekly_insights_service_key not configured, skipping';
    RETURN jsonb_build_object('ok', false, 'skipped', true, 'reason', 'service_key_not_configured');
  END IF;

  SELECT net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_svc_key
    ),
    body    := '{}'::jsonb
  ) INTO v_request_id;

  RAISE LOG 'cron_generate_weekly_insights: dispatched pg_net request_id=%', v_request_id;
  RETURN jsonb_build_object('ok', true, 'dispatched', true, 'request_id', v_request_id);

EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'cron_generate_weekly_insights: error: %', SQLERRM;
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Schedule the weekly cron job (remove existing first for idempotency)
-- ────────────────────────────────────────────────────────────────────────────

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'maintenance_weekly_insights';

SELECT cron.schedule(
  'maintenance_weekly_insights',
  '0 4 * * 1',
  $job$SELECT public.cron_generate_weekly_insights();$job$
);
