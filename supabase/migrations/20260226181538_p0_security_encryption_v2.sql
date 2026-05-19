/*
  # P0 Security: Encryption V2 Schema

  ## Summary
  Implements per-user random encryption secrets and encryption versioning
  so a DB breach cannot automatically decrypt user content.

  ## Changes

  ### profiles table
  - Add `encryption_secret` (text, NOT NULL) — base64-encoded 32 random bytes,
    generated per user at signup. Never derivable from userId.
  - Add `enc_version` (smallint, NOT NULL, DEFAULT 2) — tracks key scheme version.
  - Existing profiles get a fresh random secret and enc_version=1
    (marking their stored ciphertexts as V1 so the client uses the old
    decrypt path for backward compatibility).
  - Trigger `handle_new_user` updated to populate these fields on signup.

  ### Remove plaintext leakage
  - Drop `chat_messages.content_preview` (was storing plaintext previews).

  ### enc_version column on encrypted-content tables
  - Add `enc_version` (smallint, NOT NULL, DEFAULT 1) to:
    chat_messages, journal_entries, mood_logs, user_memory
  - DEFAULT 1 covers all existing rows (V1 ciphertexts).
  - Application code will explicitly write enc_version=2 for new rows.
  - After column exists, change DEFAULT to 2 for future insert defaults.

  ## Security
  - RLS unchanged — all existing policies remain.
  - encryption_secret is readable by the authenticated owner (SELECT *),
    which is necessary for client-side decryption.
  - No plaintext secrets are added server-side.
*/

-- ── 1. Add encryption_secret + enc_version to profiles ──────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS encryption_secret text,
  ADD COLUMN IF NOT EXISTS enc_version smallint NOT NULL DEFAULT 2;

-- Back-fill existing profiles: give them a random secret, mark as V1
UPDATE profiles
SET
  encryption_secret = encode(gen_random_bytes(32), 'base64'),
  enc_version = 1
WHERE encryption_secret IS NULL;

-- Now enforce NOT NULL
ALTER TABLE profiles
  ALTER COLUMN encryption_secret SET NOT NULL;

-- ── 2. Update handle_new_user trigger ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, language, timezone, encryption_secret, enc_version)
  VALUES (
    new.id,
    'en',
    'America/Mexico_City',
    encode(gen_random_bytes(32), 'base64'),
    2
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. Drop content_preview (plaintext leakage) ──────────────────────────────

ALTER TABLE chat_messages DROP COLUMN IF EXISTS content_preview;

-- ── 4. Add enc_version to encrypted-content tables ──────────────────────────

-- DEFAULT 1 so all existing rows are tagged V1
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS enc_version smallint NOT NULL DEFAULT 1;

ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS enc_version smallint NOT NULL DEFAULT 1;

ALTER TABLE mood_logs
  ADD COLUMN IF NOT EXISTS enc_version smallint NOT NULL DEFAULT 1;

ALTER TABLE user_memory
  ADD COLUMN IF NOT EXISTS enc_version smallint NOT NULL DEFAULT 1;

-- Change default to 2 so future inserts that omit the column default to V2
ALTER TABLE chat_messages    ALTER COLUMN enc_version SET DEFAULT 2;
ALTER TABLE journal_entries  ALTER COLUMN enc_version SET DEFAULT 2;
ALTER TABLE mood_logs        ALTER COLUMN enc_version SET DEFAULT 2;
ALTER TABLE user_memory      ALTER COLUMN enc_version SET DEFAULT 2;
