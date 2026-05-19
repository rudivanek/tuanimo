import { AlertCircle, X } from 'lucide-react';

interface CrisisResourceModalProps {
  onClose: () => void;
}

export function CrisisResourceModal({ onClose }: CrisisResourceModalProps) {
  return (
    <div className="fixed inset-0 bg-app-text/40 backdrop-blur-sm flex items-center justify-center z-50 p-5">
      <div className="bg-app-surface rounded-[18px] shadow-app max-w-sm w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-red-50 rounded-full flex items-center justify-center">
              <AlertCircle className="text-danger" size={18} />
            </div>
            <h3 className="text-[16px] font-semibold text-app-text">Ayuda en México</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-app-surface-2 rounded-xl transition-colors text-app-muted"
          >
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-app-muted mb-4">
          Si estás pasando por una crisis o necesitas apoyo profesional inmediato:
        </p>
        <div className="bg-sage-soft rounded-14 p-4 space-y-4">
          <div>
            <div className="text-sm font-semibold text-app-text">SAPTEL</div>
            <a href="tel:5552598121" className="text-sage-strong hover:underline text-lg font-medium">
              55 5259-8121
            </a>
            <p className="text-xs text-app-muted">Línea de intervención en crisis 24/7</p>
          </div>
          <div className="border-t border-sage-soft pt-4">
            <div className="text-sm font-semibold text-app-text">Línea de la Vida</div>
            <a href="tel:8009112000" className="text-sage-strong hover:underline text-lg font-medium">
              800 911 2000
            </a>
            <p className="text-xs text-app-muted">Atención psicológica gratuita 24/7</p>
          </div>
        </div>
        <p className="text-xs text-app-muted mt-3">
          Estos servicios son confidenciales y están atendidos por profesionales capacitados.
        </p>
        <button
          onClick={onClose}
          className="mt-4 w-full bg-sage-strong text-white rounded-12 px-4 py-2.5 hover:bg-[#4e7260] transition-colors text-sm font-medium"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
