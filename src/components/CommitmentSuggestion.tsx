import { Sparkles, Check, X } from 'lucide-react';

interface CommitmentSuggestionProps {
  text: string;
  onAccept: () => void;
  onIgnore: () => void;
}

export function CommitmentSuggestion({ text, onAccept, onIgnore }: CommitmentSuggestionProps) {
  return (
    <div className="mx-3 mb-2 rounded-2xl border border-[#AFA9EC]/40 bg-[#EEEDFE] p-3.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-start gap-2 mb-2.5">
        <Sparkles size={14} className="text-[#3C3489] flex-shrink-0 mt-0.5" />
        <p className="text-[12px] text-[#3C3489] font-medium leading-snug">
          Elena sugiere un compromiso
        </p>
      </div>
      <p className="text-[13.5px] text-app-text leading-relaxed mb-3 pl-5">
        "{text}"
      </p>
      <div className="flex gap-2 pl-5">
        <button
          onClick={onAccept}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#534AB7] text-white text-[12.5px] font-medium hover:opacity-90 transition-opacity"
        >
          <Check size={13} />
          Aceptar
        </button>
        <button
          onClick={onIgnore}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-app-border text-app-muted text-[12.5px] hover:text-app-text transition-colors"
        >
          <X size={13} />
          Ignorar
        </button>
      </div>
    </div>
  );
}
