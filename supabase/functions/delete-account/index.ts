import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://app.tuanimo.app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    let targetUserId: string;

    if (requestedUserId && requestedUserId !== caller.id) {
      // Admin deleting someone else — verify caller is admin
      const { data: isAdmin, error: adminCheckError } = await adminClient.rpc("is_admin", {
        uid: caller.id,
      });
      if (adminCheckError || !isAdmin) {
        return json({ error: "Access denied: admin only" }, 403);
      }
      targetUserId = requestedUserId;
    } else {
      // Self-delete (or admin deleting themselves — same flow)
      targetUserId = caller.id;
    }

    // ── Purge all public-schema data ─────────────────────────────────────────
    // Order matters: delete dependents before profiles
    const tables = [
      "chat_threads",          // cascades to chat_messages
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
        // Non-fatal — continue with the rest
      }
    }

    // Delete profile (ON DELETE CASCADE from auth.users would also do this,
    // but we do it explicitly first to be safe)
    await adminClient.from("profiles").delete().eq("id", targetUserId);

    // ── Hard-delete from auth.users ──────────────────────────────────────────
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(targetUserId);
    if (deleteAuthError) {
      console.error("auth.admin.deleteUser error:", deleteAuthError.message);
      return json({ error: "Error eliminando cuenta de autenticación: " + deleteAuthError.message }, 500);
    }

    console.log(`User ${targetUserId} fully deleted by ${caller.id}`);
    return json({ ok: true, deleted_user_id: targetUserId });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("delete-account error:", message);
    return json({ error: message }, 500);
  }
});
