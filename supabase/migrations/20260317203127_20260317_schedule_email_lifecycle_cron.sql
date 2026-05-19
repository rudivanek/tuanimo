/*
  # Schedule email-lifecycle edge function with pg_cron

  ## Summary
  Adds an hourly pg_cron job that calls the email-lifecycle edge function.
  This drives the 5-day onboarding sequence automatically without any manual triggers.

  ## Notes
  1. Runs every hour at minute 0 (e.g. 09:00, 10:00, 11:00...)
  2. The job is idempotent — safe to run multiple times per hour
  3. Safely removes any previous version of the job before scheduling
*/

DO $$
BEGIN
  PERFORM cron.unschedule('email-lifecycle-hourly');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'email-lifecycle-hourly',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/email-lifecycle',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body := '{}'::jsonb
    );
  $$
);
