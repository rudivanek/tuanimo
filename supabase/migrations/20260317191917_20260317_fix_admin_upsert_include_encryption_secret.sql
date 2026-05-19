/*
  # Fix admin_upsert_user_profile missing encryption_secret on INSERT

  The profiles table has encryption_secret NOT NULL with no default.
  When the admin function INSERTs a new profile row it was omitting
  encryption_secret, causing a NOT NULL violation.

  This replaces the function to generate encryption_secret (and enc_version)
  on INSERT, matching the handle_new_user trigger pattern.
  ON CONFLICT (existing rows) still only updates name/plan/disabled fields.
*/

CREATE OR REPLACE FUNCTION public.admin_upsert_user_profile(
  p_user_id     uuid,
  p_first_name  text    DEFAULT NULL,
  p_last_name   text    DEFAULT NULL,
  p_plan_key    text    DEFAULT NULL,
  p_is_disabled boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT is_admin(auth.uid(), (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  INSERT INTO profiles (
    id, first_name, last_name, plan_key, is_disabled,
    encryption_secret, enc_version,
    created_at, updated_at
  )
  VALUES (
    p_user_id,
    p_first_name,
    p_last_name,
    COALESCE(p_plan_key, 'starter'),
    COALESCE(p_is_disabled, false),
    encode(extensions.gen_random_bytes(32), 'base64'),
    2,
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
