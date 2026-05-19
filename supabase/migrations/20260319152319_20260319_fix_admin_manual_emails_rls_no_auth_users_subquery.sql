/*
  # Fix RLS policies on admin_manual_emails and admin_manual_email_recipients

  ## Problem
  The original policies used:
    is_admin(auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()))

  The subquery against auth.users is evaluated in the calling user's security
  context, which does not have SELECT on auth.users, causing a 403 / permission
  denied for table users error.

  ## Fix
  Call is_admin(auth.uid(), '') instead.
  The function logic is:
    WHERE (user_id = p_uid AND p_uid IS NOT NULL)
       OR (lower(email) = lower(p_email) AND p_email IS NOT NULL AND p_email <> '')
  Passing '' for p_email disables the email branch and lets the UID branch do the
  check — no auth.users access required.
*/

DROP POLICY IF EXISTS "Admins can view manual emails" ON admin_manual_emails;
DROP POLICY IF EXISTS "Admins can view manual email recipients" ON admin_manual_email_recipients;

CREATE POLICY "Admins can view manual emails"
  ON admin_manual_emails
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid(), ''));

CREATE POLICY "Admins can view manual email recipients"
  ON admin_manual_email_recipients
  FOR SELECT
  TO authenticated
  USING (
    is_admin(auth.uid(), '')
    AND EXISTS (
      SELECT 1 FROM admin_manual_emails ame
      WHERE ame.id = admin_manual_email_recipients.manual_email_id
    )
  );
