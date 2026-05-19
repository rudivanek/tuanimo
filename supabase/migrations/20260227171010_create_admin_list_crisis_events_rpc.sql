/*
  # admin_list_crisis_events RPC

  ## Summary
  SECURITY DEFINER RPC that allows admins (and service_role) to query
  crisis_events with optional filters. Uses the canonical app_admins guard
  identical to admin_token_usage_report.

  ## New Function

  ### `admin_list_crisis_events(p_limit, p_offset, p_user_id, p_severity, p_source)`
  - p_limit    INT  DEFAULT 100  — max rows to return
  - p_offset   INT  DEFAULT 0    — pagination offset
  - p_user_id  UUID DEFAULT NULL — filter by specific user
  - p_severity TEXT DEFAULT NULL — filter by 'MAYBE' or 'YES'
  - p_source   TEXT DEFAULT NULL — filter by 'chat-ai'|'journal-prompts'|'mood-insights'

  Returns: id, user_id, user_label (email or uuid), source, severity,
           created_at, thread_id, message_id, session_id, model, meta
  Ordered by created_at DESC.

  ## Auth Guard (canonical pattern — matches all other admin RPCs)
  1. service_role JWT (auth.jwt() ->> 'role' = 'service_role') → ALLOW
  2. auth.uid() IS NULL without service_role → DENY
  3. Authenticated caller: must exist in app_admins by user_id OR email → ALLOW/DENY

  ## Security
  - SECURITY DEFINER + SET search_path = public
  - REVOKE from PUBLIC; GRANT EXECUTE to authenticated only
*/

CREATE OR REPLACE FUNCTION public.admin_list_crisis_events(
  p_limit    int     DEFAULT 100,
  p_offset   int     DEFAULT 0,
  p_user_id  uuid    DEFAULT NULL,
  p_severity text    DEFAULT NULL,
  p_source   text    DEFAULT NULL
)
RETURNS TABLE (
  id           uuid,
  user_id      uuid,
  user_label   text,
  source       text,
  severity     text,
  created_at   timestamptz,
  thread_id    uuid,
  message_id   uuid,
  session_id   uuid,
  model        text,
  meta         jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller       uuid;
  v_caller_email text;
  v_jwt_role     text;
BEGIN
  v_caller   := auth.uid();
  v_jwt_role := auth.jwt() ->> 'role';

  IF v_jwt_role = 'service_role' THEN
    NULL;

  ELSIF v_caller IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: admin access required';

  ELSE
    SELECT au.email::text INTO v_caller_email
    FROM auth.users au
    WHERE au.id = v_caller;

    IF NOT EXISTS (
      SELECT 1 FROM app_admins adm
      WHERE adm.user_id = v_caller
         OR (adm.email IS NOT NULL
             AND lower(adm.email::text) = lower(COALESCE(v_caller_email, '')))
    ) THEN
      RAISE EXCEPTION 'UNAUTHORIZED: admin access required';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    ce.id,
    ce.user_id,
    COALESCE(au.email::text, ce.user_id::text) AS user_label,
    ce.source,
    ce.severity,
    ce.created_at,
    ce.thread_id,
    ce.message_id,
    ce.session_id,
    ce.model,
    ce.meta
  FROM public.crisis_events ce
  LEFT JOIN auth.users au ON au.id = ce.user_id
  WHERE (p_user_id  IS NULL OR ce.user_id  = p_user_id)
    AND (p_severity IS NULL OR ce.severity = p_severity)
    AND (p_source   IS NULL OR ce.source   = p_source)
  ORDER BY ce.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_crisis_events(int, int, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_crisis_events(int, int, uuid, text, text) TO authenticated;
