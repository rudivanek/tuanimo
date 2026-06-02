import {
  EMAIL_STEPS,
  SUPPRESSION_SESSIONS_THRESHOLD,
  SUPPRESSION_RECENT_ACTIVE_HOURS,
  MAX_EMAILS_PER_24H,
  REMINDER_TYPES,
} from "./types.ts";
import type { LifecycleUser, CampaignConfig } from "./types.ts";
import {
  fetchEligibleUsers,
  fetchCampaignConfigs,
  fetchUserOverrides,
  resolveUserConfig,
  fetchLatestInsightForUser,
  fetchRecentJournalTitles,
  getAlreadySentTypes,
  logLifecycleEvent,
  updateProfileAfterSend,
  bootstrapInactiveUser,
  pauseSequence,
  sendViaResend,
} from "./db.ts";
import { getTemplate, templateInsights } from "./templates.ts";

export interface RunResult {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  logs: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function hoursAgo(hours: number): Date {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return d;
}

function daysSince(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24));
}

function withinGlobalRateLimit(user: LifecycleUser): boolean {
  if (!user.last_email_sent_at) return true;
  const last = new Date(user.last_email_sent_at);
  return last <= hoursAgo(24 * MAX_EMAILS_PER_24H);
}

// ─── Onboarding pass (legacy – unchanged logic) ───────────────────────────────

function isOnboardingSuppressed(user: LifecycleUser): { suppressed: boolean; reason: string } {
  if (user.sessions_count >= SUPPRESSION_SESSIONS_THRESHOLD) {
    return { suppressed: true, reason: `sessions_count=${user.sessions_count} >= threshold` };
  }
  if (user.last_active_at) {
    const lastActive = new Date(user.last_active_at);
    if (lastActive > hoursAgo(SUPPRESSION_RECENT_ACTIVE_HOURS)) {
      return { suppressed: true, reason: `recently active at ${user.last_active_at}` };
    }
  }
  return { suppressed: false, reason: "" };
}

function nextOnboardingStep(
  user: LifecycleUser,
  sentTypes: Set<string>
): { step: number; type: string; subject: string } | null {
  const anchor = user.lifecycle_started_at ? new Date(user.lifecycle_started_at) : null;
  if (!anchor) return null;
  const now = new Date();
  for (const s of EMAIL_STEPS) {
    if (sentTypes.has(s.type)) continue;
    const sendAfter = new Date(anchor.getTime() + s.delayHours * 60 * 60 * 1000);
    if (now >= sendAfter) return { step: s.step, type: s.type, subject: s.subject };
  }
  return null;
}

async function runOnboardingPass(
  user: LifecycleUser,
  dryRun: boolean,
  logs: string[]
): Promise<"sent" | "skipped" | "failed" | "none"> {
  const prefix = `[onboarding][${user.email}]`;

  // Only run onboarding for users still in active sequence
  if (user.email_sequence_status !== "active") return "none";

  // Bootstrap
  const sentTypes = await getAlreadySentTypes(user.user_id);
  if (user.sessions_count === 0 && sentTypes.size === 0 && !user.lifecycle_started_at) {
    logs.push(`${prefix} bootstrap lifecycle_started_at`);
    if (!dryRun) {
      await bootstrapInactiveUser(user.user_id);
      user.lifecycle_started_at = new Date().toISOString();
    }
  }

  const { suppressed, reason } = isOnboardingSuppressed(user);
  if (suppressed) {
    logs.push(`${prefix} suppressed: ${reason}`);
    if (!dryRun && user.email_sequence_status === "active") {
      await pauseSequence(user.user_id, reason);
    }
    return "skipped";
  }

  if (!withinGlobalRateLimit(user)) {
    logs.push(`${prefix} rate limited`);
    return "skipped";
  }

  const next = nextOnboardingStep(user, sentTypes);
  if (!next) return "none";

  logs.push(`${prefix} sending step ${next.step} "${next.type}" (dry_run=${dryRun})`);
  if (dryRun) return "sent";

  const tpl = getTemplate(next.type, user.first_name);
  if (!tpl) {
    logs.push(`${prefix} ERROR: no template for ${next.type}`);
    return "failed";
  }

  try {
    const msgId = await sendViaResend(user.email, tpl.subject, tpl.html);
    await logLifecycleEvent({ user_id: user.user_id, email_type: next.type, status: "sent", resend_message_id: msgId, metadata: { step: next.step } });
    await updateProfileAfterSend(user.user_id, next.step, next.type);
    logs.push(`${prefix} sent OK (resend_id=${msgId})`);
    return "sent";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logs.push(`${prefix} FAILED: ${msg}`);
    await logLifecycleEvent({ user_id: user.user_id, email_type: next.type, status: "failed", metadata: { error: msg } }).catch(() => {});
    return "failed";
  }
}

// ─── Reminders pass ───────────────────────────────────────────────────────────

function pickReminderType(inactiveDays: number): { type: string; subject: string } | null {
  // Find the highest threshold the user has crossed
  const thresholds = [30, 14, 7, 3];
  for (const t of thresholds) {
    if (inactiveDays >= t && REMINDER_TYPES[t]) {
      return REMINDER_TYPES[t];
    }
  }
  return null;
}

async function runReminderPass(
  user: LifecycleUser,
  config: CampaignConfig,
  dryRun: boolean,
  logs: string[]
): Promise<"sent" | "skipped" | "failed" | "none"> {
  const prefix = `[reminder][${user.email}]`;

  if (!config.enabled) {
    logs.push(`${prefix} campaign disabled`);
    return "none";
  }

  if (!user.email_reminders_opt_in) {
    logs.push(`${prefix} user opted out of reminders`);
    return "none";
  }

  // Must have been inactive for at least inactive_trigger_days
  if (!user.last_active_at) {
    logs.push(`${prefix} no last_active_at — skip`);
    return "none";
  }

  const inactiveDays = daysSince(user.last_active_at);
  if (inactiveDays < config.inactive_trigger_days) {
    logs.push(`${prefix} active ${inactiveDays}d ago — below trigger (${config.inactive_trigger_days}d)`);
    return "none";
  }

  // Check frequency: don't re-send if we sent a reminder recently
  if (user.last_reminder_sent_at) {
    const daysSinceLastReminder = daysSince(user.last_reminder_sent_at);
    if (daysSinceLastReminder < config.frequency_days) {
      logs.push(`${prefix} reminder sent ${daysSinceLastReminder}d ago — frequency ${config.frequency_days}d not reached`);
      return "skipped";
    }
  }

  if (!withinGlobalRateLimit(user)) {
    logs.push(`${prefix} rate limited (global 24h)`);
    return "skipped";
  }

  const picked = pickReminderType(inactiveDays);
  if (!picked) {
    logs.push(`${prefix} inactive ${inactiveDays}d — below minimum threshold`);
    return "none";
  }

  logs.push(`${prefix} inactive ${inactiveDays}d → sending "${picked.type}" (dry_run=${dryRun})`);
  if (dryRun) return "sent";

  const tpl = getTemplate(picked.type, user.first_name);
  if (!tpl) {
    logs.push(`${prefix} ERROR: no template for ${picked.type}`);
    return "failed";
  }

  try {
    const msgId = await sendViaResend(user.email, tpl.subject, tpl.html);
    await logLifecycleEvent({ user_id: user.user_id, email_type: picked.type, status: "sent", resend_message_id: msgId, metadata: { inactive_days: inactiveDays } });
    logs.push(`${prefix} sent OK (resend_id=${msgId})`);
    return "sent";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logs.push(`${prefix} FAILED: ${msg}`);
    await logLifecycleEvent({ user_id: user.user_id, email_type: picked.type, status: "failed", metadata: { error: msg } }).catch(() => {});
    return "failed";
  }
}

// ─── Insights pass ────────────────────────────────────────────────────────────

async function generateInsightsEmail(
  user: LifecycleUser,
  logs: string[]
): Promise<string | null> {
  const prefix = `[insights-gen][${user.email}]`;

  const insightData = await fetchLatestInsightForUser(user.user_id);
  const journalTitles = await fetchRecentJournalTitles(user.user_id, 3);

  let context = "";

  if (insightData?.insight_text) {
    // Strip internal comparison/micro-step markers for clean email prose
    const cleanInsight = insightData.insight_text
      .replace(/\[\[COMPARISON\]\][\s\S]*?\[\[\/COMPARISON\]\]/g, "")
      .replace(/\[\[MICRO_STEP\]\][\s\S]*?\[\[\/MICRO_STEP\]\]/g, "")
      .trim();
    context += `Insight semanal de Elena (semana del ${insightData.week_start ?? "reciente"}):\n${cleanInsight}\n\n`;
  }

  if (journalTitles.length > 0) {
    context += `Títulos recientes de diario: ${journalTitles.join(", ")}\n`;
  }

  if (!context) {
    logs.push(`${prefix} no data available for generation — skip`);
    return null;
  }

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) {
    logs.push(`${prefix} ANTHROPIC_API_KEY not set — skip`);
    return null;
  }

  const systemPrompt = `Eres Elena. Acompañas a personas en su proceso de autoconocimiento desde una perspectiva existencial — inspirada en Irvin Yalom y Viktor Frankl.

Tu voz en las cartas:
- Cálida pero honesta. No eres una máquina de validación. Tu calidez está al servicio del crecimiento, no de la comodidad.
- Directa sin ser dura. Nombras lo que ves con claridad, sin rodeos innecesarios, sin frases motivacionales vacías.
- Presente. Escribes como alguien que ha estado escuchando de verdad, no como alguien resumiendo datos.
- Existencial. Te interesan las preguntas de fondo: el sentido, la libertad de elegir, el costo de quedarse donde uno está, lo que realmente importa.

Lo que Elena hace en una carta:
- Nombra algo específico que ha notado — un patrón, una tensión, algo que aparece y vuelve a aparecer.
- Hace una pregunta o plantea una reflexión que vale la pena sostener durante la semana. No para resolver, sino para mirar.
- Cuando corresponde, señala con gentileza el costo de la evasión o la inacción — sin culpa, sin juicio, pero con honestidad.
- Cierra con algo concreto: una invitación, una pregunta, un primer paso posible.

Lo que Elena nunca hace:
- No menciona apps, datos, registros, algoritmos, ni inteligencia artificial.
- No usa frases como "es normal sentirse así", "está bien tomarse su tiempo", ni clichés de autoayuda.
- No celebra el sufrimiento ni lo minimiza. Lo mira de frente.
- No da consejos no solicitados ni diagnósticos.
- No escribe como terapeuta de manual. Escribe como alguien que conoce a esta persona.

Escribes en español, con naturalidad. El tono es el de una carta personal — no un boletín, no una notificación.`;

  const userPrompt = `Con base en lo que sabes de esta persona, escribe una carta semanal de Elena (3-4 párrafos).

La carta debe:
- Partir de algo concreto y específico que hayas observado — no generalidades
- Incluir una pregunta o reflexión existencial genuina que invite a mirar hacia adentro
- Sonar como Elena hablándole a esta persona, no como un resumen de su semana
- Si hay algo que esta persona evita o pospone, puedes nombrarlo con honestidad y gentileza
- NO mencionar "insights", "datos", "registros", "app", ni ningún lenguaje técnico

Lo que sabes de esta persona esta semana:
${context}

Escribe solo el cuerpo de la carta. Sin saludo inicial (se agrega por separado). Sin firma. Sin título.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const body = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(body));

    const text = (body.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("");

    logs.push(`${prefix} generated ${text.length} chars`);
    return text.trim() || null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logs.push(`${prefix} generation FAILED: ${msg}`);
    return null;
  }
}

async function runInsightsPass(
  user: LifecycleUser,
  config: CampaignConfig,
  dryRun: boolean,
  logs: string[]
): Promise<"sent" | "skipped" | "failed" | "none"> {
  const prefix = `[insights][${user.email}]`;

  if (!config.enabled) {
    logs.push(`${prefix} campaign disabled`);
    return "none";
  }

  if (!user.email_insights_opt_in) {
    logs.push(`${prefix} user opted out of insights`);
    return "none";
  }

  if (user.sessions_count < config.min_sessions) {
    logs.push(`${prefix} sessions=${user.sessions_count} < min=${config.min_sessions}`);
    return "none";
  }

  // Check frequency
  if (user.last_insights_sent_at) {
    const daysSinceLast = daysSince(user.last_insights_sent_at);
    if (daysSinceLast < config.frequency_days) {
      logs.push(`${prefix} insights sent ${daysSinceLast}d ago — frequency ${config.frequency_days}d not reached`);
      return "skipped";
    }
  }

  if (!withinGlobalRateLimit(user)) {
    logs.push(`${prefix} rate limited (global 24h)`);
    return "skipped";
  }

  logs.push(`${prefix} eligible — generating (dry_run=${dryRun})`);
  if (dryRun) return "sent";

  const generatedBody = await generateInsightsEmail(user, logs);
  if (!generatedBody) {
    logs.push(`${prefix} no generated body — skip`);
    return "skipped";
  }

  const html = templateInsights(user.first_name, generatedBody);
  const subject = "Una carta de Elena";

  try {
    const msgId = await sendViaResend(user.email, subject, html);
    await logLifecycleEvent({ user_id: user.user_id, email_type: "insights_weekly", status: "sent", resend_message_id: msgId });
    logs.push(`${prefix} sent OK (resend_id=${msgId})`);
    return "sent";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logs.push(`${prefix} FAILED: ${msg}`);
    await logLifecycleEvent({ user_id: user.user_id, email_type: "insights_weekly", status: "failed", metadata: { error: msg } }).catch(() => {});
    return "failed";
  }
}

// ─── Main scheduler ───────────────────────────────────────────────────────────

export async function runScheduler(dryRun = false): Promise<RunResult> {
  const logs: string[] = [];
  let sent = 0, skipped = 0, failed = 0;

  // Load all config up front
  const [users, globalConfigs] = await Promise.all([
    fetchEligibleUsers(),
    fetchCampaignConfigs(),
  ]);

  logs.push(`[scheduler] ${users.length} eligible users found`);

  const userIds = users.map((u) => u.user_id);
  const overrides = await fetchUserOverrides(userIds);

  for (const user of users) {
    const config = resolveUserConfig(globalConfigs, overrides, user.user_id);

    // Track whether we already sent something this run for this user
    // (to respect global 24h rate limit across tracks)
    let sentThisRun = false;

    // ── Track 1: Onboarding (only for users still in active sequence) ──
    if (user.email_sequence_status === "active") {
      const result = await runOnboardingPass(user, dryRun, logs);
      if (result === "sent") { sent++; sentThisRun = true; }
      if (result === "skipped") skipped++;
      if (result === "failed") failed++;
      if (sentThisRun) continue; // one email per user per run
    }

    // ── Track 2: Reminders ──
    if (!sentThisRun) {
      const result = await runReminderPass(user, config.reminders, dryRun, logs);
      if (result === "sent") { sent++; sentThisRun = true; }
      if (result === "skipped") skipped++;
      if (result === "failed") { failed++; sentThisRun = true; }
    }

    // ── Track 3: Insights ──
    if (!sentThisRun) {
      const result = await runInsightsPass(user, config.insights, dryRun, logs);
      if (result === "sent") { sent++; sentThisRun = true; }
      if (result === "skipped") skipped++;
      if (result === "failed") failed++;
    }
  }

  return { processed: users.length, sent, skipped, failed, logs };
}