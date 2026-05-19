import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MoodLog {
  local_date: string;
  emoji: string;
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
  activeDays: number; // distinct signal_date days with score > 0
}

interface WeekSliceEdge {
  weekStart: string;
  weekEnd: string;
  totals: { positive: number; stress: number; anxiety: number; gratitude: number };
  dayCount: number;
}

interface SignalTrendEdge {
  signal: string;
  direction: "rising" | "falling" | "stable";
  weekCount: number;
  sustained: boolean;
  delta: number;
}

// Generation mode determines which prompt path and signal_meta sources[] are used.
type GenerationMode = "mood_only" | "chat_only" | "combined";

const ALL_EMOJIS = ["😔", "😟", "😐", "🙂", "😊"];

// Minimum chat-signal evidence to generate a chat-only weekly insight.
// Must match the threshold in get_users_needing_weekly_insight RPC and the
// client-side hasEnoughInsightEvidence check so all three are consistent.
const CHAT_ONLY_MIN_TOTAL = 3;
const CHAT_ONLY_MIN_DAYS = 2;

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d) + days * 86_400_000;
  return new Date(ms).toISOString().split("T")[0];
}

function buildWeekStats(logs: MoodLog[]): { distribution: string; totals: string; totalDays: number } {
  const counts: Record<string, number> = {};
  for (const e of ALL_EMOJIS) counts[e] = 0;
  for (const log of logs) {
    if (log.emoji in counts) counts[log.emoji]++;
  }
  const positive = (counts["🙂"] ?? 0) + (counts["😊"] ?? 0);
  const neutral = counts["😐"] ?? 0;
  const hard = (counts["😔"] ?? 0) + (counts["😟"] ?? 0);
  const distribution = ALL_EMOJIS.map(e => `${e}: ${counts[e]}`).join(", ");
  const totals = `positivos=${positive}, neutral=${neutral}, difíciles=${hard}`;
  return { distribution, totals, totalDays: logs.length };
}

function buildComposedInsight(insight: string, comparison: string, microStep: string): string {
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

// Slices a flat list of ChatSignalRow into N weekly buckets ending at referenceEndDate (exclusive).
// slices[0] = most recent week, slices[n-1] = oldest.
function buildWeekSlicesEdge(rows: ChatSignalRow[], referenceEndDate: string, numWeeks = 4): WeekSliceEdge[] {
  const slices: WeekSliceEdge[] = [];
  for (let i = 0; i < numWeeks; i++) {
    const weekEnd = addDays(referenceEndDate, -(i * 7));
    const weekStart = addDays(weekEnd, -7);
    const weekRows = rows.filter((r) => r.signal_date >= weekStart && r.signal_date < weekEnd);
    const totals = { positive: 0, stress: 0, anxiety: 0, gratitude: 0 };
    const uniqueDays = new Set<string>();
    for (const r of weekRows) {
      const s = Number(r.score) || 0;
      if (r.signal_type in totals) totals[r.signal_type as keyof typeof totals] += s;
      uniqueDays.add(r.signal_date);
    }
    slices.push({ weekStart, weekEnd, totals, dayCount: uniqueDays.size });
  }
  return slices;
}

const SIGNAL_TYPES_EDGE = ["positive", "stress", "anxiety", "gratitude"] as const;
const MIN_DELTA_EDGE = 1.5;
const STRONG_DELTA_EDGE = 3;

// Mirrors client-side detectMultiWeekTrends. Returns trends[] and weeksWithData count.
function detectTrendsEdge(slices: WeekSliceEdge[]): { trends: SignalTrendEdge[]; weeksWithData: number } {
  const weeksWithData = slices.filter((s) => s.dayCount > 0).length;
  if (slices.length < 2 || weeksWithData < 2) return { trends: [], weeksWithData };

  const trends: SignalTrendEdge[] = [];
  for (const signal of SIGNAL_TYPES_EDGE) {
    const values = slices.map((s) => s.totals[signal]);
    const totalDelta = values[0] - values[values.length - 1];

    if (Math.abs(totalDelta) < MIN_DELTA_EDGE) {
      trends.push({ signal, direction: "stable", weekCount: slices.filter((s) => s.totals[signal] > 0).length, sustained: false, delta: totalDelta });
      continue;
    }

    const direction = totalDelta > 0 ? "rising" : "falling";
    const deltas: number[] = [];
    for (let i = 0; i < values.length - 1; i++) deltas.push(values[i] - values[i + 1]);
    const consistentCount = deltas.filter((d) => direction === "rising" ? d > 0 : d < 0).length;
    const sustained = slices.length >= 3 && consistentCount >= slices.length - 1;

    trends.push({ signal, direction, weekCount: slices.filter((s) => s.totals[signal] > 0).length, sustained, delta: totalDelta });
  }
  return { trends, weeksWithData };
}

// Converts trend data into a concise Spanish context sentence for prompt injection.
// Only includes trends that cross the "strong enough" bar.
// Returns empty string when evidence is too weak to mention.
function buildMultiWeekTrendContext(trends: SignalTrendEdge[], weeksWithData: number): string {
  if (weeksWithData < 2) return "";

  const lines: string[] = [];
  for (const t of trends) {
    if (t.direction === "stable") continue;
    if (Math.abs(t.delta) < STRONG_DELTA_EDGE && !t.sustained) continue;

    const rising = t.direction === "rising";
    if (t.signal === "stress") {
      lines.push(t.sustained
        ? (rising ? "El estrés se ha mantenido elevado durante varias semanas consecutivas." : "El estrés ha ido bajando de forma sostenida en las últimas semanas.")
        : (rising ? "El estrés parece haber aumentado en las últimas semanas." : "El estrés parece haberse reducido progresivamente."));
    } else if (t.signal === "anxiety") {
      lines.push(t.sustained
        ? (rising ? "La ansiedad ha ido en aumento durante varias semanas consecutivas." : "La ansiedad ha ido disminuyendo de forma sostenida.")
        : (rising ? "La ansiedad parece haber aumentado en las últimas semanas." : "La ansiedad parece haberse reducido gradualmente."));
    } else if (t.signal === "positive") {
      lines.push(t.sustained
        ? (rising ? "Los momentos positivos han ido creciendo semana a semana — una tendencia alentadora." : "Los momentos positivos han ido reduciéndose en las últimas semanas.")
        : (rising ? "Parece haber más energía positiva en las últimas semanas." : "Parece haber menos momentos positivos que en semanas anteriores."));
    } else if (t.signal === "gratitude") {
      if (rising) {
        lines.push(t.sustained
          ? "La gratitud ha ido apareciendo con más frecuencia a lo largo de varias semanas."
          : "La gratitud parece estar ganando presencia en las conversaciones recientes.");
      } else if (t.sustained) {
        lines.push("La gratitud ha aparecido con menos frecuencia en las últimas semanas.");
      }
    }
  }

  if (lines.length === 0) return "";
  return `Contexto de tendencia (últimas semanas): ${lines.join(" ")} Menciona esta tendencia sólo si encaja de forma natural con la reflexión — no lo fuerces.`;
}

// Aggregates chat_signal_daily_agg rows for a specific user and week.
// Uses the service client — must filter by user_id explicitly since RLS is bypassed.
// Returns per-signal totals, dominant signal, and count of distinct active days.
async function fetchChatSignalSummary(
  svc: ReturnType<typeof createClient>,
  userId: string,
  weekStart: string,
  weekEnd: string,
): Promise<ChatSignalSummary> {
  const { data } = await svc
    .from("chat_signal_daily_agg")
    .select("signal_type, score, signal_date")
    .eq("user_id", userId)
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

// Fetches all chat_signal_daily_agg rows for a user across a multi-week window.
// Used to build trend slices — wider than the single-week summary fetch.
async function fetchMultiWeekChatSignals(
  svc: ReturnType<typeof createClient>,
  userId: string,
  since: string,
  before: string,
): Promise<ChatSignalRow[]> {
  const { data } = await svc
    .from("chat_signal_daily_agg")
    .select("signal_type, score, signal_date")
    .eq("user_id", userId)
    .gte("signal_date", since)
    .lt("signal_date", before);
  return (data ?? []) as ChatSignalRow[];
}

// Builds the supplementary context line for mood+chat combined prompt.
// Returns empty string when there is no chat signal data.
function buildChatSignalContext(cs: ChatSignalSummary): string {
  if (cs.total === 0) return "";
  const parts: string[] = [];
  if (cs.positive > 0) parts.push(`positivo=${cs.positive}`);
  if (cs.stress > 0) parts.push(`estrés=${cs.stress}`);
  if (cs.anxiety > 0) parts.push(`ansiedad=${cs.anxiety}`);
  if (cs.gratitude > 0) parts.push(`gratitud=${cs.gratitude}`);
  const dominantNote = cs.dominant ? ` (señal dominante: ${cs.dominant})` : "";
  return `Señales emocionales en conversaciones esta semana: ${parts.join(", ")}${dominantNote}. Úsalas para enriquecer la reflexión si son coherentes con el estado de ánimo.`;
}

// Builds prompt components for mood-only or combined (mood + chat) weeks.
function buildMoodPrompt(
  current: { distribution: string; totals: string; totalDays: number },
  prior: { distribution: string; totals: string; totalDays: number },
  chatSignals: ChatSignalSummary,
  trendContext: string,
  languageSignalContext = "",
): { systemPrompt: string; userMessage: string } {
  const lowDataCurrent = current.totalDays < 2;
  const lowDataPrior = prior.totalDays < 2;

  const systemPrompt = `Eres Elena, una presencia empática de apoyo emocional. Tu tarea es generar una reflexión semanal basada en registros de ánimo.

REGLAS DE VOZ (no negociables):
- Nunca diagnostiques, ni uses lenguaje clínico.
- PROHIBIDO como apertura de frase: "Es comprensible", "Es normal", "Es natural", "A veces las emociones", "puede ser difícil"
- PROHIBIDO usar ansiedad / estrés / tristeza / frustración como sujeto gramatical principal de una oración (ej: "El estrés se mantuvo" — prohibido). Describe la textura vivida en su lugar.
- Describe cómo se siente la semana — peso, presencia, ligereza, tensión, espacio — no qué categoría emocional representa.
- La reflexión debe sentirse como una observación cercana y específica, no como un resumen estadístico.
- crisis debe ser conservador: usa "MAYBE" sólo si hay patrón claro de angustia persistente; "YES" sólo si hay riesgo inmediato evidente; de lo contrario, "NO".
- Responde ÚNICAMENTE con un objeto JSON válido. Sin texto extra, sin bloques de código.

FORMATO DE RESPUESTA (JSON estricto):
{
  "insight": "2 a 4 oraciones que describen la textura de esta semana desde la experiencia vivida",
  "comparison": "exactamente 1 oración comparando esta semana con la anterior, en tono de presencia, no de reporte",
  "micro_step": "exactamente 1 invitación abierta y gentil — una pregunta o un gesto pequeño, no una instrucción ni una tarea",
  "crisis": "NO"
}`;

  const priorSection = lowDataPrior
    ? `Semana anterior: sin suficientes registros (${prior.totalDays} días).`
    : `Semana anterior (${prior.totalDays} días): ${prior.distribution} | ${prior.totals}`;

  const comparisonInstruction = (lowDataCurrent || lowDataPrior)
    ? `Como hay pocos datos, en "comparison" escribe: "Aún no hay suficientes registros de la semana anterior para comparar." y en "micro_step" sugiere registrar el ánimo hoy.`
    : `Compara honestamente pero con gentileza los cambios entre semanas.`;

  const chatContext = buildChatSignalContext(chatSignals);
  const userMessage = [
    `Semana actual (${current.totalDays} días): ${current.distribution} | ${current.totals}`,
    "",
    priorSection,
    "",
    comparisonInstruction,
    ...(chatContext ? ["", chatContext] : []),
    ...(trendContext ? ["", trendContext] : []),
    ...(languageSignalContext ? ["", languageSignalContext] : []),
  ].join("\n");

  return { systemPrompt, userMessage };
}

// Builds prompt components for chat-only weeks (no mood logs available).
// Uses a distinct system prompt that does not reference mood emojis or check-ins.
function buildChatOnlyPrompt(chatSignals: ChatSignalSummary, trendContext: string, languageSignalContext = ""): { systemPrompt: string; userMessage: string } {
  const systemPrompt = `Eres Elena, una presencia empática de apoyo emocional. Tu tarea es generar una reflexión semanal basada únicamente en señales emocionales detectadas en las conversaciones de esta semana. No hay registros de estado de ánimo disponibles — trabaja solo con las señales de conversación.

REGLAS DE VOZ (no negociables):
- Nunca diagnostiques, ni uses lenguaje clínico.
- PROHIBIDO como apertura de frase: "Es comprensible", "Es normal", "Es natural", "A veces las emociones", "puede ser difícil"
- PROHIBIDO usar ansiedad / estrés / tristeza / frustración como sujeto gramatical principal de una oración. Describe la textura vivida en su lugar.
- Describe cómo se sintió la semana en las conversaciones — peso, presencia, ligereza, tensión, espacio — no qué categoría emocional representa.
- La reflexión debe sentirse como una observación cercana y específica, no como un resumen de estadísticas.
- NO menciones emojis, check-ins de ánimo, ni "días registrados" — no existen esta semana.
- crisis debe ser conservador: usa "MAYBE" sólo si hay patrón claro de angustia persistente; "YES" sólo si hay riesgo inmediato evidente; de lo contrario, "NO".
- Responde ÚNICAMENTE con un objeto JSON válido. Sin texto extra, sin bloques de código.

FORMATO DE RESPUESTA (JSON estricto):
{
  "insight": "2 a 4 oraciones que describen la textura de esta semana desde la experiencia vivida en conversación",
  "comparison": "",
  "micro_step": "exactamente 1 invitación abierta y gentil — una pregunta o un gesto pequeño, no una instrucción ni una tarea",
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
    ...(trendContext ? ["", trendContext] : []),
    ...(languageSignalContext ? ["", languageSignalContext] : []),
  ].filter(s => s !== undefined).join("\n");

  return { systemPrompt, userMessage };
}

const SIGNAL_KEYWORDS_EDGE: Record<string, string[]> = {
  gratitude: ["gratitud", "agradecimiento", "gracias", "agradecer", "agradecida", "agradecido"],
  anxiety: ["ansiedad", "ansioso", "ansiosa", "nervios", "nervioso", "nerviosa", "preocupación", "preocupacion", "preocupado", "preocupada"],
  stress: ["estrés", "estres", "agobio", "agobiado", "agobiada", "carga", "presión", "presion", "tension", "tensión", "sobrecarga", "agotamiento"],
  positive: ["positivo", "positiva", "alegría", "alegria", "alegre", "calma", "tranquilo", "tranquila", "feliz", "felicidad", "bienestar", "contento", "contenta", "satisfecho", "satisfecha"],
};

function matchSignalsEdge(tags: string[] | null, title: string | null): Array<"positive" | "stress" | "anxiety" | "gratitude"> {
  const tokens: string[] = [];
  if (tags) {
    for (const tag of tags) tokens.push(tag.toLowerCase().trim());
  }
  if (title) {
    tokens.push(
      ...title.toLowerCase().replace(/[^a-záéíóúüñ\s]/g, " ").split(/\s+/).filter(Boolean),
    );
  }
  const matched = new Set<"positive" | "stress" | "anxiety" | "gratitude">();
  for (const [signal, keywords] of Object.entries(SIGNAL_KEYWORDS_EDGE)) {
    for (const kw of keywords) {
      if (tokens.some((t) => t.includes(kw))) {
        matched.add(signal as "positive" | "stress" | "anxiety" | "gratitude");
        break;
      }
    }
  }
  return Array.from(matched);
}

const MOOD_EMOJI_SIGNAL_EDGE: Record<string, { signal: "positive" | "stress"; score: number }> = {
  "😊": { signal: "positive", score: 1.0 },
  "🙂": { signal: "positive", score: 0.5 },
  "😟": { signal: "stress",   score: 0.5 },
  "😔": { signal: "stress",   score: 1.0 },
};

function convertMoodLogsToSignalRows(logs: MoodLog[]): ChatSignalRow[] {
  const rows: ChatSignalRow[] = [];
  for (const log of logs) {
    const mapped = MOOD_EMOJI_SIGNAL_EDGE[log.emoji];
    if (mapped) {
      rows.push({ signal_date: log.local_date, signal_type: mapped.signal, score: mapped.score });
    }
  }
  return rows;
}

interface JournalEntryEdge {
  title: string | null;
  saved_at: string;
  tags: string[] | null;
}

async function fetchMoodTrendRows(
  svc: ReturnType<typeof createClient>,
  userId: string,
  since: string,
  before: string,
): Promise<ChatSignalRow[]> {
  const { data } = await svc
    .from("mood_logs")
    .select("local_date, emoji")
    .eq("user_id", userId)
    .gte("local_date", since)
    .lt("local_date", before);
  return convertMoodLogsToSignalRows((data ?? []) as MoodLog[]);
}

async function fetchRecentJournalTitles(
  svc: ReturnType<typeof createClient>,
  userId: string,
  since: string,
  before: string,
): Promise<string[]> {
  const { data } = await svc
    .from("journal_entries")
    .select("title")
    .eq("user_id", userId)
    .not("title", "is", null)
    .gte("created_at", since)
    .lt("created_at", before)
    .order("created_at", { ascending: false })
    .limit(8);
  return ((data ?? []) as Array<{ title: string | null }>)
    .map(e => e.title ?? "")
    .filter(t => t.length > 3);
}

function buildLanguageSignalContext(titles: string[]): string {
  if (titles.length === 0) return "";
  return `\n\nTítulos recientes del diario del usuario — contexto de textura:\n${titles.map(t => `- "${t}"`).join("\n")}\nSi algún título contiene una imagen o tensión concreta, puedes reflejar su textura (transformada, nunca citada) en el campo "insight" únicamente — y solo en una frase, no en todo el insight. Lenguaje simple y directo: PROHIBIDO tono literario o poético. Si ningún título aporta algo concreto más allá de lo ya visible en los datos, ignóralos por completo.`;
}

async function fetchJournalSignalRows(
  svc: ReturnType<typeof createClient>,
  userId: string,
  since: string,
  before: string,
): Promise<ChatSignalRow[]> {
  const { data } = await svc
    .from("journal_entries")
    .select("title, saved_at, tags")
    .eq("user_id", userId)
    .not("saved_at", "is", null)
    .gte("saved_at", since)
    .lt("saved_at", before);
  const entries: JournalEntryEdge[] = (data ?? []) as JournalEntryEdge[];
  const rows: ChatSignalRow[] = [];
  for (const entry of entries) {
    const signalDate = entry.saved_at.slice(0, 10);
    const signals = matchSignalsEdge(entry.tags, entry.title);
    for (const signal of signals) {
      rows.push({ signal_date: signalDate, signal_type: signal, score: 1 });
    }
  }
  return rows;
}

async function generateInsightForUser(
  svc: ReturnType<typeof createClient>,
  userId: string,
  weekStartDate: string,
  openaiKey: string,
): Promise<void> {
  const weekEndDate = addDays(weekStartDate, 7);
  const priorWeekStart = addDays(weekStartDate, -7);

  const trendWindowStart = addDays(weekStartDate, -21);

  // Fetch mood logs (both windows), current-week chat signals, multi-week
  // chat signal rows, mood trend rows, and journal signal rows — all in parallel.
  const [currentResult, priorResult, chatSignals, multiWeekRows, moodTrendRows, journalTrendRows, recentTitles] = await Promise.all([
    svc.from("mood_logs")
      .select("local_date, emoji")
      .eq("user_id", userId)
      .gte("local_date", weekStartDate)
      .lt("local_date", weekEndDate)
      .order("local_date", { ascending: true }),
    svc.from("mood_logs")
      .select("local_date, emoji")
      .eq("user_id", userId)
      .gte("local_date", priorWeekStart)
      .lt("local_date", weekStartDate)
      .order("local_date", { ascending: true }),
    fetchChatSignalSummary(svc, userId, weekStartDate, weekEndDate),
    fetchMultiWeekChatSignals(svc, userId, trendWindowStart, weekEndDate),
    fetchMoodTrendRows(svc, userId, trendWindowStart, weekEndDate),
    fetchJournalSignalRows(svc, userId, trendWindowStart, weekEndDate),
    fetchRecentJournalTitles(svc, userId, trendWindowStart, weekEndDate),
  ]);

  const currentWeekLogs: MoodLog[] = currentResult.data ?? [];
  const priorWeekLogs: MoodLog[] = priorResult.data ?? [];

  const hasMoodData = currentWeekLogs.length > 0;
  // Chat-only eligibility mirrors get_users_needing_weekly_insight threshold
  const hasChatData = chatSignals.total >= CHAT_ONLY_MIN_TOTAL && chatSignals.activeDays >= CHAT_ONLY_MIN_DAYS;

  // Skip if neither source has enough data — e.g. race condition between RPC
  // selection and actual data arrival.
  if (!hasMoodData && !hasChatData) return;

  // Determine which generation mode applies for this week.
  const mode: GenerationMode = hasMoodData && hasChatData
    ? "combined"
    : hasMoodData
    ? "mood_only"
    : "chat_only";

  // Merge all signal sources for multi-week trend computation.
  // Chat rows carry weighted scores; journal rows score=1 per keyword match;
  // mood rows score=0.5–1.0 based on emoji valence.
  // Scores accumulate additively — the strong delta threshold (3) prevents
  // weak single-source noise from producing false trend assertions.
  const allTrendRows = [...multiWeekRows, ...moodTrendRows, ...journalTrendRows];
  const activeTrendSources = [
    ...(multiWeekRows.length > 0 ? ["chat"] : []),
    ...(moodTrendRows.length > 0 ? ["mood"] : []),
    ...(journalTrendRows.length > 0 ? ["journal"] : []),
  ];

  const trendSlices = buildWeekSlicesEdge(allTrendRows, weekEndDate, 4);
  const { trends, weeksWithData } = detectTrendsEdge(trendSlices);
  const trendContext = buildMultiWeekTrendContext(trends, weeksWithData);

  let systemPrompt: string;
  let userMessage: string;

  const languageSignalContext = buildLanguageSignalContext(recentTitles);

  if (mode === "chat_only") {
    ({ systemPrompt, userMessage } = buildChatOnlyPrompt(chatSignals, trendContext, languageSignalContext));
  } else {
    const current = buildWeekStats(currentWeekLogs);
    const prior = buildWeekStats(priorWeekLogs);
    ({ systemPrompt, userMessage } = buildMoodPrompt(current, prior, chatSignals, trendContext, languageSignalContext));
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
        { role: "user", content: userMessage },
      ],
      temperature: 0.65,
      max_tokens: 450,
      response_format: { type: "json_object" },
    }),
  });

  if (!openaiResponse.ok) {
    const errorData = await openaiResponse.json();
    throw new Error(`OpenAI error: ${JSON.stringify(errorData)}`);
  }

  const openaiData = await openaiResponse.json();
  const rawContent: string = openaiData.choices[0].message.content ?? "{}";
  const usage: OpenAIUsage | null = openaiData.usage ?? null;

  let parsed: InsightResponse;
  try {
    parsed = parseInsightResponse(rawContent);
  } catch {
    const moodDays = currentWeekLogs.length;
    parsed = {
      insight: moodDays > 0
        ? `Esta semana registraste ${moodDays} día(s) de ánimo. Cada registro es un paso de autoconocimiento — sigue adelante.`
        : `Esta semana se detectaron señales en tus conversaciones. Sigue explorando cómo te sientes con Elena.`,
      comparison: "",
      micro_step: "Hoy, dedica un momento a reconocer cómo estás.",
      crisis: "NO",
    };
  }

  const composedInsight = buildComposedInsight(parsed.insight, parsed.comparison, parsed.micro_step);

  // signal_meta is the source-of-truth for how this insight was generated.
  // Downstream UI and future analytics can read sources[] to know the mode.
  const signalMeta: Record<string, unknown> = {
    sources: mode === "chat_only" ? ["chat"] : mode === "combined" ? ["mood", "chat"] : ["mood"],
    mood_days: currentWeekLogs.length,
    ...(hasChatData ? { chat: chatSignals } : {}),
    trend_sources: activeTrendSources,
    ...(trendContext ? { trend_context_injected: true, trend_weeks_with_data: weeksWithData } : {}),
  };

  const { error: insightError } = await svc
    .from("mood_weekly_insights")
    .upsert(
      {
        user_id: userId,
        week_start_date: weekStartDate,
        insight_text: composedInsight,
        signal_meta: signalMeta,
      },
      { onConflict: "user_id,week_start_date", ignoreDuplicates: true },
    );

  if (insightError) {
    throw new Error(`Failed to save insight: ${insightError.message}`);
  }

  const safeUsage = {
    prompt_tokens: usage?.prompt_tokens ?? 0,
    completion_tokens: usage?.completion_tokens ?? 0,
    total_tokens: usage?.total_tokens ?? 0,
  };

  await svc.from("token_usage").insert({
    user_id: userId,
    operation: "mood_insights_auto",
    model: "gpt-4o-mini",
    ...safeUsage,
    metadata: { auto_generated: true, mode, ...(usage === null ? { usage_missing: true } : {}) },
  });

  if (parsed.crisis === "MAYBE" || parsed.crisis === "YES") {
    await svc.from("crisis_events").insert({
      user_id: userId,
      source: "mood-insights",
      severity: parsed.crisis,
      model: "gpt-4o-mini",
      meta: { auto_generated: true, mode },
    });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const svc = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceRoleKey);

    const authHeader = req.headers.get("Authorization") ?? "";
    const cronPassphraseHeader = req.headers.get("x-cron-passphrase") ?? "";
    const cronSecretEnv = Deno.env.get("CRON_SECRET") ?? "";

    const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;
    const isCronSecretEnv = cronSecretEnv.length > 0 && req.headers.get("x-cron-key") === cronSecretEnv;

    let isCronPassphrase = false;
    if (!isServiceRole && !isCronSecretEnv && cronPassphraseHeader.length > 0) {
      const { data: passphraseRow } = await svc
        .from("admin_settings")
        .select("value")
        .eq("key", "weekly_insights_cron_passphrase")
        .maybeSingle();
      isCronPassphrase =
        !!passphraseRow?.value &&
        passphraseRow.value.length > 0 &&
        passphraseRow.value === cronPassphraseHeader;
    }

    if (!isServiceRole && !isCronSecretEnv && !isCronPassphrase) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: settingRows } = await svc
      .from("admin_settings")
      .select("key, value")
      .eq("key", "weekly_insights_enabled");

    const isEnabled =
      (settingRows ?? []).find((r: { key: string; value: string }) => r.key === "weekly_insights_enabled")?.value === "true";

    if (!isEnabled) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "weekly_insights_enabled=false" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) throw new Error("OpenAI API key not configured");

    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const daysToThisMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const thisMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysToThisMonday));
    const lastMonday = new Date(thisMonday);
    lastMonday.setUTCDate(thisMonday.getUTCDate() - 7);

    const weekStartDate = lastMonday.toISOString().slice(0, 10);
    const weekEndDate = thisMonday.toISOString().slice(0, 10);

    const { data: eligibleUsers, error: eligibleError } = await svc.rpc(
      "get_users_needing_weekly_insight",
      { p_week_start: weekStartDate, p_week_end: weekEndDate },
    );

    if (eligibleError) throw new Error(`Failed to get eligible users: ${eligibleError.message}`);

    const users: Array<{ user_id: string }> = eligibleUsers ?? [];
    console.log(`WEEKLY_INSIGHTS: week=${weekStartDate} eligible=${users.length}`);

    let processed = 0;
    let failed = 0;
    const errors: Array<{ user_id: string; error: string }> = [];

    for (const { user_id } of users) {
      try {
        await generateInsightForUser(svc, user_id, weekStartDate, openaiKey);
        processed++;
        console.log(`WEEKLY_INSIGHTS: generated for user ${user_id}`);
      } catch (err) {
        failed++;
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ user_id, error: message });
        console.error(`WEEKLY_INSIGHTS: failed for user ${user_id}: ${message}`);
      }
    }

    console.log(`WEEKLY_INSIGHTS: done week=${weekStartDate} processed=${processed} failed=${failed}`);

    return new Response(
      JSON.stringify({ ok: true, week_start_date: weekStartDate, processed, failed, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("generate-weekly-insights error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
