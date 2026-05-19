/*
  # Add admin_fetch_flight_events RPC

  Allows admins to fetch flight recorder events for any user,
  bypassing RLS via SECURITY DEFINER.

  Returns up to `p_limit` events for `p_user_id`, ordered newest first.
*/

CREATE OR REPLACE FUNCTION admin_fetch_flight_events(
  p_user_id uuid,
  p_limit   int DEFAULT 200
)
RETURNS TABLE (
  id           uuid,
  created_at   timestamptz,
  user_id      uuid,
  event_name   text,
  payload      jsonb,
  session_id   text,
  app_area     text
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
    fre.id,
    fre.created_at,
    fre.user_id,
    fre.event_name,
    fre.payload,
    fre.session_id,
    fre.app_area
  FROM flight_recorder_events fre
  WHERE fre.user_id = p_user_id
  ORDER BY fre.created_at DESC
  LIMIT p_limit;
END;
$$;
