import { Repeat, MessageCircle, BookOpen, X } from 'lucide-react';
import type { InsightPattern, InsightPatternType } from '../../lib/insightPatterns';

type InsightPatternCardProps = {
  pattern: InsightPattern;
  onAction?: () => void;
  actionLabel?: string;
  onDismiss?: () => void;
  isNew?: boolean;
  sourceLabel?: string;
};

// What Elena sees across multiple weeks — existential framing, not mood label
const PATTERN_OBSERVATION: Record<InsightPatternType, string> = {
  stress_rising:
    'Algo pesado lleva más de una semana presente. No es un mal día — es un patrón.',
  anxiety_rising:
    'La inquietud no desapareció con la semana. Algo sigue pidiendo atención.',
  recovery:
    'Hay un cambio de dirección. Lo que antes pesaba parece estar cediendo espacio.',
  gratitude_streak:
    'La gratitud apareció con frecuencia estas semanas. Algo está siendo visto.',
  positive_momentum:
    'Hay movimiento hacia algo. La energía de estas semanas no es casual.',
};

// Existential question for each pattern — opens, doesn't instruct
const PATTERN_INVITATION: Record<InsightPatternType, string> = {
  stress_rising:
    '¿Qué es lo que todavía no has dicho en voz alta sobre esto?',
  anxiety_rising:
    '¿Qué decisión o conversación estás postergando?',
  recovery:
    '¿Qué cambió? ¿Fue algo que hiciste, o algo que dejaste de hacer?',
  gratitude_streak:
    '¿Qué condiciones hicieron posible esta semana que fuera así?',
  positive_momentum:
    '¿Hacia qué te estás moviendo? ¿Lo estás eligiendo conscientemente?',
};

const DRAFT_TYPES: InsightPatternType[] = ['recovery', 'gratitude_streak'];

export default function InsightPatternCard({
  pattern,
  onAction,
  onDismiss,
  isNew,
  sourceLabel,
}: InsightPatternCardProps) {
  const isDraft = DRAFT_TYPES.includes(pattern.type);

  const observation = PATTERN_OBSERVATION[pattern.type];
  const invitation  = PATTERN_INVITATION[pattern.type];

  return (
    <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5">

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold text-app-text flex items-center gap-2">
          <Repeat size={15} className="text-sage" />
          Patrón de varias semanas
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

      {/* Body */}
      <div className="space-y-2">
        <p className="text-sm text-app-text leading-relaxed">{observation}</p>
        <p className="text-[13px] text-sage-strong leading-relaxed italic">{invitation}</p>
      </div>

      {/* CTA */}
      {onAction && (
        <div className="mt-4">
          <button
            onClick={onAction}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-sage-soft border border-sage text-sage-strong text-[12px] font-medium rounded-full hover:bg-sage hover:text-white transition-colors"
          >
            {isDraft ? <BookOpen size={12} /> : <MessageCircle size={12} />}
            {isDraft ? 'Escribir en el diario' : 'Hablar con Elena'}
          </button>
        </div>
      )}

      <p className="text-[11px] text-app-muted/70 mt-3">
        Basado en tus últimas 2 semanas
      </p>
    </div>
  );
}
