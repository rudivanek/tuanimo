import type { MoodKey, MoodState } from '../../types/mood';
import { chipCopyByMood } from './chipCopyByMood';
import { pickVariant } from './chipVariantTracker';

export type ChipIntentKey =
  | 'explore_feeling'
  | 'name_need'
  | 'small_next_step'
  | 'reframe'
  | 'self_compassion'
  | 'gratitude'
  | 'support_request'
  | 'boundary'
  | 'values'
  | 'energy_activity'
  | 'meaningful_memory'
  | 'problem_to_action'
  | 'relationship_checkin'
  | 'body_signal'
  | 'sleep_routine'
  | 'journal_deeper';

export type Chip = {
  id: string;
  label: string;
  intentKey: ChipIntentKey;
  moodTags: MoodKey[];
  priority: number;
};

const INTENT_LABELS: Record<ChipIntentKey, string> = {
  explore_feeling: 'Explorar lo que siento',
  name_need: 'Nombrar lo que necesito',
  small_next_step: 'Un paso pequeño',
  reframe: 'Ver esto diferente',
  self_compassion: 'Ser más amable conmigo',
  gratitude: 'Lo que agradezco',
  support_request: 'Pedir apoyo',
  boundary: 'Mis límites',
  values: 'Lo que valoro',
  energy_activity: 'Lo que me da energía',
  meaningful_memory: 'Un recuerdo significativo',
  problem_to_action: 'Convertirlo en acción',
  relationship_checkin: 'Mis relaciones cercanas',
  body_signal: 'Lo que siente mi cuerpo',
  sleep_routine: 'Mi descanso',
  journal_deeper: 'Profundizar escribiendo',
};

const CRISIS_INTENTS: ChipIntentKey[] = [
  'support_request',
  'explore_feeling',
  'small_next_step',
];

// Only the three CRISIS_INTENTS keys have copy; all others are intentionally absent.
const CRISIS_COPY: Partial<Record<ChipIntentKey, string>> = {
  support_request: 'Quiero pedir apoyo ahora.',
  explore_feeling: 'Quiero decir exactamente qué está pasando conmigo.',
  small_next_step: 'Quiero dar un paso pequeño para mantenerme a salvo.',
};

const MOOD_INTENT_MAP: Record<MoodKey, ChipIntentKey[]> = {
  anxiety: [
    'small_next_step', 'name_need', 'body_signal', 'self_compassion',
    'problem_to_action', 'explore_feeling',
  ],
  stress: [
    'small_next_step', 'boundary', 'name_need', 'self_compassion',
    'problem_to_action', 'body_signal',
  ],
  overwhelm: [
    'small_next_step', 'problem_to_action', 'name_need', 'self_compassion',
    'explore_feeling', 'journal_deeper',
  ],
  sadness: [
    'explore_feeling', 'support_request', 'meaningful_memory',
    'self_compassion', 'relationship_checkin', 'journal_deeper',
  ],
  loneliness: [
    'support_request', 'relationship_checkin', 'explore_feeling',
    'self_compassion', 'meaningful_memory', 'values',
  ],
  anger: [
    'boundary', 'name_need', 'problem_to_action', 'reframe',
    'explore_feeling', 'self_compassion',
  ],
  joy: [
    'gratitude', 'values', 'meaningful_memory', 'energy_activity',
    'journal_deeper', 'explore_feeling',
  ],
  calm: [
    'gratitude', 'values', 'meaningful_memory', 'energy_activity',
    'journal_deeper', 'explore_feeling',
  ],
  uncertainty: [
    'explore_feeling', 'values', 'problem_to_action', 'journal_deeper',
    'name_need', 'self_compassion',
  ],
  neutral: [
    'explore_feeling', 'values', 'problem_to_action', 'journal_deeper',
    'meaningful_memory',
  ],
};

function getGroundingBoostIntents(): ChipIntentKey[] {
  return ['small_next_step', 'body_signal', 'name_need'];
}

function getGrowthBoostIntents(): ChipIntentKey[] {
  return ['gratitude', 'values', 'meaningful_memory'];
}

function selectIntents(moodState: MoodState, count = 4): ChipIntentKey[] {
  const base = MOOD_INTENT_MAP[moodState.mood] ?? MOOD_INTENT_MAP.neutral;
  const priority = new Map<ChipIntentKey, number>();

  base.forEach((k, i) => priority.set(k, base.length - i));

  if (moodState.arousal > 0.7) {
    for (const k of getGroundingBoostIntents()) {
      if (priority.has(k)) priority.set(k, (priority.get(k) ?? 0) + 3);
    }
  }

  if (moodState.valence > 0.5) {
    for (const k of getGrowthBoostIntents()) {
      if (priority.has(k)) priority.set(k, (priority.get(k) ?? 0) + 3);
    }
  }

  return [...priority.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([k]) => k);
}

function getInsertText(mood: MoodKey, intentKey: ChipIntentKey, isCrisis: boolean): string {
  if (isCrisis) {
    return CRISIS_COPY[intentKey] || '';
  }
  const moodCopy = chipCopyByMood[mood]?.[intentKey];
  if (moodCopy?.length) return pickVariant(intentKey, moodCopy);
  const neutralCopy = chipCopyByMood.neutral?.[intentKey];
  if (neutralCopy?.length) return pickVariant(`neutral_${intentKey}`, neutralCopy);
  return '';
}

export function buildAdaptiveChips(moodState: MoodState, count = 4): Chip[] {
  const isCrisis = moodState.mood === 'overwhelm' && moodState.arousal >= 1 &&
    moodState.reasons.includes('crisis');

  const intents = isCrisis
    ? CRISIS_INTENTS.slice(0, count)
    : selectIntents(moodState, count);

  return intents.map((intentKey, idx) => {
    const label = INTENT_LABELS[intentKey];
    const insertText = getInsertText(moodState.mood, intentKey, isCrisis);
    return {
      id: `${intentKey}-${moodState.mood}-${idx}`,
      label,
      intentKey,
      moodTags: [moodState.mood],
      priority: intents.length - idx,
      insertText,
    } as Chip & { insertText: string };
  }).filter(c => (c as Chip & { insertText: string }).insertText.length > 0) as Chip[];
}

export function getChipInsertText(chip: Chip, moodState: MoodState): string {
  const isCrisis = moodState.mood === 'overwhelm' && moodState.arousal >= 1 &&
    moodState.reasons.includes('crisis');
  return getInsertText(moodState.mood, chip.intentKey, isCrisis);
}
