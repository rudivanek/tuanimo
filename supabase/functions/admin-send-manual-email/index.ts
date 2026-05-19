import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const { ok: isAdmin, userId: adminUserId } = await resolveAdminUser(
      authHeader,
      supabaseUrl,
      anonKey,
      serviceKey,
    );

    if (!isAdmin || !adminUserId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload: SendPayload = await req.json();

    const subject = (payload.subject ?? "").trim();
    const bodyText = (payload.bodyText ?? "").trim();
    const audienceType = payload.audienceType;

    if (!subject) {
      return new Response(
        JSON.stringify({ error: "Subject is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!bodyText) {
      return new Response(
        JSON.stringify({ error: "Body text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!["single", "multiple", "all"].includes(audienceType)) {
      return new Response(
        JSON.stringify({ error: "Invalid audienceType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (audienceType === "single" && (!payload.userIds || payload.userIds.length !== 1)) {
      return new Response(
        JSON.stringify({ error: "single audience requires exactly 1 user id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (audienceType === "multiple" && (!payload.userIds || payload.userIds.length < 1)) {
      return new Response(
        JSON.stringify({ error: "multiple audience requires at least 1 user id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    let recipients: RecipientRow[] = [];

    if (audienceType === "all") {
      const { data: authUsers, error: authUsersErr } = await db.auth.admin.listUsers({
        perPage: 1000,
      });
      if (authUsersErr) throw new Error(`Failed to fetch auth users: ${authUsersErr.message}`);

      const { data: profiles } = await db
        .from("profiles")
        .select("id, first_name, last_name, deleted_at");

      const profileMap = new Map<string, { first_name: string | null; last_name: string | null; deleted_at: string | null }>();
      for (const p of (profiles ?? [])) {
        profileMap.set(p.id, p);
      }

      for (const u of authUsers.users) {
        if (!u.email || !u.email.trim()) continue;
        const profile = profileMap.get(u.id);
        if (profile?.deleted_at) continue;

        const displayName = [profile?.first_name, profile?.last_name]
          .filter(Boolean)
          .join(" ") || u.email;

        recipients.push({
          user_id: u.id,
          email: u.email.trim(),
          display_name: displayName,
        });
      }
    } else {
      const { data: authUsers } = await db.auth.admin.listUsers({ perPage: 1000 });
      const authMap = new Map<string, string>();
      for (const u of (authUsers?.users ?? [])) {
        if (u.email) authMap.set(u.id, u.email.trim());
      }

      const { data: profiles } = await db
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", payload.userIds);

      const profileMap = new Map<string, { first_name: string | null; last_name: string | null }>();
      for (const p of (profiles ?? [])) {
        profileMap.set(p.id, p);
      }

      for (const uid of payload.userIds) {
        const email = authMap.get(uid);
        if (!email) continue;
        const profile = profileMap.get(uid);
        const displayName = [profile?.first_name, profile?.last_name]
          .filter(Boolean)
          .join(" ") || email;
        recipients.push({ user_id: uid, email, display_name: displayName });
      }
    }

    const seenEmails = new Set<string>();
    recipients = recipients.filter((r) => {
      const lower = r.email.toLowerCase();
      if (seenEmails.has(lower)) return false;
      seenEmails.add(lower);
      return true;
    });

    const recipientCount = recipients.length;

    const { data: emailRecord, error: insertErr } = await db
      .from("admin_manual_emails")
      .insert({
        created_by_admin_id: adminUserId,
        audience_type: audienceType,
        subject,
        body_text: bodyText,
        status: "sending",
        recipient_count: recipientCount,
        success_count: 0,
        failure_count: 0,
      })
      .select("id")
      .single();

    if (insertErr || !emailRecord) {
      throw new Error(`Failed to create email record: ${insertErr?.message}`);
    }

    const emailRecordId = emailRecord.id;

    let successCount = 0;
    let failureCount = 0;

    for (const recipient of recipients) {
      try {
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Elena <hi@tuanimo.app>",
            to: [recipient.email],
            subject,
            text: bodyText,
          }),
        });

        const resendData = await resendRes.json();

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

    const finalStatus =
      failureCount === 0 ? "sent" : successCount === 0 ? "failed" : "partial_failed";

    await db
      .from("admin_manual_emails")
      .update({ status: finalStatus, success_count: successCount, failure_count: failureCount })
      .eq("id", emailRecordId);

    return new Response(
      JSON.stringify({
        ok: true,
        emailRecordId,
        recipientCount,
        successCount,
        failureCount,
        status: finalStatus,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[admin-send-manual-email] Error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
