/*
  # Create mood weekly insights table

  ## Summary
  Creates the mood_weekly_insights table for storing AI-generated weekly mood summaries.
  Insights are generated server-side using gpt-4o-mini based on the week's mood logs.

  ## New Tables
    - `mood_weekly_insights`
      - `id` (uuid, primary key) - Unique insight identifier
      - `user_id` (uuid, foreign key) - References auth.users(id)
      - `week_start_date` (date) - Monday of the week being analyzed
      - `insight_text` (text) - AI-generated insight summary
      - `created_at` (timestamptz) - Insight creation timestamp

  ## Security
    - Enable RLS on `mood_weekly_insights` table
    - Users can only access their own weekly insights
    - Insights are read-only for users (generated server-side only)

  ## Indexes
    1. (user_id, week_start_date DESC) for efficient insight retrieval
    2. UNIQUE constraint on (user_id, week_start_date) to prevent duplicates

  ## Notes
    1. week_start_date is always a Monday (ISO week standard)
    2. Insights are generated lazily when user views /insights page
    3. AI analyzes emoji patterns and note content for the week
    4. Cached for performance - one insight per week per user
    5. Generated using gpt-4o-mini for cost optimization
*/

CREATE TABLE IF NOT EXISTS mood_weekly_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  insight_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS mood_weekly_insights_user_week_idx 
  ON mood_weekly_insights(user_id, week_start_date DESC);

ALTER TABLE mood_weekly_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own weekly insights"
  ON mood_weekly_insights
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);