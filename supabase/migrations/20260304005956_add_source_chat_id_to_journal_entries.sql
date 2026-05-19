/*
  # Add source_chat_id to journal_entries

  ## Summary
  Adds a `source_chat_id` column to `journal_entries` so that chat-originated
  drafts can be linked back to the chat thread that triggered them.
  This enables deduplication: before creating a new draft, the app can check
  whether a linked entry already exists for the same thread and open it instead.

  ## Changes
  ### journal_entries
  - `source_chat_id` (uuid, NULL) — Foreign-key-style reference to the
    `chat_threads.id` that triggered draft creation. NULL for manual entries.

  ## New Index
  - `journal_entries_source_chat_id_idx` — Supports lookup by thread id
    when checking for existing drafts.

  ## Security
  - No new RLS policies needed. Existing `user_id = auth.uid()` policies cover
    the new column automatically.

  ## Notes
  1. ADD COLUMN IF NOT EXISTS makes the migration safe to re-run.
  2. Existing rows stay NULL — no back-fill required.
*/

ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS source_chat_id uuid NULL;

CREATE INDEX IF NOT EXISTS journal_entries_source_chat_id_idx
  ON public.journal_entries (source_chat_id)
  WHERE source_chat_id IS NOT NULL;
