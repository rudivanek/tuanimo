import { useState, useEffect, useRef } from 'react';
import { BookOpen, X, PenLine, Loader2 } from 'lucide-react';

interface DiaryDraftSuggestionProps {
  onCreateDraft: () => Promise<void>;
  onDismiss: () => void;
  reason?: string;
  disabled?: boolean;
  onMounted?: () => void;
}

export function DiaryDraftSuggestion({
  onCreateDraft,
  onDismiss,
  reason,
  disabled = false,
  onMounted,
}: DiaryDraftSuggestionProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [shimmerDone, setShimmerDone] = useState(false);
  const calledOnMounted = useRef(false);

  useEffect(() => {
    if (calledOnMounted.current) return;
    calledOnMounted.current = true;
    onMounted?.();
    const id = window.setTimeout(() => setShimmerDone(true), 1100);
    return () => window.clearTimeout(id);
  }, [onMounted]);

  const isHeavy = reason?.startsWith('heaviness');
  const isRepetition = reason?.startsWith('repetition');

  const label = isHeavy
    ? 'Para darte un poco más de espacio'
    : isRepetition
      ? 'Algo que sigue presente'
      : 'Para seguir pensando';

  const body = isHeavy
    ? 'A veces ayuda escribir esto cuando ya no hay que explicarlo — solo seguir pensando con más calma.'
    : isRepetition
      ? 'Esto sigue apareciendo en la conversación. Escribirlo podría ayudarte a verlo con más claridad.'
      : 'Si quieres, puedes escribir esto con más calma en tu diario. No tiene que estar ordenado.';

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      await onCreateDraft();
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="mt-2.5 animate-diary-entry">
      <div className="rounded-[14px] border border-app-border bg-app-surface px-4 py-3.5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0 relative">
            <span
              className="absolute inset-0 rounded-full bg-sage-strong/20 animate-pulse-ring pointer-events-none"
              aria-hidden="true"
            />
            <div className="w-8 h-8 rounded-full bg-sage-soft flex items-center justify-center relative">
              <BookOpen size={15} className="text-sage-strong" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-app-muted font-medium mb-1">
              {label}
            </p>
            <p className="text-[13.5px] text-app-text leading-snug">
              {body}
            </p>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button
                type="button"
                onClick={handleCreate}
                disabled={isCreating || disabled}
                aria-label="Escribir en el diario con calma"
                className="
                  relative overflow-hidden
                  inline-flex items-center gap-1.5 px-3.5 py-1.5
                  bg-sage-strong text-white text-[12.5px] font-medium
                  rounded-[10px] transition-colors hover:bg-[#4e7260]
                  disabled:opacity-60 disabled:cursor-not-allowed
                "
              >
                {!shimmerDone && !isCreating && (
                  <span
                    className="absolute inset-0 pointer-events-none animate-shimmer-sweep"
                    style={{
                      background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.28) 50%, transparent 70%)',
                    }}
                    aria-hidden="true"
                  />
                )}
                {isCreating ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <PenLine size={13} />
                )}
                <span aria-live="polite">
                  {isCreating ? 'Abriendo…' : 'Escribirlo con calma'}
                </span>
              </button>
              {disabled && !isCreating && (
                <span className="text-[11.5px] text-app-muted">Disponible en un momento…</span>
              )}
              <button
                type="button"
                onClick={onDismiss}
                disabled={isCreating}
                className="
                  inline-flex items-center gap-1 px-3 py-1.5
                  text-app-muted text-[12.5px]
                  rounded-[10px] transition-colors hover:bg-app-surface-2
                  disabled:opacity-40
                "
              >
                Ahora no
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            disabled={isCreating}
            className="flex-shrink-0 p-1 text-app-muted hover:text-app-text hover:bg-app-surface-2 rounded-lg transition-colors"
            aria-label="Cerrar sugerencia"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
