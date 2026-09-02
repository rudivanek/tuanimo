import { supabase } from './supabaseClient';
import { loadElenaMemories } from './elenaMemory';
import type { ProfileForEncryption } from './encryption';

const FIRST_TIME: string[] = [
  'Hola {name}, soy Elena 🌷',
];

// ── Return greetings that reference what the user shared in their first session ──
// These use {topic} as a placeholder for the decrypted first_session_topic memory.
const RETURN_WITH_MEMORY: string[] = [
  'Hola {name} 🌷\n\nLa última vez me contabas que {topic}.\n\n¿Cómo ha estado eso?',
  'Hola {name} 🌷\n\nMe quedé pensando en lo que compartiste — que {topic}.\n\n¿Cómo llega ese tema hoy?',
  'Hola {name} 🌷\n\nRecuerdo que hablamos de que {topic}.\n\n¿Algo ha cambiado desde entonces?',
];

const YESTERDAY: string[] = [
  'Hola {name} 🌷\n\n¿Cómo ha estado este día desde ayer?',
  'Hola {name}\n\nAquí estoy.\n\n¿Qué ha habido desde ayer?',
  'Hola {name} 🌷\n\n¿Algo ha cambiado desde ayer?',
  'Hola {name}\n\nGracias por volver.\n\n¿Qué tienes en la cabeza hoy?',
];

const PAST_WEEK: string[] = [
  'Hola {name} 🌷\n\n¿Cómo ha estado la semana desde la última vez?',
  'Hola {name}\n\nAquí estoy para escucharte.\n\n¿Qué ha habido estos días?',
  'Hola {name} 🌷\n\n¿Qué ha estado ocupando tu mente estos días?',
  'Hola {name}\n\nQué bueno que volviste.\n\n¿Qué tienes ahora mismo?',
];

const LONG_ABSENCE: string[] = [
  'Hola {name} 🌷\n\nMe alegra que estés aquí.\n\n¿Qué ha estado pasando estos días?',
  'Hola {name}\n\nHa pasado un tiempo.\n\n¿Qué tienes en mente ahora?',
  'Hola {name} 🌷\n\nAquí estoy.\n\n¿Qué te trajo de vuelta hoy?',
  'Hola {name}\n\nEstoy aquí para escucharte.\n\n¿Qué está presente ahora mismo?',
];

function applyName(template: string, name: string | null): string {
  if (name) return template.replace('{name}', name);
  return template.replace(' {name}', '');
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function selectVariants(hoursSinceLast: number | null): string[] {
  if (hoursSinceLast === null) return FIRST_TIME;
  if (hoursSinceLast <= 36) return YESTERDAY;
  if (hoursSinceLast <= 168) return PAST_WEEK;
  return LONG_ABSENCE;
}

export async function getLastUserChatTimestamp(userId: string): Promise<Date | null> {
  const { data } = await supabase
    .from('chat_messages')
    .select('created_at')
    .eq('user_id', userId)
    .eq('sender', 'user')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.created_at ? new Date(data.created_at) : null;
}

export function buildContextualGreeting(
  lastChatAt: Date | null,
  name: string | null,
): string {
  const hoursSinceLast = lastChatAt
    ? (Date.now() - lastChatAt.getTime()) / (1000 * 60 * 60)
    : null;

  const variants = selectVariants(hoursSinceLast);
  const template = pickRandom(variants);
  return applyName(template, name);
}

// ── First-session topic memory ─────────────────────────────────────────────────
// Fetches the encrypted 'first_session_topic' key from user_memory.
// Returns the raw encrypted value — caller must decrypt.
export async function getFirstSessionTopicEnc(userId: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('user_memory')
      .select('value_enc')
      .eq('user_id', userId)
      .eq('key', 'first_session_topic')
      .maybeSingle();
    return data?.value_enc ?? null;
  } catch {
    return null;
  }
}

// The RETURN_WITH_MEMORY templates slot {topic} in after "que", so the topic
// has to be a sentence fragment: lowercase, no final period, addressed to the
// user. Notes written as standalone third-person sentences ("Los pensamientos
// sobre el dinero son un tema recurrente para Albert.") produce a greeting that
// is both ungrammatical and oddly clinical — Elena talking *about* the person
// instead of *to* them. Returns null when the note cannot be used that way, so
// the caller can fall through to a plain greeting rather than say something odd.
export function normalizeTopicForGreeting(
  topic: string | null | undefined,
  name: string | null,
): string | null {
  if (!topic) return null;
  let t = topic.trim().replace(/\s+/g, ' ').replace(/[.;,\s]+$/, '');
  if (t.length < 6 || t.length > 140) return null;

  // A note that names the user was written about them, not to them. Rewriting
  // the grammar reliably is not possible here, so skip it.
  const first = (name ?? '').trim().split(/\s+/)[0];
  if (first && first.length > 2) {
    const escaped = first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(t)) return null;
  }

  // Multiple sentences never read as a clause.
  if (/[.!?]\s+\S/.test(t)) return null;

  // Lowercase a leading capital unless it is a proper noun (a capitalised word
  // followed by another capitalised word is left alone).
  if (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(t) && !/^[A-ZÁÉÍÓÚÑ]\S*\s+[A-ZÁÉÍÓÚÑ]/.test(t)) {
    t = t.charAt(0).toLowerCase() + t.slice(1);
  }
  return t;
}

// Builds a return greeting that references the first-session topic.
// The topic should already be decrypted before passing here.
// Returns null when the topic is not usable as a clause (see above).
export function buildReturnGreetingWithMemory(
  name: string | null,
  topic: string,
): string | null {
  const clause = normalizeTopicForGreeting(topic, name);
  if (!clause) return null;
  const template = pickRandom(RETURN_WITH_MEMORY);
  const withName = applyName(template, name);
  return withName.replace('{topic}', clause);
}

// ── Dynamic elena_memories greeting ───────────────────────────────────────────
// Picks the least-recently-referenced, non-sensitive theme/event from the
// user's Elena memory notebook and slots it into a RETURN_WITH_MEMORY template.
// Bumps last_referenced_at so the same note isn't reused soon (7-day floor).
// Returns null if nothing eligible — caller should fall through.

const MEMORY_REUSE_FLOOR_DAYS = 7;
const ELIGIBLE_MEMORY_TYPES = ['theme', 'event'];

export async function buildDynamicMemoryGreeting(
  name: string | null,
  profile: ProfileForEncryption,
): Promise<string | null> {
  try {
    const notes = await loadElenaMemories(profile);
    if (!notes.length) return null;

    const floorMs = MEMORY_REUSE_FLOOR_DAYS * 24 * 60 * 60 * 1000;
    const now = Date.now();

    // Eligible: active, non-sensitive, non-crisis, theme/event, plaintext present.
    const eligible = notes.filter(
      (n) =>
        n.active &&
        !n.sensitive &&
        n.type !== 'crisis' &&
        ELIGIBLE_MEMORY_TYPES.includes(n.type) &&
        n.note &&
        n.note.length > 5,
    );
    if (!eligible.length) return null;

    // Prefer those not referenced within the floor window; if all are recent,
    // fall through (return null) rather than force a stale repeat.
    const stale = eligible.filter(
      (n) => now - new Date(n.last_referenced_at).getTime() >= floorMs,
    );
    const pool = stale.length ? stale : [];
    if (!pool.length) return null;

    // Pick the least-recently-referenced (oldest last_referenced_at).
    pool.sort(
      (a, b) =>
        new Date(a.last_referenced_at).getTime() -
        new Date(b.last_referenced_at).getTime(),
    );
    // Take the least-recently-referenced note that actually reads as a clause.
    // Older notes were written as third-person sentences and cannot be spliced
    // into a greeting; skipping them is better than saying something odd.
    for (const candidate of pool) {
      const greeting = buildReturnGreetingWithMemory(name, candidate.note);
      if (!greeting) continue;

      // Bump last_referenced_at so it rotates out next time. Only the note we
      // actually used is bumped.
      await supabase
        .from('elena_memories')
        .update({ last_referenced_at: new Date().toISOString() })
        .eq('id', candidate.id);

      return greeting;
    }
    return null;
  } catch (err) {
    console.warn('[greeting] dynamic memory greeting failed:', err);
    return null;
  }
}

// ── Insight return bridge ─────────────────────────────────────────────────────

const RETURN_INSIGHT_OPENERS: string[] = [
  'Estuve revisando un poco lo que has compartido.',
  'Mientras no estabas, noté algo en tus conversaciones.',
  'Algo que me quedó de lo que has compartido.',
  'Hay algo que noté mientras no estabas.',
];

function extractInsightForChat(raw: string): string {
  const cleaned = raw
    .replace(/\[\[COMPARISON\]\][\s\S]*?\[\[\/COMPARISON\]\]/g, '')
    .replace(/\[\[MICRO_STEP\]\][\s\S]*?\[\[\/MICRO_STEP\]\]/g, '')
    .replace(/\n+/g, ' ')
    .trim();
  const parts = cleaned.split(/(?<=[.!?¡¿])\s+/);
  return parts.slice(0, 2).join(' ').slice(0, 250);
}

export async function getInsightSnippetForReturn(): Promise<string | null> {
  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const { data } = await supabase
      .from('mood_weekly_insights')
      .select('insight_text, week_start_date')
      .gte('week_start_date', fourteenDaysAgo)
      .order('week_start_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data?.insight_text) return null;
    return extractInsightForChat(data.insight_text as string);
  } catch {
    return null;
  }
}

export function buildReturnGreetingWithInsight(
  name: string | null,
  insightSnippet: string,
): string {
  const greeting = name ? `Hola ${name} 🌷` : 'Hola 🌷';
  const opener = pickRandom(RETURN_INSIGHT_OPENERS);
  return `${greeting}\n\n${opener}\n\n${insightSnippet}\n\n¿Qué hay ahora mismo?`;
}

const EARLY_RETURN_SIGNAL_LINES: Record<string, string[]> = {
  positive: [
    'La última vez había algo de ligereza en lo que contabas.',
    'Noté algo de ánimo en tus últimas palabras.',
  ],
  stress: [
    'La última vez sonaba como que había bastante encima.',
    'Noté algo de peso en lo que compartiste.',
  ],
  anxiety: [
    'Noté algo de inquietud en lo que compartiste.',
    'Había algo de preocupación en tus últimas palabras.',
  ],
  gratitude: [
    'Había algo de gratitud en lo que contabas.',
    'Noté algo de reconocimiento en tus palabras anteriores.',
  ],
};

export async function getChatSignalForReturn(): Promise<{ type: string; score: number } | null> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const { data } = await supabase
      .from('chat_signal_daily_agg')
      .select('signal_type, score')
      .gte('signal_date', sevenDaysAgo);

    if (!data?.length) return null;

    const totals: Record<string, number> = {};
    for (const row of data) {
      totals[row.signal_type as string] =
        (totals[row.signal_type as string] ?? 0) + (Number(row.score) || 0);
    }

    const sorted = Object.entries(totals).sort(([, a], [, b]) => b - a);
    const [dominantType, dominantScore] = sorted[0] ?? [];

    if (!dominantType || dominantScore < 2) return null;
    return { type: dominantType, score: dominantScore };
  } catch {
    return null;
  }
}

export function buildReturnGreetingWithSignal(
  name: string | null,
  signalType: string,
): string {
  const greeting = name ? `Hola ${name} 🌷` : 'Hola 🌷';
  const lines = EARLY_RETURN_SIGNAL_LINES[signalType];
  if (!lines?.length) return buildContextualGreeting(null, name);
  const line = pickRandom(lines);
  return `${greeting}\n\n${line}\n\n¿Cómo llega este momento?`;
}