/*
  # Add chip_meta column to chat_messages

  ## Summary
  Adds an optional JSONB column `chip_meta` to the `chat_messages` table to
  store metadata about which suggestion chip (if any) the user selected to
  compose a given message.

  ## New Columns
  - `chat_messages.chip_meta` (jsonb, nullable) — stores { id, label, intentKey }
    for user messages that were composed using a suggestion chip.
    Assistant messages will always have NULL here.

  ## Notes
  - Non-destructive: nullable column with no default.
  - No RLS changes needed (inherits existing chat_messages policies).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'chip_meta'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN chip_meta jsonb;
  END IF;
END $$;
