/*
  # Crisis Events Retention

  ## Summary
  Adds a configurable retention window for crisis_events rows and a
  SECURITY DEFINER purge function that deletes rows older than the configured
  window. The retention period is stored in admin_settings so it can be
  changed without a code deployment.

  ## Changes

  ### admin_settings
  - Inserts key `crisis_events_retention_days` with default value `365`
  - Uses INSERT ... ON CONFLICT DO NOTHING so a re-run never overwrites
    a manually-set value.

  ### New Function: `purge_old_crisis_events()`
  - SECURITY DEFINER + SET search_path = public
  - Reads retention days from admin_settings (defaults to 365 if missing)
  - Deletes crisis_events rows where created_at < now() - retention_days
  - Returns the count of deleted rows as `deleted_count INT`

  ## Scheduling
  pg_cron is available on this Supabase instance but must be enabled via
  the Supabase dashboard (Database -> Extensions -> pg_cron) before the
  scheduled job can run. The companion edge function `purge-crisis-events`
  provides an HTTP-invokable alternative for Supabase Cron scheduling.

  ## Security
  - SECURITY DEFINER — runs as function owner, not the caller
  - REVOKE ALL from PUBLIC; GRANT to service_role only

  ## Important Notes
  1. To change the retention window:
       UPDATE admin_settings SET value = '180'
        WHERE key = 'crisis_events_retention_days';
  2. After enabling pg_cron, schedule the job with:
       SELECT cron.schedule('purge-crisis-events-daily','0 3 * * *',
         'SELECT purge_old_crisis_events()');
*/

-- ── 1. Retention setting ──────────────────────────────────────────────────────
INSERT INTO public.admin_settings (id, key, value, updated_at)
VALUES (gen_random_uuid(), 'crisis_events_retention_days', '365', now())
ON CONFLICT (key) DO NOTHING;

-- ── 2. Purge function ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.purge_old_crisis_events()
RETURNS TABLE (deleted_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_retention_days int;
  v_cutoff         timestamptz;
  v_deleted        int;
BEGIN
  SELECT COALESCE(NULLIF(TRIM(s.value), ''), '365')::int
    INTO v_retention_days
    FROM public.admin_settings s
   WHERE s.key = 'crisis_events_retention_days';

  IF v_retention_days IS NULL THEN
    v_retention_days := 365;
  END IF;

  v_cutoff := now() - (v_retention_days || ' days')::interval;

  WITH deleted AS (
    DELETE FROM public.crisis_events
     WHERE created_at < v_cutoff
    RETURNING id
  )
  SELECT COUNT(*)::int INTO v_deleted FROM deleted;

  RETURN QUERY SELECT v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_old_crisis_events() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_old_crisis_events() TO service_role;

-- ── 3. pg_cron schedule (skips silently if pg_cron schema not yet present) ────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.schemata WHERE schema_name = 'cron'
  ) THEN
    PERFORM cron.schedule(
      'purge-crisis-events-daily',
      '0 3 * * *',
      'SELECT purge_old_crisis_events()'
    );
    RAISE NOTICE 'pg_cron job scheduled at 03:00 UTC daily.';
  ELSE
    RAISE NOTICE 'pg_cron not available — enable it in the dashboard then call cron.schedule manually.';
  END IF;
END;
$$;
