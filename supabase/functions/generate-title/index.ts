// DEPLOY REQUIREMENT: verify_jwt MUST be false
// This function performs its own auth via auth.getUser().
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://tu-animo.app",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ── Auth helpers ─────────────────────────────────────────────────────────────

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
}

async function getVerifiedUserId(authHeader: string): Promise<string | null> {
  try {
    const client = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}

// ── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(
  context: "chat" | "journal",
  firstUserMessage: string,
  firstReply?: string,
): string {
  const trimmedMsg = firstUserMessage.slice(0, 300);
  const trimmedReply = firstReply ? firstReply.slice(0, 200) : null;

  if (context === "chat") {
    return `A continuación está el inicio de una conversación de bienestar emocional en español.

Usuario: "${trimmedMsg}"
${trimmedReply ? `Consejera: "${trimmedReply}"` : ""}

Genera un título muy corto (4 a 6 palabras) en español que capture el tema central de esta conversación. El título debe ser natural, concreto y sin signos de puntuación al final. No uses comillas. Responde únicamente con el título, nada más.`;
  } else {
    return `A continuación está el inicio de una entrada de diario personal en español.

"${trimmedMsg}"

Genera un título muy corto (4 a 6 palabras) en español que capture el tema o sentimiento central de esta entrada. El título debe ser natural, concreto y sin signos de puntuación al final. No uses comillas. Responde únicamente con el título, nada más.`;
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = await getVerifiedUserId(authHeader);
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { context, firstUserMessage, firstReply } = body as {
      context: "chat" | "journal";
      firstUserMessage: string;
      firstReply?: string;
    };

    if (!context || !firstUserMessage?.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_UNAVAILABLE" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = buildPrompt(context, firstUserMessage.trim(), firstReply?.trim());

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 30,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const anthropicData = await anthropicRes.json();

    if (!anthropicRes.ok) {
      console.error("[generate-title] Anthropic error:", anthropicData);
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_UNAVAILABLE" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const usage = anthropicData.usage ?? null;

    // Log token usage fire-and-forget
    EdgeRuntime.waitUntil(
      getServiceClient()
        .from("token_usage")
        .insert({
          user_id: userId,
          operation: "generate_title",
          model: "claude-haiku-4-5-20251001",
          prompt_tokens: usage?.input_tokens ?? 0,
          completion_tokens: usage?.output_tokens ?? 0,
          total_tokens: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
          metadata: { context },
        })
        .then(() => {})
    );

    const raw: string = anthropicData.content?.[0]?.text ?? "";
    const title = raw
      .trim()
      .replace(/^["«»""]|["«»""]$/g, "") // strip any surrounding quotes
      .replace(/[.!?,;…]+$/, "")          // strip trailing punctuation
      .trim();

    if (!title || title.length < 2) {
      return new Response(
        JSON.stringify({ error: "EMPTY_TITLE" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ title }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[generate-title] unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
