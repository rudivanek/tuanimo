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

interface PromptsResponse {
  prompts: string[];
  crisis: "NO" | "MAYBE" | "YES";
}

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
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
    : `Has alcanzado tu límite mensual de ${result.monthly_limit.toLocaleString()} tokens este mes. Se restablece el primer día del próximo mes a las 00:00 UTC.`;

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

async function logTokenUsageAndIncrement(
  userId: string,
  operation: string,
  model: string,
  usage: OpenAIUsage | null,
) {
  const svc = getServiceClient();
  const safeUsage = {
    prompt_tokens: usage?.prompt_tokens ?? 0,
    completion_tokens: usage?.completion_tokens ?? 0,
    total_tokens: usage?.total_tokens ?? 0,
  };

  const { error: insertError } = await svc.from("token_usage").insert({
    user_id: userId,
    operation,
    model,
    ...safeUsage,
    ...(usage === null ? { metadata: { usage_missing: true } } : {}),
  });

  if (insertError) {
    console.error("TOKEN_USAGE_LOG_FAILED", JSON.stringify(insertError), { userId, operation });
  }
}

async function logCrisisEvent(params: {
  userId: string;
  severity: "MAYBE" | "YES";
  source: "chat-ai" | "journal-prompts" | "mood-insights";
  model?: string | null;
  meta?: Record<string, unknown>;
}) {
  const svc = getServiceClient();
  const { error } = await svc.from("crisis_events").insert({
    user_id: params.userId,
    source: params.source,
    severity: params.severity,
    model: params.model ?? null,
    meta: params.meta ?? null,
  });
  if (error) {
    console.error("CRISIS_EVENT_LOG_FAILED", JSON.stringify(error), { userId: params.userId, source: params.source });
  }
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const userId = getUserIdFromJwt(authHeader);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const user = { id: userId };

    const budgetResponse = await enforceBudget(user.id);
    if (budgetResponse) return budgetResponse;

    let languageSignals: string[] = [];
    try {
      const body = await req.json().catch(() => ({}));
      if (Array.isArray(body.languageSignals)) {
        languageSignals = (body.languageSignals as unknown[])
          .filter((s): s is string => typeof s === "string" && s.length > 0)
          .slice(0, 5);
      }
    } catch { /* ignore parse errors */ }

    const { data: recentEntries } = await getServiceClient()
      .from("journal_entries")
      .select("title, prompt, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    const recentContext = recentEntries && recentEntries.length > 0
      ? `\n\nEntradas recientes (para evitar repetición y para anclar en lo que la persona ya ha explorado):\n${recentEntries.map(e => `- ${e.title || 'Sin título'}${e.prompt ? ` (inicio: "${e.prompt.slice(0, 60)}")` : ''}`).join('\n')}`
      : '';

    const signalContext = languageSignals.length > 0
      ? `\n\nExpresiones recientes del usuario — contexto de textura:\n${languageSignals.map(s => `- "${s}"`).join('\n')}\n\nREGLAS para usar estas señales:\n- Si hay UNA señal con una imagen o tensión concreta y real, transforma su TEXTURA (no sus palabras) en exactamente UNA de las tres invitaciones. Las otras dos invitaciones no deben tocarlo.\n- NUNCA repitas ni parafrasees las palabras de la señal — transforma la sensación en algo nuevo.\n- Lenguaje simple y directo: PROHIBIDO tono literario, poético o dramático.\n- Si ninguna señal aporta algo concreto y nuevo más allá del contexto ya visible, ignóralas todas. No fuerces el reconocimiento.`
      : '';

    const systemPrompt = `Eres Elena, una presencia de reflexión personal cálida y precisa. Generas 3 invitaciones de escritura en español para que la persona pueda continuar explorando lo que está viviendo.

REGLAS DE VOZ (no negociables):
- Escribe SIEMPRE en español natural y cercano
- Cada invitación debe anclar en algo concreto: una sensación, un momento, un peso, una textura — no en una categoría emocional abstracta
- NUNCA preguntes por "emociones" como categoría: están prohibidas frases como "¿Qué emociones sientes?", "¿Cómo te sientes?", "Describe tus emociones", "¿Qué emoción te acompaña?"
- NUNCA uses palabras como ansiedad, frustración, confusión, tristeza, angustia como sujeto gramatical de la pregunta
- NUNCA uses "deberías", "tienes que", "necesitas", "intenta", "haz" ni ninguna instrucción directiva
- La invitación debe sentirse como algo que ya estaba ahí, no como una tarea nueva
- Cada invitación: una sola pregunta, máximo 20 palabras, abierta, sin parte doble

CÓMO GENERAR PREGUNTAS CON TEXTURA (ejemplos del tipo correcto):
- "¿Qué cargas ahora que no has dicho en voz alta?"
- "¿Hay algo que ha estado presente esta semana sin que lo hayas nombrado del todo?"
- "¿Qué se siente más pesado de lo que debería?"
- "¿Qué momento de esta semana se quedó contigo sin saber bien por qué?"
- "¿Hay algo que sientes que quiere espacio para salir?"
${recentContext}${signalContext}

Evaluación de crisis:
- Analiza el contexto de temas recientes para detectar señales de angustia severa.
- Usa "MAYBE" solo si hay señales claras de angustia emocional persistente.
- Usa "YES" solo si hay señales inequívocas de riesgo inmediato.
- En ausencia de señales claras, usa "NO".

Devuelve SIEMPRE un objeto JSON con exactamente esta estructura:
{
  "prompts": ["invitación 1", "invitación 2", "invitación 3"],
  "crisis": "NO"
}

Los valores válidos para "crisis" son: "NO", "MAYBE", "YES".`;

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      throw new Error("OpenAI API key not configured");
    }

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
          { role: "user", content: "Genera 3 sugerencias de escritura para hoy, en español." },
        ],
        temperature: 0.9,
        max_tokens: 400,
        response_format: { type: "json_object" },
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      throw new Error(`OPENAI_ERROR: ${JSON.stringify(errorData)}`);
    }

    const openaiData = await openaiResponse.json();
    const parsed: PromptsResponse = JSON.parse(openaiData.choices[0].message.content);
    const prompts = parsed.prompts || [];
    const crisis = (parsed.crisis && ["NO", "MAYBE", "YES"].includes(parsed.crisis))
      ? parsed.crisis
      : "NO";
    const usage: OpenAIUsage | null = openaiData.usage ?? null;

    EdgeRuntime.waitUntil(
      logTokenUsageAndIncrement(user.id, "journal_prompts", "gpt-4o-mini", usage)
    );

    if (crisis === "MAYBE" || crisis === "YES") {
      EdgeRuntime.waitUntil(
        logCrisisEvent({
          userId: user.id,
          severity: crisis,
          source: "journal-prompts",
          model: "gpt-4o-mini",
          meta: { ui_shown: true },
        })
      );
    }

    return new Response(
      JSON.stringify({ prompts, crisis, usage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Journal prompts error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: error.message === "Unauthorized" ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
