// DEPLOY REQUIREMENT: verify_jwt MUST be false
// This function performs its own auth via auth.getUser().
// Deploying with verify_jwt:true causes a 401 at the Supabase gateway
// before the function even runs. Always deploy with verify_jwt: false.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ConvertRequest {
  chat_id: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  locale?: string;
  max_words?: number;
}

interface DraftResult {
  title: string;
  content: string;
  tags: string[];
  summary_meta: { message_count: number };
  diag?: Diag;
}

type Diag = {
  has_service_key: boolean;
  project_url_host: string;
  smoke_insert: "skipped" | "ok" | "failed";
  smoke_error?: { code?: string; message?: string; details?: string; hint?: string };
  recent_rows_count?: number;
  recent_row_ids?: string[];
};

type LogRow = {
  user_id: string;
  chat_id: string;
  message_count: number;
  input_chars: number;
  outcome: string;
  http_status: number;
  deny_reason: string;
  model?: string;
  tokens_in?: number;
  tokens_out?: number;
  cost_usd?: number;
  latency_ms?: number;
};

type TokenUsageRow = {
  user_id: string;
  operation: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  metadata: Record<string, unknown>;
};

const MAX_MESSAGES = 60;
const MAX_TOTAL_CHARS = 20_000;
const RATE_LIMIT_USER_PER_HOUR = 10;
const RATE_LIMIT_CHAT_PER_HOUR = 3;
const MODEL = "gpt-4o-mini";
const COST_PER_INPUT_TOKEN = 0.00000015;
const COST_PER_OUTPUT_TOKEN = 0.0000006;
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL) throw new Error("missing_supabase_url");
if (!SERVICE_KEY) throw new Error("missing_service_role_key");

const DEBUG_LOG_INSERT = Deno.env.get("DEBUG_CHAT_TO_JOURNAL_LOG_INSERT") === "true";
const DIAG = Deno.env.get("DIAG_CHAT_TO_JOURNAL_LOGS") === "true";

const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

const PII_PATTERNS = [
  /\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/gi,
  /\b(\+?\d[\d\s\-().]{7,}\d)\b/g,
];
const INJECTION_PREFIX_RE = /^(SYSTEM|DEVELOPER|INSTRUCTIONS)\s*:/i;

function stripPII(text: string): string {
  let out = text;
  for (const pattern of PII_PATTERNS) out = out.replace(pattern, "[redacted]");
  return out;
}

function sanitizeContent(raw: string): string {
  const lines = raw.split("\n").filter((line) => !INJECTION_PREFIX_RE.test(line.trimStart()));
  return stripPII(lines.join("\n").replace(/[ \t]+/g, " ").trim());
}

function sanitizeMessages(
  messages: Array<{ role: string; content: string }>,
): Array<{ role: "user" | "assistant"; content: string }> {
  let filtered = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content?.trim())
    .map((m) => ({ role: m.role as "user" | "assistant", content: sanitizeContent(m.content) }))
    .filter((m) => m.content.length > 0);

  if (filtered.length > MAX_MESSAGES) filtered = filtered.slice(filtered.length - MAX_MESSAGES);

  let total = filtered.reduce((sum, m) => sum + m.content.length, 0);
  while (total > MAX_TOTAL_CHARS && filtered.length > 0) {
    const removed = filtered.shift()!;
    total -= removed.content.length;
  }
  return filtered;
}

function buildConversationText(messages: Array<{ role: string; content: string }>): string {
  return messages.map((m) => `${m.role === "user" ? "Yo" : "Elena"}: ${m.content}`).join("\n");
}

function buildSystemPrompt(locale: string, maxWords: number): string {
  const isEs = locale === "es";
  return isEs
    ? `Eres un asistente especializado en escritura reflexiva personal. Tu tarea es convertir una conversación de apoyo emocional en un borrador de diario íntimo y reflexivo para el usuario.

REGLAS CRÍTICAS:
- Escribe SIEMPRE en primera persona, como si el usuario escribiera su propio diario.
- El título debe tener entre 5 y 10 palabras, natural y reflexivo.
- El contenido debe tener entre 120 y ${maxWords} palabras, dividido en 2 a 4 párrafos breves.
- Estructura: (1) qué pasó o qué pensé, (2) qué sentí, (3) qué me di cuenta, (4) un pequeño paso o intención (opcional).
- Tono: cálido, honesto, introspectivo — NO cursi ni forzado.
- NUNCA incluyas: marcas de tiempo, etiquetas de hablante, citas textuales de la conversación.
- NUNCA menciones: IA, modelo de lenguaje, sistema, Elena como IA.
- Si la conversación es corta (menos de 6 mensajes), genera una reflexión simple y directa sin sobre-interpretar.
- Si la conversación contiene contenido de crisis o autolesiones, enfoca el borrador en el cuidado personal y la búsqueda de apoyo — sin instrucciones dañinas.
- Las etiquetas (tags) deben ser 2 a 4 palabras clave en español que describan los temas principales.

Devuelve SOLO un objeto JSON válido con este esquema exacto:
{
  "title": "string",
  "content": "string",
  "tags": ["string", "string"]
}`
    : `You are a specialist in personal reflective writing. Your task is to convert an emotional support conversation into an intimate, reflective journal draft for the user.

CRITICAL RULES:
- Always write in first person, as if the user is writing their own journal.
- Title: 5-10 words, natural and reflective.
- Content: 120-${maxWords} words, 2-4 short paragraphs.
- Structure: (1) what happened / what I was thinking, (2) what I felt, (3) what I realized, (4) one gentle next step (optional).
- Tone: warm, honest, introspective — not cheesy or forced.
- NEVER include: timestamps, speaker labels, verbatim chat excerpts.
- NEVER mention: AI, language model, system, Elena as an AI.
- If the conversation is short (<6 messages), write a simple reflection without over-interpreting.
- If the chat contains crisis or self-harm content, focus the draft on self-care and seeking support — no harmful instructions.
- Tags: 2-4 English keywords describing the main topics.

Return ONLY a valid JSON object with this exact schema:
{
  "title": "string",
  "content": "string",
  "tags": ["string", "string"]
}`;
}

async function callOpenAI(
  systemPrompt: string,
  conversationText: string,
  locale: string,
  openaiKey: string,
): Promise<{ raw: string; tokensIn: number; tokensOut: number }> {
  const userPrompt =
    locale === "es"
      ? `Esta es la conversación:\n\n${conversationText}\n\nGenera ahora el borrador de diario en JSON.`
      : `Here is the conversation:\n\n${conversationText}\n\nNow generate the journal draft as JSON.`;

  const openaiBody = JSON.stringify({
    model: MODEL,
    messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    temperature: 0.35,
    max_tokens: 700,
    response_format: { type: "json_object" },
  });

  const openaiHeaders = { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` };

  let response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: openaiHeaders,
    body: openaiBody,
  });

  if (!response.ok && response.status >= 500) {
    await new Promise(r => setTimeout(r, 1200));
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: openaiHeaders,
      body: openaiBody,
    });
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    console.error("callOpenAI failed after retry", { status: response.status, errData });
    throw new Error("OPENAI_UNAVAILABLE");
  }

  const data = await response.json();
  const raw: string = data.choices?.[0]?.message?.content ?? "{}";
  const tokensIn: number = data.usage?.prompt_tokens ?? 0;
  const tokensOut: number = data.usage?.completion_tokens ?? 0;
  return { raw, tokensIn, tokensOut };
}

function parseDraft(raw: string): { title: string; content: string; tags: string[] } {
  const tryParse = (str: string) => {
    const parsed = JSON.parse(str);
    return {
      title: typeof parsed.title === "string" ? parsed.title.trim() : "Reflexión de hoy",
      content: typeof parsed.content === "string" ? parsed.content.trim() : "",
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.filter((t: unknown) => typeof t === "string").slice(0, 4)
        : [],
    };
  };
  try {
    return tryParse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { return tryParse(match[0]); } catch { /* fall through */ }
    }
    return { title: "Reflexión de hoy", content: "", tags: [] };
  }
}

async function checkRateLimit(
  userId: string,
  chatId: string,
): Promise<{ allowed: boolean; reason: "rl_user" | "rl_chat" | null }> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [userRes, chatRes] = await Promise.all([
    serviceClient.schema("public").from("chat_to_journal_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("outcome", "success").gte("created_at", since),
    serviceClient.schema("public").from("chat_to_journal_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("chat_id", chatId).eq("outcome", "success").gte("created_at", since),
  ]);
  if ((userRes.count ?? 0) >= RATE_LIMIT_USER_PER_HOUR) return { allowed: false, reason: "rl_user" };
  if ((chatRes.count ?? 0) >= RATE_LIMIT_CHAT_PER_HOUR) return { allowed: false, reason: "rl_chat" };
  return { allowed: true, reason: null };
}

function pgErrFields(error: { code?: string; message?: string; details?: string; hint?: string }) {
  return { code: error.code, message: error.message, details: error.details, hint: error.hint };
}

async function insertC2JLogOrThrow(row: LogRow, label: string): Promise<void> {
  const { error } = await serviceClient.schema("public").from("chat_to_journal_logs").insert(row);
  if (error) {
    console.error(label, pgErrFields(error));
    throw new Error(`${label}:${error.code ?? "unknown"}`);
  }
}

async function insertTokenUsageOrThrow(row: TokenUsageRow, label: string): Promise<void> {
  const { error } = await serviceClient.schema("public").from("token_usage").insert(row);
  if (error) {
    console.error(label, pgErrFields(error));
    throw new Error(`${label}:${error.code ?? "unknown"}`);
  }
}

function projectHostFromUrl(url: string | null): string {
  try {
    if (!url) return "";
    return url.replace(/^https?:\/\//, "").split("/")[0];
  } catch {
    return "";
  }
}

function waitUntilSafe(p: Promise<unknown>): void {
  try {
    EdgeRuntime.waitUntil(p);
  } catch {
    /* EdgeRuntime not available in some test environments */
  }
}

function fireC2JLog(row: LogRow, label: string): void {
  waitUntilSafe(
    (async () => {
      const { error } = await serviceClient.schema("public").from("chat_to_journal_logs").insert(row);
      if (error) console.error(label, pgErrFields(error));
    })()
  );
}

function fireTokenUsage(row: TokenUsageRow, label: string): void {
  waitUntilSafe(
    (async () => {
      const { error } = await serviceClient.schema("public").from("token_usage").insert(row);
      if (error) console.error(label, pgErrFields(error));
    })()
  );
}

function safeError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const startTime = Date.now();

  try {
    const anonClient = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );

    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) return safeError(401, "Unauthorized");

    let body: ConvertRequest;
    try {
      body = await req.json();
    } catch {
      const row: LogRow = { user_id: user.id, chat_id: NIL_UUID, message_count: 0, input_chars: 0, outcome: "denied", http_status: 400, deny_reason: "bad_request" };
      if (DEBUG_LOG_INSERT) {
        await insertC2JLogOrThrow(row, "chat_to_journal_log_denied_insert_failed");
      } else {
        fireC2JLog(row, "chat_to_journal_log_denied_insert_failed");
      }
      return safeError(400, "Invalid request body");
    }

    const { chat_id, messages = [], locale = "es", max_words = 220 } = body;

    if (!chat_id || typeof chat_id !== "string" || !isUuid(chat_id)) {
      console.error("chat_to_journal_bad_chat_id", {
        chatIdType: typeof chat_id,
        chatIdPresent: !!chat_id,
        chatIdIsUuid: typeof chat_id === "string" ? isUuid(chat_id) : false,
      });
      return safeError(400, "chat_id is required");
    }

    let diag: Diag | undefined;
    if (DIAG) {
      diag = {
        has_service_key: !!SERVICE_KEY,
        project_url_host: projectHostFromUrl(SUPABASE_URL),
        smoke_insert: "skipped",
      };

      const smokeRow = {
        user_id: user.id,
        chat_id,
        message_count: 0,
        input_chars: 0,
        outcome: "denied",
        http_status: 200,
        deny_reason: "diag_smoke",
      };
      const { error: smokeErr } = await serviceClient.schema("public").from("chat_to_journal_logs").insert(smokeRow);
      if (smokeErr) {
        diag.smoke_insert = "failed";
        diag.smoke_error = { code: smokeErr.code, message: smokeErr.message, details: smokeErr.details, hint: smokeErr.hint };
        return new Response(JSON.stringify({ error: "Internal error", diag }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      diag.smoke_insert = "ok";

      const { data: rows } = await serviceClient
        .schema("public")
        .from("chat_to_journal_logs")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);
      diag.recent_rows_count = rows?.length ?? 0;
      diag.recent_row_ids = (rows ?? []).map((r: { id: string }) => r.id);
    }

    if (DEBUG_LOG_INSERT) {
      await insertC2JLogOrThrow(
        { user_id: user.id, chat_id, message_count: 0, input_chars: 0, outcome: "denied", http_status: 200, deny_reason: "debug_smoke" },
        "chat_to_journal_log_debug_smoke_failed",
      );
    }

    if (!Array.isArray(messages)) {
      const row: LogRow = { user_id: user.id, chat_id, message_count: 0, input_chars: 0, outcome: "denied", http_status: 400, deny_reason: "bad_request" };
      if (DEBUG_LOG_INSERT) {
        await insertC2JLogOrThrow(row, "chat_to_journal_log_denied_insert_failed");
      } else {
        fireC2JLog(row, "chat_to_journal_log_denied_insert_failed");
      }
      return safeError(400, "messages must be an array");
    }

    const { data: chatThread } = await anonClient.from("chat_threads").select("id").eq("id", chat_id).maybeSingle();
    if (!chatThread) {
      const row: LogRow = { user_id: user.id, chat_id, message_count: 0, input_chars: 0, outcome: "denied", http_status: 404, deny_reason: "chat_not_found" };
      if (DEBUG_LOG_INSERT) {
        await insertC2JLogOrThrow(row, "chat_to_journal_log_denied_insert_failed");
      } else {
        fireC2JLog(row, "chat_to_journal_log_denied_insert_failed");
      }
      return safeError(404, "Chat not found");
    }

    const { count: dbCount } = await serviceClient.schema("public").from("chat_messages")
      .select("id", { count: "exact", head: true }).eq("thread_id", chat_id);

    const payloadCount = messages.length;
    if (payloadCount > (dbCount ?? 0) + 3) {
      const row: LogRow = { user_id: user.id, chat_id, message_count: payloadCount, input_chars: 0, outcome: "denied", http_status: 400, deny_reason: "payload_mismatch" };
      if (DEBUG_LOG_INSERT) {
        await insertC2JLogOrThrow(row, "chat_to_journal_log_denied_insert_failed");
      } else {
        fireC2JLog(row, "chat_to_journal_log_denied_insert_failed");
      }
      return safeError(400, "Chat mismatch");
    }

    const rl = await checkRateLimit(user.id, chat_id);
    if (!rl.allowed) {
      const row: LogRow = { user_id: user.id, chat_id, message_count: 0, input_chars: 0, outcome: "denied", http_status: 429, deny_reason: rl.reason! };
      if (DEBUG_LOG_INSERT) {
        await insertC2JLogOrThrow(row, "chat_to_journal_log_denied_insert_failed");
      } else {
        fireC2JLog(row, "chat_to_journal_log_denied_insert_failed");
      }
      return safeError(429, "Too many conversions. Try again later.");
    }

    const sanitized = sanitizeMessages(messages);
    if (sanitized.length === 0) {
      const row: LogRow = { user_id: user.id, chat_id, message_count: 0, input_chars: 0, outcome: "denied", http_status: 400, deny_reason: "bad_request" };
      if (DEBUG_LOG_INSERT) {
        await insertC2JLogOrThrow(row, "chat_to_journal_log_denied_insert_failed");
      } else {
        fireC2JLog(row, "chat_to_journal_log_denied_insert_failed");
      }
      return safeError(400, "No messages provided");
    }

    const inputChars = sanitized.reduce((sum, m) => sum + m.content.length, 0);

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) throw new Error("OpenAI API key not configured");

    let firstCall: { raw: string; tokensIn: number; tokensOut: number };
    try {
      firstCall = await callOpenAI(buildSystemPrompt(locale, max_words), buildConversationText(sanitized), locale, openaiKey);
    } catch (aiErr) {
      const msg = aiErr instanceof Error ? aiErr.message : "OPENAI_UNAVAILABLE";
      return safeError(503, msg === "OPENAI_UNAVAILABLE" ? "OPENAI_UNAVAILABLE" : "AI service unavailable");
    }

    let draft = parseDraft(firstCall.raw);
    let totalTokensIn = firstCall.tokensIn;
    let totalTokensOut = firstCall.tokensOut;

    if (!draft.content || draft.content.length < 40) {
      try {
        const retryCall = await callOpenAI(
          buildSystemPrompt(locale, max_words) + "\n\nIMPORTANT: Return ONLY valid JSON.",
          buildConversationText(sanitized),
          locale,
          openaiKey,
        );
        const retryDraft = parseDraft(retryCall.raw);
        if (retryDraft.content && retryDraft.content.length >= 40) draft = retryDraft;
        totalTokensIn += retryCall.tokensIn;
        totalTokensOut += retryCall.tokensOut;
      } catch { /* use first attempt */ }
    }

    const latencyMs = Date.now() - startTime;
    const costUsd = totalTokensIn * COST_PER_INPUT_TOKEN + totalTokensOut * COST_PER_OUTPUT_TOKEN;

    const successRow: LogRow = {
      user_id: user.id,
      chat_id,
      message_count: sanitized.length,
      input_chars: inputChars,
      model: MODEL,
      tokens_in: totalTokensIn,
      tokens_out: totalTokensOut,
      cost_usd: costUsd,
      latency_ms: latencyMs,
      outcome: "success",
      http_status: 200,
      deny_reason: "",
    };

    const tokenUsageRow: TokenUsageRow = {
      user_id: user.id,
      operation: "chat_to_journal",
      model: MODEL,
      prompt_tokens: totalTokensIn,
      completion_tokens: totalTokensOut,
      total_tokens: totalTokensIn + totalTokensOut,
      metadata: { chat_id, message_count: sanitized.length, input_chars: inputChars },
    };

    if (DEBUG_LOG_INSERT) {
      await insertC2JLogOrThrow(successRow, "chat_to_journal_log_success_insert_failed");
      await insertTokenUsageOrThrow(tokenUsageRow, "chat_to_journal_token_usage_insert_failed");
    } else {
      fireC2JLog(successRow, "chat_to_journal_log_success_insert_failed");
      fireTokenUsage(tokenUsageRow, "chat_to_journal_token_usage_insert_failed");
    }

    const responsePayload: DraftResult = {
      title: draft.title,
      content: draft.content,
      tags: draft.tags,
      summary_meta: { message_count: sanitized.length },
      ...(DIAG && diag ? { diag } : {}),
    };

    return new Response(
      JSON.stringify(responsePayload),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch {
    return safeError(500, "Internal error");
  }
});
