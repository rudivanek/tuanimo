/*
  # Add plan_key to admin_list_users RPC

  ## Summary
  Updates admin_list_users to return the plan_key column from profiles,
  so the admin UI can read and display each user's assigned plan.

  ## Changes
  - Drops and recreates admin_list_users with plan_key added to RETURNS TABLE
  - plan_key is selected from profiles.plan_key
  - No other logic changes; all existing filters and ordering preserved

  ## Notes
  - tokens_allowed / tokens_used remain in the result for backwards-compatible
    display (TokenBar widget) but are no longer used for enforcement
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
  tokens_allowed bigint,
  tokens_used bigint,
  plan_key text,
  is_disabled boolean,
  is_admin_user boolean,
  deleted_at timestamptz,
  created_at timestamptz
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
    p.tokens_allowed::bigint,
    p.tokens_used::bigint,
    p.plan_key,
    p.is_disabled,
    p.is_admin AS is_admin_user,
    p.deleted_at,
    p.created_at
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
