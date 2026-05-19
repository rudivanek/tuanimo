/*
  # Add outcome tracking columns to chat_to_journal_logs

  ## Summary
  Extends the chat_to_journal_logs table to record denied/rejected conversion
  attempts alongside successful ones. This allows the admin to audit refusal
  patterns and ensures rate-limit counters only count successful conversions.

  ## Modified Tables
    - `chat_to_journal_logs`
      - `outcome` (text, NOT NULL, DEFAULT 'success') — 'success' or 'denied'
      - `http_status` (int, NOT NULL, DEFAULT 200) — HTTP status code returned to caller
      - `deny_reason` (text, NOT NULL, DEFAULT '') — machine-readable refusal reason:
          'rl_user'          — user hit hourly conversion limit
          'rl_chat'          — chat hit per-chat hourly limit
          'payload_mismatch' — message count diverges too far from DB
          'chat_not_found'   — chat_id does not exist in chat_threads
          'auth'             — caller is not authenticated
          'bad_request'      — missing/invalid field or empty sanitized payload
          ''                 — successful rows (no denial reason)

  ## Constraints
    - CHECK (outcome IN ('success', 'denied'))

  ## Security
    - No RLS changes; existing SELECT policy (own rows only) covers new columns.
    - INSERT continues to be performed by the service role in the edge function.

  ## Important Notes
    1. Existing rows receive DEFAULT values: outcome='success', http_status=200,
       deny_reason='' — which is accurate since only successful calls were logged.
    2. Rate-limit queries in the edge function now filter WHERE outcome='success'
       so denied rows do not inflate the counter and cause a feedback loop.
    3. No plaintext message content, prompt, or completion is stored in any column.
*/

ALTER TABLE chat_to_journal_logs
  ADD COLUMN IF NOT EXISTS outcome     text NOT NULL DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS http_status int  NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS deny_reason text NOT NULL DEFAULT '';

ALTER TABLE chat_to_journal_logs
  DROP CONSTRAINT IF EXISTS chat_to_journal_logs_outcome_check;

ALTER TABLE chat_to_journal_logs
  ADD CONSTRAINT chat_to_journal_logs_outcome_check
  CHECK (outcome IN ('success', 'denied'));
