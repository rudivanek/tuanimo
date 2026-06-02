import { CheckSquare, X } from 'lucide-react';

interface PracticasConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function PracticasConfirmModal({ onConfirm, onCancel, loading = false }: PracticasConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-app-text/40 backdrop-blur-sm flex items-center justify-center z-50 p-5">
      <div className="bg-app-surface rounded-[18px] shadow-app max-w-sm w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-sage-soft rounded-full flex items-center justify-center">
              <CheckSquare className="text-sage-strong" size={18} />
            </div>
            <h3 className="text-[16px] font-semibold text-app-text">Nuevas prácticas</h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 hover:bg-app-surface-2 rounded-xl transition-colors text-app-muted"
            disabled={loading}
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-app-muted leading-relaxed mb-6">
          Elena preparará tres prácticas nuevas basadas en lo que hablaron hoy. Las prácticas anteriores serán reemplazadas.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-12 border border-app-border text-sm text-app-muted hover:bg-app-surface-2 transition-colors disabled:opacity-40"
          >
            Ahora no
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-12 bg-sage-strong text-white text-sm font-medium hover:bg-[#4e7260] transition-colors disabled:opacity-40"
          >
            {loading ? 'Un momento...' : 'Sí, nuevas prácticas'}
          </button>
        </div>
      </div>
    </div>
  );
}
