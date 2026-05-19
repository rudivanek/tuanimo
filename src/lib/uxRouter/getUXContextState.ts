import { NYC_PLACE_NAMES } from '../config/entityLists';

export type SupportStance = 'PRACTICAL' | 'PROCESSING' | 'STABILIZATION' | 'CONNECTION';

export type Intensity = 0 | 1 | 2 | 3;

export type PrimaryNeed =
  | 'CLARITY'
  | 'CONTROL'
  | 'COMFORT'
  | 'CONNECTION'
  | 'MEANING'
  | 'SAFETY';

export type UXTopicKey = 'travel' | 'work' | 'relationships' | 'health' | 'self' | 'other';

export interface UXContextState {
  stance: SupportStance;
  secondaryStance: SupportStance | null;
  intensity: Intensity;
  need: PrimaryNeed;
  topicKey: UXTopicKey;
  entities: string[];
  confidence: number;
  reasons: string[];
  updatedAt: string;
}

export interface StanceLock {
  stance: SupportStance;
  turnsRemaining: number;
}

const LOCK_TURNS_DEFAULT = 2;

// ── Task / Practical signal patterns ──────────────────────────────────────────
const TASK_PATTERNS: RegExp[] = [
  /\b(qué|cuáles?|recomiénd[ae]me?|dónde|cómo llegar|cómo ir|cómo hacer|itinerario|visitar|museos?|restaurantes?|barrios?|precio|presupuesto|horarios?|actividades?|lugares?)\b/i,
  /\b(nueva york|nyc|new york|manhattan|brooklyn|queens|bronx|midtown|downtown|soho|tribeca|harlem|central park|times square)\b/i,
  /\b(plan|planes|lista|guía|tips?|consejos?|recomendaciones?|opciones?|sugerencias?)\b/i,
  /\b(metro|transporte|aeropuerto|hotel|alojamiento|vuelo|maleta|equipaje)\b/i,
  /\b(galería|galerías|moma|guggenheim|\bmet\b|whitney|chelsea)\b/i,
  /\b(trabajo|empleo|jefe|empresa|proyecto|reunión|presentación|oficina|carrera|negocio)\b/i,
  /\b(recorrido|ruta|excursión|paseo|tour|guía de viaje)\b/i,
];

// ── Reflection / Processing signal patterns ───────────────────────────────────
const REFLECT_PATTERNS: RegExp[] = [
  /\bme (siento|sentí|estoy sintiendo)\b/i,
  /\bquiero (explorar|profundizar|entender|reflexionar|hablar de) (lo que|cómo|sobre|mis|este)\b/i,
  /\bpara mí (significa|es importante|importa|quiere decir)\b/i,
  /\b(qué significa|por qué (siento|me siento|me pasa|me afecta|importa|duele))\b/i,
  /\b(quiero saber|quiero entender) (por qué|qué|cómo)\b/i,
  /\b(emociones?|sentimientos?|sensaciones? internas?)\b/i,
  /\bprocesar (esto|lo que|mis|estas)\b/i,
];

// ── Intensity markers ─────────────────────────────────────────────────────────
const HIGH_INTENSITY: RegExp[] = [
  /\b(ataque de pánico|me falta el aire|me ahogo|fuera de control|estoy al borde|no puedo más|me estoy volviendo loco|me estoy volviendo loca|no sé qué hacer|todo se derrumba|me derrumbo|no aguanto más|colapso|pánico total)\b/i,
  /\b(suicid|hacerme daño|quitarme la vida|no quiero vivir|mejor morir)\b/i,
];
const MED_INTENSITY: RegExp[] = [
  /\b(ansioso|ansiosa|nervioso|nerviosa|me preocupa mucho|mucha tristeza|mucho miedo|no puedo concentrarme|estoy temblando|muy abrumad[oa]|muy agitad[oa]|me cuesta respirar)\b/i,
];
const MILD_INTENSITY: RegExp[] = [
  /\b(un poco (ansioso|ansiosa|nervioso|nerviosa|preocupado|preocupada|triste)|algo de (ansiedad|miedo|tristeza|estrés)|ligero nerviosismo|algo nervioso|algo nerviosa)\b/i,
];

// ── Need markers ──────────────────────────────────────────────────────────────
const CONTROL_PATTERNS: RegExp[] = [
  /\b(qué (puedo|debo|debería) hacer|qué hago|cómo (manejo|controlo|enfrento)|qué me recomiendas hacer)\b/i,
];
const MEANING_PATTERNS: RegExp[] = [
  /\b(por qué (siento|me siento|me pasa|importa|duele)|qué significa|qué valor tiene|qué importa)\b/i,
];
const CONNECTION_MARKERS: RegExp[] = [
  /\b(me siento sol[oa]|nadie me entiende|vergüenza|avergonzad[oa]|me odio|me detesto|no valgo|no sirvo|rechazad[oa]|abandonad[oa]|aislad[oa])\b/i,
];
const COMFORT_MARKERS: RegExp[] = [
  /\b(sin energía|vacío|vacía|no tengo ganas|nada me da gusto|no siento nada|entumecid[oa]|apatico|apática|cansancio emocional|agotad[oa] emocionalmente)\b/i,
];

// ── Safety markers ────────────────────────────────────────────────────────────
const SAFETY_PATTERNS: RegExp[] = [
  /\b(suicid|hacerme daño|quitarme la vida|no quiero vivir|mejor morir|autolesión|cortarme|lastimarme)\b/i,
];

// ── Topic heuristics ──────────────────────────────────────────────────────────
function extractEntities(text: string): string[] {
  return NYC_PLACE_NAMES.filter(e => text.toLowerCase().includes(e.toLowerCase()));
}

function detectTopicFromText(text: string): { topicKey: UXTopicKey; entities: string[] } {
  const entities = extractEntities(text);
  if (entities.length > 0 ||
    /\b(itinerario|viaje|visitar|turismo|hotel|aeropuerto|museo|galería|restaurante|barrio|metro|transporte|nyc|nueva york|new york)\b/i.test(text)) {
    return { topicKey: 'travel', entities };
  }
  if (/\b(trabajo|empleo|jefe|empresa|proyecto|reunión|presentación|oficina|carrera|negocio|renunciar)\b/i.test(text)) {
    return { topicKey: 'work', entities: [] };
  }
  if (/\b(pareja|amigos?|familia|mamá|papá|hermano|hermana|relación|amistad|conflicto con|discutí con)\b/i.test(text)) {
    return { topicKey: 'relationships', entities: [] };
  }
  if (/\b(salud|médico|enfermedad|síntomas?|tratamiento|ejercicio|dormir|dieta|nutrición)\b/i.test(text)) {
    return { topicKey: 'health', entities: [] };
  }
  if (/\b(quien soy|me conozco|autoestima|identidad|mis valores|cómo soy|personalidad)\b/i.test(text)) {
    return { topicKey: 'self', entities: [] };
  }
  return { topicKey: 'other', entities: [] };
}

function countMatch(text: string, patterns: RegExp[]): number {
  return patterns.reduce((n, p) => n + (p.test(text) ? 1 : 0), 0);
}

// ── Exported signal detectors ─────────────────────────────────────────────────

export function detectIntentType(text: string): 'TASK' | 'REFLECT' | 'MIXED' {
  const task = countMatch(text, TASK_PATTERNS);
  const reflect = countMatch(text, REFLECT_PATTERNS);
  if (task > 0 && reflect === 0) return 'TASK';
  if (reflect > 0 && task === 0) return 'REFLECT';
  if (task > 0 && reflect > 0) return 'MIXED';
  return 'TASK';
}

export function detectIntensity(text: string): Intensity {
  if (countMatch(text, HIGH_INTENSITY) > 0) return 3;
  if (countMatch(text, MED_INTENSITY) > 0) return 2;
  if (countMatch(text, MILD_INTENSITY) > 0) return 1;
  return 0;
}

export function detectNeed(
  text: string,
  intentType: 'TASK' | 'REFLECT' | 'MIXED',
  intensity: Intensity,
): PrimaryNeed {
  if (countMatch(text, SAFETY_PATTERNS) > 0 || intensity === 3) return 'SAFETY';
  if (countMatch(text, CONTROL_PATTERNS) > 0) return 'CONTROL';
  if (countMatch(text, MEANING_PATTERNS) > 0) return 'MEANING';
  if (countMatch(text, CONNECTION_MARKERS) > 0) return 'CONNECTION';
  if (countMatch(text, COMFORT_MARKERS) > 0) return 'COMFORT';
  if (intentType === 'TASK') return 'CLARITY';
  return 'MEANING';
}

// ── Anticipatory coping frame patterns ───────────────────────────────────────
const ANTICIPATORY_FRAMES: string[] = [
  '¿qué hago si',
  '¿qué debo hacer si',
  '¿y si',
  'si me pasa',
  'si me vuelve a pasar',
  'cuando me pasa',
  'en caso de que',
  'por si me pasa',
  'qué hago cuando',
  'qué hago si',
];

const AFFECT_SIGNALS: string[] = [
  'miedo',
  'ansiedad',
  'pánico',
  'panico',
  'estrés',
  'estres',
  'angustia',
  'nervioso',
  'nerviosa',
  'abrumado',
  'abrumada',
  'me siento perdido',
  'me siento perdida',
  'me siento solo',
  'me siento sola',
  'lugares cerrados',
  'encerrado',
  'encerrada',
  'claustrofobia',
  'no puedo respirar',
  'me falta el aire',
  'taquicardia',
  'palpitaciones',
];

export function detectAnticipatoryRegulationNeed(text: string): {
  matched: boolean;
  matchedFrame?: string;
  matchedSignal?: string;
} {
  const lower = text.toLowerCase();
  const matchedFrame = ANTICIPATORY_FRAMES.find(f => lower.includes(f));
  if (!matchedFrame) return { matched: false };
  const matchedSignal = AFFECT_SIGNALS.find(s => lower.includes(s));
  if (!matchedSignal) return { matched: false };
  return { matched: true, matchedFrame, matchedSignal };
}

// ── Chip intentKeys that unconditionally force STABILIZATION ─────────────────
const STABILIZATION_CHIP_INTENTS = new Set([
  'stab_present',
  'stab_plan',
  'stab_body',
  'stab_small_step',
  'stab_ask_help',
]);

// ── Main router ───────────────────────────────────────────────────────────────

export function getUXContextState(params: {
  lastUserMessage: string;
  recentUserMessages?: string;
  stanceLock?: StanceLock;
  selectedChipType?: string;
}): { state: UXContextState; nextLock: StanceLock } {
  const { lastUserMessage, recentUserMessages = '', stanceLock, selectedChipType } = params;
  const allText = lastUserMessage + ' ' + recentUserMessages;

  const intentType = detectIntentType(lastUserMessage);
  const intensity = detectIntensity(lastUserMessage);
  const need = detectNeed(lastUserMessage, intentType, intensity);
  const { topicKey, entities } = detectTopicFromText(allText);

  const isCrisis = countMatch(lastUserMessage, SAFETY_PATTERNS) > 0;
  const reasons: string[] = [`intent:${intentType}`, `intensity:${intensity}`, `need:${need}`];

  // ── Chip-level stance override (highest priority, before all other logic) ─
  if (selectedChipType && STABILIZATION_CHIP_INTENTS.has(selectedChipType)) {
    const forcedIntensity = Math.max(intensity, 2) as Intensity;
    const state: UXContextState = {
      stance: 'STABILIZATION',
      secondaryStance: null,
      intensity: forcedIntensity,
      need,
      topicKey,
      entities,
      confidence: 1,
      reasons: [...reasons, `chip_override:${selectedChipType}`],
      updatedAt: new Date().toISOString(),
    };
    return { state, nextLock: { stance: 'STABILIZATION', turnsRemaining: LOCK_TURNS_DEFAULT } };
  }

  // ── Anticipatory regulation override ─────────────────────────────────────
  const anticCheck = detectAnticipatoryRegulationNeed(lastUserMessage);
  if (anticCheck.matched) {
    if (import.meta.env.DEV) {
      console.log('[UXRouter] anticipatory_regulation_override=true', {
        matchedFrame: anticCheck.matchedFrame,
        matchedSignal: anticCheck.matchedSignal,
      });
    }
    const forcedIntensity = Math.max(intensity, 2) as Intensity;
    const state: UXContextState = {
      stance: 'STABILIZATION',
      secondaryStance: null,
      intensity: forcedIntensity,
      need: 'SAFETY',
      topicKey,
      entities,
      confidence: 0.95,
      reasons: [...reasons, `anticipatory_override:${anticCheck.matchedFrame}+${anticCheck.matchedSignal}`],
      updatedAt: new Date().toISOString(),
    };
    return { state, nextLock: { stance: 'STABILIZATION', turnsRemaining: LOCK_TURNS_DEFAULT } };
  }

  // ── Hard overrides (bypass smoothing) ────────────────────────────────────
  if (isCrisis) {
    const state: UXContextState = {
      stance: 'STABILIZATION',
      secondaryStance: null,
      intensity: 3,
      need: 'SAFETY',
      topicKey,
      entities,
      confidence: 1,
      reasons: [...reasons, 'crisis_override'],
      updatedAt: new Date().toISOString(),
    };
    return { state, nextLock: { stance: 'STABILIZATION', turnsRemaining: 3 } };
  }

  if (intensity === 3) {
    const state: UXContextState = {
      stance: 'STABILIZATION',
      secondaryStance: topicKey !== 'other' ? 'PRACTICAL' : null,
      intensity: 3,
      need,
      topicKey,
      entities,
      confidence: 0.95,
      reasons: [...reasons, 'intensity3_override'],
      updatedAt: new Date().toISOString(),
    };
    return { state, nextLock: { stance: 'STABILIZATION', turnsRemaining: LOCK_TURNS_DEFAULT } };
  }

  // ── Stance smoothing ──────────────────────────────────────────────────────
  if (stanceLock && stanceLock.turnsRemaining > 0) {
    const lockedStance = stanceLock.stance;
    const nextLock: StanceLock = {
      stance: lockedStance,
      turnsRemaining: stanceLock.turnsRemaining - 1,
    };
    const state: UXContextState = {
      stance: lockedStance,
      secondaryStance: null,
      intensity,
      need,
      topicKey,
      entities,
      confidence: 0.8,
      reasons: [...reasons, `locked:${lockedStance}(${stanceLock.turnsRemaining})`],
      updatedAt: new Date().toISOString(),
    };
    return { state, nextLock };
  }

  // ── Fresh stance decision ──────────────────────────────────────────────────
  let stance: SupportStance;
  let secondaryStance: SupportStance | null = null;
  let confidence = 0.75;

  if (intentType === 'TASK' && intensity <= 1) {
    stance = 'PRACTICAL';
    confidence = 0.85;
  } else if (intentType === 'REFLECT' && intensity <= 2) {
    stance = 'PROCESSING';
    confidence = 0.8;
  } else if (
    countMatch(lastUserMessage, [...CONNECTION_MARKERS, ...COMFORT_MARKERS]) > 0 &&
    intensity >= 1 && intensity <= 2
  ) {
    stance = 'CONNECTION';
    confidence = 0.82;
  } else if (intentType === 'MIXED') {
    if (intensity >= 2) {
      stance = 'STABILIZATION';
      secondaryStance = 'PRACTICAL';
    } else if (need === 'MEANING' || need === 'COMFORT') {
      stance = 'PROCESSING';
      secondaryStance = topicKey !== 'other' ? 'PRACTICAL' : null;
    } else {
      stance = 'PRACTICAL';
      secondaryStance = 'PROCESSING';
    }
    confidence = 0.72;
  } else if (intensity >= 2) {
    stance = 'STABILIZATION';
    confidence = 0.88;
  } else {
    stance = 'PROCESSING';
    confidence = 0.6;
  }

  const state: UXContextState = {
    stance,
    secondaryStance,
    intensity,
    need,
    topicKey,
    entities,
    confidence,
    reasons,
    updatedAt: new Date().toISOString(),
  };

  return {
    state,
    nextLock: { stance, turnsRemaining: LOCK_TURNS_DEFAULT },
  };
}
