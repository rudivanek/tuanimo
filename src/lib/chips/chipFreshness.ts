import type { EmotionChip } from './emotionChips';
import type { MessageChipMeta } from '../../types/chat';

interface FreshnessMessage {
  sender: 'user' | 'counselor';
  chipMeta?: MessageChipMeta;
  chipMetaLookup?: Record<string, MessageChipMeta>;
}

export interface ChipFreshnessContext {
  recentlyShownIds: Set<string>;
  recentlySelectedIds: Set<string>;
}

const RECENTLY_SHOWN_WINDOW = 2;

export function buildChipFreshnessContext(messages: FreshnessMessage[]): ChipFreshnessContext {
  const counselorWithChips = messages
    .filter(m => m.sender === 'counselor' && m.chipMetaLookup && Object.keys(m.chipMetaLookup).length > 0)
    .slice(-RECENTLY_SHOWN_WINDOW);

  const recentlyShownIds = new Set<string>();
  for (const msg of counselorWithChips) {
    for (const meta of Object.values(msg.chipMetaLookup ?? {})) {
      recentlyShownIds.add(meta.id);
    }
  }

  const recentlySelectedIds = new Set<string>();
  for (const msg of messages) {
    if (msg.sender === 'user' && msg.chipMeta?.id) {
      recentlySelectedIds.add(msg.chipMeta.id);
    }
  }

  return { recentlyShownIds, recentlySelectedIds };
}

export function applyChipFreshness(
  candidates: EmotionChip[],
  ctx: ChipFreshnessContext,
  count: number,
): EmotionChip[] {
  const scored = candidates.map(c => ({
    chip: c,
    penalty: ctx.recentlySelectedIds.has(c.id) ? 2
           : ctx.recentlyShownIds.has(c.id) ? 1
           : 0,
  }));

  scored.sort((a, b) => a.penalty - b.penalty);

  return scored.slice(0, count).map(s => s.chip);
}
