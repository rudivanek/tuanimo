/*
  # Add sort_order to chat_threads and journal_entries

  ## Summary
  Adds a sort_order integer column to both chat_threads and journal_entries
  so users can manually reorder items in the sidebar lists.

  ## Changes
  - `chat_threads`: new `sort_order` integer column, defaults to 0
  - `journal_entries`: new `sort_order` integer column, defaults to 0
  - Existing rows get sort_order assigned based on their current created_at DESC position

  ## Notes
  1. Lower sort_order = higher in the list (ascending sort)
  2. On insert, new rows should get sort_order = 0 (top of list)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_threads' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE chat_threads ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
  END IF;
END $$;

UPDATE chat_threads t
SET sort_order = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) - 1 AS rn
  FROM chat_threads
) sub
WHERE t.id = sub.id;

UPDATE journal_entries j
SET sort_order = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) - 1 AS rn
  FROM journal_entries
) sub
WHERE j.id = sub.id;
