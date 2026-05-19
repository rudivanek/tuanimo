import type { MoodState } from '../../types/mood';

export type ConversationMode = 'task_topic' | 'emotion_reflection' | 'mixed';

export interface ModeState {
  mode: ConversationMode;
  confidence: number;
  reasons: string[];
}

const TASK_PATTERNS: RegExp[] = [
  /\b(qué|cuáles?|recomiénd[ae]me?|dónde|cómo|itinerario|visitar|museos?|restaurantes?|barrios?|precio|presupuesto|horarios?|actividades?|lugares?)\b/i,
  /\b(nueva york|nyc|new york|manhattan|brooklyn|queens|bronx|midtown|downtown|soho|tribeca|harlem|central park|times square)\b/i,
  /\b(plan|planes|lista|guía|tips?|consejos?|recomendaciones?|opciones?|sugerencias?)\b/i,
  /\b(metro|transporte|aeropuerto|hotel|alojamiento|vuelo|maleta|equipaje)\b/i,
  /\b(galería|galerías|moma|guggenheim|met\b|whitney|chelsea)\b/i,
  /\b(pizza|deli|brunch|bares?|cafés?\b)\b/i,
  /\b(recorrido|ruta|excursión|paseo|visita|tour)\b/i,
];

const EMOTION_PATTERNS: RegExp[] = [
  /\bme (siento|sentí|estoy sintiendo)\b/i,
  /\b(emociones?|sentimientos?|sensaciones?)\b/i,
  /\bme (preocupa|preocupan|angustia|da miedo|duele|lastima)\b/i,
  /\bpara mí (significa|es importante|importa|quiere decir)\b/i,
  /\b(ansioso|ansiosa|triste|agotad[oa]|soledad|deprimid[oa]|estresad[oa]|asustado|asustada|enojad[oa]|confundid[oa])\b/i,
  /\b(procesarlo|procesarla|asimilarlo|asimilarla|digeri[rl]o)\b/i,
  /\b(quiero (explorar|profundizar|entender|reflexionar) (lo que|cómo|sobre) (siento|me pasa|me afecta))\b/i,
  /\b(me pesa|me cuesta|me carga|me agobia)\b/i,
];

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((n, p) => n + (p.test(text) ? 1 : 0), 0);
}

export function detectConversationMode(
  lastUserMessage: string,
  recentUserMessages = '',
  moodState?: MoodState,
): ModeState {
  const text = lastUserMessage.toLowerCase();
  const allText = (lastUserMessage + ' ' + recentUserMessages).toLowerCase();

  const taskScore = countMatches(text, TASK_PATTERNS);
  const emotionScore = countMatches(text, EMOTION_PATTERNS);

  const moodBoost =
    moodState &&
    moodState.confidence >= 0.65 &&
    (moodState.valence < -0.2 || moodState.arousal > 0.7)
      ? 1
      : 0;

  const totalEmotion = emotionScore + moodBoost;
  const recentTaskScore = countMatches(allText, TASK_PATTERNS);

  const reasons: string[] = [];
  let mode: ConversationMode;
  let confidence: number;

  if (taskScore >= 1 && totalEmotion === 0) {
    mode = 'task_topic';
    confidence = Math.min(0.5 + taskScore * 0.15, 0.95);
    reasons.push(`task:${taskScore}`);
  } else if (totalEmotion >= 1 && taskScore === 0) {
    mode = 'emotion_reflection';
    confidence = Math.min(0.5 + totalEmotion * 0.15, 0.95);
    reasons.push(`emotion:${totalEmotion}`);
  } else if (taskScore >= 1 && totalEmotion >= 1) {
    mode = 'mixed';
    confidence = 0.75;
    reasons.push(`task:${taskScore},emotion:${totalEmotion}`);
  } else if (recentTaskScore >= 2) {
    mode = 'task_topic';
    confidence = 0.6;
    reasons.push(`recent_task:${recentTaskScore}`);
  } else {
    mode = 'emotion_reflection';
    confidence = 0.5;
    reasons.push('default');
  }

  return { mode, confidence, reasons };
}
