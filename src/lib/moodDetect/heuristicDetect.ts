import type { MoodKey, MoodState } from '../../types/mood';

type PhraseEntry = { phrase: string; weight: number };
type BucketMap = Record<MoodKey, PhraseEntry[]>;

const BUCKETS: BucketMap = {
  anxiety: [
    { phrase: 'ansioso', weight: 1.0 }, { phrase: 'ansiosa', weight: 1.0 },
    { phrase: 'ansiedad', weight: 1.2 }, { phrase: 'nervioso', weight: 1.0 },
    { phrase: 'nerviosa', weight: 1.0 }, { phrase: 'me preocupa', weight: 1.3 },
    { phrase: 'preocupado', weight: 1.0 }, { phrase: 'preocupada', weight: 1.0 },
    { phrase: 'preocupación', weight: 1.1 }, { phrase: 'no puedo', weight: 0.7 },
    { phrase: 'miedo', weight: 1.0 }, { phrase: 'tengo miedo', weight: 1.5 },
    { phrase: 'aterrado', weight: 1.2 }, { phrase: 'aterrada', weight: 1.2 },
    { phrase: 'angustiado', weight: 1.1 }, { phrase: 'angustiada', weight: 1.1 },
    { phrase: 'angustia', weight: 1.2 }, { phrase: 'inquieto', weight: 0.9 },
    { phrase: 'pánico', weight: 1.3 }, { phrase: 'panico', weight: 1.3 },
    { phrase: 'temor', weight: 1.0 }, { phrase: 'terror', weight: 1.2 },
    { phrase: 'me da miedo', weight: 1.4 }, { phrase: 'me asusta', weight: 1.2 },
  ],
  sadness: [
    { phrase: 'triste', weight: 1.2 }, { phrase: 'tristeza', weight: 1.3 },
    { phrase: 'llorar', weight: 1.2 }, { phrase: 'estoy llorando', weight: 1.5 },
    { phrase: 'lloro', weight: 1.3 }, { phrase: 'me duele', weight: 1.0 },
    { phrase: 'me duele mucho', weight: 1.4 }, { phrase: 'vacío', weight: 1.1 },
    { phrase: 'vacía', weight: 1.1 }, { phrase: 'deprimido', weight: 1.3 },
    { phrase: 'deprimida', weight: 1.3 }, { phrase: 'melancolía', weight: 1.2 },
    { phrase: 'sin ganas', weight: 1.1 }, { phrase: 'desanimado', weight: 1.0 },
    { phrase: 'abatido', weight: 1.1 }, { phrase: 'desilusionado', weight: 1.0 },
    { phrase: 'decepcionado', weight: 1.0 }, { phrase: 'herido', weight: 1.0 },
    { phrase: 'herida', weight: 1.0 }, { phrase: 'roto', weight: 1.1 },
    { phrase: 'rota', weight: 1.1 }, { phrase: 'nostalgia', weight: 1.0 },
    { phrase: 'extraño mucho', weight: 1.3 },
  ],
  anger: [
    { phrase: 'enojado', weight: 1.2 }, { phrase: 'enojada', weight: 1.2 },
    { phrase: 'furioso', weight: 1.3 }, { phrase: 'furiosa', weight: 1.3 },
    { phrase: 'molesto', weight: 1.0 }, { phrase: 'molesta', weight: 1.0 },
    { phrase: 'rabia', weight: 1.3 }, { phrase: 'coraje', weight: 1.2 },
    { phrase: 'bronca', weight: 1.2 }, { phrase: 'odio', weight: 1.1 },
    { phrase: 'harto', weight: 1.1 }, { phrase: 'harta', weight: 1.1 },
    { phrase: 'indignado', weight: 1.2 }, { phrase: 'irritado', weight: 1.0 },
    { phrase: 'frustrado', weight: 1.0 }, { phrase: 'frustración', weight: 1.1 },
    { phrase: 'exasperado', weight: 1.1 }, { phrase: 'me saca', weight: 0.9 },
    { phrase: 'me carga', weight: 0.9 }, { phrase: 'no lo soporto', weight: 1.2 },
    { phrase: 'resentido', weight: 1.0 }, { phrase: 'rencor', weight: 1.1 },
  ],
  stress: [
    { phrase: 'estresado', weight: 1.2 }, { phrase: 'estresada', weight: 1.2 },
    { phrase: 'estrés', weight: 1.2 }, { phrase: 'stress', weight: 1.0 },
    { phrase: 'agotado', weight: 1.1 }, { phrase: 'agotada', weight: 1.1 },
    { phrase: 'agotamiento', weight: 1.2 }, { phrase: 'mucha presión', weight: 1.3 },
    { phrase: 'demasiado trabajo', weight: 1.3 }, { phrase: 'sin tiempo', weight: 1.1 },
    { phrase: 'quemado', weight: 1.2 }, { phrase: 'burnout', weight: 1.2 },
    { phrase: 'no tengo energía', weight: 1.3 }, { phrase: 'cansado de todo', weight: 1.3 },
    { phrase: 'responsabilidades', weight: 0.7 }, { phrase: 'no alcanzo', weight: 1.1 },
    { phrase: 'saturado', weight: 1.1 }, { phrase: 'saturada', weight: 1.1 },
  ],
  loneliness: [
    { phrase: 'solo', weight: 0.8 }, { phrase: 'sola', weight: 0.8 },
    { phrase: 'soledad', weight: 1.3 }, { phrase: 'nadie me', weight: 1.2 },
    { phrase: 'aislado', weight: 1.2 }, { phrase: 'aislada', weight: 1.2 },
    { phrase: 'incomprendido', weight: 1.2 }, { phrase: 'incomprendida', weight: 1.2 },
    { phrase: 'abandonado', weight: 1.3 }, { phrase: 'abandonada', weight: 1.3 },
    { phrase: 'olvidado', weight: 1.1 }, { phrase: 'me siento aislado', weight: 1.5 },
    { phrase: 'desconectado', weight: 1.1 }, { phrase: 'nadie me entiende', weight: 1.5 },
    { phrase: 'no tengo a nadie', weight: 1.5 }, { phrase: 'excluido', weight: 1.2 },
  ],
  overwhelm: [
    { phrase: 'demasiado', weight: 1.0 }, { phrase: 'no doy abasto', weight: 1.5 },
    { phrase: 'no puedo más', weight: 1.5 }, { phrase: 'abrumado', weight: 1.3 },
    { phrase: 'abrumada', weight: 1.3 }, { phrase: 'agobiado', weight: 1.2 },
    { phrase: 'agobiada', weight: 1.2 }, { phrase: 'todo junto', weight: 1.2 },
    { phrase: 'colapso', weight: 1.2 }, { phrase: 'desbordado', weight: 1.2 },
    { phrase: 'no aguanto', weight: 1.3 }, { phrase: 'aplastado', weight: 1.2 },
    { phrase: 'sobrepasado', weight: 1.2 }, { phrase: 'al límite', weight: 1.3 },
    { phrase: 'todo a la vez', weight: 1.2 }, { phrase: 'mucho encima', weight: 1.1 },
  ],
  uncertainty: [
    { phrase: 'no sé qué hacer', weight: 1.5 }, { phrase: 'no sé', weight: 0.7 },
    { phrase: 'confundido', weight: 1.0 }, { phrase: 'confundida', weight: 1.0 },
    { phrase: 'perdido', weight: 1.0 }, { phrase: 'perdida', weight: 1.0 },
    { phrase: 'tengo dudas', weight: 1.2 }, { phrase: 'inseguro', weight: 1.0 },
    { phrase: 'insegura', weight: 1.0 }, { phrase: 'indeciso', weight: 1.1 },
    { phrase: 'sin rumbo', weight: 1.2 }, { phrase: 'desorientado', weight: 1.1 },
    { phrase: 'no tengo claro', weight: 1.3 }, { phrase: 'incertidumbre', weight: 1.2 },
    { phrase: 'no entiendo', weight: 0.9 }, { phrase: 'a ver qué pasa', weight: 0.8 },
  ],
  joy: [
    { phrase: 'feliz', weight: 1.2 }, { phrase: 'felicidad', weight: 1.3 },
    { phrase: 'alegre', weight: 1.2 }, { phrase: 'alegría', weight: 1.3 },
    { phrase: 'contento', weight: 1.1 }, { phrase: 'contenta', weight: 1.1 },
    { phrase: 'emocionado', weight: 1.1 }, { phrase: 'emocionada', weight: 1.1 },
    { phrase: 'maravilloso', weight: 1.3 }, { phrase: 'increíble', weight: 1.1 },
    { phrase: 'genial', weight: 1.1 }, { phrase: 'qué bonito', weight: 1.3 },
    { phrase: 'qué bueno', weight: 1.1 }, { phrase: 'encantado', weight: 1.0 },
    { phrase: 'orgulloso', weight: 1.1 }, { phrase: 'agradecido', weight: 1.2 },
    { phrase: 'enamorado', weight: 1.2 }, { phrase: 'entusiasmado', weight: 1.1 },
    { phrase: 'eufórico', weight: 1.3 }, { phrase: 'dichoso', weight: 1.2 },
    { phrase: 'ilusionado', weight: 1.1 }, { phrase: 'fantástico', weight: 1.2 },
  ],
  calm: [
    { phrase: 'tranquilo', weight: 1.2 }, { phrase: 'tranquila', weight: 1.2 },
    { phrase: 'paz', weight: 1.1 }, { phrase: 'en paz', weight: 1.3 },
    { phrase: 'sereno', weight: 1.2 }, { phrase: 'relajado', weight: 1.2 },
    { phrase: 'calmado', weight: 1.2 }, { phrase: 'equilibrado', weight: 1.1 },
    { phrase: 'estable', weight: 1.0 }, { phrase: 'descansado', weight: 1.1 },
    { phrase: 'me siento bien', weight: 1.2 }, { phrase: 'todo bien', weight: 1.0 },
    { phrase: 'plácido', weight: 1.1 }, { phrase: 'tranquilidad', weight: 1.2 },
  ],
  neutral: [],
};

const CRISIS_PHRASES = [
  'me quiero matar', 'suicid', 'no quiero vivir', 'hacerme daño',
  'quitarme la vida', 'no quiero seguir', 'ya no quiero estar aquí',
  'matarme', 'quiero morir', 'me voy a matar', 'sin ganas de vivir',
  'autolesion', 'autolesionarme', 'cortarme', 'hacerme daño',
];

const NEGATIONS = ['no ', 'nunca ', 'jamás ', 'tampoco ', 'sin '];

const VALENCE: Record<MoodKey, number> = {
  joy: 0.85, calm: 0.45, sadness: -0.75, anxiety: -0.55,
  anger: -0.70, stress: -0.50, loneliness: -0.55, overwhelm: -0.70,
  uncertainty: -0.30, neutral: 0.0,
};
const AROUSAL: Record<MoodKey, number> = {
  joy: 0.70, calm: 0.20, sadness: 0.30, anxiety: 0.80,
  anger: 0.90, stress: 0.70, loneliness: 0.30, overwhelm: 0.80,
  uncertainty: 0.40, neutral: 0.50,
};

function intensityBoost(text: string): number {
  let boost = 0;
  const exclamations = (text.match(/!/g) ?? []).length;
  const questions = (text.match(/\?/g) ?? []).length;
  const capsRatio = (text.match(/[A-ZÁÉÍÓÚÑ]/g) ?? []).length / Math.max(text.length, 1);
  if (exclamations > 1) boost += 0.1 * Math.min(exclamations, 3);
  if (questions > 1) boost += 0.05 * Math.min(questions, 2);
  if (capsRatio > 0.3) boost += 0.15;

  const emoNeg = ['😢', '😭', '😰', '😱', '😠', '😡', '😤', '💔', '😔', '😞', '🙁', '☹️'];
  const emoPos = ['😊', '😄', '😁', '🥰', '😍', '🎉', '✨', '🙏', '😌', '🤗'];
  for (const e of emoNeg) if (text.includes(e)) boost += 0.1;
  for (const e of emoPos) if (text.includes(e)) boost += 0.05;
  return boost;
}

function isNegated(text: string, phrase: string): boolean {
  const idx = text.indexOf(phrase);
  if (idx < 0) return false;
  const preceding = text.substring(Math.max(0, idx - 20), idx);
  return NEGATIONS.some(n => preceding.endsWith(n.trim()) || preceding.includes(n));
}

export function isCrisisMessage(text: string): boolean {
  const lower = text.toLowerCase();
  return CRISIS_PHRASES.some(p => lower.includes(p));
}

export function heuristicDetect(text: string): MoodState {
  const lower = text.toLowerCase();
  const scores = new Map<MoodKey, number>();
  const matchedReasons = new Map<MoodKey, string[]>();

  for (const [mood, entries] of Object.entries(BUCKETS) as [MoodKey, PhraseEntry[]][]) {
    if (mood === 'neutral') continue;
    let score = 0;
    const matched: string[] = [];
    for (const { phrase, weight } of entries) {
      if (lower.includes(phrase) && !isNegated(lower, phrase)) {
        score += weight;
        matched.push(phrase);
      }
    }
    if (score > 0) {
      scores.set(mood, score);
      matchedReasons.set(mood, matched);
    }
  }

  if (scores.size === 0) {
    return {
      mood: 'neutral', valence: 0, arousal: 0.5,
      confidence: 0.1, reasons: [], updatedAt: new Date().toISOString(),
    };
  }

  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [topMood, topScore] = sorted[0];
  const totalScore = sorted.reduce((s, [, v]) => s + v, 0);
  const rawConfidence = topScore / Math.max(totalScore, 1);
  const boost = intensityBoost(text);
  const confidence = Math.min(rawConfidence + boost * 0.1, 1.0);

  return {
    mood: topMood,
    valence: Math.max(-1, Math.min(1, VALENCE[topMood])),
    arousal: Math.max(0, Math.min(1, AROUSAL[topMood] + boost * 0.05)),
    confidence,
    reasons: (matchedReasons.get(topMood) ?? []).slice(0, 3),
    updatedAt: new Date().toISOString(),
  };
}
