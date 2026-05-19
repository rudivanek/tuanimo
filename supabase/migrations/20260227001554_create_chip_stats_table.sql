/*
  # Create chip_stats table for per-user adaptive chip frequency

  ## Summary
  Adds a table to track each user's chip engagement (impressions and clicks) over a rolling
  30-day window. This powers adaptive chip frequency in chat-ai: users who click chips see
  them more often; users who ignore chips see them less often and may enter a cooldown period.

  ## New Tables
  - `chip_stats`
    - `user_id` (uuid, PK, FK → auth.users): one row per user
    - `impressions_30d` (integer): how many times chips were shown in rolling 30 days
    - `clicks_30d` (integer): how many times user clicked a chip in rolling 30 days
    - `cooldown_until` (timestamptz, nullable): if set, chip frequency is suppressed until this time
    - `updated_at` (timestamptz): when the row was last modified (used for 30-day reset logic)

  ## Indexes
  - `chip_stats_cooldown_idx` on `cooldown_until` for efficient cooldown queries

  ## Security
  - RLS enabled
  - SELECT: user can read their own row
  - INSERT: user can insert their own row
  - UPDATE: user can update their own row
  - Service role bypasses RLS automatically

  ## Trigger
  - `set_chip_stats_updated_at`: auto-updates `updated_at` on every UPDATE
*/

CREATE TABLE IF NOT EXISTS chip_stats (
  user_id        uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  impressions_30d integer     NOT NULL DEFAULT 0,
  clicks_30d      integer     NOT NULL DEFAULT 0,
  cooldown_until  timestamptz NULL,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chip_stats_cooldown_idx ON chip_stats (cooldown_until);

ALTER TABLE chip_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own chip stats"
  ON chip_stats FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chip stats"
  ON chip_stats FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chip stats"
  ON chip_stats FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION set_chip_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chip_stats_updated_at ON chip_stats;
CREATE TRIGGER trg_chip_stats_updated_at
  BEFORE UPDATE ON chip_stats
  FOR EACH ROW EXECUTE FUNCTION set_chip_stats_updated_at();
