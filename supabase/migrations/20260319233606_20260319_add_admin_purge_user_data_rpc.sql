/*
  # Admin Purge User Data RPC

  ## Summary
  Adds a SECURITY DEFINER RPC that allows admins to permanently delete all data
  for a given user from every table EXCEPT the profiles table. After purging the
  data, the profile is soft-deleted (deleted_at stamped, is_disabled set to true)
  so the admin record is preserved.

  ## What Gets Deleted
  All rows where user_id = p_user_id from:
    - chat_threads (cascades to chat_messages automatically)
    - journal_entries
    - token_usage
    - token_usage_daily_rollup
    - mood_logs
    - mood_weekly_insights
    - user_memory
    - chip_stats
    - crisis_events
    - boundary_events
    - chat_signal_daily_agg
    - email_lifecycle_events
    - flight_recorder_events
    - chat_to_journal_logs

  ## What Is Kept
  - profiles row — soft-deleted (deleted_at = now(), is_disabled = true)

  ## Security
  - SECURITY DEFINER function
  - Admin-only: verified via is_admin() before any mutation
  - Granted to authenticated role only

  ## Important Notes
  1. This operation is IRREVERSIBLE — all user content is permanently removed.
  2. chat_messages are removed via ON DELETE CASCADE from chat_threads.
  3. The profiles row is intentionally preserved so admin audit history survives.
  4. This RPC replaces the previous soft-delete-only flow for the admin delete button.
*/

CREATE OR REPLACE FUNCTION public.admin_purge_user_data(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin(auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid())) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  -- Chat threads cascade-deletes chat_messages via FK ON DELETE CASCADE
  DELETE FROM public.chat_threads            WHERE user_id = p_user_id;
  DELETE FROM public.journal_entries         WHERE user_id = p_user_id;
  DELETE FROM public.token_usage             WHERE user_id = p_user_id;
  DELETE FROM public.token_usage_daily_rollup WHERE user_id = p_user_id;
  DELETE FROM public.mood_logs               WHERE user_id = p_user_id;
  DELETE FROM public.mood_weekly_insights    WHERE user_id = p_user_id;
  DELETE FROM public.user_memory             WHERE user_id = p_user_id;
  DELETE FROM public.chip_stats              WHERE user_id = p_user_id;
  DELETE FROM public.crisis_events           WHERE user_id = p_user_id;
  DELETE FROM public.boundary_events         WHERE user_id = p_user_id;
  DELETE FROM public.chat_signal_daily_agg   WHERE user_id = p_user_id;
  DELETE FROM public.email_lifecycle_events  WHERE user_id = p_user_id;
  DELETE FROM public.flight_recorder_events  WHERE user_id = p_user_id;
  DELETE FROM public.chat_to_journal_logs    WHERE user_id = p_user_id;

  -- Soft-delete the profile so the admin record survives
  UPDATE public.profiles
  SET
    deleted_at  = now(),
    is_disabled = true,
    updated_at  = now()
  WHERE id = p_user_id
    AND deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_purge_user_data(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_purge_user_data(uuid) TO authenticated;
