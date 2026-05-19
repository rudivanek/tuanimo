/*
  # Create Admin Manual Email Tables

  ## Summary
  Adds two tables to support the Admin Manual Email Sender feature, which
  allows admin users to send plain-text emails to individual users, selected
  groups, or all eligible users via the Resend integration.

  ## New Tables

  ### admin_manual_emails
  - Parent record for each manual send job triggered by an admin.
  - `id` — unique identifier
  - `created_at` — when the send was triggered
  - `created_by_admin_id` — which admin triggered the send
  - `audience_type` — one of: single | multiple | all
  - `subject` — email subject line
  - `body_text` — plain-text email body
  - `status` — draft | sending | sent | partial_failed | failed
  - `recipient_count` — total number of recipients resolved
  - `success_count` — how many emails were sent successfully
  - `failure_count` — how many emails failed

  ### admin_manual_email_recipients
  - One row per individual email sent within a job.
  - `manual_email_id` — FK to admin_manual_emails (cascade delete)
  - `user_id` — optional user ID if known
  - `email` — resolved email address
  - `send_status` — pending | sent | failed
  - `resend_message_id` — ID returned by Resend on success
  - `error_message` — error detail if send_status = failed
  - `sent_at` — timestamp when the email was accepted by Resend

  ## Indexes
  - `admin_manual_emails(created_at DESC)` for history queries
  - `admin_manual_emails(created_by_admin_id)` for per-admin filtering
  - `admin_manual_email_recipients(manual_email_id)` for join performance

  ## Security
  - RLS enabled on both tables
  - Only authenticated admins (via is_admin RPC) can SELECT rows
  - INSERT/UPDATE is handled exclusively by the service role via edge function
  - Regular users have zero access
*/

CREATE TABLE IF NOT EXISTS admin_manual_emails (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by_admin_id   uuid        NOT NULL,
  audience_type         text        NOT NULL CHECK (audience_type IN ('single', 'multiple', 'all')),
  subject               text        NOT NULL,
  body_text             text        NOT NULL,
  status                text        NOT NULL DEFAULT 'sending'
                                    CHECK (status IN ('draft', 'sending', 'sent', 'partial_failed', 'failed')),
  recipient_count       integer     NOT NULL DEFAULT 0,
  success_count         integer     NOT NULL DEFAULT 0,
  failure_count         integer     NOT NULL DEFAULT 0
);

ALTER TABLE admin_manual_emails ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS admin_manual_email_recipients (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  manual_email_id     uuid        NOT NULL REFERENCES admin_manual_emails(id) ON DELETE CASCADE,
  user_id             uuid,
  email               text        NOT NULL,
  send_status         text        NOT NULL DEFAULT 'pending'
                                  CHECK (send_status IN ('pending', 'sent', 'failed')),
  resend_message_id   text,
  error_message       text,
  sent_at             timestamptz
);

ALTER TABLE admin_manual_email_recipients ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_admin_manual_emails_created_at
  ON admin_manual_emails (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_manual_emails_created_by
  ON admin_manual_emails (created_by_admin_id);

CREATE INDEX IF NOT EXISTS idx_admin_manual_email_recipients_email_id
  ON admin_manual_email_recipients (manual_email_id);

CREATE POLICY "Admins can view manual emails"
  ON admin_manual_emails
  FOR SELECT
  TO authenticated
  USING (
    is_admin(auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()))
  );

CREATE POLICY "Admins can view manual email recipients"
  ON admin_manual_email_recipients
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_manual_emails ame
      WHERE ame.id = admin_manual_email_recipients.manual_email_id
    )
    AND is_admin(auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()))
  );
