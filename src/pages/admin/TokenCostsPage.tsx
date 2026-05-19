import { useState, useMemo } from 'react';
import { DollarSign, ChevronLeft, RefreshCw, AlertCircle, Inbox, TrendingUp, Zap, Activity } from 'lucide-react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';

interface CostReportRow {
  group_label: string;
  calls: number;
  total_tokens: number;
  cost_usd: number;
}

interface TopUserRow {
  user_label: string;
  calls: number;
  total_tokens: number;
  cost_usd: number;
}

type Period = '7d' | '30d';
type GroupBy = 'day' | 'user' | 'feature' | 'plan';

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatCost(n: number): string {
  if (n === 0) return '$0.000000';
  if (n < 0.0001) return `$${n.toFixed(8)}`;
  if (n < 0.01) return `$${n.toFixed(6)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString('en-US');
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

function getPeriodDates(period: Period): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - (period === '7d' ? 7 : 30) * 24 * 60 * 60 * 1000);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

const FEATURE_LABELS: Record<string, string> = {
  chat: 'Chat IA',
  journal_prompts: 'Sugerencias de diario',
  mood_insights: 'Insights de estado de ánimo',
};

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  power: 'Power',
  unknown: 'Sin plan',
};

function featureLabel(key: string): string {
  return FEATURE_LABELS[key] ?? key;
}

function planLabel(key: string): string {
  return PLAN_LABELS[key] ?? key;
}

function groupLabel(key: string, groupBy: GroupBy): string {
  if (groupBy === 'feature') return featureLabel(key);
  if (groupBy === 'plan') return planLabel(key);
  return key;
}

const FEATURE_COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-sky-500'];

export function TokenCostsPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [groupBy, setGroupBy] = useState<GroupBy>('feature');

  const { from, to } = useMemo(() => getPeriodDates(period), [period]);

  const {
    data: reportRows = [],
    isFetching: reportFetching,
    isError: reportError,
    error: reportErrorMsg,
    refetch: refetchReport,
  } = useQuery<CostReportRow[]>({
    queryKey: ['admin-token-costs', from, to, groupBy],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_token_cost_report', {
        p_from: from,
        p_to: to,
        p_group_by: groupBy,
      });
      if (error) throw error;
      return (data as CostReportRow[]) ?? [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const {
    data: topUsers = [],
    isFetching: usersFetching,
    isError: usersError,
  } = useQuery<TopUserRow[]>({
    queryKey: ['admin-top-users-cost', from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_top_users_by_cost', {
        p_from: from,
        p_to: to,
        p_limit: 20,
      });
      if (error) throw error;
      return (data as TopUserRow[]) ?? [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const totalCost = reportRows.reduce((s, r) => s + Number(r.cost_usd), 0);
  const totalTokens = reportRows.reduce((s, r) => s + Number(r.total_tokens), 0);
  const totalCalls = reportRows.reduce((s, r) => s + Number(r.calls), 0);
  const maxCost = Math.max(...reportRows.map((r) => Number(r.cost_usd)), 0.000001);

  const isFetching = reportFetching || usersFetching;

  const periodLabel = period === '7d' ? 'últimos 7 días' : 'últimos 30 días';

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
              <DollarSign size={20} className="text-sage-strong" />
              <h1 className="text-2xl font-semibold text-app-text">Costos de Tokens</h1>
              {isFetching && <RefreshCw size={14} className="animate-spin text-app-muted" />}
            </div>
            <p className="text-sm text-app-muted mt-0.5">Gasto estimado en OpenAI por período, función y usuario</p>
          </div>

          {/* Period selector */}
          <div className="flex items-center gap-1 bg-app-surface border border-app-border rounded-[10px] p-1">
            {(['7d', '30d'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold transition-colors ${
                  period === p
                    ? 'bg-sage-strong text-white'
                    : 'text-app-muted hover:text-app-text'
                }`}
              >
                {p === '7d' ? '7 días' : '30 días'}
              </button>
            ))}
          </div>
        </div>

        {/* Error banner */}
        {reportError && (
          <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-[12px] text-sm text-red-700">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">No se pudo cargar el reporte</p>
              <p className="text-xs text-red-500 mt-0.5">{(reportErrorMsg as Error)?.message}</p>
              <button onClick={() => refetchReport()} className="mt-1.5 text-xs font-medium underline">
                Reintentar
              </button>
            </div>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-app-surface border border-app-border rounded-[16px] p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-10 bg-emerald-50 flex items-center justify-center">
                <DollarSign size={15} className="text-emerald-600" />
              </div>
              <p className="text-[11px] font-semibold text-app-muted uppercase tracking-wider">Costo total</p>
            </div>
            <p className="text-2xl font-semibold text-sage-strong tabular-nums">{formatCost(totalCost)}</p>
            <p className="text-xs text-app-muted mt-1">{periodLabel}</p>
          </div>

          <div className="bg-app-surface border border-app-border rounded-[16px] p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-10 bg-blue-50 flex items-center justify-center">
                <Zap size={15} className="text-blue-500" />
              </div>
              <p className="text-[11px] font-semibold text-app-muted uppercase tracking-wider">Tokens usados</p>
            </div>
            <p className="text-2xl font-semibold text-app-text tabular-nums">{formatTokens(totalTokens)}</p>
            <p className="text-xs text-app-muted mt-1">{periodLabel}</p>
          </div>

          <div className="bg-app-surface border border-app-border rounded-[16px] p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-10 bg-amber-50 flex items-center justify-center">
                <Activity size={15} className="text-amber-500" />
              </div>
              <p className="text-[11px] font-semibold text-app-muted uppercase tracking-wider">Llamadas</p>
            </div>
            <p className="text-2xl font-semibold text-app-text tabular-nums">{formatNumber(totalCalls)}</p>
            <p className="text-xs text-app-muted mt-1">{periodLabel}</p>
          </div>
        </div>

        {/* Breakdown panel */}
        <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app overflow-hidden">
          <div className="px-5 py-4 border-b border-app-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-sage-strong" />
              <h2 className="text-[13px] font-semibold text-app-text">Desglose por</h2>
            </div>
            <div className="flex items-center gap-1 bg-app-bg border border-app-border rounded-[8px] p-1">
              {(['feature', 'day', 'plan', 'user'] as GroupBy[]).map((g) => {
                const labels: Record<GroupBy, string> = {
                  feature: 'Función',
                  day: 'Día',
                  plan: 'Plan',
                  user: 'Usuario',
                };
                return (
                  <button
                    key={g}
                    onClick={() => setGroupBy(g)}
                    className={`px-2.5 py-1 rounded-[6px] text-xs font-medium transition-colors ${
                      groupBy === g
                        ? 'bg-sage-strong text-white'
                        : 'text-app-muted hover:text-app-text'
                    }`}
                  >
                    {labels[g]}
                  </button>
                );
              })}
            </div>
          </div>

          {reportFetching && reportRows.length === 0 ? (
            <div className="flex items-center justify-center h-40 gap-2 text-sm text-app-muted">
              <RefreshCw size={16} className="animate-spin" />
              Cargando...
            </div>
          ) : !reportError && reportRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-app-muted">
              <Inbox size={28} strokeWidth={1.5} />
              <p className="text-sm">Sin datos para el período seleccionado</p>
            </div>
          ) : !reportError ? (
            <div className="p-5 space-y-3">
              {reportRows.map((row, i) => {
                const cost = Number(row.cost_usd);
                const pct = maxCost > 0 ? (cost / maxCost) * 100 : 0;
                const colorClass = FEATURE_COLORS[i % FEATURE_COLORS.length];
                return (
                  <div key={row.group_label} className={reportFetching ? 'opacity-50' : ''}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colorClass}`} />
                        <span className="text-sm font-medium text-app-text">
                          {groupLabel(row.group_label, groupBy)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs tabular-nums">
                        <span className="text-app-muted">{formatNumber(Number(row.calls))} llamadas</span>
                        <span className="text-app-muted">{formatTokens(Number(row.total_tokens))}</span>
                        <span className="font-semibold text-sage-strong w-20 text-right">{formatCost(cost)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-app-bg rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
                        style={{ width: `${Math.max(pct, 1)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Top 20 Users table */}
        <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app overflow-hidden">
          <div className="px-5 py-4 border-b border-app-border flex items-center gap-2">
            <Activity size={15} className="text-sage-strong" />
            <h2 className="text-[13px] font-semibold text-app-text">Top 20 usuarios por costo</h2>
            <span className="ml-auto text-[11px] text-app-muted">{periodLabel}</span>
          </div>

          {usersFetching && topUsers.length === 0 ? (
            <div className="flex items-center justify-center h-32 gap-2 text-sm text-app-muted">
              <RefreshCw size={16} className="animate-spin" />
              Cargando...
            </div>
          ) : !usersError && topUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-app-muted">
              <Inbox size={24} strokeWidth={1.5} />
              <p className="text-sm">Sin datos</p>
            </div>
          ) : !usersError ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-app-border">
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider w-8">#</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">Usuario</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">Llamadas</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">Tokens</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">Costo (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {topUsers.map((row, i) => (
                    <tr
                      key={row.user_label}
                      className={`border-b border-app-border last:border-0 hover:bg-app-bg/60 transition-colors ${
                        usersFetching ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="px-5 py-3 text-app-muted text-xs tabular-nums">{i + 1}</td>
                      <td className="px-5 py-3 text-app-text font-medium max-w-[260px] truncate">
                        {row.user_label}
                      </td>
                      <td className="px-5 py-3 text-right text-app-muted tabular-nums">
                        {formatNumber(Number(row.calls))}
                      </td>
                      <td className="px-5 py-3 text-right text-app-text tabular-nums">
                        {formatTokens(Number(row.total_tokens))}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-sage-strong tabular-nums">
                        {formatCost(Number(row.cost_usd))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {topUsers.length > 1 && (
                  <tfoot>
                    <tr className="bg-app-bg/60 border-t-2 border-app-border">
                      <td className="px-5 py-3" colSpan={2}>
                        <span className="text-[11px] font-semibold text-app-muted uppercase tracking-wider">Total</span>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-app-text tabular-nums text-sm">
                        {formatNumber(topUsers.reduce((s, r) => s + Number(r.calls), 0))}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-app-text tabular-nums text-sm">
                        {formatTokens(topUsers.reduce((s, r) => s + Number(r.total_tokens), 0))}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-sage-strong tabular-nums text-sm">
                        {formatCost(topUsers.reduce((s, r) => s + Number(r.cost_usd), 0))}
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
