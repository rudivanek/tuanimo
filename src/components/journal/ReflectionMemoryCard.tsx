import { Clock } from 'lucide-react';

const MAX_PREVIEW = 220;

type ReflectionMemoryCardProps = {
  title: string;
  content: string;
  prompt: string;
  onReflect: () => void;
  onDismiss: () => void;
  onViewOriginal: () => void;
};

export function ReflectionMemoryCard({ title, content, prompt, onReflect, onDismiss, onViewOriginal }: ReflectionMemoryCardProps) {
  const preview =
    content.length > MAX_PREVIEW
      ? content.slice(0, MAX_PREVIEW).trimEnd() + '\u2026'
      : content;

  return (
    <div className="mb-5 rounded-14 border border-sage/40 bg-sage-soft/65 px-4 py-3.5">
      <div className="flex items-center gap-1.5 mb-2">
        <Clock size={12} className="text-sage-strong/70 flex-shrink-0" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-sage-strong/70">
          {title}
        </span>
      </div>
      <p className="text-[13.5px] text-app-text/80 leading-relaxed line-clamp-4">
        {preview}
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[12px] text-sage-strong font-medium italic">
          {prompt}
        </p>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={onDismiss}
            className="text-[12px] text-app-muted hover:text-app-text/60 transition-colors"
          >
            Ahora no
          </button>
          <button
            onClick={onViewOriginal}
            className="text-[12px] text-app-muted hover:text-app-text/60 transition-colors"
          >
            Ver original
          </button>
          <button
            onClick={onReflect}
            className="text-[12px] font-semibold text-sage-strong hover:text-[#4e7260] underline-offset-2 hover:underline transition-colors"
          >
            Reflexionar
          </button>
        </div>
      </div>
    </div>
  );
}
