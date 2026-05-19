/*
  # Add linked_journal_entry_id to chat_threads

  ## Summary
  Establishes a canonical, database-side link between a chat thread and its
  associated journal entry so that diary-hint suppression survives localStorage
  clears and works across devices.

  ## Changes

  ### Modified Tables
  - `chat_threads`
    - New column: `linked_journal_entry_id` (uuid, nullable)
      - FK → `journal_entries(id)` ON DELETE SET NULL
      - Automatically nulled when the referenced journal entry is deleted

  ### New Indexes
  - `chat_threads_linked_journal_entry_id_idx` on `chat_threads(linked_journal_entry_id)`
    for fast reverse-lookups

  ## Notes
  1. Column is NULL by default; existing threads are unaffected.
  2. RLS on `chat_threads` already restricts writes to the row owner
     (`auth.uid() = user_id`), so no additional policy is needed.
  3. Backfill of legacy threads (entries with source_chat_id but no thread link)
     is handled at runtime by the client-side fallback query in ChatPage.
*/

ALTER TABLE chat_threads
  ADD COLUMN IF NOT EXISTS linked_journal_entry_id uuid
    REFERENCES journal_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS chat_threads_linked_journal_entry_id_idx
  ON chat_threads(linked_journal_entry_id);
