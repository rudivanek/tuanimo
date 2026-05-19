/*
  # Admin Users Module

  ## Summary
  Adds full admin user management capabilities: profile fields for display name,
  disable/soft-delete flags, and secure server-side RPC functions that admins
  can call to list and manage all users.

  ## Changes to existing tables

  ### profiles
  - `full_name` (text, default '') — display name
  - `is_disabled` (boolean, default false) — account disabled flag
  - `deleted_at` (timestamptz, nullable) — soft delete timestamp

  ## New RLS policies on profiles
  - Admins can SELECT all non-deleted profiles
  - Admins can UPDATE all profiles
  - Admins can INSERT new profile rows (for manual user creation)

  ## New RPC Functions (all SECURITY DEFINER, admin-only)

  ### admin_list_users(p_search, p_include_deleted)
  Returns enriched user rows joining profiles + auth.users for email.

  ### admin_upsert_user_profile(p_user_id, p_full_name, p_tokens_allowed, p_is_disabled)
  Updates mutable profile fields for any user.

  ### admin_soft_delete_user(p_user_id)
  Sets deleted_at = now() and is_disabled = true.

  ### admin_insert_profile(p_user_id, p_full_name, p_tokens_allowed)
  Creates a new profile row for an existing auth user (by UUID) if one doesn't exist.

  ## Security
  - All RPCs check is_admin() before executing; raise exception on unauthorized access.
  - RLS admin policies use is_admin() helper.
  - Non-admin users retain their existing self-only access.

  ## Notes
  1. Soft delete is preferred over hard delete to preserve referential integrity.
  2. email is read from auth.users at query time inside SECURITY DEFINER functions.
  3. No changes to existing user self-access policies.
*/

-- ============================================================
-- 1. ADD COLUMNS TO PROFILES
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN full_name text NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_disabled'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_disabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;

-- ============================================================
-- 2. ADMIN RLS POLICIES ON PROFILES
-- ============================================================

DROP POLICY IF EXISTS "Admins can select all profiles" ON profiles;
CREATE POLICY "Admins can select all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    is_admin(auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()))
  );

DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    is_admin(auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()))
  )
  WITH CHECK (
    is_admin(auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()))
  );

DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin(auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()))
  );

-- ============================================================
-- 3. admin_list_users RPC
-- ============================================================

CREATE OR REPLACE FUNCTION admin_list_users(
  p_search text DEFAULT NULL,
  p_include_deleted boolean DEFAULT false
)
RETURNS TABLE(
  id uuid,
  email text,
  full_name text,
  tokens_allowed bigint,
  tokens_used bigint,
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
    p.tokens_allowed::bigint,
    p.tokens_used::bigint,
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
    )
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_list_users(text, boolean) TO authenticated;

-- ============================================================
-- 4. admin_upsert_user_profile RPC
-- ============================================================

CREATE OR REPLACE FUNCTION admin_upsert_user_profile(
  p_user_id uuid,
  p_full_name text DEFAULT NULL,
  p_tokens_allowed int DEFAULT NULL,
  p_is_disabled boolean DEFAULT NULL
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
    full_name      = COALESCE(p_full_name, full_name),
    tokens_allowed = COALESCE(p_tokens_allowed, tokens_allowed),
    is_disabled    = COALESCE(p_is_disabled, is_disabled),
    updated_at     = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user_id: %', p_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_upsert_user_profile(uuid, text, int, boolean) TO authenticated;

-- ============================================================
-- 5. admin_soft_delete_user RPC
-- ============================================================

CREATE OR REPLACE FUNCTION admin_soft_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin(auth.uid(), (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  UPDATE profiles SET
    deleted_at  = now(),
    is_disabled = true,
    updated_at  = now()
  WHERE id = p_user_id AND deleted_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_soft_delete_user(uuid) TO authenticated;

-- ============================================================
-- 6. admin_insert_profile RPC
-- ============================================================

CREATE OR REPLACE FUNCTION admin_insert_profile(
  p_user_id uuid,
  p_full_name text DEFAULT '',
  p_tokens_allowed int DEFAULT 100000
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

  INSERT INTO profiles (id, full_name, tokens_allowed)
  VALUES (p_user_id, p_full_name, p_tokens_allowed)
  ON CONFLICT (id) DO UPDATE SET
    full_name      = EXCLUDED.full_name,
    tokens_allowed = EXCLUDED.tokens_allowed,
    updated_at     = now();
END;
$$;

GRANT EXECUTE ON FUNCTION admin_insert_profile(uuid, text, int) TO authenticated;
