import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Brain, Trash2, ChevronLeft, Users, Calendar, Repeat2, Heart, Target, AlertCircle, RefreshCw, Compass, Plus, Check, Archive, Sparkles, X } from 'lucide-react';
import { useProfile } from '../hooks/useProfile';
import { loadElenaMemories, deleteElenaMemory, deleteAllElenaMemories, type ElenaMemoryNote, type ElenaMemoryType } from '../lib/elenaMemory';
import {
  loadIntentions,
  createIntention,
  setIntentionStatus,
  deleteIntention,
  reflectOnIntentions,
  type Intention,
} from '../lib/intentions';

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

  // ── Intentions state ──────────────────────────────────────────────────────
  const [intentions, setIntentions] = useState<Intention[]>([]);
  const [intentionsLoading, setIntentionsLoading] = useState(true);
  const [newIntention, setNewIntention] = useState('');
  const [savingIntention, setSavingIntention] = useState(false);
  const [intentionBusyId, setIntentionBusyId] = useState<string | null>(null);
  const [reflecting, setReflecting] = useState(false);
  const [reflection, setReflection] = useState<string | null>(null);

  // Load on mount
  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    loadElenaMemories(profile)
      .then(setNotes)
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }, [profile]);

  // Load intentions on mount
  useEffect(() => {
    if (!profile) return;
    setIntentionsLoading(true);
    loadIntentions(profile)
      .then(setIntentions)
      .catch(() => setIntentions([]))
      .finally(() => setIntentionsLoading(false));
  }, [profile]);

  const handleAddIntention = async () => {
    const text = newIntention.trim();
    if (!text || !profile) return;
    setSavingIntention(true);
    try {
      await createIntention(text, profile, 'user');
      const refreshed = await loadIntentions(profile);
      setIntentions(refreshed);
      setNewIntention('');
    } catch {
      // silent
    } finally {
      setSavingIntention(false);
    }
  };

  const handleIntentionStatus = async (id: string, status: 'cumplida' | 'retirada') => {
    setIntentionBusyId(id);
    try {
      await setIntentionStatus(id, status);
      setIntentions(prev => prev.filter(i => i.id !== id));
    } catch {
      // silent
    } finally {
      setIntentionBusyId(null);
    }
  };

  const handleDeleteIntention = async (id: string) => {
    setIntentionBusyId(id);
    try {
      await deleteIntention(id);
      setIntentions(prev => prev.filter(i => i.id !== id));
    } catch {
      // silent
    } finally {
      setIntentionBusyId(null);
    }
  };

  const handleReflect = async () => {
    if (intentions.length === 0) return;
    setReflecting(true);
    setReflection(null);
    try {
      const result = await reflectOnIntentions(intentions.map(i => i.text));
      setReflection(result);
    } catch {
      setReflection(null);
    } finally {
      setReflecting(false);
    }
  };

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

      {/* ── Intentions block (declared by the person) ─────────────────────── */}
      <div className="bg-app-surface rounded-[16px] border border-app-border overflow-hidden">
        {/* Section header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-app-border">
          <Compass size={15} className="text-primary" />
          <span className="text-[13px] font-semibold text-app-text">Lo que estoy eligiendo</span>
          {intentions.length > 0 && (
            <span className="ml-auto text-xs text-app-muted">{intentions.length}</span>
          )}
        </div>

        {/* Intro */}
        <div className="px-4 py-3 border-b border-app-border">
          <p className="text-xs text-app-muted leading-relaxed">
            Metas y cosas que quieres cultivar. No son una lista de pendientes: son posibilidades
            que eliges tener a la vista. Puedes soltarlas o cambiarlas cuando quieras.
          </p>
        </div>

        {/* Add new */}
        <div className="px-4 py-3 border-b border-app-border">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newIntention}
              onChange={(e) => setNewIntention(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddIntention(); }}
              placeholder="Escribe una intención…"
              maxLength={280}
              className="flex-1 bg-app-bg border border-app-border rounded-[12px] px-3 py-2 text-sm text-app-text placeholder:text-app-muted/60 focus:outline-none focus:border-primary/50"
            />
            <button
              onClick={handleAddIntention}
              disabled={savingIntention || !newIntention.trim()}
              className="flex-shrink-0 p-2 rounded-[12px] bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40"
              aria-label="Agregar intención"
            >
              {savingIntention ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
            </button>
          </div>
        </div>

        {/* Loading */}
        {intentionsLoading && (
          <div className="flex items-center justify-center py-6 text-app-muted">
            <RefreshCw size={16} className="animate-spin mr-2" />
            <span className="text-sm">Cargando…</span>
          </div>
        )}

        {/* Empty */}
        {!intentionsLoading && intentions.length === 0 && (
          <div className="px-4 py-6 text-center text-app-muted">
            <p className="text-sm">Aún no has elegido ninguna intención.</p>
          </div>
        )}

        {/* List */}
        {!intentionsLoading && intentions.length > 0 && (
          <ul className="divide-y divide-app-border">
            {intentions.map((it) => (
              <li key={it.id} className="flex items-start gap-2 px-4 py-3">
                <p className="flex-1 text-sm text-app-text leading-relaxed">{it.text}</p>
                <div className="flex-shrink-0 flex items-center gap-1">
                  <button
                    onClick={() => handleIntentionStatus(it.id, 'cumplida')}
                    disabled={intentionBusyId === it.id}
                    className="p-1.5 rounded-full text-app-muted hover:text-emerald-600 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
                    aria-label="Marcar como cumplida"
                    title="La integré"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => handleIntentionStatus(it.id, 'retirada')}
                    disabled={intentionBusyId === it.id}
                    className="p-1.5 rounded-full text-app-muted hover:text-app-text hover:bg-app-bg transition-colors disabled:opacity-40"
                    aria-label="Soltar intención"
                    title="Soltar"
                  >
                    <Archive size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteIntention(it.id)}
                    disabled={intentionBusyId === it.id}
                    className="p-1.5 rounded-full text-app-muted hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-40"
                    aria-label="Eliminar intención"
                    title="Eliminar"
                  >
                    {intentionBusyId === it.id ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Reflect */}
        {!intentionsLoading && intentions.length > 0 && (
          <div className="px-4 py-3 border-t border-app-border">
            <button
              onClick={handleReflect}
              disabled={reflecting}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[12px] border border-primary/30 bg-primary/5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              {reflecting
                ? <><RefreshCw size={15} className="animate-spin" /> Elena está pensando…</>
                : <><Sparkles size={15} /> Reflexiona conmigo</>
              }
            </button>

            {reflection && (
              <div className="mt-3 relative bg-app-bg border border-app-border rounded-[12px] p-3">
                <button
                  onClick={() => setReflection(null)}
                  className="absolute top-2 right-2 p-1 rounded-full text-app-muted hover:text-app-text transition-colors"
                  aria-label="Cerrar reflexión"
                >
                  <X size={13} />
                </button>
                <p className="text-sm text-app-text leading-relaxed pr-5 whitespace-pre-line">{reflection}</p>
              </div>
            )}
          </div>
        )}
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

// Last updated: 2026-06-18
