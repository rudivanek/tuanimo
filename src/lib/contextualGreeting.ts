// src/lib/contextualGreeting.ts
// Contextual greeting system for chat welcome messages.
// Selects appropriate greeting based on time since last chat session.

import { supabase } from './supabaseClient';

// ── Types ─────────────────────────────────────────────────────────────────────

type GreetingVariant = 'FIRST_TIME' | 'YESTERDAY' | 'PAST_WEEK' | 'LONG_ABSENCE';

// ── Variant selection ─────────────────────────────────────────────────────────

function selectVariant(lastChatAt: Date | null): GreetingVariant {
  if (!lastChatAt) return 'FIRST_TIME';
  const hoursAgo = (Date.now() - lastChatAt.getTime()) / (1000 * 60 * 60);
  if (hoursAgo < 24) return 'YESTERDAY';
  if (hoursAgo < 168) return 'PAST_WEEK';
  return 'LONG_ABSENCE';
}

// ── Greeting templates ────────────────────────────────────────────────────────

const FIRST_TIME_VARIANTS = [
  (name: string | null) =>
    `Hola${name ? ` ${name}` : ''} 🌷\n\nEstoy aquí para escucharte.\n\nPuedes contarme algo que tengas en la cabeza ahora mismo… no tiene que estar ordenado.\n\n¿Cómo te sientes hoy?`,
  (name: string | null) =>
    `Hola${name ? ` ${name}` : ''} 🌷\n\nEstoy aquí para escucharte.\n\nNo necesitas saber bien qué decir — puedes empezar por lo que tengas en mente.\n\n¿Cómo te sientes hoy?`,
  (name: string | null) =>
    `Hola${name ? ` ${name}` : ''} 🌷\n\nEstoy aquí para escucharte.\n\nPuedes escribir lo que sea, tal como venga — no tiene que ser perfecto.\n\n¿Cómo te sientes hoy?`,
  (name: string | null) =>
    `Hola${name ? ` ${name}` : ''} 🌷\n\nEstoy aquí para escucharte.\n\nPuedes contarme algo de lo que tienes en mente, aunque no lo tengas del todo claro.\n\n¿Cómo te sientes hoy?`,
];

const YESTERDAY_VARIANTS = [
  (name: string | null) =>
    `Hola${name ? ` ${name}` : ''} 🌷\n\nQué bueno verte de nuevo.\n\n¿Cómo estás hoy?`,
  (name: string | null) =>
    `Hola${name ? ` ${name}` : ''} 🌷\n\nMe da gusto que estés aquí.\n\n¿Cómo te sientes ahora mismo?`,
  (name: string | null) =>
    `Hola${name ? ` ${name}` : ''} 🌷\n\nAquí estoy contigo.\n\n¿Qué tienes en mente hoy?`,
];

const PAST_WEEK_VARIANTS = [
  (name: string | null) =>
    `Hola${name ? ` ${name}` : ''} 🌷\n\nQué gusto verte de nuevo.\n\n¿Cómo te has sentido desde la última vez?`,
  (name: string | null) =>
    `Hola${name ? ` ${name}` : ''} 🌷\n\nMe da gusto verte por aquí.\n\n¿Qué ha pasado desde la última vez que hablamos?`,
  (name: string | null) =>
    `Hola${name ? ` ${name}` : ''} 🌷\n\nAquí estoy para escucharte.\n\n¿Cómo te ha ido estos días?`,
  (name: string | null) =>
    `Hola${name ? ` ${name}` : ''} 🌷\n\nVolviste 😊\n\n¿Cómo te sientes hoy?`,
];

const LONG_ABSENCE_VARIANTS = [
  (name: string | null) =>
    `Hola${name ? ` ${name}` : ''} 🌷\n\nHacía tiempo que no hablábamos.\n\n¿Cómo has estado?`,
  (name: string | null) =>
    `Hola${name ? ` ${name}` : ''} 🌷\n\nMe da gusto que hayas vuelto.\n\n¿Qué te trae por aquí hoy?`,
  (name: string | null) =>
    `Hola${name ? ` ${name}` : ''} 🌷\n\nQué bueno verte de nuevo.\n\n¿Cómo te has sentido últimamente?`,
];

function pickVariant<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Return greeting with insight snippet ──────────────────────────────────────

const RETURN_WITH_INSIGHT_VARIANTS = [
  (name: string | null, snippet: string) =>
    `Hola${name ? ` ${name}` : ''} 🌷\n\n${snippet}\n\n¿Cómo te sientes hoy?`,
  (name: string | null, snippet: string) =>
    `Hola${name ? ` ${name}` : ''} 🌷\n\n${snippet}\n\n¿Qué tienes en mente ahora mismo?`,
];

// ── Early return signal lines ─────────────────────────────────────────────────

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

// ── Return greeting with memory ───────────────────────────────────────────────

const RETURN_WITH_MEMORY_VARIANTS = [
  (name: string | null, topic: string) =>
    `Hola${name ? ` ${name}` : ''} 🌷\n\nLa última vez me contabas sobre ${topic}.\n\n¿Cómo has estado desde entonces?`,
  (name: string | null, topic: string) =>
    `Hola${name ? ` ${name}` : ''} 🌷\n\nLa última vez hablábamos de ${topic}.\n\n¿Cómo te has sentido estos días?`,
  (name: string | null, topic: string) =>
    `Hola${name ? ` ${name}` : ''} 🌷\n\nMe quedé pensando en lo que me contabas — ${topic}.\n\n¿Cómo estás hoy?`,
];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the timestamp of the most recent user chat message, or null if none exists.
 */
export async function getLastUserChatTimestamp(userId: string): Promise<Date | null> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('created_at')
    .eq('user_id', userId)
    .eq('sender', 'user')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return new Date(data.created_at);
}

/**
 * Builds the contextual greeting text based on when the user last chatted.
 */
export function buildContextualGreeting(lastChatAt: Date | null, name: string | null): string {
  const variant = selectVariant(lastChatAt);
  switch (variant) {
    case 'FIRST_TIME':
      return pickVariant(FIRST_TIME_VARIANTS)(name);
    case 'YESTERDAY':
      return pickVariant(YESTERDAY_VARIANTS)(name);
    case 'PAST_WEEK':
      return pickVariant(PAST_WEEK_VARIANTS)(name);
    case 'LONG_ABSENCE':
      return pickVariant(LONG_ABSENCE_VARIANTS)(name);
  }
}

/**
 * Returns the most recent weekly insight text snippet, or null if none exists.
 */
export async function getInsightSnippetForReturn(): Promise<string | null> {
  const { data, error } = await supabase
    .from('mood_weekly_insights')
    .select('insight_text')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const text = data.insight_text;
  if (!text || text.trim().length < 10) return null;

  // Return first sentence or first 120 chars, whichever is shorter
  const firstSentence = text.split(/[.!?]/)[0]?.trim();
  if (firstSentence && firstSentence.length >= 20) {
    return firstSentence.length <= 120 ? firstSentence : firstSentence.slice(0, 120).trim();
  }
  return text.slice(0, 120).trim();
}

/**
 * Builds a return greeting that incorporates a weekly insight snippet.
 */
export function buildReturnGreetingWithInsight(name: string | null, snippet: string): string {
  return pickVariant(RETURN_WITH_INSIGHT_VARIANTS)(name, snippet);
}

/**
 * Queries chat_signal_daily_agg for the past 7 days and returns the dominant signal type
 * if its cumulative score is >= 2, otherwise null.
 */
export async function getChatSignalForReturn(): Promise<{ type: string; score: number } | null> {
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const sinceDate = since.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('chat_signal_daily_agg')
    .select('signal_type, score')
    .gte('signal_date', sinceDate);

  if (error || !data || data.length === 0) return null;

  const totals: Record<string, number> = {};
  for (const row of data) {
    totals[row.signal_type] = (totals[row.signal_type] ?? 0) + Number(row.score ?? 0);
  }

  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;

  const [type, score] = entries[0];
  if (score < 2) return null;

  return { type, score };
}

/**
 * Builds a soft return greeting that acknowledges the user's dominant emotional signal
 * from their previous chat sessions.
 */
export function buildReturnGreetingWithSignal(name: string | null, signalType: string): string {
  const lines = EARLY_RETURN_SIGNAL_LINES[signalType];
  const signalLine = lines ? pickVariant(lines) : null;

  if (!signalLine) {
    return buildContextualGreeting(null, name);
  }

  const nameStr = name ? ` ${name}` : '';
  return `Hola${nameStr} 🌷\n\n${signalLine}\n\n¿Cómo te sientes hoy?`;
}

/**
 * Returns the encrypted value of the user's first session topic memory, or null if not set.
 */
export async function getFirstSessionTopicEnc(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_memory')
    .select('value_enc')
    .eq('user_id', userId)
    .eq('key', 'first_session_topic')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.value_enc ?? null;
}

/**
 * Builds a return greeting that references a topic from the user's first session.
 */
export function buildReturnGreetingWithMemory(name: string | null, topic: string): string {
  return pickVariant(RETURN_WITH_MEMORY_VARIANTS)(name, topic);
}
