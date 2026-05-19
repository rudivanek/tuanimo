import { ExternalLink, Trash2, X, Weight } from 'lucide-react';
import { formatBytes } from '../lib/formatBytes';

interface LargestEntry {
  id: string;
  title: string;
  created_at: string;
  content_bytes: number;
}

interface LargestEntriesPanelProps {
  entries: LargestEntry[];
  onOpenEntry: (id: string) => void;
  onDeleteEntry: (id: string, e: React.MouseEvent) => void;
  onClose: () => void;
}

export function LargestEntriesPanel({
  entries,
  onOpenEntry,
  onDeleteEntry,
  onClose,
}: LargestEntriesPanelProps) {
  const sorted = [...entries]
    .sort((a, b) => b.content_bytes - a.content_bytes)
    .slice(0, 10);

  return (
    <div className="border-b border-app-border flex-shrink-0 bg-app-surface-2/50">
      <div className="flex items-center justify-between px-4 py-2 border-b border-app-border">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-app-muted uppercase tracking-wide">
          <Weight size={11} />
          Entradas más grandes
        </span>
        <button
          onClick={onClose}
          className="p-0.5 rounded text-app-muted hover:text-app-text transition-colors"
          aria-label="Cerrar panel"
        >
          <X size={13} />
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="px-4 py-3 text-[11px] text-app-muted">
          Sin entradas todavía.
        </div>
      ) : (
        <div className="max-h-[220px] overflow-y-auto">
          {sorted.map((entry) => (
            <div
              key={entry.id}
              className="group flex items-center gap-2 px-4 py-2 border-b border-app-border last:border-b-0 hover:bg-app-surface transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p
                  onClick={() => onOpenEntry(entry.id)}
                  className="text-xs font-medium text-app-text truncate cursor-pointer hover:text-sage-strong transition-colors"
                  title={entry.title}
                >
                  {entry.title}
                </p>
                <p className="text-[10px] text-app-muted mt-0.5">
                  {new Date(entry.created_at).toLocaleDateString()}
                </p>
              </div>

              <span className="flex-shrink-0 text-[10px] font-mono text-app-muted bg-app-surface px-1.5 py-0.5 rounded border border-app-border">
                {formatBytes(entry.content_bytes)}
              </span>

              <button
                onClick={() => onOpenEntry(entry.id)}
                title="Abrir entrada"
                className="flex-shrink-0 p-1 rounded text-app-muted hover:text-sage-strong hover:bg-sage-soft transition-all opacity-0 group-hover:opacity-100"
              >
                <ExternalLink size={12} />
              </button>

              <button
                onClick={(e) => onDeleteEntry(entry.id, e)}
                title="Eliminar entrada"
                className="flex-shrink-0 p-1 rounded text-app-muted hover:text-danger hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
