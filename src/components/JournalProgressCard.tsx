import { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import type { JournalProgress } from '../lib/journalProgress';
import { JournalProgressDetailsModal } from './JournalProgressDetailsModal';
import { JournalThemeEntriesModal } from './JournalThemeEntriesModal';

interface JournalProgressCardProps {
  progress: JournalProgress;
  isLoading: boolean;
  onSelectEntryId: (id: string) => void;
}

function triggerLabel(key: string): string {
  if (key.startsWith('heaviness')) return 'bajar la intensidad';
  if (key.startsWith('repetition')) return 'aclarar un tema repetido';
  return key;
}

export function JournalProgressCard({ progress, isLoading, onSelectEntryId }: JournalProgressCardProps) {
  const [open, setOpen] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="mx-4 mt-3 mb-1 px-3 py-2.5 bg-app-surface-2 border border-app-border rounded-12 flex-shrink-0">
        <p className="text-[11px] text-app-muted">Cargando tu progreso…</p>
      </div>
    );
  }

  if (progress.saved30d === 0) return null;

  const handleThemeClick = (theme: string) => {
    setSelectedTheme(theme);
    setOpen(false);
  };

  return (
    <>
      <div className="mx-4 mt-3 mb-1 px-3 py-2.5 bg-app-surface-2 border border-app-border rounded-12 flex-shrink-0 animate-fade-in">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={11} className="text-sage-strong flex-shrink-0" />
            <span className="text-[10px] font-semibold text-sage-strong uppercase tracking-wider">
              Tu progreso
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-[11px] font-medium text-sage-strong hover:text-sage transition-colors"
          >
            Ver detalles
          </button>
        </div>
        <div className="space-y-1">
          <p className="text-[12px] text-app-text leading-snug">
            Últimos 7 días:{' '}
            <span className="font-semibold">{progress.saved7d}</span>{' '}
            <span className="text-app-muted">
              {progress.saved7d === 1 ? 'reflexión guardada' : 'reflexiones guardadas'}
            </span>
          </p>
          <p className="text-[12px] text-app-text leading-snug">
            Últimos 30 días:{' '}
            <span className="font-semibold">{progress.saved30d}</span>{' '}
            <span className="text-app-muted">
              {progress.saved30d === 1 ? 'reflexión guardada' : 'reflexiones guardadas'}
            </span>
          </p>
          {progress.topTrigger30d && (
            <p className="text-[12px] text-app-text leading-snug">
              Motivo más común:{' '}
              <span className="font-medium">{triggerLabel(progress.topTrigger30d.key)}</span>{' '}
              <span className="text-app-muted">({progress.topTrigger30d.count})</span>
            </p>
          )}
        </div>
      </div>

      <JournalProgressDetailsModal
        open={open}
        onClose={() => setOpen(false)}
        progress={progress}
        onThemeClick={handleThemeClick}
      />

      <JournalThemeEntriesModal
        open={selectedTheme !== null}
        theme={selectedTheme}
        onClose={() => setSelectedTheme(null)}
        onSelectEntryId={(id) => {
          setSelectedTheme(null);
          onSelectEntryId(id);
        }}
      />
    </>
  );
}
