/*
  # Admin Access Control System

  ## Summary
  Creates a dedicated `app_admins` table that is the single source of truth for
  who is an admin, replaces the informal `profiles.is_admin` flag for access
  control decisions. Also adds an `is_admin()` SQL function callable via RPC.

  ## New Tables

  ### app_admins
  - `id` (uuid, PK) — surrogate key
  - `user_id` (uuid, nullable, FK → auth.users) — Supabase auth user; nullable
    so a record can be pre-seeded before the user signs up
  - `email` (text, nullable) — used for pre-seed / fallback lookup
  - `role` (text, not null, default 'admin') — 'admin' or 'super_admin'
  - `created_at` (timestamptz)

  Unique constraints: `user_id` (when not null), `email` (when not null)

  ## New Functions

  ### is_admin(p_uid uuid, p_email text) → boolean
  Returns true if a matching row exists in app_admins by user_id OR email
  (case-insensitive). Runs SECURITY DEFINER so any authenticated caller can
  invoke it safely.

  ## Security (RLS)

  - RLS enabled; default-deny.
  - SELECT: existing admins can read the table (needed for super_admin checks).
  - INSERT: super_admin OR one-time bootstrap (table empty + email = rfv@datago.net).
  - UPDATE/DELETE: super_admin only.

  ## Seed
  - Inserts `rfv@datago.net` with role `super_admin` directly (migration bypasses RLS).

  ## Notes
  1. Migration runs as DB owner → RLS is bypassed for the seed INSERT.
  2. After bootstrap the only way to add admins is via super_admin account.
  3. The `is_admin` function should be called via supabase.rpc('is_admin', ...).
*/

-- ============================================================
-- 1. TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS app_admins (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  email       text,
  role        text        NOT NULL DEFAULT 'admin',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Partial unique indexes (allow multiple NULLs but no duplicate non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS app_admins_user_id_unique
  ON app_admins (user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS app_admins_email_unique
  ON app_admins (lower(email))
  WHERE email IS NOT NULL;

-- ============================================================
-- 2. RLS
-- ============================================================
ALTER TABLE app_admins ENABLE ROW LEVEL SECURITY;

-- SELECT: any existing admin can read the table
CREATE POLICY "Admins can read app_admins"
  ON app_admins FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_admins a
      WHERE a.user_id = auth.uid()
    )
  );

-- INSERT: super_admin OR bootstrap (table empty + seeding rfv@datago.net)
CREATE POLICY "Super admins or bootstrap can insert app_admins"
  ON app_admins FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_admins a
      WHERE a.user_id = auth.uid() AND a.role = 'super_admin'
    )
    OR (
      lower(email) = 'rfv@datago.net'
      AND NOT EXISTS (SELECT 1 FROM app_admins)
    )
  );

-- UPDATE: super_admin only
CREATE POLICY "Super admins can update app_admins"
  ON app_admins FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_admins a
      WHERE a.user_id = auth.uid() AND a.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_admins a
      WHERE a.user_id = auth.uid() AND a.role = 'super_admin'
    )
  );

-- DELETE: super_admin only
CREATE POLICY "Super admins can delete app_admins"
  ON app_admins FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_admins a
      WHERE a.user_id = auth.uid() AND a.role = 'super_admin'
    )
  );

-- ============================================================
-- 3. is_admin() RPC FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin(p_uid uuid, p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_admins
    WHERE
      (user_id = p_uid AND p_uid IS NOT NULL)
      OR (lower(email) = lower(p_email) AND p_email IS NOT NULL AND p_email <> '')
  );
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION is_admin(uuid, text) TO authenticated;

-- ============================================================
-- 4. SEED — first super_admin (runs as DB owner, bypasses RLS)
-- ============================================================
INSERT INTO app_admins (email, role)
VALUES ('rfv@datago.net', 'super_admin')
ON CONFLICT DO NOTHING;
