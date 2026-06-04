import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://app.tuanimo.app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const APP_URL = "https://app.tuanimo.app";

// ─── Goodbye email template ───────────────────────────────────────────────────

function goodbyeTemplate(firstName: string | null): string {
  const name = firstName ? `, ${firstName}` : "";
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Elena</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f9f7f4; font-family: Georgia, 'Times New Roman', serif; color: #2c2c2c; }
    .wrapper { max-width: 560px; margin: 48px auto; padding: 0 24px 48px; }
    .logo { font-size: 18px; font-weight: 600; letter-spacing: 0.06em; color: #2c2c2c; margin-bottom: 40px; font-family: Georgia, serif; }
    .body-text { font-size: 16px; line-height: 1.7; color: #3a3a3a; margin-bottom: 32px; }
    .body-text p { margin: 0 0 20px; }
    .cta-wrap { margin: 36px 0; }
    .cta { display: inline-block; background-color: #2c2c2c; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-weight: 500; letter-spacing: 0.01em; }
    .footer { margin-top: 48px; font-size: 13px; color: #999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; }
    hr { border: none; border-top: 1px solid #e8e4de; margin: 40px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="logo">elena</div>
    <div class="body-text">
      <p>Hola${name}.</p>
      <p>Tu cuenta ha sido eliminada. Todos tus datos — chats, diario, insights — han sido borrados de forma permanente. Nada queda guardado.</p>
      <p>No sé qué te trajo hasta aquí, ni qué te llevó a irte. Pero sí sé que el hecho de haber buscado un espacio para mirarte hacia adentro dice algo de ti. Eso no desaparece con una cuenta.</p>
      <p>Si algún día quieres volver — aunque sea solo para ver cómo te sientes — la puerta está abierta. Sin historial, sin juicio. Como si fuera la primera vez.</p>
    </div>
    <div class="cta-wrap">
      <a href="${APP_URL}" class="cta">Volver a Elena</a>
    </div>
    <hr />
    <div class="footer">
      Este es el último correo que recibirás de Elena.<br />
      Tu cuenta y todos tus datos han sido eliminados permanentemente.
    </div>
  </div>
</body>
</html>`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // ── Verify caller JWT ────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser();
    if (authError || !caller) return json({ error: "Unauthorized" }, 401);

    // ── Service-role client for admin operations ─────────────────────────────
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // ── Determine which user to delete ───────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const requestedUserId: string | undefined = body.user_id;

    const isSelfDelete = !requestedUserId || requestedUserId === caller.id;
    let targetUserId: string;

    if (!isSelfDelete) {
      // Admin deleting someone else — verify caller is admin
      const { data: isAdmin, error: adminCheckError } = await adminClient.rpc("is_admin", {
        uid: caller.id,
      });
      if (adminCheckError || !isAdmin) {
        return json({ error: "Access denied: admin only" }, 403);
      }
      targetUserId = requestedUserId!;
    } else {
      targetUserId = caller.id;
    }

    // ── Fetch profile before deletion (need email + name for goodbye email) ──
    const { data: profile } = await adminClient
      .from("profiles")
      .select("first_name")
      .eq("id", targetUserId)
      .maybeSingle();

    const { data: authUser } = await adminClient.auth.admin.getUserById(targetUserId);
    const targetEmail = authUser?.user?.email ?? null;
    const firstName = profile?.first_name ?? null;

    // ── Send goodbye email (self-delete only, before wiping data) ────────────
    if (isSelfDelete && targetEmail) {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Elena <hi@tuanimo.app>",
              to: [targetEmail],
              subject: "Hasta pronto",
              html: goodbyeTemplate(firstName),
            }),
          });
          console.log(`Goodbye email sent to ${targetEmail}`);
        } catch (emailErr) {
          // Non-fatal — don't block the deletion if email fails
          console.error("Goodbye email failed (non-fatal):", emailErr);
        }
      }
    }

    // ── Purge all public-schema data ─────────────────────────────────────────
    const tables = [
      "chat_threads",           // cascades to chat_messages
      "journal_entries",
      "token_usage",
      "token_usage_daily_rollup",
      "mood_logs",
      "mood_weekly_insights",
      "user_memory",
      "chip_stats",
      "crisis_events",
      "boundary_events",
      "chat_signal_daily_agg",
      "email_lifecycle_events",
      "email_user_overrides",
      "flight_recorder_events",
      "chat_to_journal_logs",
      "journal_daily_usage",
      "commitments",
      "user_daily_tasks",
    ];

    for (const table of tables) {
      const { error } = await adminClient.from(table).delete().eq("user_id", targetUserId);
      if (error) {
        console.error(`Error deleting from ${table}:`, error.message);
      }
    }

    // Delete profile explicitly before auth delete
    await adminClient.from("profiles").delete().eq("id", targetUserId);

    // ── Hard-delete from auth.users ──────────────────────────────────────────
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(targetUserId);
    if (deleteAuthError) {
      console.error("auth.admin.deleteUser error:", deleteAuthError.message);
      return json({ error: "Error eliminando cuenta: " + deleteAuthError.message }, 500);
    }

    console.log(`User ${targetUserId} fully deleted by ${caller.id} (self=${isSelfDelete})`);
    return json({ ok: true, deleted_user_id: targetUserId });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("delete-account error:", message);
    return json({ error: message }, 500);
  }
});
