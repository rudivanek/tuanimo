import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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

    const isServiceRole = authHeader === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`;
    const isCronSecret = cronSecret.length > 0 && cronHeader === cronSecret;

    if (!isServiceRole && !isCronSecret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const svc = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data, error } = await svc.rpc("purge_old_crisis_events");

    if (error) {
      console.error("PURGE_CRISIS_EVENTS_ERROR", JSON.stringify(error));
      throw new Error(error.message);
    }

    const deleted_count = Array.isArray(data) ? (data[0]?.deleted_count ?? 0) : (data?.deleted_count ?? 0);

    console.log(`PURGE_CRISIS_EVENTS: deleted ${deleted_count} rows`);

    return new Response(
      JSON.stringify({ ok: true, deleted_count }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("purge-crisis-events error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
