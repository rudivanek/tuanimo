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
  excerpt: string;
  daysAgo: number;
  pastSignal: string;
  currentSignal?: string | null;
  deltaDirection?: string | null;
  recentSignals?: string[];
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
    ? `Has alcanzado tu límite diario de ${result.daily_limit.toLocaleString()} tokens. El límite se restablece a las 00:00 UTC.`
    : `Has alcanzado tu límite mensual de ${result.monthly_limit.toLocaleString()} tokens este mes.`;

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

function buildSystemPrompt(
  daysAgo: number,
  pastSignal: string,
  currentSignal?: string | null,
  deltaDirection?: string | null,
): string {
  const signalLabels: Record<string, string> = {
    stress: "estrés o agobio",
    anxiety: "ansiedad o preocupación",
    positive: "positividad o bienestar",
    gratitude: "gratitud",
    neutral: "un estado tranquilo",
  };

  const pastLabel = signalLabels[pastSignal] ?? "cierta carga emocional";
  const currentLabel = currentSignal ? (signalLabels[currentSignal] ?? null) : null;

  let contextLine = `La entrada fue escrita hace ${daysAgo} días y refleja ${pastLabel}.`;

  if (currentLabel && currentLabel !== pastLabel) {
    contextLine += ` Esta semana, el estado emocional parece reflejar ${currentLabel}.`;
  }

  if (deltaDirection === "improved") {
    contextLine += " Las cosas parecen haber mejorado desde entonces.";
  } else if (deltaDirection === "worsened") {
    contextLine += " Las cosas parecen estar más pesadas ahora que entonces.";
  } else if (deltaDirection === "similar") {
    contextLine += " El patrón emocional parece continuar.";
  }

  return `Eres Elena, una presencia de reflexión personal cálida y precisa. Hablas español natural y cercano.

${contextLine}

Tu tarea: generar UNA pregunta de reflexión y UNA frase de inicio para invitar a escribir.

REGLAS DE VOZ (no negociables):
- La pregunta DEBE anclar en algo concreto del extracto — una imagen, un peso, una tensión específica que la persona ya nombró o insinuó. No inventes un tema nuevo.
- La pregunta explora TEXTURA o DURACIÓN — cómo se siente ahora, qué cambió, qué peso tiene hoy. NUNCA pregunta por categorías.
- PROHIBIDO: "¿Cómo te sientes?", "¿Qué emociones sientes?", "¿Sigues sintiéndote [etiqueta]?", cualquier pregunta que nombre ansiedad / tristeza / frustración / confusión como sujeto
- PROHIBIDO: "deberías", "tienes que", "necesitas", "intenta", cualquier instrucción directiva
- Sin diagnósticos ni lenguaje clínico
- Sin mencionar terapia, salud mental ni psicología
- La frase de inicio: invita a escribir desde dentro de la experiencia, no como tarea ("Cuando pienso en eso...", "Lo que más recuerdo es...", "Hoy eso se siente...")
- Una sola pregunta, máximo 28 palabras
- Responde únicamente con JSON válido: {"promptText": "...", "insertStarter": "..."}`;
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
    const { excerpt, daysAgo, pastSignal, currentSignal, deltaDirection, recentSignals } = body;

    if (!excerpt || typeof daysAgo !== "number" || !pastSignal) {
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

    const systemPrompt = buildSystemPrompt(daysAgo, pastSignal, currentSignal, deltaDirection);
    const safeExcerpt = excerpt.slice(0, 200);
    const validSignals = Array.isArray(recentSignals)
      ? recentSignals.filter((s): s is string => typeof s === "string" && s.length > 0).slice(0, 4)
      : [];
    const signalBlock = validSignals.length > 0
      ? `\n\nOtras expresiones recientes del usuario — contexto de fondo únicamente:\n${validSignals.map(s => `- "${s}"`).join("\n")}\nUsa estas expresiones solo si añaden textura concreta que no está ya en el extracto. NUNCA las cites ni las parafrasees directamente. Transforma la sensación, no las palabras. Si el extracto principal ya contiene todo lo necesario, ignora estas señales por completo. No uses más de una.`
      : "";
    const userMessage = `Extracto de la entrada:\n"${safeExcerpt}"${signalBlock}`;

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
          { role: "user", content: userMessage },
        ],
        temperature: 0.8,
        max_tokens: 150,
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
            operation: "ai_reflection_prompt",
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
          operation: "ai_reflection_prompt",
          model: "gpt-4o-mini",
          prompt_tokens: usage?.prompt_tokens ?? 0,
          completion_tokens: usage?.completion_tokens ?? 0,
          total_tokens: usage?.total_tokens ?? 0,
          ...(usage === null ? { metadata: { usage_missing: true } } : {}),
        })
        .then(() => {})
    );

    const raw = openaiData.choices?.[0]?.message?.content ?? "";

    let parsed: { promptText: string; insertStarter: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return new Response(
        JSON.stringify({ error: "PARSE_FAILED" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!parsed.promptText || !parsed.insertStarter) {
      return new Response(
        JSON.stringify({ error: "INCOMPLETE_RESPONSE" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        promptText: parsed.promptText,
        insertStarter: parsed.insertStarter,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[ai-reflection-prompt] unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
