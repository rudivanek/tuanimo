
/*
  # Fix journal_daily_usage.saves_count — INSERT-only semantics

  ## Problem
  The `journal_storage_enforce_trigger_fn` trigger was incrementing
  `journal_daily_usage.saves_count` on both INSERT and UPDATE operations.
  The comment even said "Always count the save in daily usage (regardless of
  size change)" — meaning every edit of an existing entry was being counted
  as a new save. This inflates the metric and would incorrectly penalise
  users under any future daily creation cap.

  ## Root cause (exact lines in UPDATE branch)
  BEFORE:
    INSERT INTO journal_daily_usage (..., saves_count, ...)
    VALUES (..., 1, ...)                          ← seeds 1 even on edit
    ON CONFLICT (...) DO UPDATE
    SET ...
        saves_count = journal_daily_usage.saves_count + 1,  ← increments on every edit

  ## Fix
  `saves_count` must only ever change during INSERT operations.

  UPDATE branch change:
  - Seed value changed from 1 → 0
    (if no row exists for that day an edit creates one with saves_count=0)
  - ON CONFLICT DO UPDATE no longer touches saves_count at all
  - bytes_saved still accumulates positive deltas, unchanged

  INSERT branch: no change — saves_count = saves_count + 1 remains correct.
  DELETE branch: no change — journal_daily_usage is untouched.

  ## Invariant after fix
  saves_count = number of new journal entries created on that day
  bytes_saved = cumulative bytes written (inserts full size + edit growth only)

  ## Safety
  - Full SECURITY DEFINER + search_path preserved
  - All storage enforcement logic (limits, locking, GREATEST guards) unchanged
  - Idempotent: CREATE OR REPLACE — safe to re-run
*/

CREATE OR REPLACE FUNCTION public.journal_storage_enforce_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- ── INSERT / UPDATE: compute byte size from the encrypted content ─────────────
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

  -- Track daily usage: INSERT increments saves_count
  INSERT INTO journal_daily_usage (user_id, day, bytes_saved, saves_count, updated_at)
  VALUES (NEW.user_id, CURRENT_DATE, v_new_bytes, 1, now())
  ON CONFLICT (user_id, day) DO UPDATE
  SET bytes_saved  = journal_daily_usage.bytes_saved + EXCLUDED.bytes_saved,
      saves_count  = journal_daily_usage.saves_count + 1,
      updated_at   = now();

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

  -- Track daily usage: UPDATE accumulates bytes_saved only — saves_count NOT touched
  INSERT INTO journal_daily_usage (user_id, day, bytes_saved, saves_count, updated_at)
  VALUES (NEW.user_id, CURRENT_DATE, GREATEST(0, v_delta), 0, now())
  ON CONFLICT (user_id, day) DO UPDATE
  SET bytes_saved = journal_daily_usage.bytes_saved + GREATEST(0, EXCLUDED.bytes_saved),
      updated_at  = now();

END IF;

RETURN NEW;
END;
$$;
