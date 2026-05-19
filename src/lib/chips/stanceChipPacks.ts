import type { SupportStance, UXContextState } from '../uxRouter/getUXContextState';
import { getTopicChipPack } from './topicChipPacks';
import type { TopicState } from '../topicDetect/topicDetect';

export interface StanceChip {
  id: string;
  label: string;
  intentKey: string;
  insertText: string;
  stance: SupportStance;
  priority: number;
}

// ── PROCESSING chips ──────────────────────────────────────────────────────────
const PROCESSING_CHIPS: StanceChip[] = [
  {
    id: 'proc_explore',
    label: 'Explorar lo que siento',
    intentKey: 'processing_explore',
    insertText: 'Quiero explorar con calma lo que estoy sintiendo en este momento.',
    stance: 'PROCESSING',
    priority: 10,
  },
  {
    id: 'proc_values',
    label: 'Lo que valoro',
    intentKey: 'processing_values',
    insertText: 'Quiero reflexionar sobre lo que más valoro y cómo conecta con lo que siento.',
    stance: 'PROCESSING',
    priority: 9,
  },
  {
    id: 'proc_trigger',
    label: 'Qué lo detonó',
    intentKey: 'processing_trigger',
    insertText: 'Quiero entender qué detonó esta situación y qué puedo aprender de ello.',
    stance: 'PROCESSING',
    priority: 8,
  },
  {
    id: 'proc_need',
    label: 'Qué necesito',
    intentKey: 'processing_need',
    insertText: 'Quiero identificar qué necesito en este momento para sentirme mejor.',
    stance: 'PROCESSING',
    priority: 7,
  },
  {
    id: 'proc_write',
    label: 'Profundizar escribiendo',
    intentKey: 'processing_write',
    insertText: 'Quiero usar la escritura para profundizar en lo que siento y ordenar mis pensamientos.',
    stance: 'PROCESSING',
    priority: 6,
  },
  {
    id: 'proc_pattern',
    label: 'Un patrón que repito',
    intentKey: 'processing_pattern',
    insertText: 'Quiero explorar un patrón que siento que repito y entender de dónde viene.',
    stance: 'PROCESSING',
    priority: 5,
  },
];

// ── STABILIZATION chips ───────────────────────────────────────────────────────
const STABILIZATION_CHIPS: StanceChip[] = [
  {
    id: 'stab_small_step',
    label: 'Un paso pequeño ahora',
    intentKey: 'stab_small_step',
    insertText: 'Quiero encontrar un paso pequeño y concreto que pueda dar ahora mismo.',
    stance: 'STABILIZATION',
    priority: 10,
  },
  {
    id: 'stab_present',
    label: 'Volver al presente',
    intentKey: 'stab_present',
    insertText: 'Quiero hacer un ejercicio para volver al presente y calmar mi mente.',
    stance: 'STABILIZATION',
    priority: 9,
  },
  {
    id: 'stab_plan',
    label: 'Plan rápido si sube',
    intentKey: 'stab_plan',
    insertText: 'Quiero preparar un plan corto para usar si la ansiedad o el malestar sube más.',
    stance: 'STABILIZATION',
    priority: 8,
  },
  {
    id: 'stab_ask_help',
    label: 'Pedir ayuda',
    intentKey: 'stab_ask_help',
    insertText: 'Quiero explorar cómo pedir apoyo a alguien de confianza en este momento.',
    stance: 'STABILIZATION',
    priority: 7,
  },
  {
    id: 'stab_body',
    label: 'Cuidar mi cuerpo',
    intentKey: 'stab_body',
    insertText: 'Quiero ideas para cuidar mi cuerpo ahora: respiración, movimiento o descanso.',
    stance: 'STABILIZATION',
    priority: 6,
  },
];

// ── CONNECTION chips ──────────────────────────────────────────────────────────
const CONNECTION_CHIPS: StanceChip[] = [
  {
    id: 'conn_not_alone',
    label: 'No estoy solo/a',
    intentKey: 'conn_not_alone',
    insertText: 'Quiero recordar que no estoy solo/a y explorar cómo conectarme con otros.',
    stance: 'CONNECTION',
    priority: 10,
  },
  {
    id: 'conn_talk',
    label: 'Hablar con alguien',
    intentKey: 'conn_talk',
    insertText: 'Quiero pensar en cómo hablar con alguien de confianza sobre lo que siento.',
    stance: 'CONNECTION',
    priority: 9,
  },
  {
    id: 'conn_kindness',
    label: 'Tratarme con amabilidad',
    intentKey: 'conn_kindness',
    insertText: 'Quiero practicar tratarme con amabilidad y compasión en este momento.',
    stance: 'CONNECTION',
    priority: 8,
  },
  {
    id: 'conn_weight',
    label: 'Lo que me pesa',
    intentKey: 'conn_weight',
    insertText: 'Quiero hablar de lo que me pesa y explorar cómo aligerarlo poco a poco.',
    stance: 'CONNECTION',
    priority: 7,
  },
  {
    id: 'conn_gesture',
    label: 'Un gesto de cuidado',
    intentKey: 'conn_gesture',
    insertText: 'Quiero hacer un pequeño gesto de cuidado hacia mí mismo/a hoy.',
    stance: 'CONNECTION',
    priority: 6,
  },
];

// ── Generic PRACTICAL chips (when no specific topic) ─────────────────────────
const PRACTICAL_GENERIC_CHIPS: StanceChip[] = [
  {
    id: 'prac_list',
    label: 'Hacer una lista',
    intentKey: 'prac_list',
    insertText: 'Quiero organizar todo en una lista clara para ver qué tengo que hacer.',
    stance: 'PRACTICAL',
    priority: 10,
  },
  {
    id: 'prac_next',
    label: 'Próximo paso',
    intentKey: 'prac_next',
    insertText: 'Quiero identificar el próximo paso más importante que debo dar.',
    stance: 'PRACTICAL',
    priority: 9,
  },
  {
    id: 'prac_options',
    label: 'Ver opciones',
    intentKey: 'prac_options',
    insertText: 'Quiero explorar todas las opciones que tengo disponibles para esta situación.',
    stance: 'PRACTICAL',
    priority: 8,
  },
  {
    id: 'prac_priorities',
    label: 'Ordenar prioridades',
    intentKey: 'prac_priorities',
    insertText: 'Quiero ordenar mis prioridades y enfocarme en lo más importante primero.',
    stance: 'PRACTICAL',
    priority: 7,
  },
];

// ── Helper: build topic state from ux entities ────────────────────────────────
function buildTopicStateFromUX(uxState: UXContextState): TopicState {
  return {
    topicKey: uxState.topicKey === 'travel' ? 'travel' : 'other',
    entities: uxState.entities,
    confidence: uxState.confidence,
    updatedAt: uxState.updatedAt,
  };
}

// ── Pack builders by stance ───────────────────────────────────────────────────
function buildPracticalChips(uxState: UXContextState, count: number): StanceChip[] {
  if (uxState.topicKey === 'travel') {
    const topicState = buildTopicStateFromUX(uxState);
    const topicChips = getTopicChipPack(topicState, count);
    if (topicChips.length > 0) {
      return topicChips.map(c => ({
        ...c,
        stance: 'PRACTICAL' as const,
      }));
    }
  }
  return PRACTICAL_GENERIC_CHIPS.slice(0, count);
}

function buildProcessingChips(count: number): StanceChip[] {
  return PROCESSING_CHIPS.slice(0, count);
}

function buildStabilizationChips(count: number): StanceChip[] {
  return STABILIZATION_CHIPS.slice(0, count);
}

function buildConnectionChips(count: number): StanceChip[] {
  return CONNECTION_CHIPS.slice(0, count);
}

function buildByStance(stance: SupportStance, uxState: UXContextState, count: number): StanceChip[] {
  switch (stance) {
    case 'PRACTICAL': return buildPracticalChips(uxState, count);
    case 'PROCESSING': return buildProcessingChips(count);
    case 'STABILIZATION': return buildStabilizationChips(count);
    case 'CONNECTION': return buildConnectionChips(count);
  }
}

// ── Main export ───────────────────────────────────────────────────────────────
export function getStanceChips(uxState: UXContextState, count = 5): StanceChip[] {
  const { stance, secondaryStance } = uxState;

  if (!secondaryStance) {
    return buildByStance(stance, uxState, count);
  }

  const primaryCount = Math.min(4, count - 1);
  const secondaryCount = count - primaryCount;

  const primary = buildByStance(stance, uxState, primaryCount);
  const secondary = buildByStance(secondaryStance, uxState, secondaryCount);

  return [...primary, ...secondary].slice(0, count);
}

export function getStanceTooltip(stance: SupportStance): string {
  switch (stance) {
    case 'PRACTICAL': return 'Sugerencias para planear.';
    case 'PROCESSING': return 'Sugerencias para explorar.';
    case 'STABILIZATION': return 'Sugerencias para estabilizarte.';
    case 'CONNECTION': return 'Sugerencias para acompañarte.';
  }
}
