/*
  # Fix admin_list_users: remove deprecated token columns

  ## Summary
  The profiles table no longer has tokens_allowed / tokens_used columns.
  This migration drops and recreates admin_list_users without those columns.

  ## Changes
  - Removes tokens_allowed and tokens_used from RETURNS TABLE and SELECT
  - Preserves all other columns including the new flight_recorder_enabled
*/

DROP FUNCTION IF EXISTS admin_list_users(text, boolean);

CREATE FUNCTION admin_list_users(
  p_search text DEFAULT NULL,
  p_include_deleted boolean DEFAULT false
)
RETURNS TABLE(
  id uuid,
  email text,
  full_name text,
  first_name text,
  last_name text,
  plan_key text,
  is_disabled boolean,
  is_admin_user boolean,
  deleted_at timestamptz,
  created_at timestamptz,
  flight_recorder_enabled boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  IF NOT is_admin(auth.uid(), (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    au.email::text,
    p.full_name,
    p.first_name,
    p.last_name,
    p.plan_key,
    p.is_disabled,
    p.is_admin AS is_admin_user,
    p.deleted_at,
    p.created_at,
    p.flight_recorder_enabled
  FROM profiles p
  JOIN auth.users au ON au.id = p.id
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
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_list_users(text, boolean) TO authenticated;
