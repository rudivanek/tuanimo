import { useEffect, useMemo } from 'react';
import { Brain, Tag, Lightbulb } from 'lucide-react';
import { trackEvent } from '../../lib/analytics';

interface WeeklyInsight {
  week_start_date: string;
  insight_text: string;
  created_at: string;
}

interface Props {
  insights: WeeklyInsight[];
  selectedWeekStart: string;
  onScrollToHistory: () => void;
  chatInsightSignal?: { type: "positive" | "stress" | "anxiety" | "gratitude"; score: number } | null;
}

const STOPWORDS = new Set([
  'para', 'como', 'pero', 'esta', 'este', 'esto', 'esos', 'esas', 'ello',
  'ellos', 'ellas', 'unas', 'unos', 'una', 'uno', 'que', 'con', 'por',
  'más', 'bien', 'algo', 'todo', 'toda', 'todos', 'todas', 'mucho', 'mucha',
  'muchos', 'muchas', 'poco', 'poca', 'pocos', 'pocas', 'cada', 'cual',
  'cuál', 'cómo', 'donde', 'cuando', 'aunque', 'sino', 'sobre',
  'entre', 'hacia', 'hasta', 'desde', 'durante', 'después', 'antes',
  'también', 'además', 'porque', 'pues', 'sido', 'estar', 'tener', 'hacer',
  'puede', 'puedo', 'podría', 'quiero', 'quiere', 'tiene', 'tengo',
  'tienes', 'tienen', 'había', 'habia', 'hubo', 'será', 'seria', 'sería',
  'estoy', 'estás', 'está', 'estamos', 'están', 'días', 'semana', 'semanas',
  'week', 'nivel', 'parte', 'tipo', 'vez', 'veces', 'solo', 'sólo',
  'mismo', 'misma', 'otros', 'otras', 'otro', 'otra', 'muy', 'bastante',
  'siempre', 'nunca', 'mientras', 'cuales', 'cuya', 'cuyo', 'cuyos', 'cuyas',
  'tus', 'mis', 'sus', 'les', 'nos', 'los', 'las', 'del', 'así',
  'aquí', 'ahí', 'allí', 'allá', 'acá', 'hoy', 'ayer', 'mañana', 'ahora',
  'luego', 'pronto', 'tarde', 'noche', 'elena', 'insight', 'ánimo', 'animo',
  'estado',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[¿?¡!.,;:()""«»\-–—\/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(w => w.length >= 4 && !STOPWORDS.has(w));
}

function extractUniqueWords(text: string): Set<string> {
  return new Set(tokenize(text));
}

function extractWordFrequencies(text: string): Map<string, number> {
  const freq = new Map<string, number>();
  for (const word of tokenize(text)) {
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }
  return freq;
}

interface MemoryResult {
  recurringThemes: string[];
  suggestedThemes: string[];
  memoryLine: string;
  insightCount: number;
}

function computeMemory(insights: WeeklyInsight[]): MemoryResult {
  const pool = insights.slice(0, 4);
  const wordInsightCount = new Map<string, number>();

  for (const insight of pool) {
    if (!insight.insight_text) continue;
    const unique = extractUniqueWords(insight.insight_text);
    for (const word of unique) {
      wordInsightCount.set(word, (wordInsightCount.get(word) ?? 0) + 1);
    }
  }

  const recurringThemes = Array.from(wordInsightCount.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word);

  if (recurringThemes.length > 0) {
    return {
      recurringThemes,
      suggestedThemes: [],
      memoryLine: `En las últimas semanas se repite: ${recurringThemes.join(', ')}.`,
      insightCount: pool.length,
    };
  }

  const latestText = pool[0]?.insight_text ?? '';
  const suggestedThemes = latestText
    ? Array.from(extractWordFrequencies(latestText).entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([word]) => word)
    : [];

  return {
    recurringThemes: [],
    suggestedThemes,
    memoryLine: 'Aún no hay un tema claro que se repita — con más semanas aparecerán patrones.',
    insightCount: pool.length,
  };
}

const SIGNAL_TYPE_LABEL: Record<string, string> = {
  stress: 'estrés',
  anxiety: 'ansiedad',
  gratitude: 'gratitud',
  positive: 'positivo',
};

export function InsightMemoryCard({ insights, selectedWeekStart: _selectedWeekStart, onScrollToHistory, chatInsightSignal }: Props) {
  const hasAny = insights.length >= 1;

  const chatSignalWeight = useMemo(() => {
    if (!chatInsightSignal) return 0;
    const { type, score } = chatInsightSignal;
    if (!type || score < 2) return 0;
    if (type === 'stress' || type === 'anxiety') return 2;
    return 1;
  }, [chatInsightSignal]);

  // Stage 3K: gate forced-to-first promotion behind a confidence threshold.
  // Actionable signals (stress/anxiety) promote at normal threshold;
  // soft signals (positive/gratitude) need a much stronger score.
  const allowChatPromotion = useMemo(() => {
    if (!chatInsightSignal) return false;
    const { type, score } = chatInsightSignal;
    if ((type === 'stress' || type === 'anxiety') && score >= 2) return true;
    if ((type === 'positive' || type === 'gratitude') && score >= 4) return true;
    return false;
  }, [chatInsightSignal]);

  const result = useMemo(() => {
    if (!hasAny) return null;
    const base = computeMemory(insights);

    // Stage 3F/3K: chat-derived signal can inject/boost themes; promotion to first is gated.
    if (chatSignalWeight > 0 && chatInsightSignal) {
      const label = SIGNAL_TYPE_LABEL[chatInsightSignal.type] ?? null;
      if (label) {
        const boost = Math.min(chatSignalWeight, 2);
        if (base.recurringThemes.length > 0) {
          const idx = base.recurringThemes.indexOf(label);
          if (idx > 0 && allowChatPromotion) {
            // Promote existing entry to front only when confidence is high
            base.recurringThemes.splice(idx, 1);
            base.recurringThemes.unshift(label);
          } else if (idx === -1 && boost >= 2) {
            // Inject new label; position depends on promotion gate
            if (allowChatPromotion) {
              base.recurringThemes.unshift(label);
            } else {
              base.recurringThemes.push(label);
            }
            if (base.recurringThemes.length > 3) base.recurringThemes.pop();
          }
        } else if (base.suggestedThemes.length > 0) {
          const idx = base.suggestedThemes.indexOf(label);
          if (idx > 0 && allowChatPromotion) {
            // Promote existing entry to front only when confidence is high
            base.suggestedThemes.splice(idx, 1);
            base.suggestedThemes.unshift(label);
          } else if (idx === -1) {
            // Inject new label; position depends on promotion gate
            if (allowChatPromotion) {
              base.suggestedThemes.unshift(label);
            } else {
              base.suggestedThemes.push(label);
            }
            if (base.suggestedThemes.length > 3) base.suggestedThemes.pop();
          }
        }
      }
    }

    return base;
  }, [insights, hasAny, chatInsightSignal, chatSignalWeight, allowChatPromotion]);

  useEffect(() => {
    if (hasAny && result) {
      trackEvent('insights_memory_shown', {
        insight_count: insights.length,
        recurring_count: result.recurringThemes.length,
        suggested_count: result.suggestedThemes.length,
        source: 'InsightMemoryCard',
      });
    }
  }, [hasAny]);

  const handleRecurringChipClick = (theme: string) => {
    trackEvent('insights_memory_theme_clicked', {
      theme,
      kind: 'recurring',
      source: 'InsightMemoryCard',
    });
    onScrollToHistory();
  };

  const handleSuggestedChipClick = (theme: string) => {
    trackEvent('insights_memory_theme_clicked', {
      theme,
      kind: 'suggested',
      source: 'InsightMemoryCard',
    });
    onScrollToHistory();
  };

  return (
    <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5">
      <h2 className="text-[15px] font-semibold text-app-text flex items-center gap-2 mb-3">
        <Brain size={16} className="text-sage" />
        Memoria
      </h2>

      {!hasAny ? (
        <p className="text-sm text-app-muted leading-relaxed">
          Con 2 semanas de uso, Elena podrá mostrar patrones y recordatorios aquí.
        </p>
      ) : result ? (
        <div className="space-y-4">
          {result.recurringThemes.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold text-app-muted uppercase tracking-wide mb-2">
                Lo que se repite
              </p>
              <div className="flex flex-wrap gap-2">
                {result.recurringThemes.map((theme) => (
                  <button
                    key={theme}
                    onClick={() => handleRecurringChipClick(theme)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sage-soft border border-sage text-sage-strong text-xs font-medium rounded-full hover:bg-sage hover:text-white transition-colors"
                  >
                    <Tag size={11} />
                    {theme}
                  </button>
                ))}
              </div>
            </div>
          ) : result.suggestedThemes.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold text-app-muted uppercase tracking-wide mb-2">
                Temas sugeridos
              </p>
              <div className="flex flex-wrap gap-2">
                {result.suggestedThemes.map((theme) => (
                  <button
                    key={theme}
                    onClick={() => handleSuggestedChipClick(theme)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-app-surface-2 border border-app-border text-app-muted text-xs font-medium rounded-full hover:border-sage hover:text-sage-strong transition-colors"
                  >
                    <Lightbulb size={11} />
                    {theme}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-app-muted/70 mt-2">Basado en tu insight más reciente.</p>
            </div>
          ) : null}

          <div>
            <p className="text-[11px] font-semibold text-app-muted uppercase tracking-wide mb-1.5">
              Recordatorio
            </p>
            <p className="text-sm text-app-text leading-relaxed">{result.memoryLine}</p>
          </div>

          <p className="text-[11px] text-app-muted/70">
            Basado en tus últimas {result.insightCount} semana{result.insightCount !== 1 ? 's' : ''} de insights.
          </p>
        </div>
      ) : null}

    </div>
  );
}

