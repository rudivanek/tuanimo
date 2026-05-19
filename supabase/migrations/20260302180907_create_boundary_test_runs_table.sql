/*
  # Create boundary_test_runs table

  1. New Tables
    - `boundary_test_runs`
      - `id` (uuid, primary key)
      - `admin_user_id` (uuid, references auth.users — the admin who ran the test)
      - `results` (jsonb — full array of BoundaryTestRun objects)
      - `summary` (jsonb — passCount, failCount, totalAttempts, leakReasons, runAt)
      - `created_at` (timestamptz)

  2. Purpose
    - Persists each admin-triggered boundary test run for historical comparison
    - Enables trend analysis: is Elena's boundary system improving or degrading?
    - Provides audit trail of QA runs with full response capture

  3. Security
    - RLS enabled
    - Only admins can insert their own test runs
    - Only admins can read test runs
    - Service role has full access
*/

CREATE TABLE IF NOT EXISTS boundary_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS boundary_test_runs_admin_user_id_idx ON boundary_test_runs(admin_user_id);
CREATE INDEX IF NOT EXISTS boundary_test_runs_created_at_idx ON boundary_test_runs(created_at DESC);

ALTER TABLE boundary_test_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can insert own test runs"
  ON boundary_test_runs FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = admin_user_id AND
    EXISTS (
      SELECT 1 FROM app_admins
      WHERE app_admins.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all test runs"
  ON boundary_test_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_admins
      WHERE app_admins.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role has full access to test runs"
  ON boundary_test_runs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
