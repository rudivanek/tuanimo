/*
  # Add welcome_inserted flag to chat_threads

  ## Summary
  Adds a boolean column `welcome_inserted` to the `chat_threads` table to track
  whether Elena's welcome message has been inserted for a given chat session.

  ## Changes
  ### Modified Tables
  - `chat_threads`
    - New column: `welcome_inserted` (boolean, default false)
      Used as an idempotency guard so the welcome message is inserted exactly once
      per chat session, even across page refreshes or multi-device access.

  ## Notes
  1. Default is `false` so all existing chat threads are unaffected (they already
     have messages, so the welcome insertion logic will skip them).
  2. The app checks this flag before inserting, then marks it `true` atomically
     after the welcome message row is written to `chat_messages`.
*/

ALTER TABLE chat_threads
  ADD COLUMN IF NOT EXISTS welcome_inserted boolean NOT NULL DEFAULT false;
