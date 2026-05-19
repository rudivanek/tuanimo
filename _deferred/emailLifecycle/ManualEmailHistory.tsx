import { RefreshCw, Inbox, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';

interface ManualEmailRow {
  id: string;
  created_at: string;
  created_by_admin_id: string;
  audience_type: string;
  subject: string;
  status: string;
  recipient_count: number;
  success_count: number;
  failure_count: number;
}

const AUDIENCE_LABELS: Record<string, string> = {
  single: 'Un usuario',
  multiple: 'Varios usuarios',
  all: 'Todos',
};

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  sent: { label: 'Enviado', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  partial_failed: { label: 'Parcial', className: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertCircle },
  failed: { label: 'Fallido', className: 'bg-red-50 text-red-700 border-red-200', icon: XCircle },
  sending: { label: 'Enviando…', className: 'bg-sky-50 text-sky-700 border-sky-200', icon: Clock },
  draft: { label: 'Borrador', className: 'bg-zinc-100 text-zinc-500 border-zinc-200', icon: Clock },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: 'bg-zinc-100 text-zinc-500 border-zinc-200', icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.className}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface Props {
  refreshKey?: number;
}

export function ManualEmailHistory({ refreshKey }: Props) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-manual-emails-history', refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_manual_emails')
        .select('id, created_at, created_by_admin_id, audience_type, subject, status, recipient_count, success_count, failure_count')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ManualEmailRow[];
    },
    staleTime: 30_000,
  });

  return (
    <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
        <h2 className="text-[15px] font-semibold text-app-text">Historial de envíos</h2>
        <button
          onClick={() => refetch()}
          className="p-1.5 rounded-lg hover:bg-app-bg text-app-muted hover:text-app-text transition-colors"
          title="Actualizar"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={20} className="animate-spin text-app-muted" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-5 py-4 text-sm text-red-600">
          <AlertCircle size={16} />
          <span>Error al cargar historial</span>
        </div>
      )}

      {!isLoading && !error && (!data || data.length === 0) && (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <Inbox size={28} className="text-app-muted" />
          <p className="text-sm text-app-muted">No hay envíos manuales todavía</p>
        </div>
      )}

      {!isLoading && data && data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-app-border bg-app-bg/50">
                <th className="px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wide whitespace-nowrap">Fecha</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wide whitespace-nowrap">Audiencia</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wide">Asunto</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wide text-center whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wide text-center whitespace-nowrap">OK</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wide text-center whitespace-nowrap">Error</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wide whitespace-nowrap">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {data.map((row) => (
                <tr key={row.id} className="hover:bg-app-bg/40 transition-colors">
                  <td className="px-5 py-3 text-xs text-app-muted whitespace-nowrap">
                    {formatDate(row.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-app-bg border border-app-border text-app-text whitespace-nowrap">
                      {AUDIENCE_LABELS[row.audience_type] ?? row.audience_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-app-text max-w-[220px] truncate">
                    {row.subject}
                  </td>
                  <td className="px-4 py-3 text-xs text-app-text text-center font-medium">
                    {row.recipient_count}
                  </td>
                  <td className="px-4 py-3 text-xs text-emerald-600 text-center font-medium">
                    {row.success_count}
                  </td>
                  <td className="px-4 py-3 text-xs text-red-500 text-center font-medium">
                    {row.failure_count > 0 ? row.failure_count : <span className="text-app-muted">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
