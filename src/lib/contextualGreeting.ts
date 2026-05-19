import { supabase } from './supabaseClient';

const FIRST_TIME: string[] = [
  'Hola {name} 🌷\n\nEstoy aquí para escucharte.\n\nPuedes contarme algo que tengas en la cabeza ahora mismo… no tiene que estar ordenado.\n\n¿Qué te trajo por aquí hoy?',
  'Hola {name}\n\nQué bueno verte por aquí.\n\nNo necesitas saber bien qué decir — puedes empezar por lo que tengas en mente.\n\n¿Qué hay en tu cabeza ahora mismo?',
  'Hola {name} 🌷\n\nPodemos ir con calma.\n\nPuedes escribir lo que sea, tal como venga — no tiene que ser perfecto.\n\n¿Qué está ocupando tu mente hoy?',
  'Hola {name}\n\nEstoy aquí contigo.\n\nPuedes contarme algo de lo que tienes en mente, aunque no lo tengas del todo claro.\n\n¿Qué está pasando por dentro hoy?',
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
