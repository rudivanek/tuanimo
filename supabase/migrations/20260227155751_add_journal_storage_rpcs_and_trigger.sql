/*
  # Journal Storage Guardrails — RPCs and Trigger

  ## Purpose
  Enforces storage limits server-side using:
  1. SECURITY DEFINER helper RPCs (callable by clients for manual use or testing)
  2. A SECURITY DEFINER BEFORE trigger on journal_entries that intercepts every
     INSERT, UPDATE, and DELETE — making bypass impossible regardless of client behavior.

  ## Functions Created

  ### reserve_journal_storage(p_user_id, p_bytes_to_add)
  - Reads profiles.journal_storage_bytes_used + allowed (FOR UPDATE row lock)
  - Raises JOURNAL_STORAGE_LIMIT if used + new > allowed
  - Atomically increments bytes_used on profiles
  - Upserts journal_daily_usage for today
  - Self-only enforcement via auth.uid() check
  - Returns jsonb: { new_used, allowed, today_bytes, today_saves }

  ### release_journal_storage(p_user_id, p_bytes_to_subtract)
  - Decrements bytes_used on profiles (never below 0)
  - Self-only enforcement
  - Used for rollback on failed writes, or on entry deletion

  ### journal_storage_enforce_trigger_fn()
  - BEFORE trigger function (SECURITY DEFINER)
  - INSERT: computes octet_length(content_enc), enforces limit, sets content_bytes
  - UPDATE: computes delta between old and new content_bytes, enforces/releases delta
  - DELETE: releases OLD.content_bytes from profile total

  ## Trigger
  - Name: journal_storage_enforce
  - Table: journal_entries
  - Fires: BEFORE INSERT OR UPDATE OR DELETE
  - Effect: Raises exception (cancels write) if storage limit exceeded on INSERT/UPDATE

  ## Security
  - All functions: SECURITY DEFINER, SET search_path = public
  - reserve/release RPCs: self-only check via auth.uid()
  - Trigger function: accesses NEW.user_id (always equals auth.uid() due to RLS)
  - REVOKE public execute on RPCs; GRANT only to authenticated role

  ## Important Notes
  1. octet_length() returns byte count of the text — accurate for UTF-8 encrypted content.
  2. Trigger sets content_bytes automatically — clients must NOT send it.
  3. On UPDATE with smaller content: delta is negative → bytes are released (counter decremented).
  4. On DELETE: bytes released so counter stays accurate over time.
  5. daily_usage.saves_count increments on every INSERT or UPDATE save operation.
*/

-- ── reserve_journal_storage ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION reserve_journal_storage(
  p_user_id     UUID,
  p_bytes_to_add BIGINT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used          BIGINT;
  v_allowed       BIGINT;
  v_today_bytes   BIGINT;
  v_today_saves   INT;
BEGIN
  -- Enforce self-only
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED: can only reserve storage for yourself';
  END IF;

  -- Validate input
  IF p_bytes_to_add <= 0 THEN
    RAISE EXCEPTION 'INVALID: p_bytes_to_add must be a positive integer';
  END IF;

  IF p_bytes_to_add > 5242880 THEN
    RAISE EXCEPTION 'INVALID: single entry exceeds 5 MB maximum';
  END IF;

  -- Lock profile row to prevent race conditions
  SELECT journal_storage_bytes_used, journal_storage_bytes_allowed
    INTO v_used, v_allowed
    FROM profiles
   WHERE id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND: no profile for user %', p_user_id;
  END IF;

  -- Enforce limit
  IF v_used + p_bytes_to_add > v_allowed THEN
    RAISE EXCEPTION 'JOURNAL_STORAGE_LIMIT: used=% allowed=% attempted=%',
      v_used, v_allowed, p_bytes_to_add;
  END IF;

  -- Reserve bytes
  UPDATE profiles
     SET journal_storage_bytes_used = v_used + p_bytes_to_add
   WHERE id = p_user_id;

  -- Upsert daily usage
  INSERT INTO journal_daily_usage (user_id, day, bytes_saved, saves_count, updated_at)
  VALUES (p_user_id, CURRENT_DATE, p_bytes_to_add, 1, now())
  ON CONFLICT (user_id, day) DO UPDATE
    SET bytes_saved = journal_daily_usage.bytes_saved + EXCLUDED.bytes_saved,
        saves_count = journal_daily_usage.saves_count + 1,
        updated_at  = now();

  -- Read back today's totals for the return payload
  SELECT bytes_saved, saves_count
    INTO v_today_bytes, v_today_saves
    FROM journal_daily_usage
   WHERE user_id = p_user_id AND day = CURRENT_DATE;

  RETURN jsonb_build_object(
    'new_used',    v_used + p_bytes_to_add,
    'allowed',     v_allowed,
    'today_bytes', v_today_bytes,
    'today_saves', v_today_saves
  );
END;
$$;

REVOKE ALL ON FUNCTION reserve_journal_storage(UUID, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reserve_journal_storage(UUID, BIGINT) TO authenticated;


-- ── release_journal_storage ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION release_journal_storage(
  p_user_id          UUID,
  p_bytes_to_subtract BIGINT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Enforce self-only
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED: can only release storage for yourself';
  END IF;

  IF p_bytes_to_subtract <= 0 THEN
    RAISE EXCEPTION 'INVALID: p_bytes_to_subtract must be a positive integer';
  END IF;

  UPDATE profiles
     SET journal_storage_bytes_used = GREATEST(0, journal_storage_bytes_used - p_bytes_to_subtract)
   WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION release_journal_storage(UUID, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION release_journal_storage(UUID, BIGINT) TO authenticated;


-- ── journal_storage_enforce_trigger_fn ────────────────────────────────────────
-- This trigger function is SECURITY DEFINER so it can update profiles regardless
-- of the caller's role.  It enforces storage limits before every INSERT, UPDATE,
-- and DELETE on journal_entries — the client can never bypass this.
CREATE OR REPLACE FUNCTION journal_storage_enforce_trigger_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_bytes BIGINT;
  v_old_bytes BIGINT;
  v_delta     BIGINT;
  v_used      BIGINT;
  v_allowed   BIGINT;
BEGIN
  -- ── DELETE: release the bytes this entry was consuming ──────────────────────
  IF TG_OP = 'DELETE' THEN
    UPDATE profiles
       SET journal_storage_bytes_used = GREATEST(0, journal_storage_bytes_used - OLD.content_bytes)
     WHERE id = OLD.user_id;
    RETURN OLD;
  END IF;

  -- ── INSERT / UPDATE: compute byte size from the encrypted content ────────────
  v_new_bytes := octet_length(COALESCE(NEW.content_enc, ''));

  -- Always set content_bytes on the new row so it stays in sync
  NEW.content_bytes := v_new_bytes;

  IF TG_OP = 'INSERT' THEN
    -- Lock profile row
    SELECT journal_storage_bytes_used, journal_storage_bytes_allowed
      INTO v_used, v_allowed
      FROM profiles
     WHERE id = NEW.user_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PROFILE_NOT_FOUND';
    END IF;

    -- Guard against single-entry abuse (5 MB)
    IF v_new_bytes > 5242880 THEN
      RAISE EXCEPTION 'INVALID: single entry exceeds 5 MB maximum';
    END IF;

    -- Enforce limit
    IF v_used + v_new_bytes > v_allowed THEN
      RAISE EXCEPTION 'JOURNAL_STORAGE_LIMIT: used=% allowed=% attempted=%',
        v_used, v_allowed, v_new_bytes;
    END IF;

    -- Reserve
    UPDATE profiles
       SET journal_storage_bytes_used = v_used + v_new_bytes
     WHERE id = NEW.user_id;

    -- Track daily usage
    INSERT INTO journal_daily_usage (user_id, day, bytes_saved, saves_count, updated_at)
    VALUES (NEW.user_id, CURRENT_DATE, v_new_bytes, 1, now())
    ON CONFLICT (user_id, day) DO UPDATE
      SET bytes_saved = journal_daily_usage.bytes_saved + EXCLUDED.bytes_saved,
          saves_count = journal_daily_usage.saves_count + 1,
          updated_at  = now();

  ELSIF TG_OP = 'UPDATE' THEN
    v_old_bytes := COALESCE(OLD.content_bytes, 0);
    v_delta     := v_new_bytes - v_old_bytes;

    IF v_delta > 0 THEN
      -- Content grew: lock profile and check limit
      SELECT journal_storage_bytes_used, journal_storage_bytes_allowed
        INTO v_used, v_allowed
        FROM profiles
       WHERE id = NEW.user_id
         FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'PROFILE_NOT_FOUND';
      END IF;

      IF v_new_bytes > 5242880 THEN
        RAISE EXCEPTION 'INVALID: single entry exceeds 5 MB maximum';
      END IF;

      IF v_used + v_delta > v_allowed THEN
        RAISE EXCEPTION 'JOURNAL_STORAGE_LIMIT: used=% allowed=% attempted_delta=%',
          v_used, v_allowed, v_delta;
      END IF;

      UPDATE profiles
         SET journal_storage_bytes_used = v_used + v_delta
       WHERE id = NEW.user_id;

    ELSIF v_delta < 0 THEN
      -- Content shrank: release the freed bytes
      UPDATE profiles
         SET journal_storage_bytes_used = GREATEST(0, journal_storage_bytes_used + v_delta)
       WHERE id = NEW.user_id;
    END IF;

    -- Always count the save in daily usage (regardless of size change)
    INSERT INTO journal_daily_usage (user_id, day, bytes_saved, saves_count, updated_at)
    VALUES (NEW.user_id, CURRENT_DATE, GREATEST(0, v_delta), 1, now())
    ON CONFLICT (user_id, day) DO UPDATE
      SET bytes_saved = journal_daily_usage.bytes_saved + GREATEST(0, EXCLUDED.bytes_saved),
          saves_count = journal_daily_usage.saves_count + 1,
          updated_at  = now();
  END IF;

  RETURN NEW;
END;
$$;

-- ── Attach trigger to journal_entries ─────────────────────────────────────────
DROP TRIGGER IF EXISTS journal_storage_enforce ON journal_entries;

CREATE TRIGGER journal_storage_enforce
  BEFORE INSERT OR UPDATE OR DELETE
  ON journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION journal_storage_enforce_trigger_fn();
