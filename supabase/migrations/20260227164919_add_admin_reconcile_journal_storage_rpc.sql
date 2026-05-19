/*
  # Admin Reconcile Journal Storage RPC

  ## Summary
  Adds a SECURITY DEFINER admin-only RPC that repairs drift between
  `journal_entries.content_bytes` (per-entry byte tracking) and
  `profiles.journal_storage_bytes_used` (the running total used for
  quota enforcement). Both fields can drift if entries were imported
  or manipulated outside the normal write path.

  ## New Function

  ### `admin_reconcile_journal_storage(p_user_id UUID DEFAULT NULL)`

  **Auth:**
  - Caller must be an admin (`is_admin = true` on their profile) OR
    calling with service-role (auth.uid() IS NULL). Otherwise raises
    UNAUTHORIZED.

  **Behavior when `p_user_id` is provided:**
  1. Backfills any stale `journal_entries.content_bytes` rows for that
     user where the stored value differs from `octet_length(content_enc)`.
  2. Recomputes `profiles.journal_storage_bytes_used` as
     `COALESCE(SUM(content_bytes), 0)` for that user.

  **Behavior when `p_user_id` is NULL:**
  - Runs the same two-step repair across ALL users.

  **Returns:**
  - `users_updated INT`  — number of profile rows touched
  - `entries_fixed INT`  — number of `journal_entries` rows whose
    `content_bytes` was corrected

  ## Security
  - SECURITY DEFINER + SET search_path = public
  - Admin-only: raises 'UNAUTHORIZED' if caller is not an admin or
    service role
  - REVOKE public execute; GRANT only to authenticated role

  ## Important Notes
  1. Idempotent — safe to run multiple times; only touches rows that
     actually have drift.
  2. Uses UPDATE … WHERE … IS DISTINCT FROM to limit rows touched.
  3. No data is deleted or restructured; purely a counter repair.
*/

CREATE OR REPLACE FUNCTION public.admin_reconcile_journal_storage(
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(users_updated INT, entries_fixed INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller        UUID;
  v_entries_fixed INT := 0;
  v_users_updated INT := 0;
BEGIN
  v_caller := auth.uid();

  -- ── Auth guard ──────────────────────────────────────────────────────────────
  -- Service-role callers have NULL uid and bypass all RLS; allow them.
  -- Authenticated callers must have is_admin = true on their profile.
  IF v_caller IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles WHERE id = v_caller AND is_admin = true
    ) THEN
      RAISE EXCEPTION 'UNAUTHORIZED: admin access required';
    END IF;
  END IF;

  -- ── Step 1: Backfill stale content_bytes ─────────────────────────────────
  IF p_user_id IS NOT NULL THEN
    UPDATE journal_entries
    SET    content_bytes = octet_length(COALESCE(content_enc, ''))
    WHERE  user_id = p_user_id
      AND  content_bytes IS DISTINCT FROM octet_length(COALESCE(content_enc, ''));
    GET DIAGNOSTICS v_entries_fixed = ROW_COUNT;
  ELSE
    UPDATE journal_entries
    SET    content_bytes = octet_length(COALESCE(content_enc, ''))
    WHERE  content_bytes IS DISTINCT FROM octet_length(COALESCE(content_enc, ''));
    GET DIAGNOSTICS v_entries_fixed = ROW_COUNT;
  END IF;

  -- ── Step 2: Recompute profiles.journal_storage_bytes_used ────────────────
  IF p_user_id IS NOT NULL THEN
    UPDATE profiles p
    SET    journal_storage_bytes_used = GREATEST(0, COALESCE(totals.real_bytes, 0))
    FROM (
      SELECT user_id, SUM(content_bytes) AS real_bytes
      FROM   journal_entries
      WHERE  user_id = p_user_id
      GROUP BY user_id
    ) AS totals
    WHERE  p.id = totals.user_id
      AND  p.journal_storage_bytes_used IS DISTINCT FROM GREATEST(0, COALESCE(totals.real_bytes, 0));

    GET DIAGNOSTICS v_users_updated = ROW_COUNT;

    -- If user has no entries at all, ensure counter is 0
    UPDATE profiles
    SET    journal_storage_bytes_used = 0
    WHERE  id = p_user_id
      AND  journal_storage_bytes_used <> 0
      AND  NOT EXISTS (SELECT 1 FROM journal_entries WHERE user_id = p_user_id);

    IF FOUND AND v_users_updated = 0 THEN
      v_users_updated := 1;
    END IF;

  ELSE
    -- All users: recompute from journal_entries
    UPDATE profiles p
    SET    journal_storage_bytes_used = GREATEST(0, COALESCE(totals.real_bytes, 0))
    FROM (
      SELECT user_id, SUM(content_bytes) AS real_bytes
      FROM   journal_entries
      GROUP BY user_id
    ) AS totals
    WHERE  p.id = totals.user_id
      AND  p.journal_storage_bytes_used IS DISTINCT FROM GREATEST(0, COALESCE(totals.real_bytes, 0));

    GET DIAGNOSTICS v_users_updated = ROW_COUNT;

    -- Users with no entries: ensure counter is 0
    UPDATE profiles
    SET    journal_storage_bytes_used = 0
    WHERE  journal_storage_bytes_used <> 0
      AND  id NOT IN (SELECT DISTINCT user_id FROM journal_entries);

    -- Count these users too
    IF FOUND THEN
      v_users_updated := v_users_updated + 1;
    END IF;
  END IF;

  RETURN QUERY SELECT v_users_updated, v_entries_fixed;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reconcile_journal_storage(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reconcile_journal_storage(UUID) TO authenticated;
