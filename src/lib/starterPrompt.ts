export type PromptGroup = 'general' | 'stress' | 'positive';

export const PROMPT_GROUPS: Record<PromptGroup, string[]> = {
  general: [
    '¿Qué ha estado en tu mente hoy?',
    '¿Hay algo en lo que has pensado mucho últimamente?',
    '¿Qué sientes que más necesitas escribir ahora?',
    '¿Qué te ayudaría a que este día se sintiera un poco más liviano?',
    '¿Cómo estás de verdad hoy, más allá de lo que muestras?',
  ],
  stress: [
    '¿Qué se ha sentido pesado últimamente?',
    '¿Qué está ocupando más espacio en tu mente ahora?',
    '¿Hay algo que te ha estado quitando energía?',
    '¿Qué cargas ahora que no has dicho en voz alta?',
    '¿Cómo se sentiría soltar aunque sea una cosa, aunque sea por un momento?',
  ],
  positive: [
    '¿Qué se ha sentido bien últimamente?',
    '¿Qué te dio energía hoy?',
    '¿Hay algo por lo que te sientas agradecido/a ahora?',
    '¿Qué pasó recientemente que vale la pena guardar?',
    '¿Qué salió más fácil o más ligero de lo que esperabas?',
  ],
};

type SignalTotals = {
  stress: number;
  positive: number;
};

const SIGNAL_THRESHOLD = 1.5;

export function resolvePromptGroup(signals: SignalTotals | null): PromptGroup {
  if (signals) {
    const { stress, positive } = signals;
    if (stress > positive && stress >= SIGNAL_THRESHOLD) return 'stress';
    if (positive > stress && positive >= SIGNAL_THRESHOLD) return 'positive';
  }
  return 'general';
}

export function pickPromptFromGroup(group: PromptGroup, exclude?: string): string {
  const pool = PROMPT_GROUPS[group];
  const candidates = exclude ? pool.filter(p => p !== exclude) : pool;
  const source = candidates.length > 0 ? candidates : pool;
  return source[Math.floor(Math.random() * source.length)];
}

export function pickStarterPrompt(signals: SignalTotals | null): string {
  return pickPromptFromGroup(resolvePromptGroup(signals));
}
