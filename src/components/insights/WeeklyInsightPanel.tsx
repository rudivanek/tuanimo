import { useState } from 'react';
import { useLocation } from 'wouter';
import { Sparkles, AlertCircle, Copy, Check, ChevronDown, BookMarked, ExternalLink, MessageCircle } from 'lucide-react';
import { trackEvent } from '../../lib/analytics';
import { sanitizeInsightText } from '../../lib/insightUtils';
import type { WeeklyInsightSummary } from '../../lib/insightWeekly';
import type { MultiWeekTrend } from '../../lib/insightTrends';

const TREND_STRONG_DELTA = 3;

const TREND_LINES: Record<string, Record<'rising' | 'falling', { sustained: string; clear: string }>> = {
  stress: {
    rising:  { sustained: 'Algo pesado ha estado presente durante varias semanas — no es un episodio aislado.',
               clear:     'La tensión parece haber ido creciendo en las últimas semanas.' },
    falling: { sustained: 'Lo que estuvo pesado parece ir cediendo poco a poco.',
               clear:     'Hay menos peso que en semanas anteriores.' },
  },
  anxiety: {
    rising:  { sustained: 'La inquietud lleva varias semanas presente — algo sigue sin resolverse.',
               clear:     'La inquietud parece haber aumentado en semanas recientes.' },
    falling: { sustained: 'Lo que generaba inquietud parece estar perdiendo fuerza semana a semana.',
               clear:     'Hay menos tensión que en semanas anteriores.' },
  },
  positive: {
    rising:  { sustained: 'Algo está funcionando — la energía positiva ha ido creciendo semana a semana.',
               clear:     'Hay más ligereza en las últimas semanas que antes.' },
    falling: { sustained: 'Los momentos de ligereza han ido haciéndose menos frecuentes con el tiempo.',
               clear:     'Hay menos energía positiva que en semanas anteriores.' },
  },
  gratitude: {
    rising:  { sustained: 'La gratitud ha aparecido con más frecuencia a lo largo de varias semanas.',
               clear:     'La gratitud parece estar ganando más presencia recientemente.' },
    falling: { sustained: 'La gratitud ha aparecido menos — algo puede estar nublando la vista.',
               clear:     'La gratitud se ha vuelto algo más escasa en las últimas semanas.' },
  },
};

function getStrongTrendLine(trend: MultiWeekTrend | null | undefined): string | null {
  if (!trend || trend.weeksWithData < 2 || trend.trends.length === 0) return null;

  const qualifying = trend.trends.filter(
    (t) => t.direction !== 'stable' && (Math.abs(t.delta) >= TREND_STRONG_DELTA || t.sustained)
  );
  if (qualifying.length === 0) return null;

  const best = qualifying.reduce((a, b) =>
    (b.sustained && !a.sustained) || (!b.sustained && !a.sustained && Math.abs(b.delta) > Math.abs(a.delta)) ? b : a
  );

  const dir = best.direction as 'rising' | 'falling';
  const entry = TREND_LINES[best.signal]?.[dir];
  if (!entry) return null;

  return best.sustained ? entry.sustained : entry.clear;
}

interface WeeklyInsight {
  week_start_date: string;
  insight_text: string;
  created_at: string;
}

interface Props {
  latestInsight: WeeklyInsight | null;
  isGenerating: boolean;
  error?: string | null;
  highlight?: boolean;
  weekLogCount: number;
  weekLabel: string;
  hasHistory?: boolean;
  onJumpToHistory?: () => void;
  onSaveToJournal: (title: string, content: string) => Promise<string>;
  chatWeekly?: WeeklyInsightSummary | null;
  sourceLabel?: string;
  currentWeekStart?: string;
  onGenerate?: () => void;
  multiWeekTrend?: MultiWeekTrend | null;
}

interface ParsedInsight {
  mainText: string;
  comparison: string;
  microStep: string;
}

function parseInsightSections(raw: string): ParsedInsight {
  let mainText = raw;
  let comparison = '';
  let microStep = '';
  let usedDelimiters = false;

  const compMatch = mainText.match(/\[\[COMPARISON\]\]([\s\S]*?)\[\[\/COMPARISON\]\]/);
  if (compMatch) {
    comparison = compMatch[1].trim();
    mainText = mainText.replace(compMatch[0], '');
    usedDelimiters = true;
  }

  const microMatch = mainText.match(/\[\[MICRO_STEP\]\]([\s\S]*?)\[\[\/MICRO_STEP\]\]/);
  if (microMatch) {
    microStep = microMatch[1].trim();
    mainText = mainText.replace(microMatch[0], '');
    usedDelimiters = true;
  }

  if (usedDelimiters) {
    return { mainText: mainText.trim(), comparison, microStep };
  }

  const COMPARISON_MARKER = '\n\nComparación:\n';
  const MICRO_STEP_MARKER = '\n\nPaso pequeño:\n';

  const microIdx = mainText.indexOf(MICRO_STEP_MARKER);
  if (microIdx !== -1) {
    microStep = mainText.slice(microIdx + MICRO_STEP_MARKER.length).trim();
    mainText = mainText.slice(0, microIdx);
  }

  const compIdx = mainText.indexOf(COMPARISON_MARKER);
  if (compIdx !== -1) {
    comparison = mainText.slice(compIdx + COMPARISON_MARKER.length).trim();
    mainText = mainText.slice(0, compIdx);
  }

  return { mainText: mainText.trim(), comparison, microStep };
}

export function WeeklyInsightPanel({
  latestInsight,
  isGenerating,
  error,
  highlight,
  weekLogCount,
  weekLabel,
  hasHistory,
  onJumpToHistory,
  onSaveToJournal,
  sourceLabel,
  currentWeekStart,
  onGenerate,
  multiWeekTrend,
}: Props) {
  const [, setLocation] = useLocation();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);

  const isCurrentWeek = !!(
    latestInsight &&
    currentWeekStart &&
    latestInsight.week_start_date === currentWeekStart
  );
  const isStale = !!(latestInsight && currentWeekStart && !isCurrentWeek);

  const handleCopy = async () => {
    if (!latestInsight) return;
    try {
      await navigator.clipboard.writeText(sanitizeInsightText(latestInsight.insight_text));
      setCopied(true);
      setCopyError(false);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopyError(true);
      setTimeout(() => setCopyError(false), 2000);
    }
  };

  const trendLine = getStrongTrendLine(multiWeekTrend);

  const parsed = latestInsight ? parseInsightSections(latestInsight.insight_text) : null;
  const sanitized = parsed ? {
    mainText:   sanitizeInsightText(parsed.mainText),
    comparison: sanitizeInsightText(parsed.comparison),
    microStep:  sanitizeInsightText(parsed.microStep),
  } : null;

  const handleSaveToJournal = async () => {
    if (!latestInsight || !sanitized) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const title = `Reflexión semanal — ${weekLabel}`;
      let body = sanitized.mainText;
      if (sanitized.comparison) body += `\n\n${sanitized.comparison}`;
      if (sanitized.microStep)  body += `\n\n${sanitized.microStep}`;
      const entryId = await onSaveToJournal(title, body);
      setSavedEntryId(entryId);
      setSaveOk(true);
      const weekEnd = new Date(latestInsight.week_start_date);
      weekEnd.setDate(weekEnd.getDate() + 6);
      trackEvent('insights_save_to_journal_success', {
        entry_id:        entryId,
        week_start_local: latestInsight.week_start_date,
        week_end_local:  weekEnd.toISOString().split('T')[0],
        week_log_count:  weekLogCount,
        source: 'insights',
        ui: 'WeeklyInsightPanel',
      });
      setTimeout(() => setSaveOk(false), 4000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar en el diario.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenInChat = () => {
    if (!sanitized?.microStep) return;
    setLocation(`/chat?prefill=${encodeURIComponent(sanitized.microStep)}`);
  };

  return (
    <div
      className="bg-app-surface rounded-[16px] shadow-app border transition-all duration-300 p-5"
      style={{
        borderColor: highlight ? '#7FA88C' : undefined,
        boxShadow:   highlight ? '0 0 0 3px var(--focus)' : undefined,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold text-app-text flex items-center gap-2">
          <Sparkles size={16} className="text-sage" />
          Reflexión semanal de Elena
        </h2>

        <div className="flex items-center gap-2">
          {latestInsight && !isGenerating && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-app-muted hover:text-app-text transition-colors px-2 py-1 rounded-8 hover:bg-app-surface-2"
            >
              {copied ? (
                <><Check size={12} className="text-sage-strong" /><span className="text-sage-strong">Copiado</span></>
              ) : copyError ? (
                <span className="text-red-500">Error</span>
              ) : (
                <><Copy size={12} /><span>Copiar</span></>
              )}
            </button>
          )}

          {hasHistory && onJumpToHistory && (
            <button
              onClick={onJumpToHistory}
              className="flex items-center gap-1 text-xs text-app-muted hover:text-app-text transition-colors px-2 py-1 rounded-8 hover:bg-app-surface-2"
            >
              <ChevronDown size={12} />
              <span>Semanas anteriores</span>
            </button>
          )}
        </div>
      </div>

      {/* Subtitle */}
      <p className="text-[11px] text-app-muted mb-3 -mt-1">
        {weekLogCount === 0 && sourceLabel === 'Chats'
          ? 'Basado en tus conversaciones de esta semana'
          : <>
              Basado en {weekLogCount} día{weekLogCount !== 1 ? 's' : ''} de esta semana
              {weekLogCount < 2 && <span className="text-app-muted/60 ml-1">(pocos datos)</span>}
            </>
        }
      </p>

      {/* Generating skeleton */}
      {isGenerating && (
        <div className="space-y-2.5">
          <p className="text-sm text-app-muted">Elena está reflexionando sobre tu semana…</p>
          <div className="space-y-2">
            <div className="h-3 bg-app-border rounded-full animate-pulse w-full" />
            <div className="h-3 bg-app-border rounded-full animate-pulse w-5/6" />
            <div className="h-3 bg-app-border rounded-full animate-pulse w-4/6" />
          </div>
        </div>
      )}

      {/* Error */}
      {!isGenerating && error && (
        <div className="flex items-start gap-2.5 p-3 bg-red-50 rounded-14 border border-red-200">
          <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Stale week banner */}
      {isStale && !isGenerating && onGenerate && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 mb-3 bg-amber-50 rounded-[10px] border border-amber-200">
          <p className="text-xs text-amber-700">Esta semana aún no tiene reflexión generada</p>
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className="flex items-center gap-1 text-xs font-medium text-amber-800 hover:text-amber-900 transition-colors flex-shrink-0 disabled:opacity-40"
          >
            <Sparkles size={11} />
            Generar ahora
          </button>
        </div>
      )}

      {/* Insight content */}
      {!isGenerating && !error && latestInsight && sanitized && (
        <div className="p-4 bg-sage-soft rounded-14 border border-sage-soft space-y-3">
          <div className="text-xs text-sage-strong font-medium">
            Semana del{' '}
            {new Date(latestInsight.week_start_date).toLocaleDateString('es', {
              month: 'long', day: 'numeric', year: 'numeric',
            })}
          </div>

          {/* Main insight text */}
          <p className="text-sm text-app-text leading-relaxed">{sanitized.mainText}</p>

          {/* Comparison — flows as plain text, no box */}
          {sanitized.comparison && (
            <p className="text-[13px] text-app-muted leading-relaxed">{sanitized.comparison}</p>
          )}

          {/* Multi-week trend context */}
          {trendLine && (
            <p className="text-[11px] text-app-muted/70 italic leading-relaxed">{trendLine}</p>
          )}

          {/* Micro-step — Elena's existential question, styled as her voice */}
          {sanitized.microStep && (
            <div className="pt-1 border-t border-sage/20">
              <p className="text-[13px] text-sage-strong italic leading-relaxed">
                {sanitized.microStep}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="pt-1 flex flex-wrap items-center gap-2">
            {sanitized.microStep && (
              <button
                onClick={handleOpenInChat}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-sage-strong hover:text-[#4e7260] transition-colors px-2.5 py-1.5 rounded-8 hover:bg-app-surface"
              >
                <MessageCircle size={13} />
                Explorar con Elena
              </button>
            )}

            {!saveOk ? (
              <button
                onClick={handleSaveToJournal}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 text-xs text-app-muted hover:text-app-text font-medium transition-colors px-2.5 py-1.5 rounded-8 hover:bg-app-surface disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <BookMarked size={13} />
                {isSaving ? 'Guardando...' : 'Guardar en diario'}
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-xs text-sage-strong font-medium">
                  <Check size={13} />
                  Guardado
                </span>
                <button
                  onClick={() => {
                    if (savedEntryId) {
                      trackEvent('insights_open_saved_entry_clicked', {
                        entry_id: savedEntryId,
                        source: 'insights',
                        ui: 'WeeklyInsightPanel',
                      });
                      setLocation(`/journal?entryId=${encodeURIComponent(savedEntryId)}&source=insights`);
                    } else {
                      setLocation('/journal');
                    }
                  }}
                  className="flex items-center gap-1 text-xs text-app-muted hover:text-app-text transition-colors"
                >
                  <ExternalLink size={12} />
                  Ver en diario
                </button>
              </div>
            )}

            {saveError && (
              <p className="text-xs text-red-600">{saveError}</p>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isGenerating && !error && !latestInsight && (
        <div className="space-y-3">
          <p className="text-sm text-app-muted leading-relaxed">
            Con unos días de conversación o diario, Elena puede ofrecerte una reflexión sobre qué patrones están emergiendo en tu semana — no un resumen de ánimo, sino algo más parecido a un espejo.
          </p>
          {onGenerate && (
            <button
              onClick={onGenerate}
              className="flex items-center gap-1.5 text-sm font-medium text-sage-strong hover:text-[#4e7260] transition-colors"
            >
              <Sparkles size={14} />
              Generar reflexión de esta semana
            </button>
          )}
        </div>
      )}
    </div>
  );
}
