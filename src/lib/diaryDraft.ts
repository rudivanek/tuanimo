import type { SupportStance } from './uxRouter/getUXContextState';

export interface DiaryDraftInput {
  userMessages: string[];
  uxStance?: SupportStance;
  uxIntensity?: number;
}

export interface DiaryDraft {
  title: string;
  content: string;
  tags: string[];
}

const EMOTION_BY_STANCE: Record<SupportStance, string> = {
  STABILIZATION: 'abrumado/a, tenso/a y con la mente muy activa',
  PROCESSING: 'confundido/a, reflexivo/a, buscando claridad',
  CONNECTION: 'solo/a y con necesidad de sentirme comprendido/a',
  PRACTICAL: 'estresado/a con algo concreto que no paro de pensar',
};

const NEED_BY_STANCE: Record<SupportStance, string> = {
  STABILIZATION: 'un momento de calma y orden en mis pensamientos',
  PROCESSING: 'entender qué estoy sintiendo y por qué',
  CONNECTION: 'sentir que no estoy solo/a con esto',
  PRACTICAL: 'tener más claridad sobre qué hacer',
};

function buildSummary(msgs: string[]): string {
  const last3 = msgs.slice(-3);
  if (last3.length === 0) return 'He estado procesando pensamientos y emociones difíciles.';
  const raw = last3.join(' ').replace(/\s+/g, ' ').trim();
  return raw.length <= 220 ? raw : raw.slice(0, 217) + '...';
}

export function generateDiaryDraft(input: DiaryDraftInput): DiaryDraft {
  const { userMessages, uxStance = 'STABILIZATION', uxIntensity = 2 } = input;

  const emotionLabel = EMOTION_BY_STANCE[uxStance];
  const needLabel = NEED_BY_STANCE[uxStance];
  const summary = buildSummary(userMessages);

  const intensityWord =
    uxIntensity >= 3 ? 'muy intensas' : uxIntensity >= 2 ? 'bastante presentes' : 'presentes';

  const title =
    uxIntensity >= 3
      ? 'Lo que pesó hoy'
      : uxStance === 'PROCESSING'
      ? 'Lo que tengo en la mente'
      : uxStance === 'CONNECTION'
      ? 'Buscando compañía'
      : 'Lo que llevo hoy';

  const lines = [
    `Lo que está pasando: ${summary}`,
    '',
    `Cómo me siento: Me siento ${emotionLabel}. Mis emociones han estado ${intensityWord}.`,
    '',
    `Lo que podría necesitar: ${needLabel}.`,
  ];

  return {
    title,
    content: lines.join('\n'),
    tags: ['Reflexión', 'De la conversación'],
  };
}

export interface RepetitionResult {
  detected: boolean;
  keyword: string;
}

const STOPWORDS = new Set([
  'que', 'con', 'una', 'los', 'las', 'del', 'para', 'por', 'como', 'pero',
  'más', 'este', 'esta', 'esto', 'ese', 'esa', 'sin', 'sus', 'hay', 'son',
  'fue', 'ser', 'han', 'has', 'hace', 'muy', 'bien', 'mal', 'hoy', 'ayer',
  'todo', 'nada', 'algo', 'cuando', 'donde', 'porque', 'desde', 'entre',
  'sobre', 'bajo', 'otro', 'otra', 'mismo', 'misma', 'cómo', 'qué', 'quién',
  'cada', 'pues', 'entonces', 'también', 'aunque', 'nunca', 'siempre',
]);

export function detectTopicRepetition(
  entries: { title: string; tags: string[]; content: string }[],
): RepetitionResult {
  const last7 = entries.slice(0, 7);
  if (last7.length < 3) return { detected: false, keyword: '' };

  const wordEntryCount: Record<string, number> = {};

  for (const entry of last7) {
    const text =
      `${entry.title} ${entry.tags.join(' ')} ${entry.content.slice(0, 120)}`.toLowerCase();
    const words = text.match(/[a-záéíóúüñ]{5,}/gi) ?? [];
    const unique = new Set(words.filter(w => !STOPWORDS.has(w)));
    for (const word of unique) {
      wordEntryCount[word] = (wordEntryCount[word] ?? 0) + 1;
    }
  }

  const repeated = Object.entries(wordEntryCount)
    .filter(([, count]) => count >= 3)
    .sort(([, a], [, b]) => b - a);

  if (repeated.length === 0) return { detected: false, keyword: '' };
  return { detected: true, keyword: repeated[0][0] };
}
