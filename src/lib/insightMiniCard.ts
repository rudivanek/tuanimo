import type { WeeklyInsightSummary, SignalTotals, SignalType } from './insightWeekly';

export type MiniInsightBasis =
  | 'recovery'
  | 'delta_large'
  | 'delta_moderate'
  | 'level'
  | 'fallback';

export type MiniInsightResult = {
  text: string;
  basis: MiniInsightBasis;
  confidence: 'high' | 'medium' | 'low';
};

export function buildWeeklyMiniInsight(summary: WeeklyInsightSummary): MiniInsightResult {
  const { dominantThisWeek, change, weekTotals } = summary;

  if (!dominantThisWeek) {
    return { text: '', basis: 'fallback', confidence: 'low' };
  }

  switch (dominantThisWeek) {
    case 'stress':
      return buildStressResult(change, weekTotals);
    case 'anxiety':
      return buildAnxietyResult(change, weekTotals);
    case 'positive':
      return buildPositiveResult(change, weekTotals);
    case 'gratitude':
      return buildGratitudeResult(change, weekTotals);
  }
}

function buildStressResult(change: SignalTotals, weekTotals: SignalTotals): MiniInsightResult {
  const delta = change.stress;

  const isRecovering = delta <= -3 && (change.positive >= 1 || change.gratitude >= 1);
  if (isRecovering) {
    return {
      text: 'La carga bajó esta semana y hay más espacio para lo positivo.',
      basis: 'recovery',
      confidence: 'high',
    };
  }

  if (delta >= 5) {
    return {
      text: 'Esta semana el peso fue bastante más intenso que la anterior.',
      basis: 'delta_large',
      confidence: 'high',
    };
  }
  if (delta >= 2) {
    return {
      text: 'Esta semana se sintió más pesada que la anterior.',
      basis: 'delta_moderate',
      confidence: 'medium',
    };
  }
  if (delta <= -5) {
    return {
      text: 'Algo se alivió esta semana — hubo bastante menos peso que la anterior.',
      basis: 'delta_large',
      confidence: 'high',
    };
  }
  if (delta <= -2) {
    return {
      text: 'La carga cedió un poco esta semana respecto a la anterior.',
      basis: 'delta_moderate',
      confidence: 'medium',
    };
  }

  if (weekTotals.stress >= 8) {
    return {
      text: 'Ha habido una tensión constante esta semana, sin mucho espacio para soltar.',
      basis: 'level',
      confidence: 'medium',
    };
  }
  if (weekTotals.stress >= 4) {
    return {
      text: 'Esta semana tuvo su peso, aunque sin llegar a ser abrumadora.',
      basis: 'level',
      confidence: 'medium',
    };
  }
  return {
    text: 'Esta semana se sintió bastante manejable.',
    basis: 'level',
    confidence: 'low',
  };
}

function buildAnxietyResult(change: SignalTotals, weekTotals: SignalTotals): MiniInsightResult {
  const delta = change.anxiety;

  const isRecovering = delta <= -3 && (change.positive >= 1 || change.gratitude >= 1);
  if (isRecovering) {
    return {
      text: 'La inquietud bajó esta semana y hay más espacio para lo positivo.',
      basis: 'recovery',
      confidence: 'high',
    };
  }

  if (delta >= 5) {
    return {
      text: 'Esta semana trajo bastante más inquietud que la anterior.',
      basis: 'delta_large',
      confidence: 'high',
    };
  }
  if (delta >= 2) {
    return {
      text: 'Esta semana trajo más inquietud que la anterior.',
      basis: 'delta_moderate',
      confidence: 'medium',
    };
  }
  if (delta <= -5) {
    return {
      text: 'Algo se calmó esta semana — bastante menos inquietud que la anterior.',
      basis: 'delta_large',
      confidence: 'high',
    };
  }
  if (delta <= -2) {
    return {
      text: 'La inquietud cedió algo respecto a la semana pasada.',
      basis: 'delta_moderate',
      confidence: 'medium',
    };
  }

  if (weekTotals.anxiety >= 8) {
    return {
      text: 'Hubo bastante inquietud esta semana, algo que no terminó de asentarse.',
      basis: 'level',
      confidence: 'medium',
    };
  }
  if (weekTotals.anxiety >= 4) {
    return {
      text: 'La semana tuvo momentos de inquietud que se mantuvieron presentes.',
      basis: 'level',
      confidence: 'medium',
    };
  }
  return {
    text: 'La inquietud estuvo presente pero sin dominar la semana.',
    basis: 'level',
    confidence: 'low',
  };
}

function buildPositiveResult(change: SignalTotals, weekTotals: SignalTotals): MiniInsightResult {
  const delta = change.positive;

  if (delta >= 4) {
    return {
      text: 'Hubo notablemente más energía y ligereza esta semana que la anterior.',
      basis: 'delta_large',
      confidence: 'high',
    };
  }
  if (delta >= 2) {
    return {
      text: 'Esta semana reflejó más energía positiva que la anterior.',
      basis: 'delta_moderate',
      confidence: 'medium',
    };
  }
  if (delta <= -4) {
    return {
      text: 'Esta semana tuvo un poco menos de energía que la anterior.',
      basis: 'delta_large',
      confidence: 'high',
    };
  }
  if (delta <= -2) {
    return {
      text: 'Hubo algo menos de ligereza que la semana pasada.',
      basis: 'delta_moderate',
      confidence: 'medium',
    };
  }

  if (weekTotals.positive >= 8) {
    return {
      text: 'La semana se sintió bastante luminosa y con buen tono.',
      basis: 'level',
      confidence: 'medium',
    };
  }
  if (weekTotals.positive >= 4) {
    return {
      text: 'Hubo una presencia sostenida de ligereza a lo largo de la semana.',
      basis: 'level',
      confidence: 'medium',
    };
  }
  return {
    text: 'Se nota un tono positivo esta semana.',
    basis: 'level',
    confidence: 'low',
  };
}

function buildGratitudeResult(change: SignalTotals, weekTotals: SignalTotals): MiniInsightResult {
  const delta = change.gratitude;

  if (delta >= 3) {
    return {
      text: 'Esta semana trajo más momentos de gratitud que la anterior.',
      basis: 'delta_moderate',
      confidence: 'high',
    };
  }
  if (delta >= 1) {
    return {
      text: 'Hubo algo más de reconocimiento y presencia en esta semana.',
      basis: 'delta_moderate',
      confidence: 'medium',
    };
  }
  if (delta <= -3) {
    return {
      text: 'Hubo algo menos de gratitud que la semana anterior.',
      basis: 'delta_moderate',
      confidence: 'medium',
    };
  }

  if (weekTotals.gratitude >= 6) {
    return {
      text: 'Esta semana estuvo marcada por momentos de reconocimiento y presencia.',
      basis: 'level',
      confidence: 'high',
    };
  }
  if (weekTotals.gratitude >= 3) {
    return {
      text: 'Se mantiene una presencia de gratitud esta semana.',
      basis: 'level',
      confidence: 'medium',
    };
  }
  return {
    text: 'Hay presencia de gratitud en esta semana.',
    basis: 'level',
    confidence: 'low',
  };
}
