import { HardDrive, AlertTriangle, XCircle, ArrowUpCircle, FolderOpen } from 'lucide-react';
import { useJournalStorage } from '../hooks/useJournalStorage';

interface JournalStorageBannerProps {
  onUpgradeClick: () => void;
  onManageClick: () => void;
}

export function JournalStorageBanner({ onUpgradeClick, onManageClick }: JournalStorageBannerProps) {
  const { used, pct, state, planKey, usedLabel, allowedLabel, isLoaded } = useJournalStorage();

  if (!isLoaded || (used === 0 && state === 'normal')) return null;

  const barColor =
    state === 'critical' ? 'bg-red-500' :
    state === 'warning'  ? 'bg-amber-400' :
    'bg-sage-strong';

  const isAtMax = planKey === 'power';

  if (state === 'normal') {
    return (
      <div className="px-4 pt-2.5 pb-3 border-b border-app-border flex-shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="flex items-center gap-1.5 text-[11px] text-app-muted font-medium">
            <HardDrive size={11} />
            Almacenamiento
          </span>
          <span className="text-[11px] text-app-muted">
            {usedLabel} / {allowedLabel}
          </span>
        </div>
        <div className="h-1 bg-app-surface-2 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  if (state === 'warning') {
    return (
      <div className="px-4 pt-3 pb-3 border-b border-amber-200 bg-amber-50 flex-shrink-0">
        <div className="flex items-start gap-2">
          <AlertTriangle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-800 leading-snug">
              Casi sin espacio
            </p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              {usedLabel} de {allowedLabel} usados ({Math.round(pct)}%)
            </p>
            <div className="mt-2 h-1.5 bg-amber-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-2.5 flex gap-3 flex-wrap">
              {!isAtMax && (
                <button
                  onClick={onUpgradeClick}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 hover:text-amber-900 transition-colors"
                >
                  <ArrowUpCircle size={12} />
                  Mejora tu plan
                </button>
              )}
              <button
                onClick={onManageClick}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 hover:text-amber-900 transition-colors"
              >
                <FolderOpen size={12} />
                Administrar entradas
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-3 pb-3 border-b border-red-200 bg-red-50 flex-shrink-0">
      <div className="flex items-start gap-2">
        <XCircle size={13} className="text-red-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-red-800 leading-snug">
            Sin espacio disponible
          </p>
          <p className="text-[11px] text-red-700 mt-0.5 leading-relaxed">
            {usedLabel} de {allowedLabel} usados. Elimina entradas antiguas para liberar espacio.
          </p>
          <div className="mt-2 h-1.5 bg-red-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: '100%' }} />
          </div>
          <div className="mt-2.5 flex gap-3">
            {!isAtMax ? (
              <button
                onClick={onUpgradeClick}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-red-800 hover:text-red-900 transition-colors"
              >
                <ArrowUpCircle size={12} />
                Mejora tu plan
              </button>
            ) : null}
            <button
              onClick={onManageClick}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-red-800 hover:text-red-900 transition-colors"
            >
              <FolderOpen size={12} />
              Administrar entradas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
