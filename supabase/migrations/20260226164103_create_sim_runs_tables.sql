/*
  # Simulation Runs Tables

  ## Summary
  Creates two tables to persist admin token-cost simulation runs and their
  per-scenario results. These are admin-only resources used by the simulator
  module to store historical run data.

  ## New Tables

  ### sim_runs
  Stores a top-level record for each simulation run:
  - `id`            — surrogate PK
  - `admin_user_id` — FK to auth.users; who triggered the run
  - `config`        — JSONB snapshot of the run configuration
  - `status`        — lifecycle: pending | running | completed | failed | cancelled
  - `summary`       — JSONB aggregate results (populated when completed)
  - `created_at`, `updated_at`

  ### sim_run_items
  Stores one row per scenario executed within a run:
  - `id`, `run_id`  — FK back to sim_runs
  - `scenario_id`, `type`, `persona_label`, `language`
  - `turns_count`, `prompt_tokens`, `completion_tokens`, `total_tokens`
  - `cost_usd`      — computed cost in USD
  - `total_latency_ms`
  - `turn_details`  — JSONB array of per-turn breakdowns
  - `error`         — non-null if this scenario failed

  ## Security
  - RLS enabled on both tables; default-deny.
  - Only admins (checked via is_admin RPC) can read/write their own sim_runs.
  - sim_run_items access piggybacked on sim_runs ownership.

  ## Notes
  1. The frontend currently accumulates results in-memory; these tables are for
     future persistence / history features.
  2. No user data or PII is stored — all scenario content is synthetic.
*/

-- ============================================================
-- sim_runs
-- ============================================================
CREATE TABLE IF NOT EXISTS sim_runs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  config         jsonb       NOT NULL DEFAULT '{}',
  status         text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','running','completed','failed','cancelled')),
  summary        jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sim_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select own sim_runs"
  ON sim_runs FOR SELECT
  TO authenticated
  USING (
    admin_user_id = auth.uid()
    AND is_admin(auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()))
  );

CREATE POLICY "Admins can insert sim_runs"
  ON sim_runs FOR INSERT
  TO authenticated
  WITH CHECK (
    admin_user_id = auth.uid()
    AND is_admin(auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()))
  );

CREATE POLICY "Admins can update own sim_runs"
  ON sim_runs FOR UPDATE
  TO authenticated
  USING (admin_user_id = auth.uid())
  WITH CHECK (admin_user_id = auth.uid());

CREATE POLICY "Admins can delete own sim_runs"
  ON sim_runs FOR DELETE
  TO authenticated
  USING (admin_user_id = auth.uid());

-- ============================================================
-- sim_run_items
-- ============================================================
CREATE TABLE IF NOT EXISTS sim_run_items (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id           uuid        NOT NULL REFERENCES sim_runs(id) ON DELETE CASCADE,
  scenario_id      text        NOT NULL,
  type             text        NOT NULL CHECK (type IN ('chat','journal')),
  persona_label    text        NOT NULL DEFAULT '',
  language         text        NOT NULL DEFAULT 'en',
  turns_count      int         NOT NULL DEFAULT 0,
  prompt_tokens    int         NOT NULL DEFAULT 0,
  completion_tokens int        NOT NULL DEFAULT 0,
  total_tokens     int         NOT NULL DEFAULT 0,
  cost_usd         numeric(14,8) NOT NULL DEFAULT 0,
  total_latency_ms int         NOT NULL DEFAULT 0,
  turn_details     jsonb       NOT NULL DEFAULT '[]',
  error            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sim_run_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select sim_run_items via run ownership"
  ON sim_run_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sim_runs r
      WHERE r.id = run_id AND r.admin_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert sim_run_items"
  ON sim_run_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sim_runs r
      WHERE r.id = run_id AND r.admin_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete sim_run_items"
  ON sim_run_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sim_runs r
      WHERE r.id = run_id AND r.admin_user_id = auth.uid()
    )
  );
