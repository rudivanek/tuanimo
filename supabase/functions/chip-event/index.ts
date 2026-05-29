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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: authUser }, error: authError } = await authClient.auth.getUser();
    if (authError || !authUser) {
      throw new Error("Unauthorized");
    }
    const userId = authUser.id;

    const body = await req.json();
    const eventType: "impression" | "click" = body.type;

    if (eventType !== "impression" && eventType !== "click") {
      throw new Error("Invalid event type — must be 'impression' or 'click'");
    }

    const svc = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: existing } = await svc
      .from("chip_stats")
      .select("impressions_30d, clicks_30d, cooldown_until, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    let impressions = existing?.impressions_30d ?? 0;
    let clicks = existing?.clicks_30d ?? 0;
    const shouldReset = existing && existing.updated_at < thirtyDaysAgo;

    if (shouldReset) {
      impressions = 0;
      clicks = 0;
    }

    if (eventType === "impression") {
      impressions += 1;
    } else {
      clicks += 1;
    }

    let cooldownUntil = existing?.cooldown_until ?? null;
    if (impressions >= 12 && clicks === 0) {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      cooldownUntil = futureDate;
    }

    const { error: upsertError } = await svc
      .from("chip_stats")
      .upsert(
        {
          user_id: userId,
          impressions_30d: impressions,
          clicks_30d: clicks,
          cooldown_until: cooldownUntil,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error("chip-event upsert error:", JSON.stringify(upsertError));
      throw new Error("Failed to record chip event");
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("chip-event error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: error.message === "Unauthorized" ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
