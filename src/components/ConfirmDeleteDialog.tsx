/**
 * ConfirmDeleteDialog.tsx
 *
 * Reusable Yes/No confirmation modal with a warning, matching the app's
 * DeleteAccountDialog style. Replaces native window.confirm() for deleting
 * chat threads and journal entries.
 */

import { AlertTriangle, Trash2, RefreshCw } from 'lucide-react';

export function ConfirmDeleteDialog({
  title,
  message,
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  loading = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-app-surface rounded-[18px] shadow-app border border-app-border w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={16} className="text-danger" />
          </div>
          <h2 className="text-[16px] font-semibold text-app-text">{title}</h2>
        </div>

        <p className="text-sm text-app-muted leading-relaxed mb-5">{message}</p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-12 border border-app-border text-app-text text-sm font-medium hover:bg-app-bg transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-12 bg-danger text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading
              ? <><RefreshCw size={13} className="animate-spin" /> Eliminando…</>
              : <><Trash2 size={13} /> {confirmLabel}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
