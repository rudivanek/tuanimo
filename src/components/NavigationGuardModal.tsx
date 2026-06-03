/**
 * NavigationGuardModal
 *
 * Shown when the user tries to navigate away from a page with unsaved work.
 * Context-aware: passes `context` so the copy fits both journal and chat.
 */

import { X } from 'lucide-react';

interface NavigationGuardModalProps {
  context: 'journal' | 'chat';
  onConfirm: () => void;
  onCancel: () => void;
}

export function NavigationGuardModal({ context, onConfirm, onCancel }: NavigationGuardModalProps) {
  const isJournal = context === 'journal';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
      onClick={onCancel}
    >
      <div
        className="bg-app-surface rounded-2xl shadow-xl border border-app-border w-full max-w-sm p-6 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[15px] font-semibold text-app-text">
              {isJournal ? '¿Salir sin guardar?' : '¿Salir con texto sin enviar?'}
            </p>
            <p className="text-[13px] text-app-muted mt-1 leading-snug">
              {isJournal
                ? 'Lo que escribiste se guardó como borrador automáticamente. Puedes retomarlo en cualquier momento desde la pestaña Borradores.'
                : 'Tienes texto escrito que aún no enviaste a Elena. Si sales ahora, se perderá.'}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="flex-shrink-0 p-1 rounded-lg text-app-muted hover:text-app-text transition-colors"
            aria-label="Cancelar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-app-border text-[13px] font-medium text-app-text hover:bg-app-surface-2 transition-colors"
          >
            {isJournal ? 'Seguir escribiendo' : 'Volver al chat'}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl bg-app-surface-2 border border-app-border text-[13px] font-medium text-app-muted hover:text-app-text transition-colors"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}
