/*
  # Create crisis_events table

  ## Summary
  Privacy-preserving audit table for crisis signals detected across all AI flows
  (chat-ai, journal-prompts, mood-insights). Stores only minimal metadata —
  NO raw user content (messages, journal text, mood notes) is ever stored here.

  ## New Table

  ### `crisis_events`
  | Column     | Type        | Notes                                              |
  |------------|-------------|----------------------------------------------------|
  | id         | uuid PK     | gen_random_uuid()                                  |
  | user_id    | uuid NOT NULL | FK → auth.users ON DELETE CASCADE                |
  | source     | text NOT NULL | 'chat-ai' | 'journal-prompts' | 'mood-insights'   |
  | severity   | text NOT NULL | 'MAYBE' | 'YES'                                    |
  | created_at | timestamptz | DEFAULT now()                                      |
  | thread_id  | uuid NULL   | Chat thread context (chat-ai only)                 |
  | message_id | uuid NULL   | Chat message row id (chat-ai only)                 |
  | session_id | uuid NULL   | Future: session/run id for batch flows             |
  | model      | text NULL   | AI model used (e.g. gpt-4o-mini)                   |
  | meta       | jsonb NULL  | STRICT safe-only fields: { "ui_shown": bool }      |

  ## Indexes
  - (user_id, created_at DESC)  — per-user chronological queries
  - (source, created_at DESC)   — per-source reporting
  - (severity, created_at DESC) — severity-level filtering

  ## Security
  - RLS enabled; default-deny
  - SELECT: authenticated users can see only their own rows
  - INSERT/UPDATE/DELETE: no user policies — only service_role can write
    (service_role bypasses RLS entirely; users cannot insert crisis events)

  ## Important Notes
  1. Service_role inserts bypass RLS — edge functions use the service role key.
  2. Admin access is via the `admin_list_crisis_events` SECURITY DEFINER RPC (separate migration).
  3. The `meta` column MUST contain only pre-approved safe fields; never raw content.
     Enforced at the application layer (edge functions), not at the DB level.
*/

CREATE TABLE IF NOT EXISTS public.crisis_events (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source     text        NOT NULL CHECK (source IN ('chat-ai', 'journal-prompts', 'mood-insights')),
  severity   text        NOT NULL CHECK (severity IN ('MAYBE', 'YES')),
  created_at timestamptz NOT NULL DEFAULT now(),
  thread_id  uuid        NULL,
  message_id uuid        NULL,
  session_id uuid        NULL,
  model      text        NULL,
  meta       jsonb       NULL
);

CREATE INDEX IF NOT EXISTS idx_crisis_events_user_created
  ON public.crisis_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crisis_events_source_created
  ON public.crisis_events (source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crisis_events_severity_created
  ON public.crisis_events (severity, created_at DESC);

ALTER TABLE public.crisis_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own crisis events"
  ON public.crisis_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
