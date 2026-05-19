/*
  # Journal Storage Guardrails — Schema

  ## Purpose
  Adds the schema layer required for enforced server-side journal storage limits.
  No storage enforcement existed before this migration.

  ## New Columns

  ### profiles
  - `journal_storage_bytes_allowed` (BIGINT, default 52428800 = 50 MB)
      The hard cap for this user's total journal storage (encrypted bytes stored in DB).
  - `journal_storage_bytes_used` (BIGINT, default 0)
      Running total of encrypted bytes currently stored across all journal entries.

  ### journal_entries
  - `content_bytes` (BIGINT, default 0)
      Byte-length of the stored `content_enc` field for this entry.
      Set automatically by the storage trigger (Migration 2) — clients never write it.

  ## New Table: journal_daily_usage
  Tracks per-user per-day journal write activity.
  Used to support future daily save caps without another schema change.

  ### Columns
  - `user_id`      UUID PK, FK → auth.users
  - `day`          DATE PK (composite PK with user_id)
  - `bytes_saved`  BIGINT — net new bytes written on this day
  - `saves_count`  INT    — number of save operations on this day
  - `created_at`   TIMESTAMPTZ
  - `updated_at`   TIMESTAMPTZ

  ## Security
  - RLS enabled on journal_daily_usage
  - SELECT allowed for own rows (read-only for the user)
  - INSERT/UPDATE blocked for direct user access (only written by SECURITY DEFINER trigger)
  - Service role retains full access (Supabase default)

  ## Important Notes
  1. Existing users get DEFAULT values — no data loss.
  2. `content_bytes` starts at 0 for all existing entries; it will be populated
     accurately going forward by the trigger. A backfill RPC can be added later.
  3. This migration is purely additive — no existing columns modified.
*/

-- ── profiles: storage budget columns ──────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'journal_storage_bytes_allowed'
  ) THEN
    ALTER TABLE profiles
      ADD COLUMN journal_storage_bytes_allowed BIGINT NOT NULL DEFAULT 52428800;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'journal_storage_bytes_used'
  ) THEN
    ALTER TABLE profiles
      ADD COLUMN journal_storage_bytes_used BIGINT NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ── journal_entries: per-entry byte size ──────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'content_bytes'
  ) THEN
    ALTER TABLE journal_entries
      ADD COLUMN content_bytes BIGINT NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ── journal_daily_usage: per-user per-day write activity ──────────────────────
CREATE TABLE IF NOT EXISTS journal_daily_usage (
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day         DATE        NOT NULL,
  bytes_saved BIGINT      NOT NULL DEFAULT 0,
  saves_count INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

ALTER TABLE journal_daily_usage ENABLE ROW LEVEL SECURITY;

-- Users may read their own usage (for future UI display); no direct write access.
CREATE POLICY "Users can view own daily journal usage"
  ON journal_daily_usage
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No INSERT policy → direct insert from authenticated role is blocked.
-- No UPDATE policy → direct update from authenticated role is blocked.
-- No DELETE policy → direct delete from authenticated role is blocked.
-- The SECURITY DEFINER trigger function (Migration 2) bypasses RLS entirely.
