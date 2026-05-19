import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
    if (!authHeader) throw new Error("Unauthorized");

    const jwt = authHeader.replace("Bearer ", "");
    let userId = "unknown";
    try {
      const b64 = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(atob(b64));
      if (payload.sub) userId = payload.sub;
    } catch {
      // best-effort: keep userId as "unknown" rather than blocking the event
    }

    const body = await req.json();
    const eventName: string = body.event_name ?? "unknown";
    const props: Record<string, unknown> = body.props ?? {};

    console.log(JSON.stringify({
      event: eventName,
      user_id: userId,
      ts: new Date().toISOString(),
      ...props,
    }));

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message ?? "error" }),
      {
        status: (error as Error).message === "Unauthorized" ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
