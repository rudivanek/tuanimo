/*
  # Fix missing INSERT RLS policies on token_usage and mood_weekly_insights

  ## Problem
  Both tables had RLS enabled with only a SELECT policy. Edge functions create
  Supabase clients using the ANON_KEY + user JWT (not service role), so all
  inserts were silently rejected by Postgres with no error thrown. The insert
  return values were also never checked, so HTTP 200 was returned despite every
  row being dropped.

  ## Changes
  1. `token_usage` — add INSERT policy so authenticated users can log their own usage
  2. `mood_weekly_insights` — add INSERT policy so authenticated users can store their own insights

  ## Security
  Both policies use WITH CHECK (auth.uid() = user_id) — users can only insert
  rows that belong to themselves. SELECT remains restricted to own rows.

  ## Notes
  1. These policies match the actual runtime behavior: edge functions run in the
     context of the authenticated user, not the service role.
  2. Migration comment in original schema said "service role" but code never
     created a service role client — this migration corrects the policy to match
     the actual implementation.
*/

CREATE POLICY "Users can insert own token usage"
  ON token_usage
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own weekly insights"
  ON mood_weekly_insights
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
