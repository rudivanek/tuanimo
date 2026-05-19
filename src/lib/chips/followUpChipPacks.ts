import type { EmotionChip } from './emotionChips';

export type FollowUpFamily =
  | 'inner_conflict'
  | 'persistence'
  | 'suppression'
  | 'overwhelm'
  | 'confusion';

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

export { SIGNAL_TO_FAMILY };
