/*
  # Add is_draft flag to journal_entries

  ## Summary
  Adds a boolean `is_draft` column to `journal_entries` to mark entries that
  were automatically created from a chat session and haven't been reviewed/saved
  by the user yet. This powers the Chat → Diary intelligence flow where Elena
  creates a pre-filled draft entry based on the emotional context of the
  conversation.

  ## Changes
  - `journal_entries`: new column `is_draft BOOLEAN NOT NULL DEFAULT FALSE`

  ## Notes
  - Existing rows default to FALSE (not a draft)
  - Drafts are created with is_draft = TRUE and cleared to FALSE when the user
    explicitly saves from the journal editor
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'is_draft'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN is_draft BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;
