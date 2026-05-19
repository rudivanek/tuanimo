/*
  # Drop old admin_upsert_user_profile overload

  Removes the legacy overload that included p_full_name, which caused
  "could not choose best candidate function" ambiguity errors.
*/

DROP FUNCTION IF EXISTS public.admin_upsert_user_profile(
  p_user_id uuid,
  p_full_name text,
  p_is_disabled boolean,
  p_first_name text,
  p_last_name text,
  p_plan_key text
);
