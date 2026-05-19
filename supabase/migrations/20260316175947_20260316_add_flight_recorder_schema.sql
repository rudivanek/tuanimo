/*
  # Stage 33C — Flight Recorder: Database Schema

  ## Summary
  Adds Supabase-backed persistent storage for the Elena Flight Recorder QA
  observability system. This is a temporary admin-controlled QA tool, not a
  user-facing feature and not third-party analytics.

  ## Changes

  ### profiles table
  - Adds `flight_recorder_enabled` (boolean, default false)
    Admin sets this to true for specific users they want to record.

  ### New Table: flight_recorder_events
  Stores metadata-only UX events for users where flight_recorder_enabled = true.

  | Column               | Type        | Notes                                         |
  |----------------------|-------------|-----------------------------------------------|
  | id                   | uuid PK     | gen_random_uuid()                             |
  | created_at           | timestamptz | DEFAULT now()                                 |
  | user_id              | uuid NOT NULL | FK → auth.users ON DELETE CASCADE           |
  | event_name           | text NOT NULL | e.g. CHAT_PAGE_OPENED                       |
  | payload              | jsonb NULL  | metadata-only, NO raw user content            |
  | session_id           | text NULL   | groups events per browser session/tab         |
  | app_area             | text NULL   | e.g. 'chat', 'journal', 'insights'            |
  | recorded_by_admin_user_id | uuid NULL | FK → auth.users ON DELETE SET NULL        |

  ## Indexes
  - user_id
  - created_at DESC
  - (user_id, created_at DESC) — primary query pattern
  - event_name

  ## Security
  - RLS enabled; default-deny
  - Users: INSERT only for own rows (user_id = auth.uid())
  - Users: SELECT only own rows
  - Admins: SELECT all rows via is_admin() check
  - Admins: DELETE all rows via is_admin() check
  - profiles.flight_recorder_enabled: admin-only UPDATE via is_admin()

  ## Notes
  1. Users cannot read other users' events.
  2. Only admins can toggle flight_recorder_enabled on profiles.
  3. Recording is opt-in per-user (admin decides).
  4. No raw message/journal text is permitted in payload (enforced at app layer).
*/

-- ============================================================
-- 1. ADD flight_recorder_enabled TO profiles
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'flight_recorder_enabled'
  ) THEN
    ALTER TABLE profiles ADD COLUMN flight_recorder_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ============================================================
-- 2. CREATE flight_recorder_events TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.flight_recorder_events (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                timestamptz NOT NULL DEFAULT now(),
  user_id                   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name                text        NOT NULL,
  payload                   jsonb       NULL,
  session_id                text        NULL,
  app_area                  text        NULL,
  recorded_by_admin_user_id uuid        NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ============================================================
-- 3. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_fre_user_id
  ON public.flight_recorder_events (user_id);

CREATE INDEX IF NOT EXISTS idx_fre_created_at
  ON public.flight_recorder_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fre_user_created
  ON public.flight_recorder_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fre_event_name
  ON public.flight_recorder_events (event_name);

-- ============================================================
-- 4. RLS
-- ============================================================
ALTER TABLE public.flight_recorder_events ENABLE ROW LEVEL SECURITY;

-- Users can insert their own events
CREATE POLICY "Users can insert own flight recorder events"
  ON public.flight_recorder_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own events
CREATE POLICY "Users can read own flight recorder events"
  ON public.flight_recorder_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can read all flight recorder events
CREATE POLICY "Admins can read all flight recorder events"
  ON public.flight_recorder_events FOR SELECT
  TO authenticated
  USING (
    is_admin(auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()))
  );

-- Admins can delete flight recorder events (for clearing logs)
CREATE POLICY "Admins can delete flight recorder events"
  ON public.flight_recorder_events FOR DELETE
  TO authenticated
  USING (
    is_admin(auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()))
  );

-- ============================================================
-- 5. POLICY: Admin can update profiles.flight_recorder_enabled
-- ============================================================
-- This is handled by a SECURITY DEFINER RPC below so normal
-- profile UPDATE policies don't need to be widened.

-- ============================================================
-- 6. ADMIN RPCs
-- ============================================================

-- RPC: admin_set_flight_recorder
-- Allows admin to toggle flight_recorder_enabled for a target user
CREATE OR REPLACE FUNCTION admin_set_flight_recorder(
  p_target_user_id uuid,
  p_enabled boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin(auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid())) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  UPDATE profiles
  SET flight_recorder_enabled = p_enabled,
      updated_at = now()
  WHERE id = p_target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_set_flight_recorder(uuid, boolean) TO authenticated;

-- RPC: admin_list_flight_recorder_users
-- Returns all users with flight recorder status and event counts
CREATE OR REPLACE FUNCTION admin_list_flight_recorder_users()
RETURNS TABLE (
  user_id            uuid,
  email              text,
  full_name          text,
  flight_recorder_enabled boolean,
  event_count        bigint,
  latest_event_at    timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin(auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid())) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  SELECT
    p.id                        AS user_id,
    u.email                     AS email,
    p.full_name                 AS full_name,
    p.flight_recorder_enabled   AS flight_recorder_enabled,
    COUNT(fre.id)               AS event_count,
    MAX(fre.created_at)         AS latest_event_at
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN flight_recorder_events fre ON fre.user_id = p.id
  WHERE p.deleted_at IS NULL
  GROUP BY p.id, u.email, p.full_name, p.flight_recorder_enabled
  ORDER BY p.flight_recorder_enabled DESC, MAX(fre.created_at) DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_list_flight_recorder_users() TO authenticated;

-- RPC: admin_clear_flight_recorder_events
-- Clears all events for a specific user (or all users if null)
CREATE OR REPLACE FUNCTION admin_clear_flight_recorder_events(
  p_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin(auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid())) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  IF p_user_id IS NOT NULL THEN
    DELETE FROM flight_recorder_events WHERE user_id = p_user_id;
  ELSE
    DELETE FROM flight_recorder_events;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_clear_flight_recorder_events(uuid) TO authenticated;
