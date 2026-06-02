import { useState, useEffect } from 'react';
import { CheckSquare, Square, Clock, RefreshCw, BookOpen } from 'lucide-react';
import { useLocation } from 'wouter';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { supabase } from '../lib/supabaseClient';
import { createJournalEntryFromInsight } from '../lib/journalEntries';

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

export function PracticasPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const [, navigate] = useLocation();
  const [tasks, setTasks] = useState<UserDailyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealedReflections, setRevealedReflections] = useState<Set<string>>(new Set());
  const [journalLoading, setJournalLoading] = useState<string | null>(null);

  useEffect(() => {
    if (user) loadTasks();
  }, [user]);

  const loadTasks = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('assign-daily-tasks', {
        body: { action: 'get_tasks', force },
      });
      if (fnError) throw fnError;
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
      const { error: fnError } = await supabase.functions.invoke('assign-daily-tasks', {
        body: { action: 'complete_task', userDailyTaskId, completed: !currentCompleted },
      });
      if (fnError) throw fnError;
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

  const handleOpenJournal = async (item: UserDailyTask) => {
    if (!user || !profile || !item.tasks.reflection_prompt) return;
    setJournalLoading(item.id);
    try {
      const content = `${item.tasks.reflection_prompt}\n\n`;
      const themeLabel = THEME_LABELS[item.tasks.theme] ?? item.tasks.theme;
      const entryId = await createJournalEntryFromInsight({
        userId: user.id,
        profile,
        title: themeLabel,
        content,
      });
      sessionStorage.setItem('diaryAutoOpen', entryId);
      navigate('/journal');
    } catch (err) {
      console.error('Journal bridge error:', err);
    } finally {
      setJournalLoading(null);
    }
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
                    disabled={journalLoading === item.id}
                    className="mt-3 flex items-center gap-1.5 text-[12px] text-sage-strong hover:text-sage font-medium transition-colors disabled:opacity-50">
                    <BookOpen size={13} />
                    {journalLoading === item.id ? 'Abriendo...' : 'Escribir en el diario'}
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
      </div>
    </div>
  );
}
