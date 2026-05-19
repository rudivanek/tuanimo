import { createClient } from "npm:@supabase/supabase-js@2";
import type { LifecycleUser, LifecycleEvent } from "./types.ts";

function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

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
    .eq("email_opt_in", true)
    .in("email_sequence_status", ["active"]);

  if (error) throw new Error(`fetchEligibleUsers: ${error.message}`);

  const ids = (data ?? []).map((r: Record<string, unknown>) => r.id as string);
  if (ids.length === 0) return [];

  const { data: users, error: uErr } = await sb.auth.admin.listUsers({ perPage: 1000 });
  if (uErr) throw new Error(`fetchEligibleUsers (auth): ${uErr.message}`);

  const emailMap = new Map<string, string>();
  for (const u of users?.users ?? []) emailMap.set(u.id, u.email ?? "");

  return (data ?? [])
    .map((r: Record<string, unknown>) => ({
      user_id: r.id as string,
      email: emailMap.get(r.id as string) ?? "",
      first_name: r.first_name as string | null,
      signup_at: r.signup_at as string | null,
      lifecycle_started_at: r.lifecycle_started_at as string | null,
      sessions_count: (r.sessions_count as number) ?? 0,
      email_sequence_step: (r.email_sequence_step as number) ?? 0,
      email_sequence_status: r.email_sequence_status as string,
      email_opt_in: r.email_opt_in as boolean,
      last_email_sent_at: r.last_email_sent_at as string | null,
      last_email_type: r.last_email_type as string | null,
      last_active_at: r.last_active_at as string | null,
    }))
    .filter((u: LifecycleUser) => !!u.email && u.email.includes("@"));
}

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
