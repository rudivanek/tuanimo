/*
  # Create boundary_events table

  1. New Tables
    - `boundary_events`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `conversation_id` (text, the thread ID)
      - `message_snippet` (text, first 120 chars of the triggering message)
      - `boundary_attempts` (int, escalation layer number)
      - `created_at` (timestamptz)

  2. Purpose
    - Product insight: tracks how often users try to use Elena as a general-purpose assistant
    - Measures positioning confusion and feature demand signals
    - Enables analysis of boundary escalation patterns per user and conversation

  3. Security
    - RLS enabled
    - Only service role can insert (edge function uses service role key)
    - Admins can read all rows via app_admins membership check
    - Users cannot read their own rows (internal product analytics only)
*/

CREATE TABLE IF NOT EXISTS boundary_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id text NOT NULL DEFAULT '',
  message_snippet text NOT NULL DEFAULT '',
  boundary_attempts int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS boundary_events_user_id_idx ON boundary_events(user_id);
CREATE INDEX IF NOT EXISTS boundary_events_created_at_idx ON boundary_events(created_at DESC);

ALTER TABLE boundary_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert boundary events"
  ON boundary_events FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Admins can read boundary events"
  ON boundary_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_admins
      WHERE app_admins.user_id = auth.uid()
    )
  );
