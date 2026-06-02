import { useMemo } from 'react';
import { CreditCard, ChevronLeft, RefreshCw, AlertCircle, Inbox, DollarSign, Zap, Activity, Users } from 'lucide-react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';

interface CycleRow {
  user_id: string;
  user_label: string;
  plan_key: string;
  cycle_start: string;
  calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
}

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  power: 'Power',
};

const PLAN_COLORS: Record<string, string> = {
  starter: 'bg-slate-100 text-slate-600',
  pro:     'bg-blue-50 text-blue-600',
  power:   'bg-amber-50 text-amber-600',
};

function formatCost(n: number): string {
  if (n === 0) return '$0.00';
  if (n < 0.0001) return `$${n.toFixed(8)}`;
  if (n < 0.01)   return `$${n.toFixed(6)}`;
  if (n < 1)      return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString('en-US');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

export function CostPerCyclePage() {
  const {
    data: rows = [],
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<CycleRow[]>({
    queryKey: ['admin-cost-per-cycle'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_cost_per_cycle');
      if (error) throw error;
      return (data as CycleRow[]) ?? [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const totals = useMemo(() => ({
    calls:        rows.reduce((s, r) => s + Number(r.calls), 0),
    totalTokens:  rows.reduce((s, r) => s + Number(r.total_tokens), 0),
    cost:         rows.reduce((s, r) => s + Number(r.cost_usd), 0),
    activeUsers:  rows.filter(r => Number(r.calls) > 0).length,
  }), [rows]);

  const maxCost = Math.max(...rows.map(r => Number(r.cost_usd)), 0.000001);

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
              <CreditCard size={20} className="text-sage-strong" />
              <h1 className="text-2xl font-semibold text-app-text">Costo por Ciclo</h1>
              {isFetching && <RefreshCw size={14} className="animate-spin text-app-muted" />}
            </div>
            <p className="text-sm text-app-muted mt-0.5">
              Consumo y gasto por usuario desde el inicio de su ciclo activo
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="mt-0.5 p-2 rounded-10 bg-app-surface border border-app-border hover:border-sage-strong transition-colors text-app-muted hover:text-sage-strong disabled:opacity-50"
            title="Actualizar"
          >
            <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Error */}
        {isError && (
          <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-[12px] text-sm text-red-700">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">No se pudo cargar el reporte</p>
              <p className="text-xs text-red-500 mt-0.5">{(error as Error)?.message}</p>
              <button onClick={() => refetch()} className="mt-1.5 text-xs font-medium underline">
                Reintentar
              </button>
            </div>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-app-surface border border-app-border rounded-[16px] p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-10 bg-emerald-50 flex items-center justify-center">
                <DollarSign size={15} className="text-emerald-600" />
              </div>
              <p className="text-[11px] font-semibold text-app-muted uppercase tracking-wider">Costo total</p>
            </div>
            <p className="text-2xl font-semibold text-sage-strong tabular-nums">{formatCost(totals.cost)}</p>
            <p className="text-xs text-app-muted mt-1">todos los ciclos activos</p>
          </div>

          <div className="bg-app-surface border border-app-border rounded-[16px] p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-10 bg-blue-50 flex items-center justify-center">
                <Zap size={15} className="text-blue-500" />
              </div>
              <p className="text-[11px] font-semibold text-app-muted uppercase tracking-wider">Tokens</p>
            </div>
            <p className="text-2xl font-semibold text-app-text tabular-nums">{formatTokens(totals.totalTokens)}</p>
            <p className="text-xs text-app-muted mt-1">total consumido</p>
          </div>

          <div className="bg-app-surface border border-app-border rounded-[16px] p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-10 bg-amber-50 flex items-center justify-center">
                <Activity size={15} className="text-amber-500" />
              </div>
              <p className="text-[11px] font-semibold text-app-muted uppercase tracking-wider">Llamadas</p>
            </div>
            <p className="text-2xl font-semibold text-app-text tabular-nums">{totals.calls.toLocaleString()}</p>
            <p className="text-xs text-app-muted mt-1">total de requests</p>
          </div>

          <div className="bg-app-surface border border-app-border rounded-[16px] p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-10 bg-violet-50 flex items-center justify-center">
                <Users size={15} className="text-violet-500" />
              </div>
              <p className="text-[11px] font-semibold text-app-muted uppercase tracking-wider">Activos</p>
            </div>
            <p className="text-2xl font-semibold text-app-text tabular-nums">
              {totals.activeUsers}
              <span className="text-base text-app-muted font-normal"> / {rows.length}</span>
            </p>
            <p className="text-xs text-app-muted mt-1">usuarios con uso</p>
          </div>
        </div>

        {/* Per-user table */}
        <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app overflow-hidden">
          <div className="px-5 py-4 border-b border-app-border flex items-center gap-2">
            <CreditCard size={15} className="text-sage-strong" />
            <h2 className="text-[13px] font-semibold text-app-text">Detalle por usuario</h2>
            <span className="ml-auto text-[11px] text-app-muted">Medido desde inicio de ciclo</span>
          </div>

          {isFetching && rows.length === 0 ? (
            <div className="flex items-center justify-center h-40 gap-2 text-sm text-app-muted">
              <RefreshCw size={16} className="animate-spin" />
              Cargando...
            </div>
          ) : !isError && rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-app-muted">
              <Inbox size={28} strokeWidth={1.5} />
              <p className="text-sm">Sin datos de usuarios</p>
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
                      Plan
                    </th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">
                      Inicio ciclo
                    </th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">
                      Llamadas
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
                  {rows.map((row) => {
                    const cost = Number(row.cost_usd);
                    const pct  = maxCost > 0 ? (cost / maxCost) * 100 : 0;
                    const planLabel = PLAN_LABELS[row.plan_key] ?? row.plan_key;
                    const planColor = PLAN_COLORS[row.plan_key] ?? 'bg-slate-100 text-slate-600';
                    const days = daysSince(row.cycle_start);
                    const hasUsage = Number(row.calls) > 0;

                    return (
                      <tr
                        key={row.user_id}
                        className={`border-b border-app-border last:border-0 hover:bg-app-bg/60 transition-colors ${
                          isFetching ? 'opacity-50' : ''
                        } ${!hasUsage ? 'opacity-60' : ''}`}
                      >
                        {/* User */}
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-1 max-w-[220px]">
                            <span className="text-app-text font-medium truncate text-[13px]">
                              {row.user_label}
                            </span>
                            {/* Cost bar */}
                            {hasUsage && (
                              <div className="h-1 bg-app-border rounded-full overflow-hidden w-full">
                                <div
                                  className="h-full bg-sage-strong/70 rounded-full transition-all duration-500"
                                  style={{ width: `${Math.max(pct, 2)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Plan */}
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${planColor}`}>
                            {planLabel}
                          </span>
                        </td>

                        {/* Cycle start */}
                        <td className="px-5 py-4">
                          <div className="flex flex-col">
                            <span className="text-app-text text-[13px] tabular-nums">
                              {formatDate(row.cycle_start)}
                            </span>
                            <span className="text-[11px] text-app-muted">
                              {days === 0 ? 'hoy' : `hace ${days}d`}
                            </span>
                          </div>
                        </td>

                        {/* Calls */}
                        <td className="px-5 py-4 text-right tabular-nums text-app-muted text-[13px]">
                          {Number(row.calls).toLocaleString()}
                        </td>

                        {/* Tokens */}
                        <td className="px-5 py-4 text-right tabular-nums text-app-text text-[13px]">
                          <div className="flex flex-col items-end">
                            <span>{formatTokens(Number(row.total_tokens))}</span>
                            {hasUsage && (
                              <span className="text-[11px] text-app-muted">
                                {formatTokens(Number(row.prompt_tokens))} in / {formatTokens(Number(row.completion_tokens))} out
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Cost */}
                        <td className="px-5 py-4 text-right tabular-nums">
                          <span className={`text-[15px] font-semibold ${hasUsage ? 'text-sage-strong' : 'text-app-muted'}`}>
                            {formatCost(cost)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {rows.length > 1 && (
                  <tfoot>
                    <tr className="bg-app-bg/60 border-t-2 border-app-border">
                      <td className="px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider" colSpan={3}>
                        Total
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-app-text tabular-nums text-sm">
                        {totals.calls.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-app-text tabular-nums text-sm">
                        {formatTokens(totals.totalTokens)}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-sage-strong tabular-nums text-sm">
                        {formatCost(totals.cost)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ) : null}
        </div>

        {/* Pricing note */}
        <p className="text-[11px] text-app-muted text-center pb-2">
          Precios: Claude Sonnet $3.00/1M entrada · $15.00/1M salida · GPT-4o-mini $0.15/1M entrada · $0.60/1M salida
        </p>

      </div>
    </div>
  );
}
