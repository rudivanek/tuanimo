const TEXTURE_WORDS = [
  'nudo', 'presión', 'peso', 'pesado', 'pesada', 'pesa', 'carga',
  'aprieta', 'aprieto', 'apretado', 'apretada', 'aprietan',
  'sofoca', 'ahoga', 'oprime', 'oprimido', 'oprimida',
  'vacío', 'vacía', 'hueco', 'hueca',
  'tensión', 'tensa', 'tenso', 'tirante', 'tirantes', 'contraído', 'contraída',
  'revuelto', 'revuelta', 'agita', 'agitado', 'agitada',
  'latido', 'vibra', 'zumba', 'golpea',
  'ardor', 'ardiendo', 'helado', 'helada',
  'pesadez', 'ligereza', 'liviano', 'liviana', 'flotando',
  'silencio', 'quietud',
  'no termina', 'no para', 'no cede', 'no pasa',
  'sin espacio', 'no hay lugar',
  'revolotea', 'tambalea', 'desborda', 'desbordando',
  'encoge', 'expande', 'paraliza', 'inmoviliza',
];

const METAPHOR_PATTERNS = [
  /como si\b/i,
  /\bes como\b/i,
  /\buna especie de\b/i,
  /\balgo que\b.{4,}/i,
];

const SPECIFIC_FIRST_PERSON = /\b(siento que|noto que|me parece que|me da la sensación|me cuesta|me pesa|me aprieta|me agita|me sofoca|me oprime|me pone|me queda|me desborda|me paraliza|me encoge)\b/i;

const CONTINUATION_PATTERNS = /\b(todavía|aún|sigue|sigo|no termina|no para|no cede|no pasa)\b/i;

const GENERIC_PATTERNS = [
  /^(todo|nada|algo) (está|estaba|se siente|es|fue) (raro|mal|bien|difícil|diferente|complicado)\.?$/i,
  /^(estoy|estaba) (mal|bien|mejor|peor|así|igual)\.?$/i,
  /^(no sé|no sé qué|no sé cómo|no sé por qué|no sé si)\.?$/i,
  /^(me siento|me sentí) (mal|bien|mejor|peor|raro|rara|así)\.?$/i,
  /^(tuve|fue) un (día|momento|rato) (difícil|duro|malo|raro|largo)\.?$/i,
  /^(es|fue|ha sido) (difícil|duro|complicado|raro|pesado)\.?$/i,
  /^no (entiendo|sé)\.?$/i,
  /^sigo (aquí|adelante|igual|así)\.?$/i,
  /^me cuesta\.?$/i,
  /^no (puedo|logro|consigo)\.?$/i,
  /^(estoy|me siento) (cansado|cansada)\.?$/i,
];

const STOP_WORDS = new Set([
  'de', 'la', 'el', 'en', 'y', 'a', 'que', 'un', 'una', 'los', 'las',
  'me', 'se', 'te', 'le', 'nos', 'lo', 'por', 'con', 'para', 'como',
  'mi', 'tu', 'su', 'hay', 'es', 'era', 'fue', 'ser', 'estar',
  'todo', 'siempre', 'nunca', 'ya', 'muy', 'más', 'pero', 'si',
  'no', 'ni', 'o', 'al', 'del', 'este', 'esta', 'ese', 'esa', 'esto',
  'he', 'ha', 'han', 'haber', 'cuando', 'donde', 'como', 'así',
]);

const MIN_SCORE = 4;
const MIN_PHRASE_CHARS = 15;

function scorePhrase(phrase: string): number {
  const lower = phrase.toLowerCase();

  if (GENERIC_PATTERNS.some(p => p.test(phrase.trim()))) return 0;

  let score = 0;

  for (const word of TEXTURE_WORDS) {
    if (lower.includes(word)) score += 2;
  }

  for (const pat of METAPHOR_PATTERNS) {
    if (pat.test(lower)) score += 3;
  }

  if (SPECIFIC_FIRST_PERSON.test(lower)) score += 3;

  if (CONTINUATION_PATTERNS.test(lower)) score += 1;

  return score;
}

function getSignificantWords(phrase: string): Set<string> {
  return new Set(
    phrase
      .toLowerCase()
      .replace(/[^a-záéíóúüñ\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w))
  );
}

function isTooSimilar(phrase: string, selected: string[]): boolean {
  const words = getSignificantWords(phrase);
  if (words.size === 0) return false;
  for (const s of selected) {
    const sw = getSignificantWords(s);
    if (sw.size === 0) continue;
    let overlap = 0;
    for (const w of words) {
      if (sw.has(w)) overlap++;
    }
    if (overlap / Math.min(words.size, sw.size) > 0.5) return true;
  }
  return false;
}

function shuffleWithinTiers(
  candidates: { phrase: string; score: number }[],
): { phrase: string; score: number }[] {
  const groups = new Map<number, { phrase: string; score: number }[]>();
  for (const c of candidates) {
    if (!groups.has(c.score)) groups.set(c.score, []);
    groups.get(c.score)!.push(c);
  }
  const tiers = Array.from(groups.keys()).sort((a, b) => b - a);
  const result: { phrase: string; score: number }[] = [];
  for (const tier of tiers) {
    const group = groups.get(tier)!;
    for (let i = group.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [group[i], group[j]] = [group[j], group[i]];
    }
    result.push(...group);
  }
  return result;
}

export function extractLanguageSignals(texts: string[], maxSignals = 5): string[] {
  const phraseScores = new Map<string, number>();
  const phraseSourceCount = new Map<string, number>();

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    if (!text || text.length < MIN_PHRASE_CHARS) continue;

    const sentences = text
      .split(/[.!?\n]+/)
      .map(s => s.trim())
      .filter(s => s.length >= MIN_PHRASE_CHARS && s.length < 120);

    const seenInThisText = new Set<string>();

    for (const sentence of sentences) {
      const score = scorePhrase(sentence);
      if (score < MIN_SCORE) continue;

      const normalized = sentence.toLowerCase().trim();

      if (!phraseScores.has(normalized) || phraseScores.get(normalized)! < score) {
        phraseScores.set(normalized, score);
      }

      if (!seenInThisText.has(normalized)) {
        seenInThisText.add(normalized);
        phraseSourceCount.set(normalized, (phraseSourceCount.get(normalized) ?? 0) + 1);
      }
    }
  }

  const candidates: { phrase: string; score: number }[] = [];

  for (const [normalized, baseScore] of phraseScores) {
    const sourceCount = phraseSourceCount.get(normalized) ?? 1;
    const repetitionBonus = sourceCount > 1 ? (sourceCount - 1) * 4 : 0;
    candidates.push({ phrase: normalized, score: baseScore + repetitionBonus });
  }

  const shuffled = shuffleWithinTiers(candidates);

  const selected: string[] = [];
  for (const c of shuffled) {
    if (selected.length >= maxSignals) break;
    if (!isTooSimilar(c.phrase, selected)) {
      selected.push(c.phrase);
    }
  }

  return selected;
}
