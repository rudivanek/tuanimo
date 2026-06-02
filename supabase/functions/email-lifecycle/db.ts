import { createClient } from "npm:@supabase/supabase-js@2";
import type { LifecycleUser, LifecycleEvent, CampaignConfig, ResolvedUserConfig } from "./types.ts";

function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function fetchEligibleUsers(): Promise<LifecycleUser[]> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("profiles")
    .select(`
      id,
      first_name,
      signup_at,
      lifecycle_started_at,
      sessions_count,
      email_sequence_step,
      email_sequence_status,
      email_opt_in,
      last_email_sent_at,
      last_email_type,
      last_active_at
    `)
    .eq("is_disabled", false)
    .is("deleted_at", null)
    .eq("email_opt_in", true);

  if (error) throw new Error(`fetchEligibleUsers: ${error.message}`);

  const ids = (data ?? []).map((r: Record<string, unknown>) => r.id as string);
  if (ids.length === 0) return [];

  const { data: users, error: uErr } = await sb.auth.admin.listUsers({ perPage: 1000 });
  if (uErr) throw new Error(`fetchEligibleUsers (auth): ${uErr.message}`);

  const emailMap = new Map<string, string>();
  for (const u of users?.users ?? []) emailMap.set(u.id, u.email ?? "");

  // Fetch per-track last-sent timestamps from lifecycle events
  const { data: eventsData } = await sb
    .from("email_lifecycle_events")
    .select("user_id, email_type, sent_at")
    .in("user_id", ids)
    .eq("status", "sent")
    .or("email_type.like.reminder_%,email_type.like.insights_%");

  const lastReminderMap = new Map<string, string>();
  const lastInsightsMap = new Map<string, string>();
  for (const ev of eventsData ?? []) {
    const r = ev as { user_id: string; email_type: string; sent_at: string };
    if (r.email_type.startsWith("reminder_")) {
      const cur = lastReminderMap.get(r.user_id);
      if (!cur || r.sent_at > cur) lastReminderMap.set(r.user_id, r.sent_at);
    }
    if (r.email_type.startsWith("insights_")) {
      const cur = lastInsightsMap.get(r.user_id);
      if (!cur || r.sent_at > cur) lastInsightsMap.set(r.user_id, r.sent_at);
    }
  }

  return (data ?? [])
    .map((r: Record<string, unknown>) => ({
      user_id: r.id as string,
      email: emailMap.get(r.id as string) ?? "",
      first_name: r.first_name as string | null,
      signup_at: r.signup_at as string | null,
      lifecycle_started_at: r.lifecycle_started_at as string | null,
      sessions_count: (r.sessions_count as number) ?? 0,
      email_sequence_step: (r.email_sequence_step as number) ?? 0,
      email_sequence_status: (r.email_sequence_status as string) ?? "active",
      email_opt_in: r.email_opt_in as boolean,
      email_reminders_opt_in: (r.email_reminders_opt_in as boolean) ?? true,
      email_insights_opt_in: (r.email_insights_opt_in as boolean) ?? true,
      last_email_sent_at: r.last_email_sent_at as string | null,
      last_email_type: r.last_email_type as string | null,
      last_active_at: r.last_active_at as string | null,
      last_reminder_sent_at: lastReminderMap.get(r.id as string) ?? null,
      last_insights_sent_at: lastInsightsMap.get(r.id as string) ?? null,
    }))
    .filter((u: LifecycleUser) => !!u.email && u.email.includes("@"));
}

// ─── Campaign config ──────────────────────────────────────────────────────────

const DEFAULT_CONFIG: Record<string, CampaignConfig> = {
  reminders: { enabled: true,  frequency_days: 3,  min_sessions: 0, inactive_trigger_days: 3 },
  insights:  { enabled: true,  frequency_days: 7,  min_sessions: 2, inactive_trigger_days: 0 },
};

export async function fetchCampaignConfigs(): Promise<Record<string, CampaignConfig>> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("email_campaign_config")
    .select("campaign_type, enabled, frequency_days, min_sessions, inactive_trigger_days");

  if (error) {
    console.warn("fetchCampaignConfigs failed, using defaults:", error.message);
    return DEFAULT_CONFIG;
  }

  const result = { ...DEFAULT_CONFIG };
  for (const row of data ?? []) {
    const r = row as { campaign_type: string; enabled: boolean; frequency_days: number; min_sessions: number; inactive_trigger_days: number };
    result[r.campaign_type] = {
      enabled: r.enabled,
      frequency_days: r.frequency_days,
      min_sessions: r.min_sessions,
      inactive_trigger_days: r.inactive_trigger_days,
    };
  }
  return result;
}

export async function fetchUserOverrides(userIds: string[]): Promise<Map<string, Map<string, Partial<CampaignConfig>>>> {
  if (userIds.length === 0) return new Map();
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("email_user_overrides")
    .select("user_id, campaign_type, enabled, frequency_days")
    .in("user_id", userIds);

  if (error) {
    console.warn("fetchUserOverrides failed:", error.message);
    return new Map();
  }

  const result = new Map<string, Map<string, Partial<CampaignConfig>>>();
  for (const row of data ?? []) {
    const r = row as { user_id: string; campaign_type: string; enabled: boolean | null; frequency_days: number | null };
    if (!result.has(r.user_id)) result.set(r.user_id, new Map());
    const patch: Partial<CampaignConfig> = {};
    if (r.enabled !== null) patch.enabled = r.enabled;
    if (r.frequency_days !== null) patch.frequency_days = r.frequency_days;
    result.get(r.user_id)!.set(r.campaign_type, patch);
  }
  return result;
}

export function resolveUserConfig(
  global: Record<string, CampaignConfig>,
  overrides: Map<string, Map<string, Partial<CampaignConfig>>>,
  userId: string
): ResolvedUserConfig {
  const userMap = overrides.get(userId) ?? new Map();
  const merge = (type: string): CampaignConfig => ({
    ...global[type],
    ...(userMap.get(type) ?? {}),
  });
  return {
    reminders: merge("reminders"),
    insights:  merge("insights"),
  };
}

// ─── Insights data ────────────────────────────────────────────────────────────

export interface UserInsightData {
  insight_text: string | null;
  week_start: string | null;
  mood_days: number;
  sources: string[];
}

export async function fetchLatestInsightForUser(userId: string): Promise<UserInsightData | null> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("mood_weekly_insights")
    .select("insight_text, week_start, mood_days, sources")
    .eq("user_id", userId)
    .order("week_start", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  const r = data as { insight_text: string; week_start: string; mood_days: number; sources: string[] };
  return {
    insight_text: r.insight_text,
    week_start: r.week_start,
    mood_days: r.mood_days ?? 0,
    sources: r.sources ?? [],
  };
}

export async function fetchRecentJournalTitles(userId: string, limit = 3): Promise<string[]> {
  const sb = getServiceClient();
  const { data } = await sb
    .from("journal_entries")
    .select("title")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r: { title: string }) => r.title).filter(Boolean);
}

// ─── Lifecycle events ─────────────────────────────────────────────────────────

export async function getAlreadySentTypes(userId: string): Promise<Set<string>> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("email_lifecycle_events")
    .select("email_type")
    .eq("user_id", userId)
    .eq("status", "sent");
  if (error) throw new Error(`getAlreadySentTypes: ${error.message}`);
  return new Set((data ?? []).map((r: { email_type: string }) => r.email_type));
}

export async function logLifecycleEvent(event: LifecycleEvent): Promise<void> {
  const sb = getServiceClient();
  const { error } = await sb.from("email_lifecycle_events").insert({
    user_id: event.user_id,
    email_type: event.email_type,
    status: event.status,
    resend_message_id: event.resend_message_id ?? null,
    metadata: event.metadata ?? {},
    sent_at: new Date().toISOString(),
  });
  if (error) throw new Error(`logLifecycleEvent: ${error.message}`);
}

export async function updateProfileAfterSend(
  userId: string,
  step: number,
  emailType: string
): Promise<void> {
  const sb = getServiceClient();
  const now = new Date().toISOString();
  const isComplete = step >= 5;
  const { error } = await sb
    .from("profiles")
    .update({
      email_sequence_step: step,
      last_email_sent_at: now,
      last_email_type: emailType,
      email_sequence_status: isComplete ? "completed" : "active",
    })
    .eq("id", userId);
  if (error) throw new Error(`updateProfileAfterSend: ${error.message}`);
}

export async function bootstrapInactiveUser(userId: string): Promise<void> {
  const sb = getServiceClient();
  const now = new Date().toISOString();
  const { error } = await sb
    .from("profiles")
    .update({ lifecycle_started_at: now })
    .eq("id", userId)
    .is("lifecycle_started_at", null);
  if (error) throw new Error(`bootstrapInactiveUser: ${error.message}`);
}

export async function pauseSequence(userId: string, reason: string): Promise<void> {
  const sb = getServiceClient();
  const { error } = await sb
    .from("profiles")
    .update({ email_sequence_status: "paused" })
    .eq("id", userId);
  if (error) throw new Error(`pauseSequence(${reason}): ${error.message}`);
}

// ─── Send ─────────────────────────────────────────────────────────────────────

export async function sendViaResend(
  to: string,
  subject: string,
  html: string
): Promise<string> {
  const apiKey = Deno.env.get("RESEND_API_KEY")!;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Elena <hi@tuanimo.app>",
      to: [to],
      subject,
      html,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Resend error: ${JSON.stringify(body)}`);
  return body.id as string;
}
