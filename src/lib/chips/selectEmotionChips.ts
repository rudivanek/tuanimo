import { EMOTION_CHIPS, type EmotionChip } from './emotionChips';

interface SelectEmotionChipsParams {
  isCrisis: boolean;
  isHighArousal: boolean;
  isLowMood: boolean;
  isPositive: boolean;
}

export function selectEmotionChips({
  isCrisis,
  isHighArousal,
  isLowMood,
  isPositive,
}: SelectEmotionChipsParams): EmotionChip[] {
  if (isCrisis) {
    return EMOTION_CHIPS.filter(c => c.tags.includes('crisis')).slice(0, 3);
  }

  const primaryTag = isHighArousal
    ? 'high_arousal'
    : isLowMood
    ? 'low_mood'
    : isPositive
    ? 'positive'
    : 'neutral';

  const primary = EMOTION_CHIPS.filter(
    c => c.tags.includes(primaryTag) && !c.tags.includes('crisis'),
  );
  const filler = EMOTION_CHIPS.filter(
    c =>
      c.tags.includes('neutral') &&
      !c.tags.includes('crisis') &&
      !c.tags.includes(primaryTag),
  );

  return [...primary, ...filler].slice(0, 5);
}
