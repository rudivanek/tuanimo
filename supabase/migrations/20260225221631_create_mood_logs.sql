/*
  # Create mood logs table

  ## Summary
  Creates the mood_logs table for daily mood check-ins.
  Users select an emoji and optionally add a note. One entry per user per day.

  ## New Tables
    - `mood_logs`
      - `id` (uuid, primary key) - Unique log identifier
      - `user_id` (uuid, foreign key) - References auth.users(id)
      - `local_date` (date) - Date in user's local timezone
      - `emoji` (text) - Mood emoji (😔/😟/😐/🙂/😊)
      - `note_enc` (text, nullable) - Encrypted optional note (AES-256-CBC)
      - `timezone` (text) - Timezone used for local_date calculation
      - `created_at` (timestamptz) - Log entry creation timestamp

  ## Security
    - Enable RLS on `mood_logs` table
    - Users can only access their own mood logs
    - All CRUD operations restricted to authenticated users

  ## Indexes
    1. (user_id, local_date DESC) for efficient heatmap queries
    2. UNIQUE constraint on (user_id, local_date) to prevent duplicates

  ## Notes
    1. local_date is computed server-side based on user's timezone
    2. emoji is constrained to 5 valid values for mood representation
    3. note_enc stores encrypted optional note (IV:ciphertext format)
    4. One check-in per day per user enforced by unique constraint
    5. Used to calculate streaks and generate weekly insights
*/

CREATE TABLE IF NOT EXISTS mood_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_date date NOT NULL,
  emoji text NOT NULL CHECK (emoji IN ('😔', '😟', '😐', '🙂', '😊')),
  note_enc text,
  timezone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, local_date)
);

CREATE INDEX IF NOT EXISTS mood_logs_user_date_idx 
  ON mood_logs(user_id, local_date DESC);

ALTER TABLE mood_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own mood logs"
  ON mood_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mood logs"
  ON mood_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mood logs"
  ON mood_logs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own mood logs"
  ON mood_logs
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);