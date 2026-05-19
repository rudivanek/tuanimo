import { useEffect } from 'react';
import { X, MessageSquare, PenLine, Lightbulb, Tag } from 'lucide-react';
import type { JournalProgress } from '../lib/journalProgress';

interface JournalProgressDetailsModalProps {
  open: boolean;
  onClose: () => void;
  progress: JournalProgress;
  onThemeClick?: (theme: string) => void;
}

function triggerLabelFull(key: string): string {
  if (key.startsWith('heaviness')) return 'Bajar la intensidad';
  if (key.startsWith('repetition')) return 'Aclarar un tema repetido';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function JournalProgressDetailsModal({
  open,
  onClose,
  progress,
  onThemeClick,
}: JournalProgressDetailsModalProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ paddingBottom: 'var(--nav-total)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Detalles de progreso"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg mx-auto bg-app-surface rounded-t-[20px] shadow-app flex flex-col max-h-[85dvh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-app-border flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-app-border absolute top-3 left-1/2 -translate-x-1/2" />
          <h2 className="text-[15px] font-semibold text-app-text mt-1">Tu progreso</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-app-surface-2 text-app-muted hover:text-app-text transition-colors mt-1"
          >
            <X size={14} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          <section>
            <p className="text-[10px] font-semibold text-sage-strong uppercase tracking-wider mb-2.5">
              En los últimos 30 días
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 border-b border-app-border last:border-0">
                <span className="text-[13px] text-app-muted">Reflexiones guardadas</span>
                <span className="text-[13px] font-semibold text-app-text">{progress.saved30d}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-app-border last:border-0">
                <span className="flex items-center gap-2 text-[13px] text-app-muted">
                  <MessageSquare size={13} className="text-sage flex-shrink-0" />
                  Desde chat
                </span>
                <span className="text-[13px] font-semibold text-app-text">{progress.originChat30d}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="flex items-center gap-2 text-[13px] text-app-muted">
                  <PenLine size={13} className="text-sage flex-shrink-0" />
                  Escritas manualmente
                </span>
                <span className="text-[13px] font-semibold text-app-text">{progress.originManual30d}</span>
              </div>
            </div>
          </section>

          <section>
            <p className="text-[10px] font-semibold text-sage-strong uppercase tracking-wider mb-2.5">
              Motivo más común
            </p>
            <div className="flex items-start gap-2.5 bg-app-surface-2 rounded-12 px-3 py-3">
              <Lightbulb size={14} className="text-sage-strong mt-0.5 flex-shrink-0" />
              {progress.topTrigger30d ? (
                <p className="text-[13px] text-app-text leading-snug">
                  {triggerLabelFull(progress.topTrigger30d.key)}
                  <span className="text-app-muted ml-1.5 text-[12px]">
                    ({progress.topTrigger30d.count}{' '}
                    {progress.topTrigger30d.count === 1 ? 'vez' : 'veces'})
                  </span>
                </p>
              ) : (
                <p className="text-[13px] text-app-muted leading-snug">
                  Aún no hay un patrón claro
                </p>
              )}
            </div>
          </section>

          <section>
            <p className="text-[10px] font-semibold text-sage-strong uppercase tracking-wider mb-2.5">
              Temas más frecuentes
            </p>
            {progress.topThemes30d.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {progress.topThemes30d.map(theme => (
                  <button
                    key={theme.key}
                    type="button"
                    onClick={() => onThemeClick?.(theme.key)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sage-soft rounded-full text-[12px] font-medium text-sage-strong hover:bg-sage-strong hover:text-white transition-colors cursor-pointer"
                  >
                    <Tag size={10} />
                    {theme.key}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-app-muted leading-snug">
                Aún no hay temas suficientes para resumir
              </p>
            )}
          </section>
        </div>

        <div className="px-5 py-4 border-t border-app-border flex-shrink-0">
          <p className="text-[11px] text-app-muted text-center leading-relaxed">
            Esto es solo una guía. Tú llevas el ritmo.
          </p>
        </div>
      </div>
    </div>
  );
}
