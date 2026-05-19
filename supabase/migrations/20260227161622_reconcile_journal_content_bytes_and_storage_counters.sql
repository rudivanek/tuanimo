
/*
  # Reconcile journal_entries.content_bytes + profiles.journal_storage_bytes_used

  ## Root Cause
  The `journal_storage_enforce` trigger (and `content_bytes` column) were added on
  2026-02-27 via migration. Three journal entries already existed in the table with
  `content_bytes = 0` (the column default) because they were written before the
  trigger was installed. As a result:

  - `journal_entries.content_bytes` is 0 for these rows despite real encrypted
    content being present in `content_enc`.
  - `profiles.journal_storage_bytes_used` is also 0 for those users because the
    trigger never incremented it on those inserts.
  - The two fields are internally consistent with each other (counter == SUM(content_bytes))
    but BOTH are wrong relative to reality (actual octet_length of content_enc).

  ## What this migration does

  ### Step 1 — Backfill content_bytes for legacy rows
  Updates every `journal_entries` row where `content_bytes != octet_length(content_enc)`.
  Safe: only touches rows where they already disagree. Idempotent.

  ### Step 2 — Reconcile profiles storage counters
  Sets `profiles.journal_storage_bytes_used = SUM(content_bytes)` for every user
  based on the now-corrected `content_bytes` values.
  Safe: users with no entries get 0, GREATEST(0,...) prevents negative values.
  Idempotent: running again produces the same result.

  ## Affected rows (at time of authoring)
  - 3 legacy journal entries across 2 users (1718 + 337 bytes untracked)
  - All other users: already at 0 with no entries, unaffected

  ## Future prevention
  The trigger already sets `NEW.content_bytes := octet_length(COALESCE(NEW.content_enc, ''))`
  on every INSERT and UPDATE before the row is committed, so no new drift is possible
  through normal write paths. This migration is a one-time catch-up only.

  ## Security
  This runs as a migration (service role). No RLS bypass is needed — migrations
  execute outside the RLS layer. No user-facing data is exposed or deleted.
*/

-- ── Step 1: Backfill content_bytes for all legacy rows ──────────────────────
-- Sets content_bytes = octet_length(content_enc) for any row where they disagree.
-- For new rows the trigger guarantees they agree, so this only hits legacy data.
UPDATE journal_entries
SET content_bytes = octet_length(content_enc)
WHERE content_bytes IS DISTINCT FROM octet_length(content_enc);

-- ── Step 2: Reconcile profiles.journal_storage_bytes_used ───────────────────
-- Recomputes each user's counter from the ground truth (content_bytes in journal_entries).
-- Users with no entries resolve to 0 via the LEFT JOIN + COALESCE.
UPDATE profiles p
SET journal_storage_bytes_used = GREATEST(0, COALESCE(totals.real_bytes, 0))
FROM (
  SELECT
    user_id,
    SUM(content_bytes) AS real_bytes
  FROM journal_entries
  GROUP BY user_id
) AS totals
WHERE p.id = totals.user_id;

-- For users with zero journal entries ensure counter is 0 (not drifted positive)
UPDATE profiles
SET journal_storage_bytes_used = 0
WHERE id NOT IN (SELECT DISTINCT user_id FROM journal_entries)
  AND journal_storage_bytes_used != 0;
