export interface EmotionChip {
  id: string;
  label: string;
  insertText: string;
  tags: ReadonlyArray<'crisis' | 'high_arousal' | 'low_mood' | 'positive' | 'neutral'>;
  signal?: string;
}

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
