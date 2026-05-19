/*
  # Drop deprecated token columns and update affected RPCs

  ## Summary
  Removes the legacy `tokens_allowed` and `tokens_used` columns from the `profiles`
  table. These columns were the original flat-cap token system and have been superseded
  by the plan-based system (`token_plan_limits`, `token_usage`, `check_token_budget`).
  No runtime code reads or writes these columns for enforcement.

  ## Changes

  ### 1. Drop deprecated columns
  - `profiles.tokens_allowed` — removed (was: monthly flat cap, never enforced)
  - `profiles.tokens_used`    — removed (was: lifetime counter, never enforced)

  ### 2. Recreate admin_list_users (without legacy columns)
  - Removes `tokens_allowed` and `tokens_used` from RETURNS TABLE and SELECT

  ### 3. Recreate admin_upsert_user_profile (without p_tokens_allowed)
  - Removes `p_tokens_allowed` param and `tokens_allowed =` assignment from UPDATE

  ### 4. Recreate admin_insert_profile (without p_tokens_allowed)
  - Removes `p_tokens_allowed` param; INSERT no longer sets these columns

  ### 5. Drop increment_tokens_used RPC
  - Was used to atomically increment profiles.tokens_used; now dead code

  ## Security
  - No RLS changes; profiles RLS is unaffected by column removal
  - All RPCs remain SECURITY DEFINER with admin guard intact

  ## Important Notes
  - Budget enforcement is UNCHANGED: check_token_budget → token_plan_limits + token_usage
  - These column drops are safe because IF EXISTS guards are used
*/

-- ============================================================
-- 1. Drop the deprecated columns
-- ============================================================

ALTER TABLE profiles
  DROP COLUMN IF EXISTS tokens_allowed,
  DROP COLUMN IF EXISTS tokens_used;

-- ============================================================
-- 2. Recreate admin_list_users without the legacy columns
-- ============================================================

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

-- ============================================================
-- 3. Recreate admin_upsert_user_profile without p_tokens_allowed
-- ============================================================

DROP FUNCTION IF EXISTS admin_upsert_user_profile(uuid, text, int, boolean, text, text, text);
DROP FUNCTION IF EXISTS admin_upsert_user_profile(uuid, text, int, boolean, text, text);

CREATE FUNCTION admin_upsert_user_profile(
  p_user_id    uuid,
  p_full_name  text    DEFAULT NULL,
  p_is_disabled boolean DEFAULT NULL,
  p_first_name text    DEFAULT NULL,
  p_last_name  text    DEFAULT NULL,
  p_plan_key   text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin(auth.uid(), (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  UPDATE profiles SET
    first_name  = COALESCE(p_first_name, first_name),
    last_name   = COALESCE(p_last_name, last_name),
    is_disabled = COALESCE(p_is_disabled, is_disabled),
    plan_key    = COALESCE(p_plan_key, plan_key),
    updated_at  = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user_id: %', p_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_upsert_user_profile(uuid, text, boolean, text, text, text) TO authenticated;

-- ============================================================
-- 4. Recreate admin_insert_profile without p_tokens_allowed
-- ============================================================

DROP FUNCTION IF EXISTS admin_insert_profile(uuid, text, int);

CREATE OR REPLACE FUNCTION admin_insert_profile(
  p_user_id  uuid,
  p_full_name text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin(auth.uid(), (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'No auth user found with id: %', p_user_id;
  END IF;

  INSERT INTO profiles (id, full_name)
  VALUES (p_user_id, p_full_name)
  ON CONFLICT (id) DO UPDATE SET
    full_name  = EXCLUDED.full_name,
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION admin_insert_profile(uuid, text) TO authenticated;

-- ============================================================
-- 5. Drop increment_tokens_used (dead code after column removal)
-- ============================================================

DROP FUNCTION IF EXISTS public.increment_tokens_used(uuid, int);
DROP FUNCTION IF EXISTS public.increment_tokens_used(uuid, bigint);
