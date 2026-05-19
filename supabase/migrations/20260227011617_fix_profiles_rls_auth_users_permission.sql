/*
  # Fix profiles RLS: permission denied for table users

  ## Problem
  The admin RLS policies on the profiles table call:
    is_admin(auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()))

  The subquery runs as the authenticated user who does NOT have SELECT on auth.users,
  causing a 403 "permission denied for table users" on every profile fetch.

  ## Fix
  Create a SECURITY DEFINER helper function `get_my_email()` that looks up the
  current user's email inside a privileged context. Update all three admin
  policies on profiles to use this helper instead of the inline subquery.

  ## Changes
  - New function: public.get_my_email() RETURNS text SECURITY DEFINER
  - Updated policies on profiles table:
      "Admins can select all profiles"
      "Admins can update all profiles"
      "Admins can insert profiles"
*/

-- ── 1. Helper: returns the email of auth.uid() via SECURITY DEFINER ──────────

CREATE OR REPLACE FUNCTION public.get_my_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_email() TO authenticated;

-- ── 2. Rebuild admin policies to use the helper ───────────────────────────────

DROP POLICY IF EXISTS "Admins can select all profiles" ON profiles;
CREATE POLICY "Admins can select all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    is_admin(auth.uid(), get_my_email())
  );

DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    is_admin(auth.uid(), get_my_email())
  )
  WITH CHECK (
    is_admin(auth.uid(), get_my_email())
  );

DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin(auth.uid(), get_my_email())
  );
