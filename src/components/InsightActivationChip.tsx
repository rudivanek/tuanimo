import { Sparkles, X } from 'lucide-react';

interface Props {
  onView: () => void;
  onDismiss: () => void;
}

export function InsightActivationChip({ onView, onDismiss }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-sage-soft border-b border-sage/30 flex-shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <Sparkles size={13} className="text-sage-strong flex-shrink-0" />
        <span className="text-[12.5px] text-sage-strong font-medium leading-snug">
          Elena está empezando a ver patrones en lo que escribes.
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onView}
          className="text-[12px] font-semibold text-sage-strong hover:text-[#4e7260] transition-colors px-2 py-1 rounded-8 hover:bg-app-surface whitespace-nowrap"
        >
          Ver lo que encontró Elena
        </button>
        <button
          onClick={onDismiss}
          className="text-sage-strong/60 hover:text-sage-strong transition-colors"
          aria-label="Cerrar"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
