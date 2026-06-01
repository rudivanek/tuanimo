/**
 * chipEngine.ts — Unified chip system
 *
 * Merged from: emotionChips.ts, selectEmotionChips.ts, followUpChipPacks.ts,
 *              chipFreshness.ts, chipTiming.ts, chipVariantTracker.ts
 *
 * This single file contains all chip data definitions, selection logic,
 * timing rules, freshness tracking, and variant rotation.
 */

import type { MessageChipMeta } from '../../types/chat';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmotionChip {
  id: string;
  label: string;
  insertText: string;
  tags: ReadonlyArray<'crisis' | 'high_arousal' | 'low_mood' | 'positive' | 'neutral'>;
  signal?: string;
}

export type ChipTimingMode = 'entry' | 'followup' | 'none';

export type FollowUpFamily =
  | 'inner_conflict'
  | 'persistence'
  | 'suppression'
  | 'overwhelm'
  | 'confusion';

export interface ChipFreshnessContext {
  recentlyShownIds: Set<string>;
  recentlySelectedIds: Set<string>;
}

// ─── Emotion Chip Definitions ────────────────────────────────────────────────

export const EMOTION_CHIPS: ReadonlyArray<EmotionChip> = [
  {
    id: 'crisis_support',
    label: 'Pedir apoyo ahora',
    insertText: 'Quiero pedir apoyo ahora.',
    tags: ['crisis'],
  },
  {
    id: 'crisis_express',
    label: 'Decir qué está pasando',
    insertText: 'Quiero decir exactamente qué está pasando conmigo.',
    tags: ['crisis'],
  },
  {
    id: 'crisis_step',
    label: 'Un paso para mantenerme a salvo',
    insertText: 'Quiero dar un paso pequeño para mantenerme a salvo.',
    tags: ['crisis'],
  },

  {
    id: 'smart_confusion',
    label: 'No sé qué me pasa',
    insertText: 'No sé exactamente qué me pasa, pero algo no está bien.',
    tags: ['high_arousal', 'neutral'],
    signal: 'confusion',
  },
  {
    id: 'smart_overwhelm',
    label: 'Tengo demasiadas cosas encima',
    insertText: 'Tengo demasiadas cosas encima y no sé por dónde empezar.',
    tags: ['high_arousal', 'neutral'],
    signal: 'overwhelm',
  },
  {
    id: 'smart_pressure',
    label: 'Siento presión todo el tiempo',
    insertText: 'Siento que hay presión todo el tiempo y no termina de soltarse.',
    tags: ['high_arousal'],
    signal: 'overwhelm_persistence',
  },
  {
    id: 'smart_headfull',
    label: 'Muchas cosas en la cabeza y nada claro',
    insertText: 'Tengo muchas cosas en la cabeza y nada está claro.',
    tags: ['high_arousal', 'neutral'],
    signal: 'confusion_overwhelm',
  },
  {
    id: 'smart_stuck',
    label: 'Sé lo que tengo que hacer, pero no lo hago',
    insertText: 'Sé lo que tengo que hacer, pero no lo hago. No entiendo por qué.',
    tags: ['high_arousal', 'neutral'],
    signal: 'inner_conflict',
  },

  {
    id: 'smart_persistence',
    label: 'Esto no se me quita',
    insertText: 'Hay algo que no se me quita. Llevo tiempo así y no veo que cambie.',
    tags: ['low_mood', 'neutral'],
    signal: 'persistence',
  },
  {
    id: 'smart_persist_days',
    label: 'Llevo días sintiéndome así',
    insertText: 'Llevo días sintiéndome así y no sé cuándo va a pasar.',
    tags: ['low_mood'],
    signal: 'persistence_duration',
  },
  {
    id: 'smart_conflict',
    label: 'Quiero cambiar algo pero no puedo',
    insertText: 'Quiero cambiar algo, pero cada vez que lo intento me quedo bloqueado/a.',
    tags: ['low_mood', 'neutral'],
    signal: 'inner_conflict',
  },
  {
    id: 'smart_avoid',
    label: 'Prefiero no pensar en esto',
    insertText: 'Hay algo en lo que prefiero no pensar demasiado, pero no se va.',
    tags: ['low_mood', 'neutral'],
    signal: 'suppression_avoidance',
  },
  {
    id: 'smart_tired',
    label: 'Estoy cansado/a de sentirme así',
    insertText: 'Estoy cansado/a de seguir sintiéndome así. Quiero entender qué está pasando.',
    tags: ['low_mood'],
    signal: 'persistence_fatigue',
  },

  {
    id: 'smart_suppression',
    label: 'Estoy bien… pero no tanto',
    insertText: 'En general estoy bien… pero hay algo que no termina de estar bien.',
    tags: ['neutral'],
    signal: 'suppression',
  },

  {
    id: 'smart_pos_contrast',
    label: 'Bien, pero con algo pendiente',
    insertText: 'Me siento bien, pero hay algo que tengo pendiente de mirar.',
    tags: ['positive'],
    signal: 'contrast_mixed',
  },
  {
    id: 'smart_pos_energy',
    label: 'Quiero aprovechar este momento',
    insertText: 'Me siento con energía y quiero entender qué hacer con eso.',
    tags: ['positive', 'neutral'],
    signal: 'positive_momentum',
  },
  {
    id: 'smart_pos_focus',
    label: 'Algo en lo que quiero enfocarme',
    insertText: 'Hay algo en lo que quiero enfocarme, pero no sé bien cómo empezar.',
    tags: ['positive'],
    signal: 'values_unclear',
  },
  {
    id: 'pos_gratitude',
    label: 'Lo que agradezco',
    insertText: 'Quiero reflexionar sobre lo que agradezco en este momento.',
    tags: ['positive', 'neutral'],
  },
  {
    id: 'pos_values',
    label: 'Lo que valoro',
    insertText: 'Quiero reflexionar sobre lo que más valoro y cómo conecta con lo que siento.',
    tags: ['positive', 'neutral'],
  },
];

// ─── Follow-Up Chip Packs ────────────────────────────────────────────────────

const FOLLOW_UP_PACKS: Record<FollowUpFamily, ReadonlyArray<EmotionChip>> = {
  inner_conflict: [
    {
      id: 'fu_ic_1',
      label: 'Lo que me frena',
      insertText: 'Quiero explorar qué es lo que me está frenando.',
      tags: ['neutral'],
      signal: 'inner_conflict',
    },
    {
      id: 'fu_ic_2',
      label: 'La parte de mí que duda',
      insertText: 'Quiero hablar de la parte de mí que duda o que no sabe qué hacer.',
      tags: ['neutral'],
      signal: 'inner_conflict',
    },
    {
      id: 'fu_ic_3',
      label: 'Lo que quiero y lo que evito',
      insertText: 'Quiero ver qué es lo que quiero y qué es lo que estoy evitando al mismo tiempo.',
      tags: ['neutral'],
      signal: 'inner_conflict',
    },
    {
      id: 'fu_ic_4',
      label: 'El miedo detrás de esto',
      insertText: 'Quiero mirar si hay un miedo detrás de lo que estoy sintiendo.',
      tags: ['neutral'],
      signal: 'inner_conflict',
    },
    {
      id: 'fu_ic_5',
      label: 'Un paso pequeño, sin forzar',
      insertText: 'Quiero encontrar un paso pequeño que pueda dar sin forzarme.',
      tags: ['neutral'],
      signal: 'inner_conflict',
    },
  ],

  persistence: [
    {
      id: 'fu_pe_1',
      label: 'Desde cuándo viene esto',
      insertText: 'Quiero pensar desde cuándo viene lo que estoy sintiendo.',
      tags: ['low_mood'],
      signal: 'persistence',
    },
    {
      id: 'fu_pe_2',
      label: 'Lo que más me cansa',
      insertText: 'Quiero hablar de lo que más me está cansando de esta situación.',
      tags: ['low_mood'],
      signal: 'persistence',
    },
    {
      id: 'fu_pe_3',
      label: 'Lo que sigue volviendo',
      insertText: 'Hay algo que sigue volviendo aunque yo quiera que se vaya.',
      tags: ['low_mood'],
      signal: 'persistence',
    },
    {
      id: 'fu_pe_4',
      label: 'Lo que esperaba que cambiara',
      insertText: 'Quiero hablar de lo que pensé que ya iba a haber cambiado.',
      tags: ['low_mood'],
      signal: 'persistence',
    },
    {
      id: 'fu_pe_5',
      label: 'Cómo se siente hoy',
      insertText: 'Quiero describir cómo se siente esto hoy, en este momento.',
      tags: ['neutral'],
      signal: 'persistence',
    },
  ],

  suppression: [
    {
      id: 'fu_su_1',
      label: 'Lo que prefiero no mirar',
      insertText: 'Hay algo que estoy evitando mirar directamente.',
      tags: ['neutral'],
      signal: 'suppression_avoidance',
    },
    {
      id: 'fu_su_2',
      label: 'Lo que estoy sosteniendo',
      insertText: 'Quiero hablar de lo que estoy sosteniendo y cómo me pesa.',
      tags: ['neutral'],
      signal: 'suppression_avoidance',
    },
    {
      id: 'fu_su_3',
      label: 'Lo que estoy minimizando',
      insertText: 'Creo que estoy minimizando algo que en realidad me importa.',
      tags: ['neutral'],
      signal: 'suppression_avoidance',
    },
    {
      id: 'fu_su_4',
      label: 'Lo que aparece si me detengo',
      insertText: 'Quiero ver qué aparece cuando me detengo un momento.',
      tags: ['neutral'],
      signal: 'suppression_avoidance',
    },
    {
      id: 'fu_su_5',
      label: 'Decirlo sin adelantarme',
      insertText: 'Quiero decir lo que está ahí, sin meterme en explicaciones todavía.',
      tags: ['neutral'],
      signal: 'suppression_avoidance',
    },
  ],

  overwhelm: [
    {
      id: 'fu_ow_1',
      label: 'Lo que más me pesa',
      insertText: 'Quiero hablar de lo que más me está pesando ahora mismo.',
      tags: ['high_arousal'],
      signal: 'overwhelm',
    },
    {
      id: 'fu_ow_2',
      label: 'Todo lo que traigo encima',
      insertText: 'Quiero intentar soltar todo lo que traigo encima, aunque sea aquí.',
      tags: ['high_arousal'],
      signal: 'overwhelm',
    },
    {
      id: 'fu_ow_3',
      label: 'Lo que siento que no alcanza',
      insertText: 'Hay algo en lo que siento que no alcanza, que nunca es suficiente.',
      tags: ['high_arousal'],
      signal: 'overwhelm',
    },
    {
      id: 'fu_ow_4',
      label: 'La presión que no se va',
      insertText: 'Quiero hablar de esa presión que no termina de irse.',
      tags: ['high_arousal'],
      signal: 'overwhelm',
    },
    {
      id: 'fu_ow_5',
      label: 'Una cosa a la vez',
      insertText: 'Quiero intentar quedarme con una sola cosa y mirarla.',
      tags: ['neutral'],
      signal: 'overwhelm',
    },
  ],

  confusion: [
    {
      id: 'fu_co_1',
      label: 'Lo que no logro entender',
      insertText: 'Hay algo que no logro entender de lo que me pasa.',
      tags: ['neutral'],
      signal: 'confusion',
    },
    {
      id: 'fu_co_2',
      label: 'Lo que se me mezcla',
      insertText: 'Quiero hablar de lo que se me mezcla y no logro separar.',
      tags: ['neutral'],
      signal: 'confusion',
    },
    {
      id: 'fu_co_3',
      label: 'Ponerle nombre a esto',
      insertText: 'Quiero intentar ponerle nombre a lo que estoy sintiendo.',
      tags: ['neutral'],
      signal: 'confusion',
    },
    {
      id: 'fu_co_4',
      label: 'Qué parte se siente más rara',
      insertText: 'Quiero explorar qué parte de todo esto se siente más rara o extraña.',
      tags: ['neutral'],
      signal: 'confusion',
    },
    {
      id: 'fu_co_5',
      label: 'Lo que sí alcanzo a notar',
      insertText: 'Quiero describir lo que sí alcanzo a notar, aunque no sea todo.',
      tags: ['neutral'],
      signal: 'confusion',
    },
  ],
};

const SIGNAL_TO_FAMILY: Record<string, FollowUpFamily> = {
  inner_conflict: 'inner_conflict',
  values_unclear: 'inner_conflict',
  persistence: 'persistence',
  persistence_duration: 'persistence',
  persistence_fatigue: 'persistence',
  overwhelm_persistence: 'persistence',
  suppression: 'suppression',
  suppression_avoidance: 'suppression',
  overwhelm: 'overwhelm',
  confusion_overwhelm: 'overwhelm',
  confusion: 'confusion',
  contrast_mixed: 'confusion',
};

// ─── Variant Tracker (in-memory rotation) ────────────────────────────────────

const lastUsedIndex = new Map<string, number>();

export function pickVariant(intentKey: string, variants: string[]): string {
  if (!variants.length) return '';
  if (variants.length === 1) return variants[0];
  const last = lastUsedIndex.get(intentKey) ?? -1;
  const next = (last + 1 + Math.floor(Math.random() * (variants.length - 1))) % variants.length;
  const safe = next === last ? (next + 1) % variants.length : next;
  lastUsedIndex.set(intentKey, safe);
  return variants[safe];
}

// ─── Selection: Emotion Chips ────────────────────────────────────────────────

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

// ─── Selection: Follow-Up Chips ──────────────────────────────────────────────

function pickN<T>(arr: ReadonlyArray<T>, n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export function getFollowUpChips(signal: string, count = 3): EmotionChip[] | null {
  const family = SIGNAL_TO_FAMILY[signal];
  if (!family) return null;
  const pack = FOLLOW_UP_PACKS[family];
  return pickN(pack, Math.min(count, pack.length));
}

// ─── Freshness: Avoid Repeating Recently Shown Chips ─────────────────────────

interface FreshnessMessage {
  sender: 'user' | 'counselor';
  chipMeta?: MessageChipMeta;
  chipMetaLookup?: Record<string, MessageChipMeta>;
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

// ─── Timing: When to Show Chips ──────────────────────────────────────────────

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
const EARLY_TURN_CUTOFF = 3;
const STALL_LENGTH = 25;

// Heavy topics — suppress chips entirely when present in the last user message
const HEAVY_TOPIC_PATTERNS: RegExp[] = [
  /morir|muerte|morirme|me voy a morir|miedo a morir/i,
  /lastim[eé]|hice daño|herí|me arrepiento|no sé cómo vivir con/i,
  /duelo|murió|falleció|perdí a|extraño a|ya no está/i,
  /me quiero morir|no quiero vivir|hacerme daño|quitarme la vida/i,
  /relación.*daño|daño.*relación|me maltrata|me controla|me minimiza/i,
  /identidad|quién soy|me perdí|ya no sé quién/i,
  /desperdicié|perdí el tiempo|ya es tarde|no sirvo/i,
];

function isHeavyTopic(lastUserContent: string): boolean {
  return HEAVY_TOPIC_PATTERNS.some(p => p.test(lastUserContent));
}

export function resolveChipMode({ messages, isCrisis, followUpSignal }: ChipTimingOptions): ChipTimingMode {
  if (isCrisis) return 'none';

  const counselorCount = messages.filter(m => m.sender === 'counselor').length;
  const userMessages = messages.filter(m => m.sender === 'user');

  // Suppress on heavy topics regardless of turn count
  const lastUserMsg = userMessages[userMessages.length - 1];
  if (lastUserMsg && isHeavyTopic(lastUserMsg.content)) return 'none';

  // Suppress for first 3 user turns
  if (userMessages.length <= 3) return 'none';

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

  const lastUserMsgLength = lastUserMsg?.content?.trim().length ?? 0;
  const isStalled = !lastUserMsg?.chipMeta && lastUserMsgLength < STALL_LENGTH;

  if (freeTextRun >= FREE_TEXT_RUN_CUTOFF) return 'none';

  if (counselorCount >= 5 && freeTextRun >= 1) return 'none';

  if (followUpSignal && counselorCount <= EARLY_TURN_CUTOFF) return 'followup';

  if (counselorCount <= EARLY_TURN_CUTOFF) return 'entry';

  if (isStalled && counselorCount <= 8) return 'entry';

  return 'none';
}