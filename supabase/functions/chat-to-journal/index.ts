// DEPLOY REQUIREMENT: verify_jwt MUST be false
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ConvertRequest { chat_id: string; messages: Array<{ role: "user" | "assistant"; content: string }>; locale?: string; max_words?: number; }
interface DraftResult { title: string; content: string; tags: string[]; summary_meta: { message_count: number }; diag?: Diag; }
type Diag = { has_service_key: boolean; project_url_host: string; smoke_insert: "skipped" | "ok" | "failed"; smoke_error?: { code?: string; message?: string; details?: string; hint?: string }; recent_rows_count?: number; recent_row_ids?: string[]; };
type LogRow = { user_id: string; chat_id: string; message_count: number; input_chars: number; outcome: string; http_status: number; deny_reason: string; model?: string; tokens_in?: number; tokens_out?: number; cost_usd?: number; latency_ms?: number; };
type TokenUsageRow = { user_id: string; operation: string; model: string; prompt_tokens: number; completion_tokens: number; total_tokens: number; metadata: Record<string, unknown>; };

const MAX_MESSAGES = 60;
const MAX_TOTAL_CHARS = 20_000;
const RATE_LIMIT_USER_PER_HOUR = 10;
const RATE_LIMIT_CHAT_PER_HOUR = 3;
const MODEL = "claude-sonnet-4-6";
const COST_PER_INPUT_TOKEN = 0.000003;
const COST_PER_OUTPUT_TOKEN = 0.000015;
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL) throw new Error("missing_supabase_url");
if (!SERVICE_KEY) throw new Error("missing_service_role_key");

const DEBUG_LOG_INSERT = Deno.env.get("DEBUG_CHAT_TO_JOURNAL_LOG_INSERT") === "true";
const DIAG = Deno.env.get("DIAG_CHAT_TO_JOURNAL_LOGS") === "true";
const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUuid(v: string): boolean { return UUID_RE.test(v); }

const PII_PATTERNS = [/\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/gi, /\b(\+?\d[\d\s\-().]{7,}\d)\b/g];
const INJECTION_PREFIX_RE = /^(SYSTEM|DEVELOPER|INSTRUCTIONS)\s*:/i;
function stripPII(text: string): string { let out = text; for (const pattern of PII_PATTERNS) out = out.replace(pattern, "[redacted]"); return out; }
function sanitizeContent(raw: string): string { const lines = raw.split("\n").filter((line) => !INJECTION_PREFIX_RE.test(line.trimStart())); return stripPII(lines.join("\n").replace(/[ \t]+/g, " ").trim()); }
function sanitizeMessages(messages: Array<{ role: string; content: string }>): Array<{ role: "user" | "assistant"; content: string }> {
  let filtered = messages.filter((m) => (m.role === "user" || m.role === "assistant") && m.content?.trim()).map((m) => ({ role: m.role as "user" | "assistant", content: sanitizeContent(m.content) })).filter((m) => m.content.length > 0);
  if (filtered.length > MAX_MESSAGES) filtered = filtered.slice(filtered.length - MAX_MESSAGES);
  let total = filtered.reduce((sum, m) => sum + m.content.length, 0);
  while (total > MAX_TOTAL_CHARS && filtered.length > 0) { const removed = filtered.shift()!; total -= removed.content.length; }
  return filtered;
}
function buildConversationText(messages: Array<{ role: string; content: string }>): string { return messages.map((m) => `${m.role === "user" ? "Yo" : "Elena"}: ${m.content}`).join("\n"); }
function buildSystemPrompt(locale: string, maxWords: number): string {
  const isEs = locale === "es";
  return isEs ? `Eres un asistente especializado en escritura reflexiva personal. Tu tarea es convertir una conversaci\u00f3n de apoyo emocional en un borrador de diario \u00edntimo y reflexivo para el usuario.\n\nREGLAS CR\u00cdTICAS:\n- Escribe SIEMPRE en primera persona, como si el usuario escribiera su propio diario.\n- El t\u00edtulo debe tener entre 5 y 10 palabras, natural y reflexivo.\n- El contenido debe tener entre 120 y ${maxWords} palabras, dividido en 2 a 4 p\u00e1rrafos breves.\n- Estructura: (1) qu\u00e9 pas\u00f3 o qu\u00e9 pens\u00e9, (2) qu\u00e9 sent\u00ed, (3) qu\u00e9 me di cuenta, (4) un peque\u00f1o paso o intenci\u00f3n (opcional).\n- Tono: c\u00e1lido, honesto, introspectivo \u2014 NO cursi ni forzado.\n- NUNCA incluyas: marcas de tiempo, etiquetas de hablante, citas textuales de la conversaci\u00f3n.\n- NUNCA menciones: IA, modelo de lenguaje, sistema, Elena como IA.\n- Si la conversaci\u00f3n es corta (menos de 6 mensajes), genera una reflexi\u00f3n simple y directa sin sobre-interpretar.\n- Si la conversaci\u00f3n contiene contenido de crisis o autolesiones, enfoca el borrador en el cuidado personal y la b\u00fasqueda de apoyo \u2014 sin instrucciones da\u00f1inas.\n- Las etiquetas (tags) deben ser 2 a 4 palabras clave en espa\u00f1ol que describan los temas principales.\n\nDevuelve SOLO un objeto JSON v\u00e1lido con este esquema exacto:\n{\n  "title": "string",\n  "content": "string",\n  "tags": ["string", "string"]\n}` : `You are a specialist in personal reflective writing. Your task is to convert an emotional support conversation into an intimate, reflective journal draft for the user.\n\nCRITICAL RULES:\n- Always write in first person, as if the user is writing their own journal.\n- Title: 5-10 words, natural and reflective.\n- Content: 120-${maxWords} words, 2-4 short paragraphs.\n- Structure: (1) what happened / what I was thinking, (2) what I felt, (3) what I realized, (4) one gentle next step (optional).\n- Tone: warm, honest, introspective \u2014 not cheesy or forced.\n- NEVER include: timestamps, speaker labels, verbatim chat excerpts.\n- NEVER mention: AI, language model, system, Elena as an AI.\n- If the conversation is short (<6 messages), write a simple reflection without over-interpreting.\n- If the chat contains crisis or self-harm content, focus the draft on self-care and seeking support \u2014 no harmful instructions.\n- Tags: 2-4 English keywords describing the main topics.\n\nReturn ONLY a valid JSON object with this exact schema:\n{\n  "title": "string",\n  "content": "string",\n  "tags": ["string", "string"]\n}`;
}
async function callClaude(systemPrompt: string, conversationText: string, locale: string, anthropicKey: string): Promise<{ raw: string; tokensIn: number; tokensOut: number }> {
  const userPrompt = locale === "es" ? `Esta es la conversaci\u00f3n:\n\n${conversationText}\n\nGenera ahora el borrador de diario en JSON.` : `Here is the conversation:\n\n${conversationText}\n\nNow generate the journal draft as JSON.`;
  const claudeBody = JSON.stringify({ model: MODEL, max_tokens: 800, temperature: 0.35, system: systemPrompt, messages: [{ role: "user", content: userPrompt }] });
  const claudeHeaders = { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" };
  let response = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: claudeHeaders, body: claudeBody });
  if (!response.ok && response.status >= 500) { await new Promise(r => setTimeout(r, 1200)); response = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: claudeHeaders, body: claudeBody }); }
  if (!response.ok) { const errData = await response.json().catch(() => ({})); console.error("callClaude failed", { status: response.status, errData }); throw new Error("ANTHROPIC_UNAVAILABLE"); }
  const data = await response.json();
  return { raw: data.content?.[0]?.text ?? "{}", tokensIn: data.usage?.input_tokens ?? 0, tokensOut: data.usage?.output_tokens ?? 0 };
}
function parseDraft(raw: string): { title: string; content: string; tags: string[] } {
  const tryParse = (str: string) => { const parsed = JSON.parse(str); return { title: typeof parsed.title === "string" ? parsed.title.trim() : "Reflexi\u00f3n de hoy", content: typeof parsed.content === "string" ? parsed.content.trim() : "", tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t: unknown) => typeof t === "string").slice(0, 4) : [] }; };
  try { return tryParse(raw); } catch { const match = raw.match(/\{[\s\S]*\}/); if (match) { try { return tryParse(match[0]); } catch { /* fall through */ } } return { title: "Reflexi\u00f3n de hoy", content: "", tags: [] }; }
}
async function checkRateLimit(userId: string, chatId: string): Promise<{ allowed: boolean; reason: "rl_user" | "rl_chat" | null }> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [userRes, chatRes] = await Promise.all([serviceClient.schema("public").from("chat_to_journal_logs").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("outcome", "success").gte("created_at", since), serviceClient.schema("public").from("chat_to_journal_logs").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("chat_id", chatId).eq("outcome", "success").gte("created_at", since)]);
  if ((userRes.count ?? 0) >= RATE_LIMIT_USER_PER_HOUR) return { allowed: false, reason: "rl_user" };
  if ((chatRes.count ?? 0) >= RATE_LIMIT_CHAT_PER_HOUR) return { allowed: false, reason: "rl_chat" };
  return { allowed: true, reason: null };
}
function pgErrFields(error: { code?: string; message?: string; details?: string; hint?: string }) { return { code: error.code, message: error.message, details: error.details, hint: error.hint }; }
function waitUntilSafe(p: Promise<unknown>): void { try { EdgeRuntime.waitUntil(p); } catch { /* ok */ } }
function fireC2JLog(row: LogRow, label: string): void { waitUntilSafe((async () => { const { error } = await serviceClient.schema("public").from("chat_to_journal_logs").insert(row); if (error) console.error(label, pgErrFields(error)); })()); }
function fireTokenUsage(row: TokenUsageRow, label: string): void { waitUntilSafe((async () => { const { error } = await serviceClient.schema("public").from("token_usage").insert(row); if (error) console.error(label, pgErrFields(error)); })()); }
// Token budget (same contract as chat-ai enforceBudget). Fails open on RPC error.
async function enforceBudget(userId: string): Promise<Response | null> {
  const { data, error } = await serviceClient.rpc("check_token_budget", { p_user_id: userId });
  if (error) { console.error("enforceBudget: check_token_budget failed", JSON.stringify(error)); return null; }
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || result.allowed) return null;
  const isDailyLimit = result.reason === "DAILY_LIMIT_REACHED";
  const message = isDailyLimit
    ? `Has alcanzado tu límite diario de ${result.daily_limit.toLocaleString()} tokens. Se restablece a medianoche (hora del centro de México).`
    : `Has alcanzado tu límite mensual de ${result.monthly_limit.toLocaleString()} tokens. Se restablece al iniciar tu siguiente ciclo mensual.`;
  return new Response(JSON.stringify({ error: result.reason, message, daily_used: result.daily_used, daily_limit: result.daily_limit, monthly_used: result.monthly_used, monthly_limit: result.monthly_limit }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function safeError(status: number, message: string): Response { return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const startTime = Date.now();
  try {
    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) return safeError(401, "Unauthorized");
    const budgetResponse = await enforceBudget(user.id);
    if (budgetResponse) return budgetResponse;
    let body: ConvertRequest;
    try { body = await req.json(); } catch { fireC2JLog({ user_id: user.id, chat_id: NIL_UUID, message_count: 0, input_chars: 0, outcome: "denied", http_status: 400, deny_reason: "bad_request" }, "c2j_log_failed"); return safeError(400, "Invalid request body"); }
    const { chat_id, messages = [], locale = "es", max_words = 220 } = body;
    if (!chat_id || typeof chat_id !== "string" || !isUuid(chat_id)) return safeError(400, "chat_id is required");
    if (!Array.isArray(messages)) { fireC2JLog({ user_id: user.id, chat_id, message_count: 0, input_chars: 0, outcome: "denied", http_status: 400, deny_reason: "bad_request" }, "c2j_log_failed"); return safeError(400, "messages must be an array"); }
    const { data: chatThread } = await anonClient.from("chat_threads").select("id").eq("id", chat_id).maybeSingle();
    if (!chatThread) { fireC2JLog({ user_id: user.id, chat_id, message_count: 0, input_chars: 0, outcome: "denied", http_status: 404, deny_reason: "chat_not_found" }, "c2j_log_failed"); return safeError(404, "Chat not found"); }
    const { count: dbCount } = await serviceClient.schema("public").from("chat_messages").select("id", { count: "exact", head: true }).eq("thread_id", chat_id);
    if (messages.length > (dbCount ?? 0) + 3) { fireC2JLog({ user_id: user.id, chat_id, message_count: messages.length, input_chars: 0, outcome: "denied", http_status: 400, deny_reason: "payload_mismatch" }, "c2j_log_failed"); return safeError(400, "Chat mismatch"); }
    const rl = await checkRateLimit(user.id, chat_id);
    if (!rl.allowed) { fireC2JLog({ user_id: user.id, chat_id, message_count: 0, input_chars: 0, outcome: "denied", http_status: 429, deny_reason: rl.reason! }, "c2j_log_failed"); return safeError(429, "Too many conversions. Try again later."); }
    const sanitized = sanitizeMessages(messages);
    if (sanitized.length === 0) { fireC2JLog({ user_id: user.id, chat_id, message_count: 0, input_chars: 0, outcome: "denied", http_status: 400, deny_reason: "bad_request" }, "c2j_log_failed"); return safeError(400, "No messages provided"); }
    const inputChars = sanitized.reduce((sum, m) => sum + m.content.length, 0);
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) throw new Error("Anthropic API key not configured");
    let firstCall: { raw: string; tokensIn: number; tokensOut: number };
    try { firstCall = await callClaude(buildSystemPrompt(locale, max_words), buildConversationText(sanitized), locale, anthropicKey); } catch (aiErr) { const msg = aiErr instanceof Error ? aiErr.message : "ANTHROPIC_UNAVAILABLE"; return safeError(503, msg === "ANTHROPIC_UNAVAILABLE" ? "ANTHROPIC_UNAVAILABLE" : "AI service unavailable"); }
    let draft = parseDraft(firstCall.raw);
    let totalTokensIn = firstCall.tokensIn;
    let totalTokensOut = firstCall.tokensOut;
    if (!draft.content || draft.content.length < 40) { try { const retryCall = await callClaude(buildSystemPrompt(locale, max_words) + "\n\nIMPORTANT: Return ONLY valid JSON.", buildConversationText(sanitized), locale, anthropicKey); const retryDraft = parseDraft(retryCall.raw); if (retryDraft.content && retryDraft.content.length >= 40) draft = retryDraft; totalTokensIn += retryCall.tokensIn; totalTokensOut += retryCall.tokensOut; } catch { /* use first */ } }
    const latencyMs = Date.now() - startTime;
    const costUsd = totalTokensIn * COST_PER_INPUT_TOKEN + totalTokensOut * COST_PER_OUTPUT_TOKEN;
    fireC2JLog({ user_id: user.id, chat_id, message_count: sanitized.length, input_chars: inputChars, model: MODEL, tokens_in: totalTokensIn, tokens_out: totalTokensOut, cost_usd: costUsd, latency_ms: latencyMs, outcome: "success", http_status: 200, deny_reason: "" }, "c2j_success_log_failed");
    fireTokenUsage({ user_id: user.id, operation: "chat_to_journal", model: MODEL, prompt_tokens: totalTokensIn, completion_tokens: totalTokensOut, total_tokens: totalTokensIn + totalTokensOut, metadata: { chat_id, message_count: sanitized.length, input_chars: inputChars } }, "c2j_token_usage_failed");
    return new Response(JSON.stringify({ title: draft.title, content: draft.content, tags: draft.tags, summary_meta: { message_count: sanitized.length } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch { return safeError(500, "Internal error"); }
});