
/*
  # Journal Storage Plan RPC and Auto-Sync Trigger

  ## Summary
  Creates the infrastructure that makes `profiles.journal_storage_bytes_allowed`
  automatically reflect the user's `plan_key` without any manual DB intervention.

  ## New Functions

  ### 1. `journal_storage_bytes_for_plan(p_plan_key TEXT) → BIGINT`
  Pure immutable mapping function. Single source of truth for tier limits.
  | plan_key | bytes          | human size |
  |----------|----------------|------------|
  | starter  | 52,428,800     | 50 MB      |
  | pro      | 262,144,000    | 250 MB     |
  | power    | 1,073,741,824  | 1 GB       |
  Unknown values fall back to 50 MB (safe default).

  ### 2. `apply_journal_storage_limit(p_user_id UUID) → TABLE(allowed, used, tier)`
  SECURITY DEFINER RPC. Reads the user's current `plan_key`, computes the
  correct byte limit, writes it to `journal_storage_bytes_allowed`, and
  returns the resulting state.

  Auth rules:
  - `auth.uid() IS NULL` (service role / migration) → always allowed
  - `auth.uid() = p_user_id` → user updating themselves → allowed
  - `auth.uid() ≠ p_user_id` → caller must have `is_admin = true` → allowed
  - Otherwise → UNAUTHORIZED exception

  ### 3. `profiles_sync_storage_limit_fn()` (trigger function)
  BEFORE UPDATE trigger. When `plan_key` changes, immediately computes the new
  allowed bytes and sets `NEW.journal_storage_bytes_allowed` in-place — no
  second UPDATE query needed. Fully atomic.

  ## New Trigger
  `trg_profiles_sync_storage_limit` — BEFORE UPDATE OF plan_key ON profiles
  Fires only when `plan_key` actually changes (NEW.plan_key IS DISTINCT FROM OLD.plan_key).

  ## Important Notes
  - Trigger enforcement logic in `journal_storage_enforce_trigger_fn` is NOT changed.
  - Existing users already have `plan_key = 'starter'` (default from prior migration)
    and `journal_storage_bytes_allowed = 52428800` — these already agree, so no
    backfill is needed for correctness. A convenience backfill is included below
    as a DO block to make the state explicit.
  - All functions use `SET search_path TO 'public'` to prevent search path injection.
*/

-- ─── 1. Pure mapping function ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.journal_storage_bytes_for_plan(p_plan_key TEXT)
RETURNS BIGINT
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE p_plan_key
    WHEN 'pro'   THEN 262144000     -- 250 MB
    WHEN 'power' THEN 1073741824    -- 1 GB
    ELSE              52428800      -- 50 MB  (starter + unknown fallback)
  END;
$$;

COMMENT ON FUNCTION public.journal_storage_bytes_for_plan(TEXT) IS
  'Maps a plan_key string to the journal storage byte allowance for that tier. '
  'Unknown values safely fall back to 50 MB (starter limit).';

-- ─── 2. Public RPC: apply_journal_storage_limit ───────────────────────────────

CREATE OR REPLACE FUNCTION public.apply_journal_storage_limit(p_user_id UUID)
RETURNS TABLE(allowed BIGINT, used BIGINT, tier TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan_key TEXT;
  v_allowed  BIGINT;
  v_caller   UUID;
BEGIN
  v_caller := auth.uid();

  -- Auth guard: service role (null uid) always passes; authenticated callers
  -- must be the owner or a platform admin.
  IF v_caller IS NOT NULL AND v_caller <> p_user_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = v_caller AND is_admin = true
    ) THEN
      RAISE EXCEPTION 'UNAUTHORIZED: you may only update your own storage limit';
    END IF;
  END IF;

  SELECT p.plan_key
  INTO   v_plan_key
  FROM   profiles p
  WHERE  p.id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND: %', p_user_id;
  END IF;

  v_allowed := journal_storage_bytes_for_plan(v_plan_key);

  UPDATE profiles
  SET    journal_storage_bytes_allowed = v_allowed,
         updated_at                   = now()
  WHERE  id = p_user_id;

  RETURN QUERY
    SELECT
      v_allowed                             AS allowed,
      p.journal_storage_bytes_used          AS used,
      v_plan_key                            AS tier
    FROM profiles p
    WHERE p.id = p_user_id;
END;
$$;

COMMENT ON FUNCTION public.apply_journal_storage_limit(UUID) IS
  'Reads the user''s plan_key, computes the correct byte allowance, writes it to '
  'journal_storage_bytes_allowed, and returns (allowed, used, tier). '
  'Self-call or admin/service-role only.';

-- ─── 3. Trigger function ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.profiles_sync_storage_limit_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only act when plan_key genuinely changed
  IF NEW.plan_key IS DISTINCT FROM OLD.plan_key THEN
    NEW.journal_storage_bytes_allowed := journal_storage_bytes_for_plan(NEW.plan_key);
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.profiles_sync_storage_limit_fn() IS
  'BEFORE UPDATE trigger body. When plan_key changes, sets journal_storage_bytes_allowed '
  'in-place on NEW before the row is written. Zero extra queries.';

-- ─── 4. Attach trigger ────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_profiles_sync_storage_limit ON profiles;

CREATE TRIGGER trg_profiles_sync_storage_limit
  BEFORE UPDATE OF plan_key
  ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION profiles_sync_storage_limit_fn();

-- ─── 5. One-time backfill: reconcile all existing users ───────────────────────
-- All current users have plan_key = 'starter' (default) and
-- journal_storage_bytes_allowed = 52428800 (50 MB), which already agrees.
-- This block runs apply_journal_storage_limit for every profile to make the
-- state explicit and log the results.

DO $$
DECLARE
  r       RECORD;
  v_count INT := 0;
BEGIN
  FOR r IN
    SELECT id FROM profiles
  LOOP
    PERFORM apply_journal_storage_limit(r.id);
    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'Backfill complete: % profiles reconciled', v_count;
END $$;
