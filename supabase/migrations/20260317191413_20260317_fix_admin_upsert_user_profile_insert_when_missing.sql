/*
  # Fix admin_upsert_user_profile — create profile row if missing

  ## Problem
  The function used a plain UPDATE and raised "Profile not found" when the
  profile row didn't exist (e.g. users who signed up but never completed
  onboarding, like rvanek@gmail.com).

  ## Fix
  Replace the UPDATE with INSERT ... ON CONFLICT DO UPDATE so it works
  whether or not a profile row already exists.
*/

CREATE OR REPLACE FUNCTION admin_upsert_user_profile(
  p_user_id    uuid,
  p_first_name text    DEFAULT NULL,
  p_last_name  text    DEFAULT NULL,
  p_plan_key   text    DEFAULT NULL,
  p_is_disabled boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin(auth.uid(), (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  INSERT INTO profiles (id, first_name, last_name, plan_key, is_disabled, created_at, updated_at)
  VALUES (
    p_user_id,
    p_first_name,
    p_last_name,
    COALESCE(p_plan_key, 'starter'),
    COALESCE(p_is_disabled, false),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name  = COALESCE(EXCLUDED.first_name,  profiles.first_name),
    last_name   = COALESCE(EXCLUDED.last_name,   profiles.last_name),
    is_disabled = COALESCE(p_is_disabled,         profiles.is_disabled),
    plan_key    = COALESCE(EXCLUDED.plan_key,     profiles.plan_key),
    updated_at  = now();
END;
$$;
