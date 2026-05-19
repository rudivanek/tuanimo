/*
  # Harden admin_reconcile_journal_storage Auth Guard

  ## Problem
  The original function had two weaknesses:

  1. **Wrong admin table** — checked `profiles.is_admin` (a denormalized flag) instead
     of the canonical `app_admins` table used by every other admin RPC in this project.
     A stale `profiles.is_admin = true` row would incorrectly grant access.

  2. **NULL uid bypass was implicit** — `auth.uid() IS NULL` was silently allowed as a
     proxy for "service role", without explicitly verifying the JWT role claim.
     Any future code path that legitimately produces a NULL uid (e.g., a Postgres
     background worker) would have been granted unrestricted access.

  ## When auth.uid() is NULL in this Supabase project

  Three contexts:
  a) **service_role JWT** — JWT has no `sub` claim; `auth.uid()` returns NULL.
     `auth.jwt() ->> 'role'` returns 'service_role'. This is the only NULL path
     reachable via supabase.rpc() or the REST API.
  b) **Direct DB owner / psql connection** — superusers bypass GRANT checks entirely;
     they cannot be blocked at the function level, and `auth.uid()` returns NULL
     because no JWT is present. `auth.jwt()` returns NULL.
  c) **authenticated JWT** — ALWAYS has a non-null `sub` UUID. Cannot produce a
     NULL auth.uid() in practice.

  ## Patched Guard Logic

  Priority order:
  1. If `auth.jwt() ->> 'role' = 'service_role'`  → ALLOW  (explicit service-role check)
  2. If `auth.uid() IS NULL`                        → DENY   (unknown null context)
  3. Look up `app_admins` by uid OR email (canonical pattern, matches all other admin RPCs)
     → ALLOW if found, DENY otherwise

  ## Verification Queries (run in Supabase SQL editor as postgres/owner)

  -- Non-admin authenticated user (replace UUID with a real non-admin user):
  -- SELECT set_config('request.jwt.claims',
  --   '{"sub":"<non-admin-uuid>","role":"authenticated"}', true);
  -- SELECT * FROM admin_reconcile_journal_storage();
  -- Expected: ERROR: UNAUTHORIZED: admin access required

  -- Admin user (replace UUID with an actual app_admins user):
  -- SELECT set_config('request.jwt.claims',
  --   '{"sub":"<admin-uuid>","role":"authenticated"}', true);
  -- SELECT * FROM admin_reconcile_journal_storage();
  -- Expected: (0, 0) — or actual repair counts

  -- Service role (auth.jwt() role claim = service_role):
  -- SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
  -- SELECT * FROM admin_reconcile_journal_storage();
  -- Expected: (0, 0)

  ## Security
  - SECURITY DEFINER + SET search_path = public
  - REVOKE from PUBLIC; GRANT EXECUTE to authenticated only
  - Superusers (DB owner, postgres) always bypass GRANT — they cannot be blocked
    at the function level and are trusted infra-level actors
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
  v_caller_email  text;
  v_jwt_role      text;
  v_entries_fixed INT := 0;
  v_users_updated INT := 0;
BEGIN
  v_caller   := auth.uid();
  v_jwt_role := auth.jwt() ->> 'role';

  -- ── Auth guard ──────────────────────────────────────────────────────────────
  -- 1. Explicit service_role claim → trusted server-side caller, allow.
  IF v_jwt_role = 'service_role' THEN
    NULL; -- pass through

  -- 2. NULL uid without a service_role claim → unknown/unsupported context, deny.
  ELSIF v_caller IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: admin access required';

  -- 3. Authenticated caller → verify against app_admins (uid OR email match).
  --    Mirrors the pattern used by admin_token_usage_report and all other admin RPCs.
  ELSE
    SELECT au.email::text
    INTO   v_caller_email
    FROM   auth.users au
    WHERE  au.id = v_caller;

    IF NOT EXISTS (
      SELECT 1 FROM app_admins adm
      WHERE adm.user_id = v_caller
         OR (adm.email IS NOT NULL
             AND lower(adm.email::text) = lower(COALESCE(v_caller_email, '')))
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

    UPDATE profiles
    SET    journal_storage_bytes_used = 0
    WHERE  id = p_user_id
      AND  journal_storage_bytes_used <> 0
      AND  NOT EXISTS (SELECT 1 FROM journal_entries WHERE user_id = p_user_id);

    IF FOUND AND v_users_updated = 0 THEN
      v_users_updated := 1;
    END IF;

  ELSE
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

    UPDATE profiles
    SET    journal_storage_bytes_used = 0
    WHERE  journal_storage_bytes_used <> 0
      AND  id NOT IN (SELECT DISTINCT user_id FROM journal_entries);

    IF FOUND THEN
      v_users_updated := v_users_updated + 1;
    END IF;
  END IF;

  RETURN QUERY SELECT v_users_updated, v_entries_fixed;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reconcile_journal_storage(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reconcile_journal_storage(UUID) TO authenticated;
