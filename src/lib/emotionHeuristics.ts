export interface DiarySuggestionResult {
  shouldSuggest: boolean;
  reason: string;
  heaviness: number;
  repetition: number;
}

const HEAVY_ES = [
  'ansiedad', 'pánico', 'panico', 'miedo', 'deprime', 'depresión', 'depresion',
  'abrumado', 'abrumada', 'temblar', 'sudo', 'sudando', 'ataque', 'ataques',
  'nervios', 'tensión', 'tension', 'siento mal', 'no puedo', 'me cuesta',
  'angustia', 'angustiado', 'angustiada', 'desesperado', 'desesperada',
  'agotado', 'agotada', 'llorar', 'lloro', 'soledad', 'perdido', 'perdida',
  'bloqueado', 'bloqueada', 'paralizado', 'paralizada', 'frustrado', 'frustrada',
  'preocupado', 'preocupada', 'asustado', 'asustada', 'estresado', 'estresada',
];

const HEAVY_EN = [
  'anxiety', 'panic', 'fear', 'overwhelmed', 'depressed', 'attack', 'attacks',
  'trembling', 'sweating', 'scared', 'hopeless', 'desperate', 'exhausted',
  'crying', 'alone', 'lost', 'stressed', 'worried', 'terrified', 'helpless',
];

const ALL_HEAVY = [...HEAVY_ES, ...HEAVY_EN];

function stripDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const NORMALIZED_HEAVY_KEYWORDS = ALL_HEAVY.map(k => stripDiacritics(k.toLowerCase()));

const HEAVY_TOKEN_SET = new Set(
  ALL_HEAVY.flatMap(phrase =>
    stripDiacritics(phrase.toLowerCase())
      .split(/\s+/)
      .filter(t => t.length >= 4)
  )
);

const TOPIC_TOKEN_SET = new Set([
  'trabajo', 'jefe', 'pareja', 'relacion', 'dinero', 'salud',
  'viaje', 'cdmx', 'familia', 'estres', 'miedo', 'ansiedad', 'panico',
]);

const STOPWORDS = new Set([
  'para', 'pero', 'como', 'este', 'esta', 'esto', 'desde', 'entre', 'sobre',
  'otro', 'otra', 'mismo', 'misma', 'tambien', 'nunca', 'siempre', 'entonces',
  'pues', 'bien', 'hace', 'that', 'with', 'this', 'from', 'have', 'been',
  'they', 'will', 'would', 'could', 'should', 'when', 'what', 'then', 'there',
]);

function isMeaningfulToken(token: string): boolean {
  const normalized = stripDiacritics(token);
  if (HEAVY_TOKEN_SET.has(normalized)) return true;
  if (TOPIC_TOKEN_SET.has(normalized)) return true;
  if (token.length >= 6) return true;
  return false;
}

function tokenize(text: string): string[] {
  return stripDiacritics(text.toLowerCase())
    .replace(/[¿¡.,!?;:()[\]"'«»]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 4 && !/^\d+$/.test(t) && !STOPWORDS.has(t));
}

export function evaluateDiarySuggestion(userMessages: string[]): DiarySuggestionResult {
  const last8 = userMessages.slice(-8);

  if (last8.length < 3) {
    return { shouldSuggest: false, reason: 'not_enough_messages', heaviness: 0, repetition: 0 };
  }

  const combined = stripDiacritics(last8.join(' ').toLowerCase());

  let heaviness = 0;
  for (const keyword of NORMALIZED_HEAVY_KEYWORDS) {
    const words = keyword.split(/\s+/);
    if (words.length === 1) {
      const pattern = new RegExp(`\\b${words[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      if (pattern.test(combined)) heaviness++;
    } else {
      if (combined.includes(keyword)) heaviness++;
    }
  }

  const freqMap: Record<string, number> = {};
  let skippedCount = 0;
  for (const msg of last8) {
    const tokens = tokenize(msg);
    for (const t of tokens) {
      if (!isMeaningfulToken(t)) {
        skippedCount++;
        continue;
      }
      freqMap[t] = (freqMap[t] ?? 0) + 1;
    }
  }

  const repetition = Object.values(freqMap).length > 0 ? Math.max(...Object.values(freqMap)) : 0;

  if (import.meta.env.DEV) {
    console.debug('[evaluateDiarySuggestion]', { heaviness, repetition, skippedCount, freqMap });
  }

  if (heaviness >= 3) {
    return { shouldSuggest: true, reason: 'heaviness>=3', heaviness, repetition };
  }
  if (heaviness >= 1 && repetition >= 3) {
    return { shouldSuggest: true, reason: 'repetition>=3_with_heaviness>=1', heaviness, repetition };
  }

  return {
    shouldSuggest: false,
    reason: `below_threshold(heaviness=${heaviness},repetition=${repetition})`,
    heaviness,
    repetition,
  };
}

const L2_KEYWORDS = [
  'suicid', 'suicida', 'suicidar', 'hacerme daño', 'matarme', 'quitarme la vida',
  'no quiero vivir', 'autolesion', 'autolesión', 'self-harm', 'kill myself',
  'end my life', 'hurt myself', 'want to die',
];

const L1_KEYWORDS = [
  'pánico', 'panico', 'panic', 'ansiedad', 'anxiety', 'ataque de', 'ataques de',
  'temblar', 'sudo', 'sudando', 'trembling', 'sweating', 'no puedo respirar',
  "can't breathe", 'cannot breathe', 'hyperventil',
];

export function computeCrisisLevel(content: string): 0 | 1 | 2 {
  const text = content.toLowerCase();
  if (L2_KEYWORDS.some(k => text.includes(k))) return 2;
  if (L1_KEYWORDS.some(k => text.includes(k))) return 1;
  return 0;
}

export function sessionCrisisLevel(userMessages: string[]): 0 | 1 | 2 {
  let max: 0 | 1 | 2 = 0;
  for (const msg of userMessages) {
    const level = computeCrisisLevel(msg);
    if (level > max) max = level as 0 | 1 | 2;
    if (max === 2) break;
  }
  return max;
}
