import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Brain, Trash2, ChevronLeft, Users, Calendar, Repeat2, Heart, Target, AlertCircle, RefreshCw } from 'lucide-react';
import { useProfile } from '../hooks/useProfile';
import { loadElenaMemories, deleteElenaMemory, deleteAllElenaMemories, type ElenaMemoryNote, type ElenaMemoryType } from '../lib/elenaMemory';

// ── Type metadata ──────────────────────────────────────────────────────────────

const TYPE_META: Record<ElenaMemoryType, { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string }> = {
  person:     { label: 'Personas',          icon: Users,       color: 'text-blue-600'  },
  event:      { label: 'Momentos',          icon: Calendar,    color: 'text-amber-600' },
  theme:      { label: 'Lo que regresa',    icon: Repeat2,     color: 'text-violet-600'},
  helps:      { label: 'Lo que te ayuda',   icon: Heart,       color: 'text-rose-500'  },
  commitment: { label: 'Compromisos',       icon: Target,      color: 'text-emerald-600'},
  crisis:     { label: 'Momentos difíciles',icon: AlertCircle, color: 'text-orange-500'},
};

const TYPE_ORDER: ElenaMemoryType[] = ['person', 'event', 'theme', 'helps', 'commitment', 'crisis'];

// ── Component ─────────────────────────────────────────────────────────────────

export function ElenaMemoryPage() {
  const [, navigate] = useLocation();
  const { data: profile } = useProfile();

  const [notes, setNotes] = useState<ElenaMemoryNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  // Load on mount
  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    loadElenaMemories(profile)
      .then(setNotes)
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }, [profile]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteElenaMemory(id);
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch {
      // silent
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    if (!confirmClearAll) {
      setConfirmClearAll(true);
      return;
    }
    setClearingAll(true);
    try {
      await deleteAllElenaMemories();
      setNotes([]);
      setConfirmClearAll(false);
    } catch {
      // silent
    } finally {
      setClearingAll(false);
    }
  };

  // Group notes by type, only include types that have notes
  const grouped = TYPE_ORDER
    .map(type => ({ type, notes: notes.filter(n => n.type === type) }))
    .filter(g => g.notes.length > 0);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="bg-app-bg p-5 space-y-5"
      style={{ minHeight: 'calc(100dvh - var(--chrome-total))', paddingBottom: 'calc(var(--nav-total) + 1.5rem)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/settings')}
          className="p-1.5 rounded-full hover:bg-app-surface transition-colors text-app-muted"
          aria-label="Volver"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <Brain size={20} className="text-primary" />
          <h1 className="text-xl font-semibold text-app-text">Memoria de Elena</h1>
        </div>
      </div>

      {/* Description */}
      <div className="bg-app-surface rounded-[16px] border border-app-border p-4">
        <p className="text-sm text-app-muted leading-relaxed">
          Elena guarda algunas notas entre conversaciones para acompañarte mejor con el tiempo.
          Puedes eliminar cualquier nota cuando quieras.
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-app-muted">
          <RefreshCw size={18} className="animate-spin mr-2" />
          <span className="text-sm">Cargando…</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && notes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center text-app-muted gap-3">
          <Brain size={32} className="opacity-30" />
          <p className="text-sm">Elena aún no tiene notas guardadas.</p>
          <p className="text-xs opacity-70">Aparecerán aquí después de algunas conversaciones.</p>
        </div>
      )}

      {/* Grouped notes */}
      {!loading && grouped.map(({ type, notes: groupNotes }) => {
        const meta = TYPE_META[type];
        const Icon = meta.icon;
        return (
          <div key={type} className="bg-app-surface rounded-[16px] border border-app-border overflow-hidden">
            {/* Section header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-app-border">
              <Icon size={15} className={meta.color} />
              <span className="text-[13px] font-semibold text-app-text">{meta.label}</span>
              <span className="ml-auto text-xs text-app-muted">{groupNotes.length}</span>
            </div>

            {/* Notes */}
            <ul className="divide-y divide-app-border">
              {groupNotes.map(note => (
                <li key={note.id} className="flex items-start gap-3 px-4 py-3">
                  <p className="flex-1 text-sm text-app-text leading-relaxed">{note.note}</p>
                  <button
                    onClick={() => handleDelete(note.id)}
                    disabled={deletingId === note.id}
                    className="flex-shrink-0 p-1.5 rounded-full text-app-muted hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-40"
                    aria-label="Eliminar nota"
                  >
                    {deletingId === note.id
                      ? <RefreshCw size={14} className="animate-spin" />
                      : <Trash2 size={14} />
                    }
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {/* Clear all */}
      {!loading && notes.length > 0 && (
        <div className="pt-2">
          <button
            onClick={handleClearAll}
            disabled={clearingAll}
            className={[
              'w-full py-3 rounded-[14px] border text-sm font-medium transition-colors disabled:opacity-50',
              confirmClearAll
                ? 'bg-danger/10 border-danger/30 text-danger'
                : 'bg-app-surface border-app-border text-app-muted hover:text-danger hover:border-danger/30',
            ].join(' ')}
          >
            {clearingAll
              ? 'Eliminando…'
              : confirmClearAll
                ? '¿Confirmar? Toca de nuevo para borrar todo'
                : 'Borrar toda la memoria de Elena'
            }
          </button>
          {confirmClearAll && !clearingAll && (
            <button
              onClick={() => setConfirmClearAll(false)}
              className="w-full text-center text-xs text-app-muted mt-2 py-1"
            >
              Cancelar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
