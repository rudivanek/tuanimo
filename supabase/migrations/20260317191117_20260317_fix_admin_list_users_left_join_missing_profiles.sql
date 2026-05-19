/*
  # Fix admin_list_users — show users with no profile row

  ## Problem
  The RPC used INNER JOIN between profiles and auth.users, so any user
  who exists in auth.users but has no matching row in profiles (e.g. rvanek@gmail.com)
  was silently excluded from the list.

  ## Fix
  Switch to LEFT JOIN and use COALESCE to provide safe fallback values for
  all profile columns when the profile row is missing.
*/

CREATE OR REPLACE FUNCTION admin_list_users(
  p_search        text    DEFAULT NULL,
  p_include_deleted boolean DEFAULT false
)
RETURNS TABLE (
  id                      uuid,
  email                   text,
  full_name               text,
  first_name              text,
  last_name               text,
  plan_key                text,
  is_disabled             boolean,
  is_admin_user           boolean,
  deleted_at              timestamptz,
  created_at              timestamptz,
  flight_recorder_enabled boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin(auth.uid(), (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  SELECT
    au.id,
    au.email::text,
    COALESCE(p.full_name, '')                     AS full_name,
    p.first_name,
    p.last_name,
    COALESCE(p.plan_key, 'starter')               AS plan_key,
    COALESCE(p.is_disabled, false)                AS is_disabled,
    COALESCE(p.is_admin, false)                   AS is_admin_user,
    p.deleted_at,
    COALESCE(p.created_at, au.created_at)         AS created_at,
    COALESCE(p.flight_recorder_enabled, false)    AS flight_recorder_enabled
  FROM auth.users au
  LEFT JOIN profiles p ON p.id = au.id
  WHERE
    (p_include_deleted OR p.deleted_at IS NULL)
    AND (
      p_search IS NULL
      OR p_search = ''
      OR au.email ILIKE '%' || p_search || '%'
      OR p.full_name ILIKE '%' || p_search || '%'
      OR p.first_name ILIKE '%' || p_search || '%'
      OR p.last_name ILIKE '%' || p_search || '%'
    )
  ORDER BY COALESCE(p.created_at, au.created_at) DESC;
END;
$$;
