import { useEffect, useRef } from 'react';
import { Clock, PenLine, X } from 'lucide-react';

type ReflectionViewerModalProps = {
  title: string;
  content: string;
  onClose: () => void;
  onUseReflection: () => void;
};

export function ReflectionViewerModal({ title, content, onClose, onUseReflection }: ReflectionViewerModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-app-text/30 backdrop-blur-sm flex items-center justify-center z-50 p-5"
      onClick={onClose}
    >
      <div
        className="bg-app-surface rounded-[18px] shadow-app max-w-sm w-full flex flex-col max-h-[70vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-2 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <Clock size={12} className="text-sage-strong/70 flex-shrink-0" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-sage-strong/70">
              {title}
            </span>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-1.5 hover:bg-app-surface-2 rounded-xl transition-colors text-app-muted"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 pb-3 flex-shrink-0">
          <span className="text-[11px] text-app-muted/60 tracking-wide">
            Reflexión pasada · solo lectura
          </span>
        </div>

        <div className="px-5 pb-4 overflow-y-auto">
          <p className="text-[13.5px] text-app-text/80 leading-relaxed whitespace-pre-wrap">
            {content}
          </p>
        </div>

        <div className="px-5 pb-5 flex-shrink-0 border-t border-app-border/40 pt-3">
          <button
            onClick={onUseReflection}
            className="flex items-center gap-1.5 text-[12px] font-medium text-sage-strong/80 hover:text-sage-strong transition-colors"
          >
            <PenLine size={13} />
            Usar esta reflexión
          </button>
        </div>
      </div>
    </div>
  );
}
