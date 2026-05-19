/*
  # P0 Security: Backfill profile encryption secrets

  ## Summary
  Defensive migration that ensures every profile row has a valid
  encryption_secret and is marked as enc_version=2.

  ## What this does

  1. Backfills encryption_secret for any profiles that somehow have NULL or empty
     encryption_secret (should be 0 rows after the previous migration, but applied
     defensively for any race-condition signups).

  2. Updates profiles.enc_version to 2 for all profiles that already have a valid
     encryption_secret but are still marked enc_version=1. These users received a
     fresh random secret during the previous migration, so their new messages will
     be V2 encrypted. The V1 flag on the profile was only needed as an intermediary
     marker; the actual V1/V2 decision for existing rows is governed by the
     enc_version column on each individual message/journal/mood/memory row, not
     by profiles.enc_version.

  ## Backward compatibility
  - Existing V1 ciphertexts remain readable: decryptForUser() detects payload format
    (plain base64 = V1, JSON with "v":2 = V2) and routes accordingly.
  - Changing profiles.enc_version to 2 does NOT affect old row decryption.
  - No ciphertext is modified by this migration.

  ## Notes
  - Idempotent: safe to run multiple times.
  - Does not touch auth.users, only the public.profiles table.
*/

-- Backfill any profiles that somehow have NULL or empty encryption_secret
UPDATE profiles
SET
  encryption_secret = encode(gen_random_bytes(32), 'base64'),
  enc_version = 2
WHERE encryption_secret IS NULL OR encryption_secret = '';

-- Upgrade enc_version to 2 for all profiles that already have a proper secret
-- (they got their secret in the previous migration, V1 flag was transitional only)
UPDATE profiles
SET enc_version = 2
WHERE enc_version = 1
  AND encryption_secret IS NOT NULL
  AND encryption_secret <> '';
