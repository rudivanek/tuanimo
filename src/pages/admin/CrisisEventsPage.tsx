import { useState, useCallback } from 'react';
import { AlertTriangle, ChevronLeft, RefreshCw, AlertCircle, Inbox } from 'lucide-react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';

interface CrisisEventRow {
  id: string;
  user_id: string;
  user_label: string;
  source: string;
  severity: string;
  created_at: string;
  thread_id: string | null;
  model: string | null;
  meta: Record<string, unknown> | null;
}

const SOURCE_LABELS: Record<string, string> = {
  'chat-ai': 'Chat',
  'journal-prompts': 'Diario',
  'mood-insights': 'Insights',
};

function SeverityBadge({ severity }: { severity: string }) {
  const isYes = severity === 'YES';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-6 text-[11px] font-semibold ${
        isYes
          ? 'bg-red-100 text-red-700'
          : 'bg-amber-100 text-amber-700'
      }`}
    >
      {severity}
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-6 text-[11px] font-medium bg-app-bg border border-app-border text-app-muted">
      {SOURCE_LABELS[source] ?? source}
    </span>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CrisisEventsPage() {
  const [severityFilter, setSeverityFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({ severity: '', source: '' });

  const handleApply = useCallback(() => {
    setAppliedFilters({ severity: severityFilter, source: sourceFilter });
  }, [severityFilter, sourceFilter]);

  const {
    data: rows = [],
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<CrisisEventRow[]>({
    queryKey: ['admin-crisis-events', appliedFilters],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_crisis_events', {
        p_limit: 200,
        p_offset: 0,
        p_severity: appliedFilters.severity || null,
        p_source: appliedFilters.source || null,
      });
      if (error) throw error;
      return data as CrisisEventRow[];
    },
    staleTime: 0,
  });

  const yesCount = rows.filter(r => r.severity === 'YES').length;
  const maybeCount = rows.filter(r => r.severity === 'MAYBE').length;

  return (
    <div
      className="bg-app-bg p-5 space-y-5"
      style={{
        minHeight: 'calc(100dvh - var(--chrome-total))',
        paddingBottom: 'calc(var(--nav-total) + 1.5rem)',
      }}
    >
      <div className="max-w-5xl mx-auto space-y-5">

        <div className="flex items-start gap-4">
          <Link
            href="/app/admin"
            className="mt-0.5 p-2 rounded-10 bg-app-surface border border-app-border hover:border-sage-strong transition-colors text-app-muted hover:text-sage-strong"
          >
            <ChevronLeft size={16} />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <AlertTriangle size={20} className="text-danger" />
              <h1 className="text-2xl font-semibold text-app-text">Eventos de Crisis</h1>
            </div>
            <p className="text-sm text-app-muted mt-0.5">Señales de angustia detectadas por los modelos de IA</p>
          </div>
        </div>

        <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app p-5">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <div>
              <label className="text-[11px] font-medium text-app-muted uppercase tracking-wider block mb-1.5">
                Severidad
              </label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="w-full h-10 px-3 rounded-10 bg-app-bg border border-app-border text-sm text-app-text focus:outline-none focus:border-sage-strong transition-colors"
              >
                <option value="">Todas</option>
                <option value="YES">YES — Crítico</option>
                <option value="MAYBE">MAYBE — Posible</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-app-muted uppercase tracking-wider block mb-1.5">
                Fuente
              </label>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="w-full h-10 px-3 rounded-10 bg-app-bg border border-app-border text-sm text-app-text focus:outline-none focus:border-sage-strong transition-colors"
              >
                <option value="">Todas las fuentes</option>
                <option value="chat-ai">Chat</option>
                <option value="journal-prompts">Diario</option>
                <option value="mood-insights">Insights</option>
              </select>
            </div>

            <button
              onClick={handleApply}
              disabled={isFetching}
              className="h-10 px-5 rounded-10 bg-sage-strong text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-2"
            >
              {isFetching ? <RefreshCw size={14} className="animate-spin" /> : null}
              Aplicar
            </button>
          </div>
        </div>

        {isError && (
          <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-[12px] text-sm text-red-700">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">No se pudieron cargar los eventos</p>
              <p className="text-xs text-red-500 mt-0.5">{(error as Error)?.message}</p>
              <button onClick={() => refetch()} className="mt-1.5 text-xs font-medium underline">
                Reintentar
              </button>
            </div>
          </div>
        )}

        {!isError && rows.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-app-surface border border-app-border rounded-[12px] p-4">
              <p className="text-[11px] font-medium text-app-muted uppercase tracking-wider mb-1">Total</p>
              <p className="text-xl font-semibold text-app-text">{rows.length}</p>
            </div>
            <div className="bg-app-surface border border-red-200 rounded-[12px] p-4">
              <p className="text-[11px] font-medium text-red-400 uppercase tracking-wider mb-1">YES</p>
              <p className="text-xl font-semibold text-red-600">{yesCount}</p>
            </div>
            <div className="bg-app-surface border border-amber-200 rounded-[12px] p-4">
              <p className="text-[11px] font-medium text-amber-500 uppercase tracking-wider mb-1">MAYBE</p>
              <p className="text-xl font-semibold text-amber-600">{maybeCount}</p>
            </div>
          </div>
        )}

        <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app overflow-hidden">
          {isFetching && rows.length === 0 ? (
            <div className="flex items-center justify-center h-40 gap-2 text-sm text-app-muted">
              <RefreshCw size={16} className="animate-spin" />
              Cargando...
            </div>
          ) : !isError && rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-app-muted">
              <Inbox size={28} strokeWidth={1.5} />
              <p className="text-sm">Sin eventos de crisis registrados</p>
            </div>
          ) : !isError ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-app-border">
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">
                      Usuario
                    </th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">
                      Fuente
                    </th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">
                      Severidad
                    </th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">
                      Modelo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className={`border-b border-app-border last:border-0 transition-colors hover:bg-app-bg/60 ${
                        isFetching ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="px-5 py-3 text-app-text font-medium max-w-[200px] truncate">
                        {row.user_label}
                      </td>
                      <td className="px-5 py-3">
                        <SourceBadge source={row.source} />
                      </td>
                      <td className="px-5 py-3">
                        <SeverityBadge severity={row.severity} />
                      </td>
                      <td className="px-5 py-3 text-app-muted tabular-nums whitespace-nowrap">
                        {formatDateTime(row.created_at)}
                      </td>
                      <td className="px-5 py-3 text-app-muted text-xs">
                        {row.model ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

      </div>
    </div>
  );
}
