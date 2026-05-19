/*
  # Email Lifecycle Schema

  ## Summary
  Adds email onboarding/re-engagement lifecycle tracking to support a 5-day
  Spanish email sequence for Elena users. Covers both new signups and existing
  inactive users who have never had a chat or journal session.

  ## New Columns on profiles

  - `signup_at` (timestamptz) — When the user first signed up (mirrors auth.users.created_at)
  - `last_active_at` (timestamptz) — Last time the user had a meaningful activity (chat or journal)
  - `sessions_count` (int) — Number of meaningful sessions (each session = at least 1 chat msg or journal entry)
  - `first_session_at` (timestamptz) — Timestamp of the user's very first meaningful session
  - `last_email_sent_at` (timestamptz) — When the last lifecycle email was sent
  - `last_email_type` (text) — The type/slug of the last lifecycle email sent
  - `email_sequence_status` (text) — 'active' | 'paused' | 'completed' | 'opted_out'
  - `email_opt_in` (boolean) — Whether the user consents to lifecycle emails (default true)
  - `lifecycle_started_at` (timestamptz) — The anchor time for sequence step timing
  - `email_sequence_step` (int) — Which step they are currently on (0 = not started, 1-5 = steps)

  ## New Table: email_lifecycle_events

  Append-only log of every lifecycle email send attempt. Used for deduplication,
  auditability, and admin monitoring.

  - `id` (uuid, PK)
  - `user_id` (uuid, FK → auth.users)
  - `email_type` (text) — e.g. 'day1_empieza_simple'
  - `sent_at` (timestamptz)
  - `status` (text) — 'sent' | 'failed' | 'skipped'
  - `resend_message_id` (text)
  - `metadata` (jsonb)
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on email_lifecycle_events
  - Users can only read their own events
  - Only service role can insert (via edge functions)
  - Admin RPC to list lifecycle events

  ## Notes
  1. lifecycle_started_at is the sequence anchor — it is set to signup_at for new users,
     and to NOW() for existing inactive users on their first scheduler evaluation.
  2. sessions_count = 0 AND no lifecycle events = existing inactive user bootstrap path.
  3. email_sequence_status starts as 'active' and moves to 'completed' after step 5 or
     'paused' if suppression rules trigger.
*/

-- Add lifecycle columns to profiles (all safe, no destructive changes)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'signup_at') THEN
    ALTER TABLE profiles ADD COLUMN signup_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_active_at') THEN
    ALTER TABLE profiles ADD COLUMN last_active_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'sessions_count') THEN
    ALTER TABLE profiles ADD COLUMN sessions_count int NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'first_session_at') THEN
    ALTER TABLE profiles ADD COLUMN first_session_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_email_sent_at') THEN
    ALTER TABLE profiles ADD COLUMN last_email_sent_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_email_type') THEN
    ALTER TABLE profiles ADD COLUMN last_email_type text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email_sequence_status') THEN
    ALTER TABLE profiles ADD COLUMN email_sequence_status text NOT NULL DEFAULT 'active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email_opt_in') THEN
    ALTER TABLE profiles ADD COLUMN email_opt_in boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'lifecycle_started_at') THEN
    ALTER TABLE profiles ADD COLUMN lifecycle_started_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email_sequence_step') THEN
    ALTER TABLE profiles ADD COLUMN email_sequence_step int NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Backfill signup_at from auth.users.created_at for all existing profiles
UPDATE profiles p
SET signup_at = u.created_at
FROM auth.users u
WHERE p.id = u.id
  AND p.signup_at IS NULL;

-- Set lifecycle_started_at = signup_at for users who already have it set
UPDATE profiles
SET lifecycle_started_at = signup_at
WHERE lifecycle_started_at IS NULL
  AND signup_at IS NOT NULL;

-- Create email_lifecycle_events table
CREATE TABLE IF NOT EXISTS email_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_type text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'skipped')),
  resend_message_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS email_lifecycle_events_user_id_idx ON email_lifecycle_events(user_id);
CREATE INDEX IF NOT EXISTS email_lifecycle_events_user_type_idx ON email_lifecycle_events(user_id, email_type);
CREATE INDEX IF NOT EXISTS email_lifecycle_events_sent_at_idx ON email_lifecycle_events(sent_at DESC);

-- Enable RLS
ALTER TABLE email_lifecycle_events ENABLE ROW LEVEL SECURITY;

-- Users can read their own lifecycle events
CREATE POLICY "Users can read own lifecycle events"
  ON email_lifecycle_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Only service role can insert (edge functions use service role)
-- No insert policy for authenticated = only service role bypasses RLS

-- Admin RPC: list recent lifecycle events with user email
CREATE OR REPLACE FUNCTION admin_list_lifecycle_events(
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email text,
  email_type text,
  sent_at timestamptz,
  status text,
  resend_message_id text,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin(auth.uid(), (SELECT a.email FROM auth.users a WHERE a.id = auth.uid())) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY
  SELECT
    e.id,
    e.user_id,
    u.email::text,
    e.email_type,
    e.sent_at,
    e.status,
    e.resend_message_id,
    e.metadata,
    e.created_at
  FROM email_lifecycle_events e
  JOIN auth.users u ON u.id = e.user_id
  ORDER BY e.sent_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Admin RPC: list users with lifecycle summary
CREATE OR REPLACE FUNCTION admin_list_lifecycle_users(
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  user_id uuid,
  email text,
  signup_at timestamptz,
  lifecycle_started_at timestamptz,
  sessions_count int,
  email_sequence_step int,
  email_sequence_status text,
  email_opt_in boolean,
  last_email_sent_at timestamptz,
  last_email_type text,
  emails_sent bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin(auth.uid(), (SELECT a.email FROM auth.users a WHERE a.id = auth.uid())) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY
  SELECT
    p.id AS user_id,
    u.email::text,
    p.signup_at,
    p.lifecycle_started_at,
    p.sessions_count,
    p.email_sequence_step,
    p.email_sequence_status,
    p.email_opt_in,
    p.last_email_sent_at,
    p.last_email_type,
    COUNT(e.id) AS emails_sent
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN email_lifecycle_events e ON e.user_id = p.id
  WHERE p.deleted_at IS NULL
    AND p.is_disabled = false
  GROUP BY p.id, u.email
  ORDER BY p.signup_at DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
