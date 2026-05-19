import {
  EMAIL_STEPS,
  SUPPRESSION_SESSIONS_THRESHOLD,
  SUPPRESSION_RECENT_ACTIVE_HOURS,
  MAX_EMAILS_PER_24H,
} from "./types.ts";
import type { LifecycleUser } from "./types.ts";
import {
  fetchEligibleUsers,
  getAlreadySentTypes,
  logLifecycleEvent,
  updateProfileAfterSend,
  bootstrapInactiveUser,
  pauseSequence,
  sendViaResend,
} from "./db.ts";
import { getTemplate } from "./templates.ts";

export interface RunResult {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  logs: string[];
}

function hoursAgo(hours: number): Date {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return d;
}

function isSuppressed(user: LifecycleUser): { suppressed: boolean; reason: string } {
  if (user.sessions_count >= SUPPRESSION_SESSIONS_THRESHOLD) {
    return { suppressed: true, reason: `sessions_count=${user.sessions_count} >= threshold` };
  }
  if (user.last_active_at) {
    const lastActive = new Date(user.last_active_at);
    const cutoff = hoursAgo(SUPPRESSION_RECENT_ACTIVE_HOURS);
    if (lastActive > cutoff) {
      return { suppressed: true, reason: `recently active at ${user.last_active_at}` };
    }
  }
  return { suppressed: false, reason: "" };
}

function withinRateLimit(user: LifecycleUser): boolean {
  if (!user.last_email_sent_at) return true;
  const last = new Date(user.last_email_sent_at);
  const cutoff = hoursAgo(24 * MAX_EMAILS_PER_24H);
  return last <= cutoff;
}

function nextStepForUser(
  user: LifecycleUser,
  sentTypes: Set<string>
): { step: number; type: string; subject: string } | null {
  const anchor = user.lifecycle_started_at ? new Date(user.lifecycle_started_at) : null;
  if (!anchor) return null;
  const now = new Date();

  for (const s of EMAIL_STEPS) {
    if (sentTypes.has(s.type)) continue;
    const sendAfter = new Date(anchor.getTime() + s.delayHours * 60 * 60 * 1000);
    if (now >= sendAfter) {
      return { step: s.step, type: s.type, subject: s.subject };
    }
  }
  return null;
}

export async function runScheduler(dryRun = false): Promise<RunResult> {
  const logs: string[] = [];
  let sent = 0, skipped = 0, failed = 0;

  const users = await fetchEligibleUsers();
  logs.push(`[scheduler] ${users.length} eligible users found`);

  for (const user of users) {
    const prefix = `[${user.email}]`;

    // --- STEP 1: Bootstrap existing inactive users ---
    const sentTypes = await getAlreadySentTypes(user.user_id);
    const isInactiveUncontacted = user.sessions_count === 0 && sentTypes.size === 0;

    if (isInactiveUncontacted && !user.lifecycle_started_at) {
      logs.push(`${prefix} bootstrap: sessions=0, no emails sent, setting lifecycle_started_at=now`);
      if (!dryRun) {
        await bootstrapInactiveUser(user.user_id);
        user.lifecycle_started_at = new Date().toISOString();
      }
    }

    // --- Suppression check ---
    const { suppressed, reason } = isSuppressed(user);
    if (suppressed) {
      logs.push(`${prefix} suppressed: ${reason}`);
      if (!dryRun && user.email_sequence_status === "active") {
        await pauseSequence(user.user_id, reason);
      }
      skipped++;
      continue;
    }

    // --- Rate limit check ---
    if (!withinRateLimit(user)) {
      logs.push(`${prefix} rate limited: last email sent at ${user.last_email_sent_at}`);
      skipped++;
      continue;
    }

    // --- Find next step ---
    const next = nextStepForUser(user, sentTypes);
    if (!next) {
      logs.push(`${prefix} no step due yet (step=${user.email_sequence_step}, lifecycle_started_at=${user.lifecycle_started_at})`);
      skipped++;
      continue;
    }

    logs.push(`${prefix} sending step ${next.step} "${next.type}" (dry_run=${dryRun})`);

    if (dryRun) {
      sent++;
      continue;
    }

    // --- Send ---
    const tpl = getTemplate(next.type, user.first_name);
    if (!tpl) {
      logs.push(`${prefix} ERROR: no template for ${next.type}`);
      failed++;
      continue;
    }

    try {
      const msgId = await sendViaResend(user.email, tpl.subject, tpl.html);
      await logLifecycleEvent({
        user_id: user.user_id,
        email_type: next.type,
        status: "sent",
        resend_message_id: msgId,
        metadata: { step: next.step, subject: next.subject },
      });
      await updateProfileAfterSend(user.user_id, next.step, next.type);
      logs.push(`${prefix} sent OK (resend_id=${msgId})`);
      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logs.push(`${prefix} FAILED: ${msg}`);
      await logLifecycleEvent({
        user_id: user.user_id,
        email_type: next.type,
        status: "failed",
        metadata: { step: next.step, error: msg },
      }).catch(() => {});
      failed++;
    }
  }

  return { processed: users.length, sent, skipped, failed, logs };
}
