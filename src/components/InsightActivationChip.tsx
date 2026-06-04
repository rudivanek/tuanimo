import { Sparkles, X } from 'lucide-react';

interface Props {
  onView: () => void;
  onDismiss: () => void;
}

export function InsightActivationChip({ onView, onDismiss }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[#FAEEDA] border-b border-[#EF9F27]/30 flex-shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <Sparkles size={13} className="text-[#854F0B] flex-shrink-0" />
        <span className="text-[12.5px] text-[#854F0B] font-medium leading-snug">
          Elena está empezando a ver patrones en lo que escribes.
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onView}
          className="text-[12px] font-semibold text-[#854F0B] hover:text-[#633806] transition-colors px-2 py-1 rounded-8 hover:bg-app-surface whitespace-nowrap"
        >
          Ver lo que encontró Elena
        </button>
        <button
          onClick={onDismiss}
          className="text-[#854F0B]/60 hover:text-[#854F0B] transition-colors"
          aria-label="Cerrar"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
