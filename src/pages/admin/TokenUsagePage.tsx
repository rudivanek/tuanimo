import { useState, useCallback } from 'react';
import { BarChart3, ChevronLeft, RefreshCw, AlertCircle, Inbox } from 'lucide-react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';

interface ReportRow {
  user_id: string;
  user_label: string;
  usage_date: string;
  total_tokens: number;
  total_cost_usd: number;
}

interface UserOption {
  user_id: string;
  user_label: string;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatTokens(n: number): string {
  return n.toLocaleString('en-US');
}

function formatCost(n: number): string {
  if (n === 0) return '$0.000000';
  if (n < 0.0001) return `$${n.toFixed(8)}`;
  if (n < 0.01) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(4)}`;
}

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

const today = new Date();
const defaultFrom = toIsoDate(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000));
const defaultUntil = toIsoDate(today);

export function TokenUsagePage() {
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateUntil, setDateUntil] = useState(defaultUntil);
  const [appliedFilters, setAppliedFilters] = useState({
    user: '',
    from: defaultFrom,
    until: defaultUntil,
  });

  const handleApply = useCallback(() => {
    setAppliedFilters({ user: selectedUser, from: dateFrom, until: dateUntil });
  }, [selectedUser, dateFrom, dateUntil]);

  const { data: users = [] } = useQuery<UserOption[]>({
    queryKey: ['admin-users-with-usage'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_users_with_usage');
      if (error) throw error;
      return data as UserOption[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: rows = [],
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<ReportRow[]>({
    queryKey: ['admin-token-usage', appliedFilters],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_token_usage_report', {
        p_date_from: appliedFilters.from,
        p_date_until: appliedFilters.until,
        p_user_id: appliedFilters.user || null,
      });
      if (error) throw error;
      return data as ReportRow[];
    },
    staleTime: 0,
  });

  const totalTokens = rows.reduce((s, r) => s + Number(r.total_tokens), 0);
  const totalCost = rows.reduce((s, r) => s + Number(r.total_cost_usd), 0);

  return (
    <div
      className="bg-app-bg p-5 space-y-5"
      style={{
        minHeight: 'calc(100dvh - var(--chrome-total))',
        paddingBottom: 'calc(var(--nav-total) + 1.5rem)',
      }}
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
              <BarChart3 size={20} className="text-sage-strong" />
              <h1 className="text-2xl font-semibold text-app-text">Uso de Tokens</h1>
            </div>
            <p className="text-sm text-app-muted mt-0.5">Consumo y costo por usuario y fecha</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app p-5">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
            <div>
              <label className="text-[11px] font-medium text-app-muted uppercase tracking-wider block mb-1.5">
                Usuario
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full h-10 px-3 rounded-10 bg-app-bg border border-app-border text-sm text-app-text focus:outline-none focus:border-sage-strong transition-colors"
              >
                <option value="">Todos los usuarios</option>
                {users.map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.user_label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-app-muted uppercase tracking-wider block mb-1.5">
                Desde
              </label>
              <input
                type="date"
                value={dateFrom}
                max={dateUntil}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-10 px-3 rounded-10 bg-app-bg border border-app-border text-sm text-app-text focus:outline-none focus:border-sage-strong transition-colors"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-app-muted uppercase tracking-wider block mb-1.5">
                Hasta
              </label>
              <input
                type="date"
                value={dateUntil}
                min={dateFrom}
                onChange={(e) => setDateUntil(e.target.value)}
                className="h-10 px-3 rounded-10 bg-app-bg border border-app-border text-sm text-app-text focus:outline-none focus:border-sage-strong transition-colors"
              />
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

        {/* Error state */}
        {isError && (
          <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-[12px] text-sm text-red-700">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">No se pudo cargar el reporte</p>
              <p className="text-xs text-red-500 mt-0.5">{(error as Error)?.message}</p>
              <button
                onClick={() => refetch()}
                className="mt-1.5 text-xs font-medium underline"
              >
                Reintentar
              </button>
            </div>
          </div>
        )}

        {/* Summary cards */}
        {!isError && rows.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-app-surface border border-app-border rounded-[12px] p-4">
              <p className="text-[11px] font-medium text-app-muted uppercase tracking-wider mb-1">Filas</p>
              <p className="text-xl font-semibold text-app-text">{rows.length.toLocaleString()}</p>
            </div>
            <div className="bg-app-surface border border-app-border rounded-[12px] p-4">
              <p className="text-[11px] font-medium text-app-muted uppercase tracking-wider mb-1">Total Tokens</p>
              <p className="text-xl font-semibold text-app-text">{formatTokens(totalTokens)}</p>
            </div>
            <div className="bg-app-surface border border-app-border rounded-[12px] p-4 col-span-2 sm:col-span-1">
              <p className="text-[11px] font-medium text-app-muted uppercase tracking-wider mb-1">Costo Total</p>
              <p className="text-xl font-semibold text-sage-strong">{formatCost(totalCost)}</p>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app overflow-hidden">
          {isFetching && rows.length === 0 ? (
            <div className="flex items-center justify-center h-40 gap-2 text-sm text-app-muted">
              <RefreshCw size={16} className="animate-spin" />
              Cargando...
            </div>
          ) : !isError && rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-app-muted">
              <Inbox size={28} strokeWidth={1.5} />
              <p className="text-sm">Sin datos para el período seleccionado</p>
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
                      Fecha
                    </th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">
                      Tokens
                    </th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">
                      Costo (USD)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={`${row.user_id}-${row.usage_date}`}
                      className={`border-b border-app-border last:border-0 transition-colors hover:bg-app-bg/60 ${
                        isFetching ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="px-5 py-3 text-app-text font-medium max-w-[220px] truncate">
                        {row.user_label}
                      </td>
                      <td className="px-5 py-3 text-app-muted tabular-nums">
                        {formatDate(row.usage_date)}
                      </td>
                      <td className="px-5 py-3 text-right text-app-text tabular-nums">
                        {formatTokens(Number(row.total_tokens))}
                      </td>
                      <td className="px-5 py-3 text-right text-sage-strong tabular-nums font-medium">
                        {formatCost(Number(row.total_cost_usd))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {rows.length > 1 && (
                  <tfoot>
                    <tr className="bg-app-bg/60 border-t-2 border-app-border">
                      <td className="px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider" colSpan={2}>
                        Total
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-app-text tabular-nums">
                        {formatTokens(totalTokens)}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-sage-strong tabular-nums">
                        {formatCost(totalCost)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
