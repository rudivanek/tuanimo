// DEPLOY REQUIREMENT: verify_jwt MUST be false
// This function performs its own auth via auth.getUser().
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
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

Genera un título en español (entre 4 y 8 palabras) que capture el tema central con sus detalles concretos.
REGLAS:
- Incluye los elementos específicos mencionados (personas, hábitos, situaciones, nombres concretos)
- NO uses términos genéricos como "cambio", "reflexión", "emociones", "sentimientos" si hay algo más concreto
- Natural, directo, sin signos de puntuación al final, sin comillas
- Responde únicamente con el título, nada más.`;
  } else {
    return `A continuación está el inicio de una entrada de diario personal en español.

"${trimmedMsg}"

Genera un título en español (entre 4 y 8 palabras) que capture el tema central con sus detalles concretos.
REGLAS:
- Incluye los elementos específicos mencionados (hábitos, personas, situaciones, nombres concretos)
- NO uses términos genéricos como "reflexión", "emociones", "sentimientos", "promesa de cambio" si hay algo más concreto
- Natural, directo, sin signos de puntuación al final, sin comillas
- Responde únicamente con el título, nada más.`;
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

    // Token budget: fail open on RPC error; when over budget, skip the AI call and
    // return no title with 200 so the best-effort caller keeps its current title.
    const { data: budgetData, error: budgetError } = await getServiceClient().rpc("check_token_budget", { p_user_id: userId });
    if (budgetError) {
      console.error("enforceBudget: check_token_budget failed", JSON.stringify(budgetError));
    } else {
      const budget = Array.isArray(budgetData) ? budgetData[0] : budgetData;
      if (budget && !budget.allowed) {
        return new Response(
          JSON.stringify({ title: null, error: budget.reason }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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
        max_tokens: 40,
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
      .replace(/^["\u00ab\u00bb\u201c\u201d]|["\u00ab\u00bb\u201c\u201d]$/g, "")
      .replace(/[.!?,;\u2026]+$/, "")
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
