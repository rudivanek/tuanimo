import { useState, useEffect, useCallback } from 'react';
import { CheckSquare, Square, Clock, RefreshCw, BookOpen, Sparkles, CheckCircle2, Trash2 } from 'lucide-react';
import { useLocation } from 'wouter';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { getActiveCommitment, resolveCommitment, dismissCommitment, type Commitment } from '../lib/commitments';

interface Task {
  id: string;
  theme: string;
  action_text: string;
  reflection_prompt: string | null;
  duration_minutes: number;
}

interface UserDailyTask {
  id: string;
  task_id: string;
  assigned_date: string;
  completed: boolean;
  completed_at: string | null;
  tasks: Task;
}

const THEME_LABELS: Record<string, string> = {
  meaning:       'Sentido',
  avoidance:     'Acción',
  grief:         'Duelo',
  identity:      'Identidad',
  relationships: 'Vínculos',
  anxiety:       'Presencia',
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export function PracticasPage() {
  const { user, session } = useAuth();
  const [, navigate] = useLocation();
  const [tasks, setTasks] = useState<UserDailyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealedReflections, setRevealedReflections] = useState<Set<string>>(new Set());

  // ── Commitments ──────────────────────────────────────────────────────────
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [commitmentsLoading, setCommitmentsLoading] = useState(true);

  useEffect(() => {
    if (user && session) loadTasks();
  }, [user, session]);

  const loadCommitments = useCallback(async () => {
    if (!user) return;
    setCommitmentsLoading(true);
    const { data, error } = await supabase
      .from('commitments')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pending', 'done', 'not_done'])
      .order('created_at', { ascending: false })
      .limit(20);
    if (!error && data) setCommitments(data as Commitment[]);
    setCommitmentsLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) loadCommitments();
  }, [user, loadCommitments]);

  // Reload when user returns to this tab
  useEffect(() => {
    const onFocus = () => { if (user) loadCommitments(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user, loadCommitments]);

  const handleCommitmentResolve = async (id: string, outcome: 'done' | 'not_done') => {
    await resolveCommitment(id, outcome);
    loadCommitments();
  };

  const handleCommitmentDelete = async (id: string) => {
    await dismissCommitment(id);
    loadCommitments();
  };

  const callFunction = async (body: object): Promise<Response> => {
    const token = session?.access_token;
    if (!token) throw new Error('No session');
    return fetch(`${SUPABASE_URL}/functions/v1/assign-daily-tasks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  };

  const loadTasks = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await callFunction({ action: 'get_tasks', force });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error || `Error ${res.status}`);
      }
      const data = await res.json() as { tasks: UserDailyTask[] };
      setTasks(data.tasks ?? []);
    } catch (err) {
      console.error('PracticasPage load error:', err);
      setError('No se pudieron cargar las prácticas. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const toggleComplete = async (userDailyTaskId: string, currentCompleted: boolean) => {
    setTasks(prev =>
      prev.map(t =>
        t.id === userDailyTaskId
          ? { ...t, completed: !currentCompleted, completed_at: !currentCompleted ? new Date().toISOString() : null }
          : t
      )
    );
    if (!currentCompleted) {
      setRevealedReflections(prev => new Set([...prev, userDailyTaskId]));
    }
    try {
      const res = await callFunction({ action: 'complete_task', userDailyTaskId, completed: !currentCompleted });
      if (!res.ok) throw new Error(`Error ${res.status}`);
    } catch (err) {
      console.error('Toggle complete error:', err);
      setTasks(prev =>
        prev.map(t =>
          t.id === userDailyTaskId
            ? { ...t, completed: currentCompleted, completed_at: currentCompleted ? t.completed_at : null }
            : t
        )
      );
    }
  };

  const handleOpenJournal = (item: UserDailyTask) => {
    if (!item.tasks.reflection_prompt) return;
    try {
      sessionStorage.setItem('diaryNewPrefill', item.tasks.reflection_prompt);
    } catch {}
    navigate('/journal');
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const allDone = tasks.length > 0 && completedCount === tasks.length;

  if (loading) {
    return (
      <div className="bg-app-bg overflow-y-auto"
        style={{ minHeight: 'calc(100dvh - var(--chrome-total))', paddingBottom: 'calc(var(--nav-total) + 1rem)' }}>
        <div className="max-w-3xl mx-auto px-5 py-6">
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-strong" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-app-bg overflow-y-auto"
      style={{ minHeight: 'calc(100dvh - var(--chrome-total))', paddingBottom: 'calc(var(--nav-total) + 1rem)' }}>
      <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-app-text">Prácticas</h1>
            <p className="text-app-muted text-sm mt-0.5">Tres cosas pequeñas para hoy</p>
          </div>
          {tasks.length > 0 && (
            <div className="flex-shrink-0 text-right">
              <span className="text-2xl font-semibold text-sage-strong">{completedCount}</span>
              <span className="text-app-muted text-sm"> / {tasks.length}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-[14px] px-4 py-3 text-sm text-red-800 flex items-center justify-between gap-3">
            <span>{error}</span>
            <button onClick={() => loadTasks()}
              className="flex items-center gap-1.5 text-red-700 hover:text-red-900 transition-colors flex-shrink-0">
              <RefreshCw size={14} />
              <span className="text-xs font-medium">Reintentar</span>
            </button>
          </div>
        )}

        {!error && tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 px-6 text-center gap-4">
            <p className="text-[14px] text-app-text font-medium leading-relaxed">
              Las prácticas aparecen después de tu primera conversación con Elena.
            </p>
            <p className="text-[13px] text-app-muted leading-relaxed max-w-[280px]">
              Elena elige tres prácticas basadas en lo que surge en vuestras conversaciones. Empieza hablando con ella.
            </p>
          </div>
        )}

        {allDone && (
          <div className="bg-sage-soft border border-sage/20 rounded-[14px] px-4 py-3 text-center">
            <p className="text-sm text-sage-strong font-medium">Completaste las tres prácticas de hoy.</p>
            <p className="text-xs text-app-muted mt-0.5">Vuelve mañana — Elena habrá preparado otras nuevas.</p>
          </div>
        )}

        {tasks.map((item) => {
          const showReflection =
            item.tasks.reflection_prompt &&
            (item.completed || revealedReflections.has(item.id));

          return (
            <div key={item.id}
              className={[
                'bg-app-surface rounded-[16px] border p-5 transition-all duration-200',
                item.completed ? 'border-sage/30 opacity-70' : 'border-app-border shadow-app',
              ].join(' ')}>

              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-medium text-sage-strong bg-sage-soft px-2.5 py-0.5 rounded-full">
                  {THEME_LABELS[item.tasks.theme] ?? item.tasks.theme}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-app-muted">
                  <Clock size={11} />
                  {item.tasks.duration_minutes} min
                </span>
              </div>

              <button onClick={() => toggleComplete(item.id, item.completed)}
                className="w-full text-left flex items-start gap-3 group">
                <span className="flex-shrink-0 mt-0.5 text-sage-strong transition-opacity group-active:opacity-60">
                  {item.completed
                    ? <CheckSquare size={20} strokeWidth={1.8} />
                    : <Square size={20} strokeWidth={1.8} className="text-app-muted" />}
                </span>
                <p className={['text-[14px] leading-relaxed transition-colors',
                  item.completed ? 'line-through text-app-muted' : 'text-app-text'].join(' ')}>
                  {item.tasks.action_text}
                </p>
              </button>

              {showReflection && (
                <div className="mt-4 pl-8">
                  <div className="border-l-2 border-sage/30 pl-3">
                    <p className="text-[12px] text-sage-strong italic leading-relaxed">
                      {item.tasks.reflection_prompt}
                    </p>
                  </div>
                  <button onClick={() => handleOpenJournal(item)}
                    className="mt-3 flex items-center gap-1.5 text-[12px] text-sage-strong hover:text-sage font-medium transition-colors">
                    <BookOpen size={13} />
                    Escribir en el diario
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {tasks.length > 0 && (
          <p className="text-center text-[11px] text-app-muted/60 px-4 leading-relaxed">
            Las prácticas se renuevan cada día a medianoche.
          </p>
        )}

        {/* ── Compromisos section ── */}
        <div className="pt-2">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={15} className="text-sage-strong" />
            <h2 className="text-[15px] font-semibold text-app-text">Compromisos</h2>
          </div>

          {commitmentsLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sage-strong" />
            </div>
          ) : commitments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-6 text-center gap-3">
              <p className="text-[13px] text-app-muted leading-relaxed max-w-[260px]">
                Los compromisos aparecen aquí cuando los creas desde el chat con Elena.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {commitments.map(c => (
                <div key={c.id}
                  className={[
                    'bg-app-surface rounded-[16px] border px-4 py-3 transition-all',
                    c.status === 'done' ? 'border-app-border opacity-50' : 'border-app-border',
                  ].join(' ')}
                >
                  {/* Source badge + date */}
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] font-medium text-sage-strong bg-sage-soft px-2.5 py-0.5 rounded-full">
                      {c.source === 'elena' ? 'Sugerido por Elena' : 'Tuyo'}
                    </span>
                    <span className="text-[11px] text-app-muted">
                      {new Date(c.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>

                  {/* Single row: checkbox + text + trash */}
                  <div className="flex items-center gap-3">
                    {/* Checkbox — only active for pending/not_done */}
                    {c.status === 'done' ? (
                      <CheckCircle2 size={20} className="flex-shrink-0 text-sage-strong" strokeWidth={1.8} />
                    ) : (
                      <button
                        onClick={() => handleCommitmentResolve(c.id, 'done')}
                        className="flex-shrink-0 text-app-muted hover:text-sage-strong transition-colors"
                        aria-label="Marcar como completado"
                      >
                        <CheckCircle2 size={20} strokeWidth={1.8} />
                      </button>
                    )}

                    {/* Text */}
                    <p className={['flex-1 text-[14px] leading-relaxed',
                      c.status === 'done' ? 'text-app-muted line-through' : 'text-app-text'
                    ].join(' ')}>
                      {c.text}
                    </p>

                    {/* Delete — only for non-done */}
                    {c.status !== 'done' && (
                      <button
                        onClick={() => handleCommitmentDelete(c.id)}
                        className="flex-shrink-0 p-1 text-app-muted hover:text-danger transition-colors"
                        aria-label="Eliminar compromiso"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {/* Completion date for done items */}
                  {c.status === 'done' && c.resolved_at && (
                    <p className="text-[11px] text-app-muted mt-1.5 pl-8">
                      Completado · {new Date(c.resolved_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
