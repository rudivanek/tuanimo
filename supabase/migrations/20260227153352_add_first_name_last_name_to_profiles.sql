/*
  # Split profiles.full_name into first_name + last_name

  ## Summary
  Adds separate first_name and last_name columns to the profiles table, backfills
  them from the existing full_name column, and installs a trigger that keeps full_name
  automatically in sync whenever first_name or last_name is written. RPC functions
  used by the admin panel are updated to expose and accept the new fields.

  ## New columns on profiles
  - `first_name` (text, nullable) — first/given name, max 80 chars
  - `last_name`  (text, nullable) — last/family name, max 120 chars

  ## Backfill logic
  For every row where full_name is non-empty:
  - first_name = first whitespace-delimited token
  - last_name  = everything after the first token (trimmed); NULL if empty

  ## Trigger: trg_sync_full_name
  Runs BEFORE INSERT OR UPDATE OF first_name, last_name on profiles.
  Sets full_name = concat_ws(' ', first_name, last_name) whenever either
  name part is non-NULL so full_name stays accurate for legacy code.

  ## Updated RPC functions
  - admin_list_users    — now also returns first_name, last_name columns
  - admin_upsert_user_profile — now accepts p_first_name, p_last_name in addition
    to p_full_name (kept for backward compatibility)

  ## Security
  - No RLS changes; existing policies remain intact.
  - Columns are nullable (no NOT NULL constraint) to avoid breaking existing rows.
*/

-- ============================================================
-- 1. ADD COLUMNS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'first_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN first_name text
      CONSTRAINT profiles_first_name_length CHECK (char_length(first_name) <= 80);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_name text
      CONSTRAINT profiles_last_name_length CHECK (char_length(last_name) <= 120);
  END IF;
END $$;

-- ============================================================
-- 2. BACKFILL from full_name
-- ============================================================

UPDATE profiles
SET
  first_name = CASE
    WHEN trim(full_name) = '' THEN NULL
    ELSE split_part(trim(full_name), ' ', 1)
  END,
  last_name = NULLIF(
    trim(regexp_replace(trim(full_name), '^\S+\s*', '')),
    ''
  )
WHERE full_name IS NOT NULL AND trim(full_name) <> ''
  AND first_name IS NULL AND last_name IS NULL;

-- ============================================================
-- 3. TRIGGER: keep full_name in sync from first_name / last_name
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_full_name_from_parts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.first_name IS NOT NULL OR NEW.last_name IS NOT NULL) THEN
    NEW.full_name = trim(concat_ws(' ', NEW.first_name, NEW.last_name));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_full_name ON profiles;
CREATE TRIGGER trg_sync_full_name
  BEFORE INSERT OR UPDATE OF first_name, last_name
  ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_full_name_from_parts();

-- ============================================================
-- 4. UPDATE admin_list_users — add first_name, last_name to result
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
    p.first_name,
    p.last_name,
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
      OR p.first_name ILIKE '%' || p_search || '%'
      OR p.last_name ILIKE '%' || p_search || '%'
    )
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_list_users(text, boolean) TO authenticated;

-- ============================================================
-- 5. UPDATE admin_upsert_user_profile — accept first_name / last_name
-- ============================================================

DROP FUNCTION IF EXISTS admin_upsert_user_profile(uuid, text, int, boolean);

CREATE FUNCTION admin_upsert_user_profile(
  p_user_id uuid,
  p_full_name text DEFAULT NULL,
  p_tokens_allowed int DEFAULT NULL,
  p_is_disabled boolean DEFAULT NULL,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL
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
    first_name     = COALESCE(p_first_name, first_name),
    last_name      = COALESCE(p_last_name, last_name),
    tokens_allowed = COALESCE(p_tokens_allowed, tokens_allowed),
    is_disabled    = COALESCE(p_is_disabled, is_disabled),
    updated_at     = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user_id: %', p_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_upsert_user_profile(uuid, text, int, boolean, text, text) TO authenticated;
