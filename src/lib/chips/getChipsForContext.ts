import type { MoodState } from '../../types/mood';
import type { TopicState } from '../topicDetect/topicDetect';
import type { ModeState } from '../contextRouter/conversationMode';
import { buildAdaptiveChips, getChipInsertText } from './adaptiveChips';
import { getTopicChipPack } from './topicChipPacks';

export type ChipLane = 'topic' | 'emotion';

export interface ContextChip {
  id: string;
  label: string;
  intentKey: string;
  insertText: string;
  lane: ChipLane;
}

export type ChipMode = 'task_topic' | 'emotion_reflection' | 'mixed';

export interface ChipsForContextResult {
  chips: ContextChip[];
  mode: ChipMode;
  tooltipCopy: string;
}

function buildEmotionChips(moodState: MoodState, count: number): ContextChip[] {
  const chipObjects = buildAdaptiveChips(moodState, count);
  return chipObjects
    .map(c => ({
      id: c.id,
      label: c.label,
      intentKey: c.intentKey as string,
      insertText: getChipInsertText(c, moodState),
      lane: 'emotion' as const,
    }))
    .filter(c => c.insertText.length > 0);
}

export function getChipsForContext(params: {
  moodState: MoodState;
  topicState: TopicState;
  modeState: ModeState;
  count?: number;
}): ChipsForContextResult {
  const { moodState, topicState, modeState, count = 5 } = params;
  const mode = modeState.mode as ChipMode;

  if (mode === 'task_topic') {
    const topicChips = getTopicChipPack(topicState, count);
    if (topicChips.length > 0) {
      return {
        chips: topicChips.map(c => ({ ...c, lane: 'topic' as const })),
        mode,
        tooltipCopy: 'Sugerencias para continuar tu plan.',
      };
    }
    return {
      chips: buildEmotionChips(moodState, count),
      mode: 'emotion_reflection',
      tooltipCopy: 'Sugerencias para profundizar.',
    };
  }

  if (mode === 'emotion_reflection') {
    return {
      chips: buildEmotionChips(moodState, count),
      mode,
      tooltipCopy: 'Sugerencias para profundizar.',
    };
  }

  const topicSlots = Math.min(4, count - 1);
  const emotionSlots = count - topicSlots;

  const topicChips = getTopicChipPack(topicState, topicSlots);
  const emotionChips = buildEmotionChips(moodState, emotionSlots);

  const combined: ContextChip[] = [
    ...topicChips.map(c => ({ ...c, lane: 'topic' as const })),
    ...emotionChips.slice(0, emotionSlots),
  ].slice(0, count);

  return {
    chips: combined,
    mode,
    tooltipCopy: 'Sugerencias para planear y también reflexionar.',
  };
}
