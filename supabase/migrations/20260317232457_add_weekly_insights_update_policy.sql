/*
  # Add UPDATE policy for mood_weekly_insights

  The mood-insights edge function now uses upsert (insert + update on conflict).
  Without an UPDATE policy, the upsert silently fails when a row already exists
  for the same (user_id, week_start_date) because RLS blocks the update.

  Changes:
  - Adds UPDATE policy allowing authenticated users to update their own weekly insights
*/

CREATE POLICY "Users can update own weekly insights"
  ON mood_weekly_insights
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
