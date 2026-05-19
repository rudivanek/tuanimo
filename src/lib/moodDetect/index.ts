import type { MoodState } from '../../types/mood';
import { heuristicDetect, isCrisisMessage } from './heuristicDetect';
import { llmDetect } from './llmDetect';

const LLM_CONFIDENCE_THRESHOLD = 0.55;
const THROTTLE_MS = 3000;
const MIN_MESSAGE_LENGTH = 12;

const EMOTION_QUICK_WORDS = [
  'triste', 'feliz', 'ansioso', 'enojado', 'solo', 'miedo', 'bien',
  'mal', 'llorar', 'rabia', 'estrés', 'paz', 'cansado', 'asustado',
  'nervioso', 'contento', 'agobiado', 'vacío', 'alegre', 'preocupado',
];

let lastLlmCallAt = 0;

function hasEmotionKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return EMOTION_QUICK_WORDS.some(w => lower.includes(w));
}

function shouldRunDetect(message: string, lastUpdateAt: number): boolean {
  const now = Date.now();
  if (now - lastUpdateAt < THROTTLE_MS) return false;
  if (message.length < MIN_MESSAGE_LENGTH && !hasEmotionKeyword(message)) return false;
  return true;
}

function buildCrisisMoodState(): MoodState {
  return {
    mood: 'overwhelm',
    valence: -1,
    arousal: 1,
    confidence: 1,
    reasons: ['crisis'],
    updatedAt: new Date().toISOString(),
  };
}

export { isCrisisMessage };

export async function runMoodDetect(
  message: string,
  context: string[] = [],
  lastUpdateAt = 0,
): Promise<MoodState> {
  if (isCrisisMessage(message)) {
    return buildCrisisMoodState();
  }

  if (!shouldRunDetect(message, lastUpdateAt)) {
    return heuristicDetect(message);
  }

  const heuristic = heuristicDetect(message);

  if (heuristic.confidence >= LLM_CONFIDENCE_THRESHOLD) {
    return heuristic;
  }

  const now = Date.now();
  if (now - lastLlmCallAt < THROTTLE_MS) {
    return heuristic;
  }

  try {
    lastLlmCallAt = Date.now();
    const llmResult = await llmDetect(message, context);
    return llmResult;
  } catch {
    return heuristic;
  }
}

export type { MoodState };
