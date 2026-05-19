/*
  # Admin Reset User Data RPC + Audit Log

  ## Summary
  Adds two things:
  1. An `admin_actions_log` table for auditing admin actions (reset, purge, etc.)
  2. A `admin_reset_user_data(p_user_id uuid)` SECURITY DEFINER RPC that wipes all
     behavioral/historical data for a user while keeping their auth account and profile
     identity intact. After reset the user experiences the app exactly as a brand-new
     account.

  ## New Tables
  - `admin_actions_log`
    - id (uuid PK)
    - admin_id (uuid, FK → auth.users)
    - action_type (text) — e.g. 'reset_user'
    - target_user_id (uuid)
    - metadata (jsonb) — row-count summary of what was deleted
    - created_at (timestamptz)

  ## New Functions
  - `admin_reset_user_data(p_user_id uuid) → jsonb`
    Deletes all content rows for the user then resets lifecycle/billing profile fields
    to new-user defaults. Does NOT delete the profile row or auth.users row.

  ## Tables Cleared by Reset
  Content:
    - chat_threads (cascade-deletes chat_messages)
    - journal_entries
    - mood_logs
    - mood_weekly_insights
    - user_memory
    - chat_signal_daily_agg
  Token / billing:
    - token_usage
    - token_usage_daily_rollup
  Engagement:
    - chip_stats
  Safety / events:
    - crisis_events
    - boundary_events
    - email_lifecycle_events
    - flight_recorder_events
    - chat_to_journal_logs
    - journal_daily_usage

  ## Profile Fields Reset to New-User Defaults
    - cycle_start = now()
    - cycle_end = NULL
    - journal_storage_bytes_used = 0
    - sessions_count = 0
    - first_session_at = NULL
    - last_active_at = NULL
    - last_email_sent_at = NULL
    - last_email_type = NULL
    - email_sequence_status = 'active'
    - email_sequence_step = 0
    - lifecycle_started_at = NULL

  ## Security
  - SECURITY DEFINER — runs with function-owner privileges (bypasses RLS for deletes)
  - Admin-only: raises exception if caller is not an app admin
  - Granted to authenticated role only
  - admin_actions_log: RLS enabled, admins can read

  ## Important Notes
  1. Idempotent — safe to run multiple times; missing rows are a no-op.
  2. chat_messages are removed via ON DELETE CASCADE from chat_threads.
  3. journal_entries deleted before cascade would be an issue — chat_threads
     (which holds the FK reference) is deleted first so journal_entries can then
     be deleted cleanly.
  4. Returns a jsonb summary of deleted row counts.
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Audit log table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_actions_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type     text        NOT NULL,
  target_user_id  uuid        NOT NULL,
  metadata        jsonb       NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_actions_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS admin_actions_log_admin_id_idx
  ON public.admin_actions_log (admin_id);

CREATE INDEX IF NOT EXISTS admin_actions_log_target_user_id_idx
  ON public.admin_actions_log (target_user_id);

CREATE INDEX IF NOT EXISTS admin_actions_log_created_at_idx
  ON public.admin_actions_log (created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'admin_actions_log'
      AND policyname = 'Admins can read action log'
  ) THEN
    CREATE POLICY "Admins can read action log"
      ON public.admin_actions_log
      FOR SELECT
      TO authenticated
      USING (is_admin(auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid())));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. admin_reset_user_data RPC
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_reset_user_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_threads         int := 0;
  v_journal         int := 0;
  v_token_raw       int := 0;
  v_token_rollup    int := 0;
  v_mood            int := 0;
  v_mood_insights   int := 0;
  v_memory          int := 0;
  v_chips           int := 0;
  v_signals         int := 0;
  v_crisis          int := 0;
  v_boundary        int := 0;
  v_lifecycle       int := 0;
  v_flight          int := 0;
  v_c2j_logs        int := 0;
  v_journal_usage   int := 0;
BEGIN
  -- ── Auth check ──────────────────────────────────────────────────────────
  IF NOT is_admin(auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid())) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  -- ── Content data ─────────────────────────────────────────────────────────
  -- Delete chat_threads first; ON DELETE CASCADE removes chat_messages.
  DELETE FROM public.chat_threads WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_threads = ROW_COUNT;

  -- Now journal_entries (no more FK references from chat_threads)
  DELETE FROM public.journal_entries WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_journal = ROW_COUNT;

  DELETE FROM public.mood_logs WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_mood = ROW_COUNT;

  DELETE FROM public.mood_weekly_insights WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_mood_insights = ROW_COUNT;

  DELETE FROM public.user_memory WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_memory = ROW_COUNT;

  DELETE FROM public.chat_signal_daily_agg WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_signals = ROW_COUNT;

  -- ── Token / billing ───────────────────────────────────────────────────────
  DELETE FROM public.token_usage WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_token_raw = ROW_COUNT;

  DELETE FROM public.token_usage_daily_rollup WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_token_rollup = ROW_COUNT;

  -- ── Engagement ────────────────────────────────────────────────────────────
  DELETE FROM public.chip_stats WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_chips = ROW_COUNT;

  -- ── Safety / events ───────────────────────────────────────────────────────
  DELETE FROM public.crisis_events WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_crisis = ROW_COUNT;

  DELETE FROM public.boundary_events WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_boundary = ROW_COUNT;

  DELETE FROM public.email_lifecycle_events WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_lifecycle = ROW_COUNT;

  DELETE FROM public.flight_recorder_events WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_flight = ROW_COUNT;

  DELETE FROM public.chat_to_journal_logs WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_c2j_logs = ROW_COUNT;

  DELETE FROM public.journal_daily_usage WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_journal_usage = ROW_COUNT;

  -- ── Reset profile to new-user defaults ────────────────────────────────────
  UPDATE public.profiles
  SET
    cycle_start                = now(),
    cycle_end                  = NULL,
    journal_storage_bytes_used = 0,
    sessions_count             = 0,
    first_session_at           = NULL,
    last_active_at             = NULL,
    last_email_sent_at         = NULL,
    last_email_type            = NULL,
    email_sequence_status      = 'active',
    email_sequence_step        = 0,
    lifecycle_started_at       = NULL,
    updated_at                 = now()
  WHERE id = p_user_id;

  -- ── Audit log ─────────────────────────────────────────────────────────────
  INSERT INTO public.admin_actions_log (admin_id, action_type, target_user_id, metadata)
  VALUES (
    auth.uid(),
    'reset_user',
    p_user_id,
    jsonb_build_object(
      'deleted_chat_threads',     v_threads,
      'deleted_journal_entries',  v_journal,
      'deleted_token_rows',       v_token_raw + v_token_rollup,
      'deleted_mood_rows',        v_mood + v_mood_insights,
      'deleted_memory_rows',      v_memory,
      'deleted_chip_rows',        v_chips,
      'deleted_signal_rows',      v_signals,
      'deleted_crisis_rows',      v_crisis,
      'deleted_boundary_rows',    v_boundary,
      'deleted_lifecycle_rows',   v_lifecycle + v_c2j_logs + v_journal_usage,
      'deleted_flight_rows',      v_flight
    )
  );

  RETURN jsonb_build_object(
    'success',                  true,
    'deleted_chat_threads',     v_threads,
    'deleted_journal_entries',  v_journal,
    'deleted_token_rows',       v_token_raw + v_token_rollup,
    'deleted_mood_rows',        v_mood + v_mood_insights,
    'deleted_memory_rows',      v_memory,
    'deleted_signal_rows',      v_signals,
    'profile_reset',            true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_user_data(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_data(uuid) TO authenticated;
