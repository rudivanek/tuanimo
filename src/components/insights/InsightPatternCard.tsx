import { Activity, MessageCircle, BookOpen, X } from 'lucide-react';
import type { InsightPattern, InsightPatternType } from '../../lib/insightPatterns';

type InsightPatternCardProps = {
  pattern: InsightPattern;
  onAction?: () => void;
  actionLabel?: string;
  onDismiss?: () => void;
  isNew?: boolean;
  sourceLabel?: string;
};

const SUPPORTING_LINE: Record<InsightPatternType, string> = {
  stress_rising: 'Tu nivel de estrés parece haber subido esta semana.',
  anxiety_rising: 'Se nota más tensión o preocupación que la semana pasada.',
  recovery: 'Hay señales de que algo está mejorando poco a poco.',
  gratitude_streak: 'Has tenido varios momentos de gratitud recientemente.',
  positive_momentum: 'Tu ánimo muestra una tendencia positiva.',
};

const DRAFT_TYPES: InsightPatternType[] = ['recovery', 'gratitude_streak'];

function patternConfidence(pattern: InsightPattern): 'Alta' | 'Media' {
  switch (pattern.type) {
    case 'stress_rising':
    case 'anxiety_rising':
      return pattern.strength >= 5 ? 'Alta' : 'Media';
    case 'gratitude_streak':
      return pattern.strength >= 6 ? 'Alta' : 'Media';
    case 'positive_momentum':
      return pattern.strength >= 3 ? 'Alta' : 'Media';
    case 'recovery':
      return 'Media';
    default:
      return 'Media';
  }
}

export default function InsightPatternCard({ pattern, onAction, actionLabel, onDismiss, isNew, sourceLabel }: InsightPatternCardProps) {
  const isDraft = DRAFT_TYPES.includes(pattern.type);

  return (
    <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold text-app-text flex items-center gap-2">
          <Activity size={16} className="text-sage" />
          Patrón detectado
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-app-bg text-app-muted border border-app-border">
            {patternConfidence(pattern)}
          </span>
          {isNew && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Nuevo
            </span>
          )}
          {sourceLabel && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-app-bg text-app-muted border border-app-border">
              {sourceLabel}
            </span>
          )}
        </h2>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-app-muted/50 hover:text-app-muted transition-colors p-0.5 rounded"
            aria-label="Ocultar hoy"
            title="Ocultar hoy"
          >
            <X size={13} />
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-app-muted uppercase tracking-wide">
          {pattern.label}
        </p>
        <p className="text-sm text-app-text leading-relaxed">
          {SUPPORTING_LINE[pattern.type]}
        </p>
      </div>

      {onAction && actionLabel && (
        <div className="mt-4">
          <button
            onClick={onAction}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-sage-soft border border-sage text-sage-strong text-[12px] font-medium rounded-full hover:bg-sage hover:text-white transition-colors"
          >
            {isDraft ? <BookOpen size={12} /> : <MessageCircle size={12} />}
            {actionLabel}
          </button>
        </div>
      )}

      <p className="text-[11px] text-app-muted/70 mt-3">
        Basado en tus últimas 2 semanas
      </p>
    </div>
  );
}
