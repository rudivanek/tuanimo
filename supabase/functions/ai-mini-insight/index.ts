import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface RequestBody {
  dominantSignal: string;
  delta: number;
  basis: string;
  sourceLabel?: string | null;
}

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
}

function getUserIdFromJwt(authHeader: string): string | null {
  try {
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

async function enforceBudget(userId: string): Promise<Response | null> {
  const svc = getServiceClient();
  const { data, error } = await svc.rpc("check_token_budget", { p_user_id: userId });

  if (error) {
    console.error("enforceBudget: check_token_budget failed", JSON.stringify(error));
    return null;
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result || result.allowed) return null;

  const isDailyLimit = result.reason === "DAILY_LIMIT_REACHED";
  const message = isDailyLimit
    ? `Has alcanzado tu límite diario de ${result.daily_limit.toLocaleString()} tokens.`
    : `Has alcanzado tu límite mensual de ${result.monthly_limit.toLocaleString()} tokens.`;

  return new Response(
    JSON.stringify({
      error: result.reason,
      message,
      daily_used: result.daily_used,
      daily_limit: result.daily_limit,
      monthly_used: result.monthly_used,
      monthly_limit: result.monthly_limit,
    }),
    { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

const SIGNAL_LABELS: Record<string, string> = {
  stress: "estrés o carga",
  anxiety: "ansiedad o preocupación",
  positive: "ánimo positivo",
  gratitude: "gratitud",
};

const BASIS_LABELS: Record<string, string> = {
  recovery: "Se detecta un patrón de recuperación: la señal pesada bajó mientras lo positivo subió.",
  delta_large: "El cambio respecto a la semana anterior fue notable.",
  delta_moderate: "El cambio respecto a la semana anterior fue moderado.",
  level: "El nivel se mantuvo relativamente estable.",
};

const SOURCE_LABELS: Record<string, string> = {
  Chats: "Datos basados en conversaciones de la semana.",
  Diario: "Datos basados en entradas del diario de la semana.",
  Mixto: "Datos basados en conversaciones y entradas del diario.",
};

function buildSystemPrompt(
  dominantSignal: string,
  delta: number,
  basis: string,
  sourceLabel?: string | null,
): string {
  const signalLabel = SIGNAL_LABELS[dominantSignal] ?? dominantSignal;
  const basisLabel = BASIS_LABELS[basis] ?? "";
  const sourceContext = sourceLabel ? (SOURCE_LABELS[sourceLabel] ?? "") : "";

  const deltaDir =
    delta >= 5 ? `aumentó considerablemente (+${delta})`
    : delta >= 2 ? `aumentó (+${delta})`
    : delta <= -5 ? `bajó considerablemente (${delta})`
    : delta <= -2 ? `bajó (${delta})`
    : `se mantuvo similar (${delta > 0 ? "+" : ""}${delta})`;

  return `Eres Elena, un asistente de apoyo emocional cálido y directo. Hablas español natural y cercano, sin lenguaje clínico.

Contexto de la semana del usuario:
- Señal dominante: ${signalLabel}
- Cambio vs semana anterior: ${deltaDir}
- Patrón: ${basisLabel}
${sourceContext ? `- ${sourceContext}` : ""}

Tu tarea: generar UNA sola frase de observación en español natural. Máximo 20 palabras. Sin diagnósticos. Sin "deberías" ni consejos directivos. Sin lenguaje clínico. Solo una observación honesta y cercana sobre lo que refleja esta semana.

Responde únicamente con JSON válido: {"text": "..."}`;
}

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

    const userId = getUserIdFromJwt(authHeader);
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const budgetResponse = await enforceBudget(userId);
    if (budgetResponse) return budgetResponse;

    const body: RequestBody = await req.json();
    const { dominantSignal, delta, basis, sourceLabel } = body;

    if (!dominantSignal || typeof delta !== "number" || !basis) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_UNAVAILABLE" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = buildSystemPrompt(dominantSignal, delta, basis, sourceLabel);

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Genera el resumen de esta semana." },
        ],
        temperature: 0.8,
        max_tokens: 80,
        response_format: { type: "json_object" },
      }),
    });

    const openaiData = await openaiResponse.json();

    if (!openaiResponse.ok) {
      EdgeRuntime.waitUntil(
        getServiceClient()
          .from("token_usage")
          .insert({
            user_id: userId,
            operation: "ai_mini_insight",
            model: "gpt-4o-mini",
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
            metadata: { usage_missing: true, openai_error: true },
          })
          .then(() => {})
      );
      return new Response(
        JSON.stringify({ error: "OPENAI_UNAVAILABLE" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const usage: OpenAIUsage | null = openaiData.usage ?? null;

    EdgeRuntime.waitUntil(
      getServiceClient()
        .from("token_usage")
        .insert({
          user_id: userId,
          operation: "ai_mini_insight",
          model: "gpt-4o-mini",
          prompt_tokens: usage?.prompt_tokens ?? 0,
          completion_tokens: usage?.completion_tokens ?? 0,
          total_tokens: usage?.total_tokens ?? 0,
          ...(usage === null ? { metadata: { usage_missing: true } } : {}),
        })
        .then(() => {})
    );

    const raw = openaiData.choices?.[0]?.message?.content ?? "";

    let parsed: { text: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return new Response(
        JSON.stringify({ error: "PARSE_FAILED" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!parsed.text || typeof parsed.text !== "string") {
      return new Response(
        JSON.stringify({ error: "INCOMPLETE_RESPONSE" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ text: parsed.text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[ai-mini-insight] unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
