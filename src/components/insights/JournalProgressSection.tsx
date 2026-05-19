import { BookOpen, MessageSquare, PenLine, Tag, Lightbulb } from 'lucide-react';
import type { JournalProgress } from '../../lib/journalProgress';

interface Props {
  progress: JournalProgress | null;
  isLoading: boolean;
}

function triggerLabel(key: string): string {
  if (key.startsWith('heaviness')) return 'Bajar la intensidad';
  if (key.startsWith('repetition')) return 'Aclarar un tema repetido';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function Skeleton() {
  return (
    <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5 animate-pulse">
      <div className="h-4 w-36 bg-app-surface-2 rounded mb-4" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-app-bg rounded-14 border border-app-border p-4 space-y-2">
          <div className="h-3 w-24 bg-app-surface-2 rounded" />
          <div className="h-5 w-16 bg-app-surface-2 rounded" />
        </div>
        <div className="bg-app-bg rounded-14 border border-app-border p-4 space-y-2">
          <div className="h-3 w-24 bg-app-surface-2 rounded" />
          <div className="h-5 w-16 bg-app-surface-2 rounded" />
        </div>
      </div>
    </div>
  );
}

export function JournalProgressSection({ progress, isLoading }: Props) {
  if (isLoading) return <Skeleton />;

  if (!progress || progress.saved30d === 0) {
    return (
      <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5">
        <h2 className="text-[15px] font-semibold text-app-text mb-3 flex items-center gap-2">
          <BookOpen size={17} className="text-sage" />
          Progreso de diario
        </h2>
        <p className="text-sm text-app-muted leading-relaxed">
          Guarda algunas entradas en tu diario para ver los patrones aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5">
      <h2 className="text-[15px] font-semibold text-app-text mb-4 flex items-center gap-2">
        <BookOpen size={17} className="text-sage" />
        Progreso de diario
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div className="bg-app-bg rounded-14 border border-app-border px-4 py-3">
          <p className="text-[10px] font-semibold text-sage-strong uppercase tracking-wider mb-2">
            Reflexiones guardadas
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-app-muted">Últimos 7 días</span>
              <span className="text-[13px] font-semibold text-app-text">{progress.saved7d}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-app-muted">Últimos 30 días</span>
              <span className="text-[13px] font-semibold text-app-text">{progress.saved30d}</span>
            </div>
          </div>
        </div>

        <div className="bg-app-bg rounded-14 border border-app-border px-4 py-3">
          <p className="text-[10px] font-semibold text-sage-strong uppercase tracking-wider mb-2">
            Origen
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[12px] text-app-muted">
                <MessageSquare size={11} className="text-sage flex-shrink-0" />
                Desde chat
              </span>
              <span className="text-[13px] font-semibold text-app-text">{progress.originChat30d}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[12px] text-app-muted">
                <PenLine size={11} className="text-sage flex-shrink-0" />
                Manuales
              </span>
              <span className="text-[13px] font-semibold text-app-text">{progress.originManual30d}</span>
            </div>
          </div>
        </div>
      </div>

      {progress.topTrigger30d && (
        <div className="flex items-start gap-2.5 bg-app-bg rounded-14 border border-app-border px-3 py-3 mb-3">
          <Lightbulb size={14} className="text-sage-strong mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[10px] font-semibold text-sage-strong uppercase tracking-wider mb-0.5">
              Motivo más frecuente
            </p>
            <p className="text-[13px] text-app-text leading-snug">
              {triggerLabel(progress.topTrigger30d.key)}
              <span className="text-app-muted ml-1.5 text-[11px]">
                ({progress.topTrigger30d.count}{' '}
                {progress.topTrigger30d.count === 1 ? 'vez' : 'veces'})
              </span>
            </p>
          </div>
        </div>
      )}

      {progress.topThemes30d.length > 0 ? (
        <div>
          <p className="text-[10px] font-semibold text-sage-strong uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Tag size={10} />
            Temas más frecuentes
          </p>
          <div className="flex flex-wrap gap-2">
            {progress.topThemes30d.map(theme => (
              <span
                key={theme.key}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-sage-soft rounded-full text-[12px] font-medium text-sage-strong"
              >
                {theme.key}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-[12px] text-app-muted">
          Aún no hay temas — guarda más entradas para ver patrones.
        </p>
      )}

      {progress.avgEmotionScore30d !== null && (
        <p className="text-[11px] text-app-muted mt-3 pt-3 border-t border-app-border">
          Puntuación emocional promedio (30d):{' '}
          <span className="font-semibold text-app-text">{progress.avgEmotionScore30d.toFixed(1)}</span>
        </p>
      )}
    </div>
  );
}
