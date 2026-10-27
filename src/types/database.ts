import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Sends an email the admin wrote by hand to chosen users (or everyone).
 * Called from /admin/send-email.
 *
 * Who never receives it, whatever the page sends:
 *   - anyone whose main email switch is off      (profiles.email_opt_in = false)
 *   - anyone whose "Noticias de Con Elena" is off (profiles.email_news_opt_in = false)
 *   - deleted accounts                            (profiles.deleted_at set)
 *   - accounts with no profile row (their switches cannot be checked)
 * These are counted in skipped_count.
 *
 * Every email ends with a footer linking to /settings, where the user can turn
 * "Noticias de Con Elena" off.
 *
 * verify_jwt is false on purpose: the function checks the caller itself
 * (getUser + is_admin).
 */

const APP_URL = "https://app.conelena.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://app.conelena.app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Resend allows 2 requests per second by default; one email every 600 ms stays under it.
const SEND_INTERVAL_MS = 600;
// At 600 ms each, 200 emails take about 2 minutes, close to the edge function time limit.
const MAX_RECIPIENTS = 200;

const FOOTER_TEXT =
  "\n\n—\nRecibes este correo porque tienes una cuenta en Con Elena.\n" +
  `Si no quieres recibir más noticias, puedes ajustar tus preferencias aquí: ${APP_URL}/settings`;

interface SendPayload {
  audienceType: "single" | "multiple" | "all";
  userIds: string[];
  subject: string;
  bodyText: string;
}

interface RecipientRow {
  user_id: string;
  email: string;
  display_name: string;
}

interface ProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  deleted_at: string | null;
  email_opt_in: boolean | null;
  email_news_opt_in: boolean | null;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Same look as the automatic emails (email-lifecycle), without the button.
function buildHtml(bodyText: string): string {
  const paragraphs = bodyText
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br />")}</p>`)
    .join("");
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Elena</title>
</head>
<body style="margin:0;padding:0;background-color:#f9f7f4;font-family:Georgia,'Times New Roman',serif;color:#2c2c2c;">
  <div style="max-width:560px;margin:48px auto;padding:0 24px 48px;">
    <div style="font-size:18px;font-weight:600;letter-spacing:0.06em;color:#2c2c2c;margin-bottom:40px;">elena</div>
    <div style="font-size:16px;line-height:1.7;color:#3a3a3a;margin-bottom:32px;">${paragraphs}</div>
    <hr style="border:none;border-top:1px solid #e8e4de;margin:40px 0;" />
    <div style="margin-top:48px;font-size:13px;color:#999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;">
      Recibes este correo porque tienes una cuenta en Con Elena.<br />
      Si no quieres recibir más noticias, puedes <a href="${APP_URL}/settings" style="color:#999;text-decoration:underline;">ajustar tus preferencias aquí</a>.
    </div>
  </div>
</body>
</html>`;
}

async function resolveAdminUser(
  authHeader: string,
  supabaseUrl: string,
  anonKey: string,
  serviceKey: string,
): Promise<{ ok: boolean; userId: string | null }> {
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : authHeader.trim();
  if (!token) return { ok: false, userId: null };

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return { ok: false, userId: null };

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data, error: rpcErr } = await adminClient.rpc("is_admin", {
    p_uid: user.id,
    p_email: user.email ?? "",
  });

  return { ok: !rpcErr && data === true, userId: user.id };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      return json({ error: "RESEND_API_KEY not configured" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const { ok: isAdmin, userId: adminUserId } = await resolveAdminUser(
      authHeader,
      supabaseUrl,
      anonKey,
      serviceKey,
    );

    if (!isAdmin || !adminUserId) {
      return json({ error: "Unauthorized" }, 401);
    }

    const payload: SendPayload = await req.json();

    const subject = (payload.subject ?? "").trim();
    const bodyText = (payload.bodyText ?? "").trim();
    const audienceType = payload.audienceType;
    const requestedIds = Array.isArray(payload.userIds)
      ? [...new Set(payload.userIds.filter((id) => typeof id === "string" && id))]
      : [];

    if (!subject) return json({ error: "Subject is required" }, 400);
    if (subject.length > 200) return json({ error: "Subject must be at most 200 characters" }, 400);
    if (!bodyText) return json({ error: "Body text is required" }, 400);
    if (bodyText.length > 10000) return json({ error: "Body must be at most 10000 characters" }, 400);
    if (!["single", "multiple", "all"].includes(audienceType)) {
      return json({ error: "Invalid audienceType" }, 400);
    }
    if (audienceType === "single" && requestedIds.length !== 1) {
      return json({ error: "single audience requires exactly 1 user id" }, 400);
    }
    if (audienceType === "multiple" && requestedIds.length < 1) {
      return json({ error: "multiple audience requires at least 1 user id" }, 400);
    }

    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Addresses come from auth; switches and names from profiles.
    const { data: authUsers, error: authUsersErr } = await db.auth.admin.listUsers({ perPage: 1000 });
    if (authUsersErr) throw new Error(`Failed to fetch auth users: ${authUsersErr.message}`);
    const authMap = new Map<string, string>();
    for (const u of authUsers.users) {
      if (u.email && u.email.trim()) authMap.set(u.id, u.email.trim());
    }

    const candidateIds = audienceType === "all" ? [...authMap.keys()] : requestedIds;

    const { data: profiles, error: profilesErr } = await db
      .from("profiles")
      .select("id, first_name, last_name, deleted_at, email_opt_in, email_news_opt_in")
      .in("id", candidateIds);
    if (profilesErr) throw new Error(`Failed to fetch profiles: ${profilesErr.message}`);

    const profileMap = new Map<string, ProfileRow>();
    for (const p of (profiles ?? []) as ProfileRow[]) profileMap.set(p.id, p);

    let recipients: RecipientRow[] = [];
    let skippedCount = 0;

    for (const uid of candidateIds) {
      const email = authMap.get(uid);
      if (!email) continue; // no address: nothing to skip, nothing to send
      const profile = profileMap.get(uid);
      if (
        !profile ||
        profile.deleted_at ||
        profile.email_opt_in === false ||
        profile.email_news_opt_in === false
      ) {
        skippedCount++;
        continue;
      }
      const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || email;
      recipients.push({ user_id: uid, email, display_name: displayName });
    }

    const seenEmails = new Set<string>();
    recipients = recipients.filter((r) => {
      const lower = r.email.toLowerCase();
      if (seenEmails.has(lower)) return false;
      seenEmails.add(lower);
      return true;
    });

    if (recipients.length > MAX_RECIPIENTS) {
      return json({ error: `At most ${MAX_RECIPIENTS} recipients per send (got ${recipients.length})` }, 400);
    }

    const recipientCount = recipients.length;

    const { data: emailRecord, error: insertErr } = await db
      .from("admin_manual_emails")
      .insert({
        created_by_admin_id: adminUserId,
        audience_type: audienceType,
        subject,
        body_text: bodyText,
        status: recipientCount === 0 ? "sent" : "sending",
        recipient_count: recipientCount,
        success_count: 0,
        failure_count: 0,
        skipped_count: skippedCount,
      })
      .select("id")
      .single();

    if (insertErr || !emailRecord) {
      throw new Error(`Failed to create email record: ${insertErr?.message}`);
    }

    const emailRecordId = emailRecord.id;

    let successCount = 0;
    let failureCount = 0;
    const text = bodyText + FOOTER_TEXT;
    const html = buildHtml(bodyText);

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      if (i > 0) await sleep(SEND_INTERVAL_MS);
      try {
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Elena <hola@conelena.app>",
            to: [recipient.email],
            subject,
            text,
            html,
          }),
        });

        const resendData = await resendRes.json().catch(() => ({}));

        if (resendRes.ok) {
          successCount++;
          await db.from("admin_manual_email_recipients").insert({
            manual_email_id: emailRecordId,
            user_id: recipient.user_id,
            email: recipient.email,
            send_status: "sent",
            resend_message_id: resendData.id ?? null,
            sent_at: new Date().toISOString(),
          });
        } else {
          failureCount++;
          await db.from("admin_manual_email_recipients").insert({
            manual_email_id: emailRecordId,
            user_id: recipient.user_id,
            email: recipient.email,
            send_status: "failed",
            error_message: JSON.stringify(resendData),
          });
        }
      } catch (recipientErr) {
        failureCount++;
        await db.from("admin_manual_email_recipients").insert({
          manual_email_id: emailRecordId,
          user_id: recipient.user_id,
          email: recipient.email,
          send_status: "failed",
          error_message: String(recipientErr),
        });
      }
    }

    const finalStatus = recipientCount === 0
      ? "sent"
      : failureCount === 0 ? "sent" : successCount === 0 ? "failed" : "partial_failed";

    await db
      .from("admin_manual_emails")
      .update({ status: finalStatus, success_count: successCount, failure_count: failureCount })
      .eq("id", emailRecordId);

    return json({
      ok: true,
      emailRecordId,
      recipientCount,
      skippedCount,
      successCount,
      failureCount,
      status: finalStatus,
    });
  } catch (err) {
    console.error("[admin-send-manual-email] Error:", err);
    return json({ error: String(err) }, 500);
  }
});