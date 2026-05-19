import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const cronHeader = req.headers.get("x-cron-key") ?? "";
    const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;
    const isCronSecret  = cronSecret.length > 0 && cronHeader === cronSecret;

    if (!isServiceRole && !isCronSecret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const svc = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceRoleKey,
    );

    // ── Check master switch ───────────────────────────────────────────────────
    const { data: settingRows } = await svc
      .from("admin_settings")
      .select("key, value")
      .in("key", ["token_rollup_enabled"]);

    const settings = Object.fromEntries(
      (settingRows ?? []).map((r: { key: string; value: string }) => [r.key, r.value])
    );

    if (settings["token_rollup_enabled"] !== "true") {
      console.log("ROLLUP_TOKEN_USAGE: disabled by admin_settings, skipping");
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "token_rollup_enabled=false" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Primary rollup: yesterday (T-1) ──────────────────────────────────────
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const { error: primaryErr } = await svc.rpc("rollup_token_usage_for_day", {
      p_day: yesterdayStr,
    });

    if (primaryErr) {
      console.error("ROLLUP_TOKEN_USAGE: primary rollup error", JSON.stringify(primaryErr));
      throw new Error(`Primary rollup failed: ${primaryErr.message}`);
    }

    console.log(`ROLLUP_TOKEN_USAGE: primary rollup complete for ${yesterdayStr}`);

    // ── Gap-fill: last 7 days ─────────────────────────────────────────────────
    const { data: gapRows, error: gapErr } = await svc.rpc(
      "rollup_token_usage_missing_days",
      { p_days_back: 7 }
    );

    if (gapErr) {
      console.error("ROLLUP_TOKEN_USAGE: gap-fill error", JSON.stringify(gapErr));
    }

    const gapFilled: Array<{ processed_day: string; raw_rows: number }> =
      Array.isArray(gapRows) ? gapRows : [];

    const missedDays = gapFilled.filter((r) => r.processed_day !== yesterdayStr);

    if (missedDays.length > 0) {
      console.log(
        `ROLLUP_TOKEN_USAGE: gap-fill recovered ${missedDays.length} missed day(s): ` +
        missedDays.map((r) => r.processed_day).join(", ")
      );
    } else {
      console.log("ROLLUP_TOKEN_USAGE: gap-fill found no missed days");
    }

    return new Response(
      JSON.stringify({
        ok:            true,
        primary_day:   yesterdayStr,
        gap_days_filled: missedDays.length,
        gap_detail:    missedDays,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("rollup-token-usage error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
