/*
  # Fix admin_list_flight_recorder_users — email type mismatch

  auth.users.email is character varying, but the function declared email as text.
  PostgreSQL strict return type matching rejects this.
  Fix: cast u.email::text explicitly in the SELECT.
*/

DROP FUNCTION IF EXISTS admin_list_flight_recorder_users();

CREATE OR REPLACE FUNCTION admin_list_flight_recorder_users()
RETURNS TABLE (
  user_id                 uuid,
  email                   text,
  full_name               text,
  flight_recorder_enabled boolean,
  event_count             bigint,
  latest_event_at         timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin(
    auth.uid(),
    (SELECT au.email FROM auth.users au WHERE au.id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  SELECT
    p.id                               AS user_id,
    u.email::text                      AS email,
    p.full_name                        AS full_name,
    p.flight_recorder_enabled          AS flight_recorder_enabled,
    COUNT(fre.id)                      AS event_count,
    MAX(fre.created_at)                AS latest_event_at
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN flight_recorder_events fre ON fre.user_id = p.id
  WHERE p.deleted_at IS NULL
  GROUP BY p.id, u.email, p.full_name, p.flight_recorder_enabled
  ORDER BY p.flight_recorder_enabled DESC, MAX(fre.created_at) DESC NULLS LAST;
END;
$$;
