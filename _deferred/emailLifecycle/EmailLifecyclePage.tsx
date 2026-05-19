import { useState } from 'react';
import { Mail, ChevronLeft, RefreshCw, AlertCircle, Inbox, Play, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';

interface LifecycleUserRow {
  user_id: string;
  email: string;
  signup_at: string | null;
  lifecycle_started_at: string | null;
  sessions_count: number;
  email_sequence_step: number;
  email_sequence_status: string;
  email_opt_in: boolean;
  last_email_sent_at: string | null;
  last_email_type: string | null;
  emails_sent: number;
}

interface LifecycleEventRow {
  id: string;
  user_id: string;
  email: string;
  email_type: string;
  sent_at: string;
  status: string;
  resend_message_id: string | null;
  metadata: Record<string, unknown>;
}

interface TriggerResult {
  ok: boolean;
  dry_run: boolean;
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  logs: string[];
  error?: string;
}

const STEP_LABELS: Record<string, string> = {
  day1_empieza_simple: 'Día 1 — Empieza simple',
  day2_dos_minutos: 'Día 2 — 2 minutos',
  day3_mas_cerca: 'Día 3 — Más cerca',
  day4_empieza_interesante: 'Día 4 — Se pone interesante',
  day5_mayoria_se_detiene: 'Día 5 — La mayoría para',
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: { label: 'Activo', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  paused: { label: 'Pausado', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  completed: { label: 'Completado', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  opted_out: { label: 'Opt-out', className: 'bg-zinc-100 text-zinc-500 border-zinc-200' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? { label: status, className: 'bg-zinc-100 text-zinc-500 border-zinc-200' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${s.className}`}>
      {s.label}
    </span>
  );
}

function SendStatusIcon({ status }: { status: string }) {
  if (status === 'sent') return <CheckCircle2 size={14} className="text-emerald-500" />;
  if (status === 'failed') return <XCircle size={14} className="text-red-500" />;
  return <Clock size={14} className="text-amber-500" />;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-app-surface border border-app-border rounded-[12px] p-4">
      <p className="text-[11px] font-medium text-app-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-semibold text-app-text">{value}</p>
      {sub && <p className="text-[11px] text-app-muted mt-0.5">{sub}</p>}
    </div>
  );
}

export function EmailLifecyclePage() {
  const [activeTab, setActiveTab] = useState<'users' | 'events'>('users');
  const [triggerResult, setTriggerResult] = useState<TriggerResult | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  const {
    data: users = [],
    isFetching: usersLoading,
    isError: usersError,
    refetch: refetchUsers,
  } = useQuery<LifecycleUserRow[]>({
    queryKey: ['admin-lifecycle-users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_lifecycle_users', { p_limit: 200, p_offset: 0 });
      if (error) throw error;
      return data as LifecycleUserRow[];
    },
    staleTime: 0,
  });

  const {
    data: events = [],
    isFetching: eventsLoading,
    isError: eventsError,
    refetch: refetchEvents,
  } = useQuery<LifecycleEventRow[]>({
    queryKey: ['admin-lifecycle-events'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_lifecycle_events', { p_limit: 200, p_offset: 0 });
      if (error) throw error;
      return data as LifecycleEventRow[];
    },
    staleTime: 0,
    enabled: activeTab === 'events',
  });

  const triggerMutation = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-lifecycle${dryRun ? '?dry_run=true' : ''}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      return json as TriggerResult;
    },
    onSuccess: (result) => {
      setTriggerResult(result);
      setShowLogs(true);
      refetchUsers();
      refetchEvents();
    },
  });

  const activeCount = users.filter(u => u.email_sequence_status === 'active').length;
  const completedCount = users.filter(u => u.email_sequence_status === 'completed').length;
  const pausedCount = users.filter(u => u.email_sequence_status === 'paused').length;
  const totalSent = events.filter(e => e.status === 'sent').length;

  return (
    <div
      className="bg-app-bg p-5 space-y-5"
      style={{ minHeight: 'calc(100dvh - var(--chrome-total))', paddingBottom: 'calc(var(--nav-total) + 1.5rem)' }}
    >
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-start gap-4">
          <Link
            href="/app/admin"
            className="mt-0.5 p-2 rounded-10 bg-app-surface border border-app-border hover:border-sage-strong transition-colors text-app-muted hover:text-sage-strong"
          >
            <ChevronLeft size={16} />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Mail size={20} className="text-sage-strong" />
              <h1 className="text-2xl font-semibold text-app-text">Email Lifecycle</h1>
            </div>
            <p className="text-sm text-app-muted mt-0.5">Secuencia de onboarding de 5 días en español para nuevos y usuarios inactivos</p>
          </div>
        </div>

        {/* Manual trigger panel */}
        <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app p-5 space-y-4">
          <div>
            <h2 className="text-[13px] font-semibold text-app-text">Trigger manual</h2>
            <p className="text-xs text-app-muted mt-0.5">Ejecuta el scheduler ahora. El modo dry-run solo simula, no envía emails.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => triggerMutation.mutate(true)}
              disabled={triggerMutation.isPending}
              className="h-9 px-4 rounded-10 border border-app-border bg-app-bg text-sm font-medium text-app-text hover:border-sage-strong transition-colors disabled:opacity-60 flex items-center gap-2"
            >
              {triggerMutation.isPending ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
              Dry-run
            </button>
            <button
              onClick={() => triggerMutation.mutate(false)}
              disabled={triggerMutation.isPending}
              className="h-9 px-4 rounded-10 bg-sage-strong text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-2"
            >
              {triggerMutation.isPending ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
              Enviar ahora
            </button>
          </div>

          {triggerMutation.isError && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-[10px] px-3 py-2">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              <span>{(triggerMutation.error as Error).message}</span>
            </div>
          )}

          {triggerResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-app-bg border border-app-border rounded-[10px] px-3 py-2 text-center">
                  <p className="text-[10px] text-app-muted uppercase tracking-wide">Procesados</p>
                  <p className="text-lg font-semibold text-app-text">{triggerResult.processed}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-[10px] px-3 py-2 text-center">
                  <p className="text-[10px] text-emerald-600 uppercase tracking-wide">{triggerResult.dry_run ? 'Simularían' : 'Enviados'}</p>
                  <p className="text-lg font-semibold text-emerald-700">{triggerResult.sent}</p>
                </div>
                <div className="bg-app-bg border border-app-border rounded-[10px] px-3 py-2 text-center">
                  <p className="text-[10px] text-app-muted uppercase tracking-wide">Omitidos</p>
                  <p className="text-lg font-semibold text-app-text">{triggerResult.skipped}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-[10px] px-3 py-2 text-center">
                  <p className="text-[10px] text-red-400 uppercase tracking-wide">Fallidos</p>
                  <p className="text-lg font-semibold text-red-600">{triggerResult.failed}</p>
                </div>
              </div>
              <button
                onClick={() => setShowLogs(v => !v)}
                className="text-xs text-sage-strong underline"
              >
                {showLogs ? 'Ocultar' : 'Ver'} logs ({triggerResult.logs.length})
              </button>
              {showLogs && (
                <div className="bg-zinc-900 rounded-[10px] p-3 max-h-60 overflow-y-auto">
                  {triggerResult.logs.map((line, i) => (
                    <p key={i} className="text-[11px] font-mono text-zinc-300 leading-5">{line}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stats row */}
        {users.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total usuarios" value={users.length} />
            <StatCard label="Secuencia activa" value={activeCount} />
            <StatCard label="Completados" value={completedCount} />
            <StatCard label="Emails enviados" value={events.length > 0 ? totalSent : '—'} sub="total histórico" />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-app-surface border border-app-border rounded-[12px] p-1 w-fit">
          {(['users', 'events'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-[9px] text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-app-bg border border-app-border text-app-text shadow-sm'
                  : 'text-app-muted hover:text-app-text'
              }`}
            >
              {tab === 'users' ? 'Usuarios' : 'Historial de envíos'}
            </button>
          ))}
        </div>

        {/* Users table */}
        {activeTab === 'users' && (
          <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app overflow-hidden">
            {usersLoading && users.length === 0 ? (
              <div className="flex items-center justify-center h-40 gap-2 text-sm text-app-muted">
                <RefreshCw size={16} className="animate-spin" /> Cargando...
              </div>
            ) : usersError ? (
              <div className="flex items-start gap-3 m-5 px-4 py-3 bg-red-50 border border-red-200 rounded-[12px] text-sm text-red-700">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                <span>Error al cargar usuarios</span>
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-app-muted">
                <Inbox size={28} strokeWidth={1.5} />
                <p className="text-sm">Sin usuarios en el lifecycle</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-app-border">
                      {['Email', 'Inicio ciclo', 'Sesiones', 'Paso', 'Estado', 'Último envío'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.user_id} className="border-b border-app-border last:border-0 hover:bg-app-bg/50 transition-colors">
                        <td className="px-4 py-3 text-app-text font-medium max-w-[200px] truncate">{u.email}</td>
                        <td className="px-4 py-3 text-app-muted whitespace-nowrap tabular-nums text-xs">{formatDate(u.lifecycle_started_at)}</td>
                        <td className="px-4 py-3 text-app-text tabular-nums">{u.sessions_count}</td>
                        <td className="px-4 py-3 text-app-muted text-xs">{u.email_sequence_step}/5</td>
                        <td className="px-4 py-3"><StatusBadge status={u.email_sequence_status} /></td>
                        <td className="px-4 py-3 text-app-muted text-xs whitespace-nowrap">
                          {u.last_email_type ? (
                            <div>
                              <p className="text-app-text text-[11px]">{STEP_LABELS[u.last_email_type] ?? u.last_email_type}</p>
                              <p className="text-[11px]">{formatDate(u.last_email_sent_at)}</p>
                            </div>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Events table */}
        {activeTab === 'events' && (
          <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app overflow-hidden">
            {eventsLoading && events.length === 0 ? (
              <div className="flex items-center justify-center h-40 gap-2 text-sm text-app-muted">
                <RefreshCw size={16} className="animate-spin" /> Cargando...
              </div>
            ) : eventsError ? (
              <div className="flex items-start gap-3 m-5 px-4 py-3 bg-red-50 border border-red-200 rounded-[12px] text-sm text-red-700">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                <span>Error al cargar eventos</span>
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-app-muted">
                <Inbox size={28} strokeWidth={1.5} />
                <p className="text-sm">Sin envíos registrados</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-app-border">
                      {['', 'Email', 'Tipo', 'Enviado', 'Resend ID'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((e) => (
                      <tr key={e.id} className="border-b border-app-border last:border-0 hover:bg-app-bg/50 transition-colors">
                        <td className="px-4 py-3"><SendStatusIcon status={e.status} /></td>
                        <td className="px-4 py-3 text-app-text font-medium max-w-[180px] truncate">{e.email}</td>
                        <td className="px-4 py-3 text-app-muted text-xs">{STEP_LABELS[e.email_type] ?? e.email_type}</td>
                        <td className="px-4 py-3 text-app-muted whitespace-nowrap tabular-nums text-xs">{formatDate(e.sent_at)}</td>
                        <td className="px-4 py-3 text-app-muted font-mono text-[11px] truncate max-w-[160px]">
                          {e.resend_message_id ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
