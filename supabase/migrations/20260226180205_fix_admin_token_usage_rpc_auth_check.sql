/*
  # Fix admin check in token usage report RPCs

  ## Problem
  The original admin_token_usage_report and admin_list_users_with_usage functions
  only checked app_admins.user_id = auth.uid(). However, the seeded super_admin
  row may have user_id = NULL (only email set). The is_admin() function correctly
  checks BOTH user_id AND email — this migration mirrors that same logic.

  ## Fix
  Update the admin check in both functions to:
    EXISTS (
      SELECT 1 FROM app_admins
      WHERE user_id = auth.uid()
         OR lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    )

  This matches how is_admin(p_uid, p_email) works.
*/

CREATE OR REPLACE FUNCTION admin_token_usage_report(
  p_date_from  date,
  p_date_until date,
  p_user_id    uuid DEFAULT NULL
)
RETURNS TABLE (
  user_id        uuid,
  user_label     text,
  usage_date     date,
  total_tokens   bigint,
  total_cost_usd numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_email text;
BEGIN
  SELECT email INTO v_caller_email FROM auth.users WHERE id = auth.uid();

  IF NOT EXISTS (
    SELECT 1 FROM app_admins
    WHERE user_id = auth.uid()
       OR (email IS NOT NULL AND lower(email) = lower(v_caller_email))
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    tu.user_id,
    COALESCE(au.email, tu.user_id::text)            AS user_label,
    date_trunc('day', tu.created_at)::date          AS usage_date,
    SUM(tu.total_tokens)::bigint                    AS total_tokens,
    SUM(
      CASE tu.model
        WHEN 'gpt-4o' THEN
          (tu.prompt_tokens     * 5.0   +
           tu.completion_tokens * 15.0) / 1000000.0
        WHEN 'gpt-4o-mini' THEN
          (tu.prompt_tokens     * 0.15  +
           tu.completion_tokens * 0.60) / 1000000.0
        ELSE
          tu.total_tokens * 5.0 / 1000000.0
      END
    )::numeric(18, 8)                               AS total_cost_usd
  FROM token_usage tu
  LEFT JOIN auth.users au ON au.id = tu.user_id
  WHERE
    tu.created_at >= p_date_from::timestamptz
    AND tu.created_at <  (p_date_until + INTERVAL '1 day')
    AND (p_user_id IS NULL OR tu.user_id = p_user_id)
  GROUP BY
    tu.user_id,
    au.email,
    date_trunc('day', tu.created_at)::date
  ORDER BY
    usage_date DESC,
    user_label  ASC;
END;
$$;

CREATE OR REPLACE FUNCTION admin_list_users_with_usage()
RETURNS TABLE (
  user_id    uuid,
  user_label text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_email text;
BEGIN
  SELECT email INTO v_caller_email FROM auth.users WHERE id = auth.uid();

  IF NOT EXISTS (
    SELECT 1 FROM app_admins
    WHERE user_id = auth.uid()
       OR (email IS NOT NULL AND lower(email) = lower(v_caller_email))
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT DISTINCT
    tu.user_id,
    COALESCE(au.email, tu.user_id::text) AS user_label
  FROM token_usage tu
  LEFT JOIN auth.users au ON au.id = tu.user_id
  ORDER BY user_label ASC;
END;
$$;
