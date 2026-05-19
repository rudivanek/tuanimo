/*
 * Elena Flight Recorder — Stage 33C: Supabase-backed QA Observability Layer
 *
 * Purpose:
 * Records Elena UX events per signed-in user for QA product testing.
 * This is NOT user analytics and NEVER sends data to third parties.
 * Admin-controlled per user via profiles.flight_recorder_enabled.
 *
 * Storage: Supabase public.flight_recorder_events
 *
 * Safe payload rules:
 * - Do NOT pass full message/entry body content
 * - Allowed: lengths, booleans, timestamps, ids, reason labels, counts, route names
 */

import { supabase } from './supabaseClient';

export interface FlightEvent {
  id: string;
  created_at: string;
  user_id: string;
  event_name: string;
  payload?: Record<string, unknown> | null;
  session_id?: string | null;
  app_area?: string | null;
}

// ============================================================
// Session ID — generated once per browser tab/session
// ============================================================
export function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem('elena_fr_session_id');
    if (!sid) {
      sid = `fr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem('elena_fr_session_id', sid);
    }
    return sid;
  } catch {
    return 'unknown';
  }
}

// ============================================================
// Per-session in-memory cache of flight_recorder_enabled
// Keyed by userId, avoids repeated DB fetches within a session
// ============================================================
const enabledCache = new Map<string, boolean>();

export async function shouldRecordFlightForUser(
  userId: string | null | undefined
): Promise<boolean> {
  if (!userId) return false;
  if (enabledCache.has(userId)) return enabledCache.get(userId)!;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('flight_recorder_enabled')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) {
      enabledCache.set(userId, false);
      return false;
    }
    const enabled = data.flight_recorder_enabled === true;
    enabledCache.set(userId, enabled);
    return enabled;
  } catch {
    return false;
  }
}

export function invalidateFlightRecorderCache(userId?: string | null): void {
  if (userId) {
    enabledCache.delete(userId);
  } else {
    enabledCache.clear();
  }
}

// ============================================================
// Core record function — fire-and-forget, never throws
// ============================================================
export async function recordFlightEvent(
  userId: string | null | undefined,
  eventName: string,
  payload?: Record<string, unknown>
): Promise<void> {
  if (!userId) return;
  try {
    const enabled = await shouldRecordFlightForUser(userId);
    if (!enabled) return;

    const row: Record<string, unknown> = {
      user_id: userId,
      event_name: eventName,
      session_id: getSessionId(),
    };
    if (payload !== undefined) row.payload = payload;

    await supabase.from('flight_recorder_events').insert(row);
  } catch {
    // fail silently — must never block UX
  }
}

// ============================================================
// Fetch events for a user (admin or self)
// ============================================================
export async function fetchFlightEventsForUser(
  userId: string | null | undefined,
  limit = 200
): Promise<FlightEvent[]> {
  if (!userId) return [];
  try {
    const { data, error } = await supabase.rpc('admin_fetch_flight_events', {
      p_user_id: userId,
      p_limit: limit,
    });
    if (error) return [];
    return (data ?? []) as FlightEvent[];
  } catch {
    return [];
  }
}

// ============================================================
// Clear events — admin RPCs
// ============================================================
export async function clearFlightEventsForUser(
  userId: string | null | undefined
): Promise<void> {
  if (!userId) return;
  try {
    await supabase.rpc('admin_clear_flight_recorder_events', {
      p_user_id: userId,
    });
  } catch {}
}

export async function clearAllFlightEvents(): Promise<void> {
  try {
    await supabase.rpc('admin_clear_flight_recorder_events', {
      p_user_id: null,
    });
  } catch {}
}

// ============================================================
// Fetch all users with recorder status (admin)
// ============================================================
export interface FlightRecorderUserRow {
  user_id: string;
  email: string;
  full_name: string;
  flight_recorder_enabled: boolean;
  event_count: number;
  latest_event_at: string | null;
}

export async function fetchAllRecordedFlightUsers(): Promise<FlightRecorderUserRow[]> {
  const { data, error } = await supabase.rpc('admin_list_flight_recorder_users');
  if (error) throw new Error(error.message);
  return (data ?? []) as FlightRecorderUserRow[];
}

// ============================================================
// Toggle recording for a user (admin)
// ============================================================
export async function setFlightRecorderForUser(
  targetUserId: string,
  enabled: boolean
): Promise<void> {
  await supabase.rpc('admin_set_flight_recorder', {
    p_target_user_id: targetUserId,
    p_enabled: enabled,
  });
  invalidateFlightRecorderCache(targetUserId);
}

// ============================================================
// Export as plain text — QA timeline format
// QA_TEMP: fullText fields in payloads are temporary QA-only data.
//          Remove QA_TEMP payload fields from recordFlightEvent call sites before GA.
// ============================================================

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  } catch {
    return iso;
  }
}

function renderTimelineEntry(e: FlightEvent): string[] {
  const t = fmtTime(e.created_at);
  const p = e.payload as Record<string, unknown> | null | undefined;
  const lines: string[] = [];

  switch (e.event_name) {
    case 'USER_SENT_MESSAGE':
      lines.push(`${t} — User said:`);
      if (p?.fullText) lines.push(`"${p.fullText}"`);
      else lines.push(`[${p?.length ?? '?'} chars]`);
      break;

    case 'ELENA_RESPONSE_RENDERED':
      lines.push(`${t} — Elena replied:`);
      if (p?.fullText) lines.push(`"${p.fullText}"`);
      else lines.push(`[${p?.length ?? '?'} chars]`);
      break;

    case 'JOURNAL_ENTRY_SAVED': {
      const kind = p?.isUpdate ? 'updated' : 'saved (new)';
      const src = p?.source ? ` [source: ${p.source}]` : '';
      lines.push(`${t} — Journal entry ${kind}${src}:`);
      if (p?.fullText) lines.push(`"${p.fullText}"`);
      else lines.push(`[${p?.entryLength ?? '?'} chars]`);
      break;
    }

    case 'INSIGHT_STATE_SNAPSHOT': {
      lines.push(`${t} — Insight state snapshot:`);
      if (p) {
        Object.entries(p).forEach(([k, v]) => {
          lines.push(`  - ${k}: ${JSON.stringify(v)}`);
        });
      }
      break;
    }

    case 'DIARY_SUGGESTION_CHIP_SHOWN':
      lines.push(`${t} — Diary suggestion chip shown${p?.reason ? ` (reason: ${p.reason})` : ''}`);
      break;

    case 'DIARY_SUGGESTION_CHIP_CLICKED':
      lines.push(`${t} — Diary suggestion chip clicked → navigating to Journal`);
      break;

    case 'DIARY_SUGGESTION_CHIP_DISMISSED':
      lines.push(`${t} — Diary suggestion chip dismissed${p?.reason ? ` (reason: ${p.reason})` : ''}`);
      break;

    case 'INSIGHT_ACTIVATION_CHIP_SHOWN':
      lines.push(`${t} — Insight activation chip shown`);
      break;

    case 'INSIGHT_ACTIVATION_CHIP_CLICKED':
      lines.push(`${t} — Insight activation chip clicked`);
      break;

    case 'CHAT_PAGE_OPENED': {
      const src = p?.source ? ` [source: ${p.source}]` : '';
      const msgs = p?.hasExistingMessages ? ' (existing messages present)' : '';
      lines.push(`${t} — User opened Chat${src}${msgs}`);
      break;
    }

    case 'JOURNAL_PAGE_OPENED': {
      const src = p?.source ? ` [source: ${p.source}]` : '';
      const drafts = p?.hasDrafts ? ' (has drafts)' : '';
      lines.push(`${t} — User opened Journal${src}${drafts}`);
      break;
    }

    case 'INSIGHTS_PAGE_OPENED': {
      const src = p?.source ? ` [source: ${p.source}]` : '';
      const newInsight = p?.arrivedWithNewInsight ? ' (arrived with new insight)' : '';
      lines.push(`${t} — User opened Insights${src}${newInsight}`);
      break;
    }

    case 'CHAT_GREETING_VISIBLE': {
      const gtype = p?.greetingType ? ` [type: ${p.greetingType}]` : '';
      const count = p?.messageCountAtRender != null ? ` (msgCount: ${p.messageCountAtRender})` : '';
      lines.push(`${t} — Chat greeting visible${gtype}${count}`);
      break;
    }

    case 'GUIDED_STARTER_PROMPT_SHOWN': {
      const group = p?.promptGroup ? ` [group: ${p.promptGroup}]` : '';
      lines.push(`${t} — Guided starter prompt shown${group}`);
      break;
    }

    case 'STARTER_PROMPT_INSERTED':
      lines.push(`${t} — Starter prompt inserted into editor`);
      break;

    case 'TRY_ANOTHER_PROMPT_CLICKED':
      lines.push(`${t} — "Try another prompt" clicked`);
      break;

    case 'REFLECTION_MEMORY_CARD_SHOWN':
      lines.push(`${t} — Reflection memory card shown${p?.daysAgo != null ? ` (${p.daysAgo} days ago)` : ''}`);
      break;

    case 'REFLECTION_MEMORY_INSERTED':
      lines.push(`${t} — Reflection memory inserted into editor`);
      break;

    case 'REFLECTION_MEMORY_VIEW_ORIGINAL_CLICKED':
      lines.push(`${t} — View original reflection clicked`);
      break;

    case 'JOURNAL_POST_SAVE_INSIGHT_NUDGE_SHOWN':
      lines.push(`${t} — Post-save insight nudge shown`);
      break;

    case 'JOURNAL_POST_SAVE_INSIGHT_NUDGE_CLICKED':
      lines.push(`${t} — Post-save insight nudge clicked → navigating to Insights`);
      break;

    case 'INSIGHT_THRESHOLD_CROSSED':
      lines.push(`${t} — Insight threshold crossed`);
      break;

    case 'INSIGHTS_PROGRESS_MESSAGE_VISIBLE':
      lines.push(`${t} — Insights progress message visible${p?.level != null ? ` (level: ${p.level})` : ''}`);
      break;

    case 'FIRST_REAL_INSIGHT_VISIBLE':
      lines.push(`${t} — First real insight visible`);
      if (p?.latestInsightAt) lines.push(`  latestInsightAt: ${p.latestInsightAt}`);
      break;

    default:
      lines.push(`${t} — ${e.event_name}`);
      if (p && Object.keys(p).length > 0) {
        lines.push(`  ${JSON.stringify(p)}`);
      }
  }

  return lines;
}

export async function exportFlightEventsAsText(
  userId: string | null | undefined
): Promise<string> {
  const events = await fetchFlightEventsForUser(userId, 2000);
  const chronological = [...events].reverse();

  const header: string[] = [
    '═══════════════════════════════════════════════════',
    'ELENA FLIGHT RECORDER — QA EXPORT',
    '═══════════════════════════════════════════════════',
    `Generated : ${new Date().toISOString()}`,
    `User      : ${userId ?? 'unknown'}`,
    `Events    : ${chronological.length}`,
    `Note      : fullText fields are QA_TEMP — remove before GA`,
    '═══════════════════════════════════════════════════',
    '',
    '── TIMELINE ─────────────────────────────────────',
    '',
  ];

  const timelineLines: string[] = [];
  let lastSession: string | null = null;
  chronological.forEach(e => {
    if (e.session_id && e.session_id !== lastSession) {
      if (lastSession !== null) timelineLines.push('');
      timelineLines.push(`┄┄ Session: ${e.session_id} ┄┄`);
      lastSession = e.session_id;
    }
    timelineLines.push(...renderTimelineEntry(e));
    timelineLines.push('');
  });

  const rawSection: string[] = [
    '── RAW EVENTS ───────────────────────────────────',
    '',
  ];
  chronological.forEach((e, i) => {
    rawSection.push(`[${i + 1}] ${e.created_at}  ${e.event_name}`);
    if (e.session_id) rawSection.push(`    session: ${e.session_id}`);
    if (e.payload) rawSection.push(`    payload: ${JSON.stringify(e.payload)}`);
  });

  return [...header, ...timelineLines, ...rawSection].join('\n');
}
