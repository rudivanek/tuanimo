/*
  # Create chat_to_journal_logs table

  ## Summary
  Adds a dedicated log table for the "Convert chat to journal" feature that serves
  two purposes simultaneously: per-user and per-chat rate limiting, and admin cost
  tracking for this specific operation.

  ## New Tables
    - `chat_to_journal_logs`
      - `id` (uuid, primary key)
      - `user_id` (uuid) – references auth.users
      - `chat_id` (uuid) – the chat thread that was converted
      - `message_count` (int) – number of messages in the sanitized payload
      - `input_chars` (int) – total character count of sanitized message content
      - `model` (text) – OpenAI model used (e.g. gpt-4o-mini)
      - `tokens_in` (int) – prompt tokens consumed
      - `tokens_out` (int) – completion tokens consumed
      - `cost_usd` (numeric 10,6) – estimated USD cost of the call
      - `latency_ms` (int) – end-to-end edge function latency in milliseconds
      - `created_at` (timestamptz) – timestamp of the conversion

  ## Security
    - RLS enabled; users may SELECT their own rows only
    - INSERT is performed by the edge function using the service role (bypasses RLS)
    - No UPDATE or DELETE policies — log rows are immutable

  ## Indexes
    1. (user_id, created_at DESC) — fast per-user rate limit window queries
    2. (user_id, chat_id, created_at DESC) — fast per-chat rate limit window queries

  ## Important Notes
    1. Rate limit logic runs in the edge function; this table is the authoritative
       counter — no in-memory counters that drift on cold starts.
    2. cost_usd is an estimate based on public gpt-4o-mini pricing at migration time;
       the column stores whatever the edge function calculates, so updating the formula
       in the function is sufficient without a schema change.
    3. This table is separate from token_usage intentionally: token_usage tracks all
       LLM calls app-wide; chat_to_journal_logs provides richer per-conversion context
       (chat_id, input_chars, latency) for this specific operation.
*/

CREATE TABLE IF NOT EXISTS chat_to_journal_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id       uuid        NOT NULL,
  message_count int         NOT NULL DEFAULT 0,
  input_chars   int         NOT NULL DEFAULT 0,
  model         text        NOT NULL DEFAULT '',
  tokens_in     int         NOT NULL DEFAULT 0,
  tokens_out    int         NOT NULL DEFAULT 0,
  cost_usd      numeric(10,6) NOT NULL DEFAULT 0,
  latency_ms    int         NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_to_journal_logs_user_created_idx
  ON chat_to_journal_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS chat_to_journal_logs_user_chat_created_idx
  ON chat_to_journal_logs(user_id, chat_id, created_at DESC);

ALTER TABLE chat_to_journal_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own conversion logs"
  ON chat_to_journal_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
