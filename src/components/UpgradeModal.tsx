import { X, Check, Zap } from 'lucide-react';
import { useJournalStorage } from '../hooks/useJournalStorage';

interface UpgradeModalProps {
  onClose: () => void;
}

const PLANS = [
  {
    key: 'starter',
    label: 'Starter',
    storage: '50 MB',
    features: ['Diario personal', 'Chat con IA', 'Insights de estado de ánimo'],
    price: 'Gratis',
    highlight: false,
  },
  {
    key: 'pro',
    label: 'Pro',
    storage: '250 MB',
    features: ['Todo en Starter', 'Mayor almacenamiento de diario', 'Historial extendido'],
    price: 'Próximamente',
    highlight: true,
  },
  {
    key: 'power',
    label: 'Power',
    storage: '1 GB',
    features: ['Todo en Pro', 'Almacenamiento máximo', 'Prioridad en el servicio'],
    price: 'Próximamente',
    highlight: false,
  },
] as const;

export function UpgradeModal({ onClose }: UpgradeModalProps) {
  const { planKey } = useJournalStorage();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      <div
        className="relative z-10 w-full sm:max-w-lg bg-app-surface rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-app-border">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-sage-soft rounded-lg">
              <Zap size={16} className="text-sage-strong" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-app-text">Mejora tu plan</h2>
              <p className="text-xs text-app-muted mt-0.5">Más almacenamiento para tu diario</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-app-surface-2 text-app-muted hover:text-app-text transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 grid grid-cols-3 gap-3">
          {PLANS.map((plan) => {
            const isCurrent = planKey === plan.key;
            return (
              <div
                key={plan.key}
                className={`relative rounded-xl border p-3.5 flex flex-col gap-2 transition-all
                  ${plan.highlight
                    ? 'border-sage-strong/50 bg-sage-soft/20 ring-1 ring-sage-strong/20'
                    : 'border-app-border bg-app-bg'
                  }
                  ${isCurrent ? 'opacity-60' : ''}
                `}
              >
                {plan.highlight && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white bg-sage-strong px-2.5 py-0.5 rounded-full whitespace-nowrap">
                    Popular
                  </span>
                )}

                <div>
                  <p className="text-xs font-semibold text-app-text">{plan.label}</p>
                  <p className="text-[11px] text-app-muted mt-0.5">{plan.storage} diario</p>
                </div>

                <ul className="flex flex-col gap-1.5 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <Check size={10} className="text-sage-strong mt-0.5 flex-shrink-0" />
                      <span className="text-[10px] text-app-muted leading-tight">{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-1">
                  {isCurrent ? (
                    <span className="block text-center text-[10px] font-semibold text-sage-strong bg-sage-soft rounded-lg py-1.5">
                      Plan actual
                    </span>
                  ) : plan.price === 'Gratis' ? (
                    <span className="block text-center text-[10px] text-app-muted">
                      Gratis
                    </span>
                  ) : (
                    <span className="block text-center text-[10px] font-medium text-app-muted bg-app-surface-2 rounded-lg py-1.5">
                      Próximamente
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 pb-5">
          <p className="text-[11px] text-app-muted text-center leading-relaxed">
            Los planes de pago estarán disponibles pronto. Mientras tanto, libera espacio eliminando entradas antiguas.
          </p>
        </div>
      </div>
    </div>
  );
}
