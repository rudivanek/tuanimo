import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, ChevronRight, Tag } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { fetchSavedEntries30d } from '../lib/journalProgress';

interface JournalThemeEntriesModalProps {
  open: boolean;
  theme: string | null;
  onClose: () => void;
  onSelectEntryId: (id: string) => void;
}

function formatSavedDate(savedAt: string): string {
  return new Date(savedAt).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function JournalThemeEntriesModal({
  open,
  theme,
  onClose,
  onSelectEntryId,
}: JournalThemeEntriesModalProps) {
  const { user } = useAuth();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['journal-entries-30d', user?.id],
    queryFn: () => fetchSavedEntries30d(supabase, user!.id),
    enabled: !!user && open,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  const filtered = theme
    ? entries.filter(e => {
        const t = theme.toLowerCase();
        const inTags = Array.isArray(e.tags) && e.tags.some(tag => tag.toLowerCase().includes(t));
        const inTitle = (e.title ?? '').toLowerCase().includes(t);
        return inTags || inTitle;
      })
    : [];

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`Entradas sobre: ${theme}`}
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg mx-auto bg-app-surface rounded-t-[20px] shadow-app flex flex-col max-h-[80dvh]">
        <div className="w-10 h-1 rounded-full bg-app-border absolute top-3 left-1/2 -translate-x-1/2" />

        <div className="flex items-start justify-between px-5 pt-6 pb-3 border-b border-app-border flex-shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-app-text flex items-center flex-wrap gap-1.5">
              Entradas sobre:
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sage-soft text-sage-strong rounded-full text-[12px] font-medium">
                <Tag size={10} />
                {theme}
              </span>
            </h2>
            <p className="text-[11px] text-app-muted mt-1">Últimos 30 días</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-app-surface-2 text-app-muted hover:text-app-text transition-colors flex-shrink-0 mt-0.5"
            aria-label="Cerrar"
          >
            <X size={14} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 py-1">
          {isLoading ? (
            <div className="px-5 py-2 space-y-0">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse flex items-center justify-between gap-3 py-3.5 border-b border-app-border last:border-0">
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-app-surface-2 rounded-full w-3/4" />
                    <div className="h-2.5 bg-app-surface-2 rounded-full w-1/3" />
                  </div>
                  <div className="w-4 h-4 rounded bg-app-surface-2 flex-shrink-0" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-[13px] text-app-muted leading-relaxed">
                Aún no hay entradas guardadas sobre este tema.
              </p>
            </div>
          ) : (
            <div className="px-5">
              {filtered.map(entry => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    onSelectEntryId(entry.id);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between gap-3 py-3.5 border-b border-app-border last:border-0 text-left hover:bg-app-surface-2 -mx-5 px-5 transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium text-app-text truncate">
                      {entry.title || 'Sin título'}
                    </p>
                    <p className="text-[11.5px] text-app-muted mt-0.5">
                      Guardado el {formatSavedDate(entry.saved_at)}
                    </p>
                  </div>
                  <ChevronRight
                    size={15}
                    className="text-app-muted group-hover:text-app-text transition-colors flex-shrink-0"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
