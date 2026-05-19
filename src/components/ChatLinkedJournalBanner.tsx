import { BookOpen, ExternalLink } from 'lucide-react';

interface LinkedEntry {
  id: string;
  title: string | null;
  is_draft: boolean;
  saved_at: string | null;
}

interface ChatLinkedJournalBannerProps {
  entry: LinkedEntry;
  onOpen: () => void;
}

export function ChatLinkedJournalBanner({ entry, onOpen }: ChatLinkedJournalBannerProps) {
  const body = entry.is_draft
    ? 'Escribiste algo a partir de esta conversación.'
    : 'Guardaste una reflexión desde aquí.';

  const cta = entry.is_draft ? 'Ver borrador' : 'Abrir reflexión';

  return (
    <div className="animate-in fade-in slide-in-from-top-1 duration-300">
      <div className="rounded-[14px] border border-app-border bg-app-surface px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sage-soft flex items-center justify-center">
            <BookOpen size={14} className="text-sage-strong" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-app-muted font-medium mb-1">
              Tu diario
            </p>
            <p className="text-[13px] text-app-text leading-snug">{body}</p>
          </div>
          <button
            type="button"
            onClick={onOpen}
            className="
              flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5
              bg-sage-strong text-white text-[12px] font-medium
              rounded-[10px] transition-colors hover:bg-[#4e7260] whitespace-nowrap
            "
          >
            <ExternalLink size={12} />
            {cta}
          </button>
        </div>
      </div>
    </div>
  );
}
