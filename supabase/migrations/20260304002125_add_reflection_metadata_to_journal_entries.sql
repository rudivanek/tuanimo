/*
  # Add Reflection Metadata to Journal Entries

  ## Summary
  Adds lightweight metadata columns to journal_entries to power future "progress",
  "milestones", and "you've worked through this before" features. No UI changes;
  these fields are stored silently on creation and finalization.

  ## New Columns

  ### journal_entries
  - `origin` (text, NOT NULL, DEFAULT 'manual') — How the entry was created.
    Values: 'manual' (user typed directly in journal) | 'chat' (created from diary draft suggestion in chat).
  - `trigger_reason` (text, NULL) — The evaluation reason string from the diary suggestion
    heuristic (e.g., 'heaviness>=3', 'repetition>=3_with_heaviness>=1'). Null for manual entries.
  - `emotion_score_at_creation` (integer, NULL) — The heaviness score (0–N) at the moment the
    draft was triggered. Null for manual entries.
  - `saved_at` (timestamptz, NULL) — Set when a draft is finalized (is_draft flipped to false).
    Null for drafts-in-progress and for manual entries (they are saved immediately).

  ## New Indexes
  - `journal_entries_user_origin_created_at_idx` — Supports filtering by origin per user.
  - `journal_entries_user_saved_at_idx` — Supports sorting/filtering by finalization time per user.

  ## Security
  - No new RLS policies required. Existing user_id = auth.uid() policies on journal_entries
    already cover all new columns.

  ## Notes
  1. All existing rows will get origin = 'manual' (the column default), trigger_reason = NULL,
     emotion_score_at_creation = NULL, saved_at = NULL — safe backfill via DEFAULT.
  2. ADD COLUMN IF NOT EXISTS used throughout to make migration re-runnable safely.
*/

ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS trigger_reason text NULL,
  ADD COLUMN IF NOT EXISTS emotion_score_at_creation integer NULL,
  ADD COLUMN IF NOT EXISTS saved_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS journal_entries_user_origin_created_at_idx
  ON public.journal_entries (user_id, origin, created_at DESC);

CREATE INDEX IF NOT EXISTS journal_entries_user_saved_at_idx
  ON public.journal_entries (user_id, saved_at DESC);
