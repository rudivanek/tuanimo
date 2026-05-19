/*
  # Add plan_key parameter to admin_upsert_user_profile RPC

  ## Summary
  Updates the admin_upsert_user_profile function to accept an optional plan_key
  parameter so admins can assign a billing plan (starter / pro / power) to users
  from the Edit User modal.

  ## Changes
  - Drops and recreates admin_upsert_user_profile with new p_plan_key parameter
  - When p_plan_key is provided, profiles.plan_key is updated
  - tokens_allowed parameter kept for backwards-compatibility but no longer
    surfaced in the UI (DEPRECATED — lifetime cap removed, plan budgets are sole limiter)

  ## Notes
  - No data is lost; existing plan_key values are preserved if p_plan_key is NULL
  - GRANT on new signature is issued to authenticated role
*/

DROP FUNCTION IF EXISTS admin_upsert_user_profile(uuid, text, int, boolean, text, text);

CREATE FUNCTION admin_upsert_user_profile(
  p_user_id       uuid,
  p_full_name     text    DEFAULT NULL,
  p_tokens_allowed int   DEFAULT NULL,
  p_is_disabled   boolean DEFAULT NULL,
  p_first_name    text    DEFAULT NULL,
  p_last_name     text    DEFAULT NULL,
  p_plan_key      text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin(auth.uid(), (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  UPDATE profiles SET
    first_name     = COALESCE(p_first_name, first_name),
    last_name      = COALESCE(p_last_name, last_name),
    tokens_allowed = COALESCE(p_tokens_allowed, tokens_allowed),
    is_disabled    = COALESCE(p_is_disabled, is_disabled),
    plan_key       = COALESCE(p_plan_key, plan_key),
    updated_at     = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user_id: %', p_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_upsert_user_profile(uuid, text, int, boolean, text, text, text) TO authenticated;
