
/*
  # Add plan_key to profiles — single source of truth for storage tier

  ## Summary
  No billing/plan field existed in the `profiles` table. The journal storage
  limit (`journal_storage_bytes_allowed`) was a bare integer with no semantic
  link to a pricing tier, requiring manual DB edits to change a user's limit.

  This migration adds the foundation: a `plan_key` column that identifies
  which pricing tier a user is on. Future migrations and RPCs will use this
  column to automatically compute and enforce the correct storage limit.

  ## New Column
  - `profiles.plan_key` (TEXT, NOT NULL, DEFAULT 'starter')
    Valid values: 'starter' | 'pro' | 'power'
    Enforced via CHECK constraint `chk_profiles_plan_key`.

  ## Tier → Storage Mapping (reference, enforced in later migration)
  | plan_key | journal_storage_bytes_allowed |
  |----------|-------------------------------|
  | starter  | 52,428,800   (50 MB)          |
  | pro      | 262,144,000  (250 MB)         |
  | power    | 1,073,741,824 (1 GB)          |

  ## Safety
  - Uses `IF NOT EXISTS` guard so the migration is idempotent.
  - All existing users default to 'starter', which matches the current
    52 MB default — no data loss or limit change on deploy.
  - CHECK constraint prevents unknown tier values being stored.
  - No existing trigger logic is altered.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'plan_key'
  ) THEN
    ALTER TABLE profiles
      ADD COLUMN plan_key TEXT NOT NULL DEFAULT 'starter';

    ALTER TABLE profiles
      ADD CONSTRAINT chk_profiles_plan_key
        CHECK (plan_key IN ('starter', 'pro', 'power'));
  END IF;
END $$;

COMMENT ON COLUMN profiles.plan_key IS
  'Pricing tier key. Valid values: starter (50 MB) | pro (250 MB) | power (1 GB). '
  'Drives journal_storage_bytes_allowed via trigger.';
