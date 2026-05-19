import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MoodLog {
  local_date: string;
  emoji: string;
  note_enc?: string;
}

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface InsightResponse {
  insight: string;
  comparison: string;
  micro_step: string;
  crisis: "NO" | "MAYBE" | "YES";
}

interface ChatSignalRow {
  signal_type: "positive" | "stress" | "anxiety" | "gratitude";
  score: number;
  signal_date: string;
}

interface ChatSignalSummary {
  positive: number;
  stress: number;
  anxiety: number;
  gratitude: number;
  total: number;
  dominant: string | null;
  activeDays: number;
}

// Generation mode determines which prompt path and signal_meta sources[] are used.
type GenerationMode = "mood_only" | "chat_only" | "combined";

const ALL_EMOJIS = ["😔", "😟", "😐", "🙂", "😊"];

// Minimum chat-signal evidence required for a chat-only weekly insight.
// Mirrors the threshold in get_users_needing_weekly_insight RPC and the
// client-side hasEnoughInsightEvidence check for consistency.
const CHAT_ONLY_MIN_TOTAL = 3;
const CHAT_ONLY_MIN_DAYS = 2;

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

function buildWeekStats(logs: MoodLog[]): {
  distribution: string;
  totals: string;
  totalDays: number;
} {
  const counts: Record<string, number> = {};
  for (const e of ALL_EMOJIS) counts[e] = 0;
  for (const log of logs) {
    if (log.emoji in counts) counts[log.emoji]++;
  }

  const positive = (counts["🙂"] ?? 0) + (counts["😊"] ?? 0);
  const neutral = counts["😐"] ?? 0;
  const hard = (counts["😔"] ?? 0) + (counts["😟"] ?? 0);

  const distribution = ALL_EMOJIS
    .map(e => `${e}: ${counts[e]}`)
    .join(", ");

  const totals = `positivos=${positive}, neutral=${neutral}, difíciles=${hard}`;

  return { distribution, totals, totalDays: logs.length };
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d) + days * 86_400_000;
  return new Date(ms).toISOString().split("T")[0];
}

function buildComposedInsight(
  insight: string,
  comparison: string,
  microStep: string,
): string {
  let composed = insight.trim();
  if (comparison.trim()) {
    composed += `\n\n[[COMPARISON]]\n${comparison.trim()}\n[[/COMPARISON]]`;
  }
  if (microStep.trim()) {
    composed += `\n\n[[MICRO_STEP]]\n${microStep.trim()}\n[[/MICRO_STEP]]`;
  }
  return composed;
}

function parseInsightResponse(raw: string): InsightResponse {
  let text = raw.trim();

  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }

  const obj = JSON.parse(text);

  const insight = typeof obj.insight === "string" && obj.insight.trim()
    ? obj.insight.trim()
    : "Esta semana registraste tu ánimo. Sigue así — cada registro cuenta.";

  const comparison = typeof obj.comparison === "string" ? obj.comparison.trim() : "";
  const micro_step = typeof obj.micro_step === "string" ? obj.micro_step.trim() : "";

  const rawCrisis = obj.crisis ?? "";
  const crisis: "NO" | "MAYBE" | "YES" = ["NO", "MAYBE", "YES"].includes(rawCrisis)
    ? rawCrisis as "NO" | "MAYBE" | "YES"
    : "NO";

  return { insight, comparison, micro_step, crisis };
}

// Aggregates chat_signal_daily_agg rows for a given week.
// Uses the user-scoped client so RLS applies — only the requesting user's rows are read.
async function fetchChatSignalSummary(
  client: ReturnType<typeof createClient>,
  weekStart: string,
  weekEnd: string,
): Promise<ChatSignalSummary> {
  const { data } = await client
    .from("chat_signal_daily_agg")
    .select("signal_type, score, signal_date")
    .gte("signal_date", weekStart)
    .lt("signal_date", weekEnd);

  const rows: ChatSignalRow[] = (data ?? []) as ChatSignalRow[];
  const totals = { positive: 0, stress: 0, anxiety: 0, gratitude: 0 };
  const activeDateSet = new Set<string>();

  for (const r of rows) {
    const s = Number(r.score) || 0;
    if (r.signal_type in totals) {
      totals[r.signal_type] += s;
    }
    if (s > 0 && r.signal_date) {
      activeDateSet.add(r.signal_date);
    }
  }

  const total = totals.positive + totals.stress + totals.anxiety + totals.gratitude;
  const dominant = total > 0
    ? (Object.entries(totals).reduce((a, b) => b[1] > a[1] ? b : a)[0] as string)
    : null;

  return { ...totals, total, dominant, activeDays: activeDateSet.size };
}

// Builds prompt components for mood-only or combined (mood + chat) weeks.
function buildMoodPrompt(
  current: { distribution: string; totals: string; totalDays: number },
  prior: { distribution: string; totals: string; totalDays: number },
  chatSignals: ChatSignalSummary,
): { systemPrompt: string; userMessage: string } {
  const lowDataCurrent = current.totalDays < 2;
  const lowDataPrior = prior.totalDays < 2;

  const systemPrompt = `Eres Elena, una presencia empática de apoyo emocional. Tu tarea es generar una reflexión semanal gentil basada en registros de ánimo.

REGLAS CRÍTICAS:
- Nunca diagnostiques, ni uses lenguaje clínico.
- Sé cálida, concisa y empática.
- crisis debe ser conservador: usa "MAYBE" sólo si hay patrón claro de angustia persistente; "YES" sólo si hay riesgo inmediato evidente; de lo contrario, "NO".
- Responde ÚNICAMENTE con un objeto JSON válido. Sin texto extra, sin bloques de código.

FORMATO DE RESPUESTA (JSON estricto):
{
  "insight": "2 a 4 oraciones empáticas sobre los patrones de esta semana",
  "comparison": "exactamente 1 oración comparando esta semana con la anterior",
  "micro_step": "exactamente 1 sugerencia concreta y pequeña para esta semana",
  "crisis": "NO"
}`;

  const priorSection = lowDataPrior
    ? `Semana anterior: sin suficientes registros (${prior.totalDays} días).`
    : `Semana anterior (${prior.totalDays} días): ${prior.distribution} | ${prior.totals}`;

  const comparisonInstruction = (lowDataCurrent || lowDataPrior)
    ? `Como hay pocos datos, en "comparison" escribe: "Aún no hay suficientes registros de la semana anterior para comparar." y en "micro_step" sugiere registrar el ánimo hoy.`
    : `Compara honestamente pero con gentileza los cambios entre semanas.`;

  // Append chat context only when signals are present
  const chatContextLine = chatSignals.total > 0
    ? (() => {
        const parts: string[] = [];
        if (chatSignals.positive > 0) parts.push(`positivo=${chatSignals.positive}`);
        if (chatSignals.stress > 0) parts.push(`estrés=${chatSignals.stress}`);
        if (chatSignals.anxiety > 0) parts.push(`ansiedad=${chatSignals.anxiety}`);
        if (chatSignals.gratitude > 0) parts.push(`gratitud=${chatSignals.gratitude}`);
        const dominantNote = chatSignals.dominant ? ` (señal dominante: ${chatSignals.dominant})` : "";
        return `Señales emocionales en conversaciones esta semana: ${parts.join(", ")}${dominantNote}. Úsalas para enriquecer la reflexión si son coherentes con el estado de ánimo.`;
      })()
    : "";

  const userMessage = [
    `Semana actual (${current.totalDays} días): ${current.distribution} | ${current.totals}`,
    "",
    priorSection,
    "",
    comparisonInstruction,
    ...(chatContextLine ? ["", chatContextLine] : []),
  ].join("\n");

  return { systemPrompt, userMessage };
}

// Builds prompt components for chat-only weeks (no mood logs available).
// Uses a distinct system prompt that does not reference mood emojis or check-ins.
function buildChatOnlyPrompt(chatSignals: ChatSignalSummary): { systemPrompt: string; userMessage: string } {
  const systemPrompt = `Eres Elena, una presencia empática de apoyo emocional. Tu tarea es generar una reflexión semanal empática basada únicamente en señales emocionales detectadas en las conversaciones de esta semana. No hay registros de estado de ánimo disponibles — trabaja solo con las señales de conversación.

REGLAS CRÍTICAS:
- Nunca diagnostiques, ni uses lenguaje clínico.
- Sé cálida, concisa y empática.
- NO menciones emojis, check-ins de ánimo, ni "días registrados" — no existen esta semana.
- crisis debe ser conservador: usa "MAYBE" sólo si hay patrón claro de angustia persistente; "YES" sólo si hay riesgo inmediato evidente; de lo contrario, "NO".
- Responde ÚNICAMENTE con un objeto JSON válido. Sin texto extra, sin bloques de código.

FORMATO DE RESPUESTA (JSON estricto):
{
  "insight": "2 a 4 oraciones empáticas sobre los patrones emocionales en las conversaciones de esta semana",
  "comparison": "",
  "micro_step": "exactamente 1 sugerencia concreta y pequeña para esta semana",
  "crisis": "NO"
}`;

  const parts: string[] = [];
  if (chatSignals.positive > 0) parts.push(`positivo=${chatSignals.positive}`);
  if (chatSignals.stress > 0) parts.push(`estrés=${chatSignals.stress}`);
  if (chatSignals.anxiety > 0) parts.push(`ansiedad=${chatSignals.anxiety}`);
  if (chatSignals.gratitude > 0) parts.push(`gratitud=${chatSignals.gratitude}`);
  const dominantNote = chatSignals.dominant ? `\nSeñal dominante: ${chatSignals.dominant}` : "";

  const userMessage = [
    `Señales emocionales en conversaciones esta semana (${chatSignals.activeDays} día(s) activo(s)):`,
    parts.map(p => `- ${p}`).join("\n"),
    dominantNote,
    `Total de señales: ${chatSignals.total}`,
    "",
    "No hay registros de estado de ánimo esta semana. Genera una reflexión empática basada únicamente en las señales de conversación anteriores.",
  ].filter(s => s !== undefined).join("\n");

  return { systemPrompt, userMessage };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const budgetResponse = await enforceBudget(user.id);
    if (budgetResponse) return budgetResponse;

    const { weekStartDate } = await req.json();

    const currentWeekStart = weekStartDate as string;
    const currentWeekEnd = addDays(currentWeekStart, 7);
    const priorWeekStart = addDays(currentWeekStart, -7);
    const priorWeekEnd = currentWeekStart;

    // Fetch mood logs (both weeks) and current-week chat signals in parallel.
    // Both are checked before deciding whether generation is viable and which
    // prompt path to use.
    const [currentResult, priorResult, chatSignals] = await Promise.all([
      supabaseClient
        .from("mood_logs")
        .select("local_date, emoji")
        .eq("user_id", user.id)
        .gte("local_date", currentWeekStart)
        .lt("local_date", currentWeekEnd)
        .order("local_date", { ascending: true }),
      supabaseClient
        .from("mood_logs")
        .select("local_date, emoji")
        .eq("user_id", user.id)
        .gte("local_date", priorWeekStart)
        .lt("local_date", priorWeekEnd)
        .order("local_date", { ascending: true }),
      fetchChatSignalSummary(supabaseClient, currentWeekStart, currentWeekEnd),
    ]);

    const currentWeekLogs: MoodLog[] = currentResult.data ?? [];
    const priorWeekLogs: MoodLog[] = priorResult.data ?? [];

    const hasMoodData = currentWeekLogs.length > 0;
    // Chat-only eligibility mirrors the scheduler threshold and the client-side
    // hasEnoughInsightEvidence check so all three surfaces are consistent.
    const hasChatData = chatSignals.total >= CHAT_ONLY_MIN_TOTAL && chatSignals.activeDays >= CHAT_ONLY_MIN_DAYS;

    if (!hasMoodData && !hasChatData) {
      return new Response(
        JSON.stringify({ insight: "No hay suficientes datos esta semana para generar un insight.", crisis: "NO" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine generation mode for this week.
    const mode: GenerationMode = hasMoodData && hasChatData
      ? "combined"
      : hasMoodData
      ? "mood_only"
      : "chat_only";

    let systemPrompt: string;
    let userMessage: string;

    if (mode === "chat_only") {
      ({ systemPrompt, userMessage } = buildChatOnlyPrompt(chatSignals));
    } else {
      const current = buildWeekStats(currentWeekLogs);
      const prior = buildWeekStats(priorWeekLogs);
      ({ systemPrompt, userMessage } = buildMoodPrompt(current, prior, chatSignals));
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) throw new Error("OpenAI API key not configured");

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
        temperature: 0.65,
        max_tokens: 450,
        response_format: { type: "json_object" },
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      throw new Error(`OPENAI_ERROR: ${JSON.stringify(errorData)}`);
    }

    const openaiData = await openaiResponse.json();
    const rawContent: string = openaiData.choices[0].message.content ?? "{}";
    const usage: OpenAIUsage | null = openaiData.usage ?? null;

    let parsed: InsightResponse;
    try {
      parsed = parseInsightResponse(rawContent);
    } catch (parseErr) {
      console.error("JSON parse failed, using fallback:", parseErr);
      parsed = {
        insight: mode === "chat_only"
          ? "Esta semana se detectaron señales emocionales en tus conversaciones. Sigue explorando cómo te sientes con Elena."
          : `Esta semana registraste ${currentWeekLogs.length} día(s) de ánimo. Cada registro es un paso de autoconocimiento — sigue adelante.`,
        comparison: "",
        micro_step: "Hoy, dedica un momento a reconocer cómo estás.",
        crisis: "NO",
      };
    }

    const composedInsight = buildComposedInsight(
      parsed.insight,
      parsed.comparison,
      parsed.micro_step,
    );

    // signal_meta is the source-of-truth for how this insight was generated.
    const signalMeta: Record<string, unknown> = {
      sources: mode === "chat_only" ? ["chat"] : mode === "combined" ? ["mood", "chat"] : ["mood"],
      mood_days: currentWeekLogs.length,
      ...(hasChatData ? { chat: chatSignals } : {}),
    };

    const { error: insightInsertError } = await supabaseClient
      .from("mood_weekly_insights")
      .upsert(
        {
          user_id: user.id,
          week_start_date: currentWeekStart,
          insight_text: composedInsight,
          signal_meta: signalMeta,
        },
        { onConflict: "user_id,week_start_date" },
      );

    if (insightInsertError) {
      console.error("mood_weekly_insights upsert failed:", JSON.stringify(insightInsertError));
    }

    EdgeRuntime.waitUntil(
      logTokenUsageAndIncrement(user.id, "mood_insights", "gpt-4o-mini", usage)
    );

    if (parsed.crisis === "MAYBE" || parsed.crisis === "YES") {
      EdgeRuntime.waitUntil(
        logCrisisEvent({
          userId: user.id,
          severity: parsed.crisis,
          source: "mood-insights",
          model: "gpt-4o-mini",
          meta: { ui_shown: true, mode },
        })
      );
    }

    return new Response(
      JSON.stringify({ insight: composedInsight, crisis: parsed.crisis, usage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Mood insights error:", errMsg, error);
    return new Response(
      JSON.stringify({ error: errMsg || "Internal server error" }),
      {
        status: errMsg === "Unauthorized" ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
