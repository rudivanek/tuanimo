import { useEffect, useState } from 'react';
import { X, BookOpen, Loader2, AlertCircle } from 'lucide-react';

interface ConvertToJournalModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function ConvertToJournalModal({
  open,
  onClose,
  onConfirm,
}: ConvertToJournalModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setIsLoading(false);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, isLoading, onClose]);

  const handleConfirm = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo crear el borrador. Inténtalo de nuevo.',
      );
      setIsLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Convertir conversación a entrada de diario"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={!isLoading ? onClose : undefined}
      />

      <div className="relative w-full max-w-sm bg-app-surface rounded-[20px] shadow-app p-6 flex flex-col gap-4">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full bg-app-surface-2 text-app-muted hover:text-app-text transition-colors disabled:opacity-40"
          aria-label="Cerrar"
        >
          <X size={14} />
        </button>

        <div className="flex items-center gap-3 pr-8">
          <div className="w-10 h-10 rounded-[14px] bg-sage-soft flex items-center justify-center flex-shrink-0">
            <BookOpen size={18} className="text-sage-strong" />
          </div>
          <h2 className="text-[15px] font-semibold text-app-text leading-snug">
            Crear entrada de diario desde esta conversación
          </h2>
        </div>

        <p className="text-[13px] text-app-muted leading-relaxed">
          Resumiremos los momentos clave y emociones de tu conversación en un borrador que podrás editar antes de guardar.
        </p>

        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-12">
            <AlertCircle size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-[12.5px] text-red-700 leading-snug">{error}</p>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 bg-sage-soft/50 rounded-12">
            <Loader2 size={14} className="text-sage-strong animate-spin flex-shrink-0" />
            <p className="text-[12.5px] text-sage-strong font-medium">
              Generando tu borrador...
            </p>
          </div>
        )}

        <div className="flex gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-12 border border-app-border text-[13px] font-medium text-app-muted hover:bg-app-surface-2 hover:text-app-text transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-12 bg-sage-strong text-white text-[13px] font-medium hover:bg-[#4e7260] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {isLoading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <BookOpen size={13} />
            )}
            {isLoading ? 'Creando...' : 'Crear borrador'}
          </button>
        </div>
      </div>
    </div>
  );
}
