/*
 * Reflection Delta Engine — Stage RP-02
 *
 * Compares the emotional signal from a past journal entry (RP-01) with the
 * user's current dominant signal (derived from chat_signal_daily_agg) and
 * produces a delta-aware reflection prompt in Spanish.
 *
 * Delta classification:
 *   improved  — past heavy (stress/anxiety) → current light (positive/gratitude)
 *   worsened  — past light (positive/gratitude) → current heavy (stress/anxiety)
 *   similar   — both signals belong to the same emotional family (heavy→heavy or light→light)
 *
 * Returns null (fall back to RP-01) when:
 *   - Either signal is 'neutral'
 *   - The past and current signals are identical (no meaningful delta to surface)
 *   - Evidence is marked insufficient by the caller
 *
 * Variant index is passed in from the caller so it stays consistent with the
 * daysAgo-based rotation already used in reflectionPrompt.ts.
 */

import type { ReflectionPromptSignal, ReflectionPromptResult } from './reflectionPrompt';

export type DeltaDirection = 'improved' | 'worsened' | 'similar';

const HEAVY_SIGNALS = new Set<ReflectionPromptSignal>(['stress', 'anxiety']);
const LIGHT_SIGNALS = new Set<ReflectionPromptSignal>(['positive', 'gratitude']);

export function classifyDelta(
  past: ReflectionPromptSignal,
  current: ReflectionPromptSignal
): DeltaDirection | null {
  if (past === 'neutral' || current === 'neutral') return null;
  if (past === current) return null;

  if (HEAVY_SIGNALS.has(past) && LIGHT_SIGNALS.has(current)) return 'improved';
  if (LIGHT_SIGNALS.has(past) && HEAVY_SIGNALS.has(current)) return 'worsened';
  if (HEAVY_SIGNALS.has(past) && HEAVY_SIGNALS.has(current)) return 'similar';
  if (LIGHT_SIGNALS.has(past) && LIGHT_SIGNALS.has(current)) return 'similar';

  return null;
}

const DELTA_PROMPTS: Record<DeltaDirection, [string, string, string]> = {
  improved: [
    'La vez pasada sonaba muy pesado. Esta semana parece un poco más ligero. ¿Qué cambió?',
    'Hay algo distinto en el tono de esta semana comparado con entonces. ¿A qué se debe?',
    'Algo ha mejorado desde aquella entrada. ¿Qué crees que hizo la diferencia?',
  ],
  worsened: [
    'La vez anterior había más calma. ¿Qué crees que hizo la diferencia?',
    'Aquel momento positivo, ¿sigue siendo un recurso ahora que las cosas pesan más?',
    'La energía de entonces contrasta con esta semana. ¿Qué ha pasado?',
  ],
  similar: [
    'Veo señales parecidas a las de hace unos días. ¿Sientes que esto sigue igual o se movió algo?',
    'El patrón parece continuar desde aquella entrada. ¿Lo notas tú también?',
    'Algo de entonces sigue presente esta semana. ¿Es lo mismo o hay matices nuevos?',
  ],
};

const DELTA_STARTERS: Record<DeltaDirection, [string, string, string]> = {
  improved: [
    'La vez pasada algo sentía pesado. Comparando con cómo estoy ahora:\n',
    'Desde aquella entrada difícil, algo parece haber cambiado:\n',
    'Mirando hacia atrás y comparando con esta semana:\n',
  ],
  worsened: [
    'Antes había más calma. Pensando en eso ahora:\n',
    'Aquella energía positiva contrasta con cómo me siento esta semana:\n',
    'Al releer eso de hace unos días, comparando con ahora:\n',
  ],
  similar: [
    'Esta semana se parece a lo de hace unos días. Reflexionando:\n',
    'El patrón parece continuar. Al revisarlo:\n',
    'Algo sigue igual desde entonces. Pensando en ello:\n',
  ],
};

export function buildDeltaResult(
  past: ReflectionPromptSignal,
  current: ReflectionPromptSignal,
  variantIndex: number
): ReflectionPromptResult | null {
  const direction = classifyDelta(past, current);
  if (!direction) return null;

  const idx = variantIndex % 3;
  return {
    signal: past,
    promptText: DELTA_PROMPTS[direction][idx],
    insertStarter: DELTA_STARTERS[direction][idx],
  };
}
