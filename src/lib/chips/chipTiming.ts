export type ChipMode = 'entry' | 'followup' | 'none';

interface ChipTimingMessage {
  sender: 'user' | 'counselor';
  content: string;
  chipMeta?: { signal?: string };
}

interface ChipTimingOptions {
  messages: ChipTimingMessage[];
  isCrisis: boolean;
  followUpSignal: string | undefined;
}

const FREE_TEXT_MOMENTUM_MIN_LENGTH = 35;
const FREE_TEXT_RUN_CUTOFF = 2;
const EARLY_TURN_CUTOFF = 4;
const STALL_LENGTH = 25;

export function resolveChipMode({ messages, isCrisis, followUpSignal }: ChipTimingOptions): ChipMode {
  if (isCrisis) return 'none';

  const counselorCount = messages.filter(m => m.sender === 'counselor').length;
  const userMessages = messages.filter(m => m.sender === 'user');

  let freeTextRun = 0;
  for (let i = userMessages.length - 1; i >= 0; i--) {
    const msg = userMessages[i];
    const isChipTriggered = !!msg.chipMeta;
    const isMeaningful = msg.content.trim().length >= FREE_TEXT_MOMENTUM_MIN_LENGTH;
    if (!isChipTriggered && isMeaningful) {
      freeTextRun++;
    } else {
      break;
    }
  }

  const lastUserMsg = userMessages[userMessages.length - 1];
  const lastUserMsgLength = lastUserMsg?.content?.trim().length ?? 0;
  const isStalled = !lastUserMsg?.chipMeta && lastUserMsgLength < STALL_LENGTH;

  if (freeTextRun >= FREE_TEXT_RUN_CUTOFF) return 'none';

  if (counselorCount >= 5 && freeTextRun >= 1) return 'none';

  if (followUpSignal && counselorCount <= EARLY_TURN_CUTOFF) return 'followup';

  if (counselorCount <= EARLY_TURN_CUTOFF) return 'entry';

  if (isStalled && counselorCount <= 8) return 'entry';

  return 'none';
}
