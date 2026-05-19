/*
 * Adaptive Reflection Prompt Engine
 *
 * Classifies the emotional signal of a past journal entry (using lightweight
 * keyword heuristics) and returns a context-appropriate Spanish reflection
 * prompt and insert starter.
 *
 * Design principles:
 * - Rule-based first: no API calls, no latency, works offline.
 * - Signal detection reuses the same keyword vocabulary as insightWeeklyJournal.ts
 *   so both systems agree on what "stress" and "gratitude" look like.
 * - Variant selection uses daysAgo % 3 so the prompt varies slightly across
 *   different sessions without requiring any persistent state.
 * - Delta-aware (RP-02): when a current-state signal is supplied, the engine
 *   compares past vs. current and picks a delta-aware prompt if the direction
 *   is clear (improved / worsened / similar). Falls back to RP-01 variants
 *   when evidence is neutral or absent.
 * - Structured-metadata priority (RP-03): when pre-classified metadata is
 *   available from the journal entry itself (emotion_score_at_creation,
 *   trigger_reason), it takes precedence over keyword heuristics. Keywords
 *   remain the fallback for manual entries where structured data is absent.
 *   Signal priority: metaSignal (RP-03) > keyword heuristics (RP-01).
 * - AI refinement slot: generateReflectionPrompt() accepts an optional
 *   `aiOverride` parameter. When an AI-generated prompt is available in the
 *   future, pass it here and the rule-based result is bypassed entirely.
 */

import { buildDeltaResult } from './reflectionDelta';

export type ReflectionPromptSignal = 'stress' | 'anxiety' | 'gratitude' | 'positive' | 'neutral';

export type ReflectionPromptResult = {
  signal: ReflectionPromptSignal;
  promptText: string;
  insertStarter: string;
};

export type EntryMetaSignals = {
  emotion_score?: number | null;
  trigger_reason?: string | null;
  origin?: string | null;
  tags?: string[] | null;
};

export function classifySignalFromMetadata(
  meta: EntryMetaSignals
): ReflectionPromptSignal | null {
  const { emotion_score, trigger_reason } = meta;

  if (typeof emotion_score === 'number' && emotion_score >= 1) {
    return 'stress';
  }

  if (trigger_reason) {
    if (trigger_reason.includes('repetition') && trigger_reason.includes('heaviness')) return 'anxiety';
    if (trigger_reason.includes('heaviness')) return 'stress';
  }

  return null;
}

const SIGNAL_KEYWORDS: Record<Exclude<ReflectionPromptSignal, 'neutral'>, string[]> = {
  stress: [
    'estrés', 'estres', 'agobio', 'agobiado', 'agobiada', 'cargado', 'cargada',
    'presión', 'presion', 'abrumado', 'abrumada', 'pesado', 'pesada',
    'agotado', 'agotada', 'cansado', 'cansada', 'saturado', 'saturada',
    'responsabilidad', 'deadline', 'plazo', 'urgente',
  ],
  anxiety: [
    'ansiedad', 'ansioso', 'ansiosa', 'nervios', 'nervioso', 'nerviosa',
    'preocupación', 'preocupacion', 'preocupado', 'preocupada',
    'miedo', 'pánico', 'panico', 'inquieto', 'inquieta',
    'intranquilo', 'intranquila', 'angustia', 'angustiado', 'angustiada',
  ],
  gratitude: [
    'gratitud', 'agradecimiento', 'gracias', 'agradecer', 'agradecida',
    'agradecido', 'afortunada', 'afortunado', 'bendecida', 'bendecido',
    'valoro', 'aprecio', 'privilegiado', 'privilegiada',
  ],
  positive: [
    'alegría', 'alegria', 'alegre', 'calma', 'tranquilo', 'tranquila',
    'contento', 'contenta', 'feliz', 'ilusión', 'ilusion', 'motivado', 'motivada',
    'esperanza', 'entusiasmo', 'orgulloso', 'orgullosa', 'logro', 'conseguí', 'consegui',
  ],
};

const PROMPT_VARIANTS: Record<ReflectionPromptSignal, [string, string, string]> = {
  stress: [
    '¿Esa carga sigue sintiéndose igual de pesada hoy?',
    '¿Algo de esa presión ya pasó?',
    '¿Qué ha cambiado desde que escribiste esto?',
  ],
  anxiety: [
    '¿Esa preocupación sigue presente hoy?',
    '¿Qué parte de esto ya no te pesa igual?',
    '¿Qué tan distinto se siente ahora?',
  ],
  gratitude: [
    '¿Qué otras cosas pequeñas agradeces hoy?',
    '¿Ese momento sigue dándote algo?',
    '¿Qué más ha salido bien esta semana?',
  ],
  positive: [
    '¿Ese ánimo sigue contigo?',
    '¿Qué de ese momento te gustaría repetir?',
    '¿Qué ha seguido saliendo bien desde entonces?',
  ],
  neutral: [
    '¿Qué peso tiene hoy lo que escribiste entonces?',
    '¿Algo ha cambiado desde que escribiste esto?',
    '¿Qué parte de esto sigue presente en ti?',
  ],
};

const INSERT_STARTERS: Record<ReflectionPromptSignal, [string, string, string]> = {
  stress: [
    'Hace unos días escribí sobre algo que sentía pesado. Hoy, comparando:\n',
    'Aquella presión que sentía hace unos días, ahora:\n',
    'Hace una semana me sentía agobiado/a. Hoy esto ha cambiado:\n',
  ],
  anxiety: [
    'Hace unos días escribí sobre algo que me preocupaba. Ahora:\n',
    'Lo que me generaba inquietud entonces, hoy:\n',
    'Aquella inquietud de hace unos días, hoy se siente:\n',
  ],
  gratitude: [
    'Hace unos días anoté algo por lo que estaba agradecido/a. Hoy:\n',
    'Aquellos momentos de gratitud me recuerdan que:\n',
    'Siguiendo con lo que agradecí entonces:\n',
  ],
  positive: [
    'Hace unos días me sentía con buena energía. Hoy:\n',
    'Aquel ánimo positivo de hace una semana, hoy:\n',
    'Desde que escribí eso con entusiasmo:\n',
  ],
  neutral: [
    'Hace unos días escribí:\n',
    'Al releer esto que escribí hace unos días:\n',
    'Esto que escribí hace una semana me hace pensar:\n',
  ],
};

function detectSignal(content: string): ReflectionPromptSignal {
  const lower = content.toLowerCase();
  const scores: Record<Exclude<ReflectionPromptSignal, 'neutral'>, number> = {
    stress: 0,
    anxiety: 0,
    gratitude: 0,
    positive: 0,
  };

  for (const signal of Object.keys(SIGNAL_KEYWORDS) as Exclude<ReflectionPromptSignal, 'neutral'>[]) {
    for (const kw of SIGNAL_KEYWORDS[signal]) {
      if (lower.includes(kw)) scores[signal]++;
    }
  }

  const ranked = (Object.keys(scores) as Exclude<ReflectionPromptSignal, 'neutral'>[])
    .filter((s) => scores[s] > 0)
    .sort((a, b) => scores[b] - scores[a]);

  return ranked.length > 0 ? ranked[0] : 'neutral';
}

export function generateReflectionPrompt(
  content: string,
  daysAgo: number = 7,
  aiOverride?: { promptText: string; insertStarter: string },
  currentSignal?: ReflectionPromptSignal,
  metaSignal?: ReflectionPromptSignal
): ReflectionPromptResult {
  if (aiOverride) {
    return {
      signal: 'neutral',
      promptText: aiOverride.promptText,
      insertStarter: aiOverride.insertStarter,
    };
  }

  const signal = metaSignal ?? detectSignal(content);
  const variantIndex = Math.abs(Math.round(daysAgo) - 6) % 3;

  if (currentSignal) {
    const deltaResult = buildDeltaResult(signal, currentSignal, variantIndex);
    if (deltaResult) return deltaResult;
  }

  return {
    signal,
    promptText: PROMPT_VARIANTS[signal][variantIndex],
    insertStarter: INSERT_STARTERS[signal][variantIndex],
  };
}
