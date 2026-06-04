import { useState, useCallback, useMemo } from 'react';
import { BarChart3, ChevronLeft, RefreshCw, AlertCircle, Inbox, Download } from 'lucide-react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';

interface ReportRow {
  user_id: string;
  user_label: string;
  usage_date: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
}

interface UserOption {
  user_id: string;
  user_label: string;
}

/** Always returns YYYY-MM-DD in the user's local timezone — never UTC */
function localToday(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function localDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString('en-US');
}

function formatCost(n: number): string {
  if (n === 0)    return '$0.000000';
  if (n < 0.0001) return `$${n.toFixed(8)}`;
  if (n < 0.01)   return `$${n.toFixed(6)}`;
  return `$${n.toFixed(4)}`;
}

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

export function TokenUsagePage() {
  // Default: today → today. Computed fresh on every mount via inline arrow.
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [dateFrom,     setDateFrom]     = useState<string>(() => localToday());
  const [dateUntil,    setDateUntil]    = useState<string>(() => localToday());

  // appliedFrom/Until are what was last submitted with Aplicar.
  // Initialised to today as well.
  const [appliedUser,  setAppliedUser]  = useState<string>('');
  const [appliedFrom,  setAppliedFrom]  = useState<string>(() => localToday());
  const [appliedUntil, setAppliedUntil] = useState<string>(() => localToday());

  const handleApply = useCallback(() => {
    setAppliedUser(selectedUser);
    setAppliedFrom(dateFrom);
    setAppliedUntil(dateUntil);
  }, [selectedUser, dateFrom, dateUntil]);

  const setLast30 = useCallback(() => {
    const from  = localDaysAgo(30);
    const until = localToday();
    setDateFrom(from);
    setDateUntil(until);
    setAppliedUser(selectedUser);
    setAppliedFrom(from);
    setAppliedUntil(until);
  }, [selectedUser]);

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
    queryKey: ['admin-token-usage', appliedUser, appliedFrom, appliedUntil],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_token_usage_report', {
        p_date_from:  appliedFrom,
        p_date_until: appliedUntil,
        p_user_id:    appliedUser || null,
      });
      if (error) throw error;
      return data as ReportRow[];
    },
    staleTime: 0,
  });

  const totals = useMemo(() => ({
    distinctUsers:    new Set(rows.map(r => r.user_id)).size,
    promptTokens:     rows.reduce((s, r) => s + Number(r.prompt_tokens),     0),
    completionTokens: rows.reduce((s, r) => s + Number(r.completion_tokens), 0),
    totalTokens:      rows.reduce((s, r) => s + Number(r.total_tokens),      0),
    cost:             rows.reduce((s, r) => s + Number(r.total_cost_usd),    0),
  }), [rows]);

  // ── CSV export ────────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    if (rows.length === 0) return;
    const userLabel = appliedUser
      ? (users.find(u => u.user_id === appliedUser)?.user_label ?? appliedUser)
      : 'Todos';
    const esc = (v: string | number) => {
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = ['Usuario','Fecha','Tokens Entrada','Tokens Salida','Total Tokens','Costo (USD)'];
    const dataRows: (string | number)[][] = rows.map(r => [
      r.user_label, formatDate(r.usage_date),
      Number(r.prompt_tokens), Number(r.completion_tokens),
      Number(r.total_tokens),  Number(r.total_cost_usd),
    ]);
    dataRows.push(['TOTAL','', totals.promptTokens, totals.completionTokens, totals.totalTokens, totals.cost]);
    const summary: (string | number)[][] = [
      [],['--- Resumen ---'],
      ['Usuarios', totals.distinctUsers],
      ['Tokens Entrada', totals.promptTokens],
      ['Tokens Salida', totals.completionTokens],
      ['Total Tokens', totals.totalTokens],
      ['Costo Total (USD)', totals.cost],
      ['Costo/M Tokens', totals.totalTokens > 0 ? +((totals.cost / totals.totalTokens) * 1e6).toFixed(4) : 0],
      [],
      ['Filtro Usuario', userLabel],
      ['Filtro Desde', appliedFrom],
      ['Filtro Hasta', appliedUntil],
      ['Exportado', new Date().toLocaleString('es-MX')],
    ];
    const csv = '\uFEFF' + [headers, ...dataRows, ...summary].map(r => r.map(esc).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), {
      href:     URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
      download: `tuanimo-tokens_${appliedFrom}_${appliedUntil}.csv`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  }, [rows, totals, appliedUser, appliedFrom, appliedUntil, users]);

  return (
    <div
      className="bg-app-bg p-5 space-y-5"
      style={{ minHeight: 'calc(100dvh - var(--chrome-total))', paddingBottom: 'calc(var(--nav-total) + 1.5rem)' }}
    >
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-start gap-4">
          <Link href="/app/admin" className="mt-0.5 p-2 rounded-10 bg-app-surface border border-app-border hover:border-sage-strong transition-colors text-app-muted hover:text-sage-strong">
            <ChevronLeft size={16} />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <BarChart3 size={20} className="text-sage-strong" />
              <h1 className="text-2xl font-semibold text-app-text">Uso de Tokens</h1>
              {isFetching && <RefreshCw size={14} className="animate-spin text-app-muted" />}
            </div>
            <p className="text-sm text-app-muted mt-0.5">Consumo y costo por usuario y fecha</p>
          </div>
          <button
            onClick={handleExport}
            disabled={rows.length === 0 || isFetching}
            title="Exportar a CSV"
            className="mt-0.5 flex items-center gap-2 h-9 px-4 rounded-10 bg-app-surface border border-app-border text-sm font-medium text-app-text hover:border-sage-strong hover:text-sage-strong transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={15} />
            <span className="hidden sm:inline">CSV</span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
            <div>
              <label className="text-[11px] font-medium text-app-muted uppercase tracking-wider block mb-1.5">Usuario</label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full h-10 px-3 rounded-10 bg-app-bg border border-app-border text-sm text-app-text focus:outline-none focus:border-sage-strong transition-colors"
              >
                <option value="">Todos los usuarios</option>
                {users.map((u) => (
                  <option key={u.user_id} value={u.user_id}>{u.user_label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-app-muted uppercase tracking-wider block mb-1.5">Desde</label>
              <input
                type="date" value={dateFrom} max={dateUntil}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-10 px-3 rounded-10 bg-app-bg border border-app-border text-sm text-app-text focus:outline-none focus:border-sage-strong transition-colors"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-app-muted uppercase tracking-wider block mb-1.5">Hasta</label>
              <input
                type="date" value={dateUntil} min={dateFrom}
                onChange={(e) => setDateUntil(e.target.value)}
                className="h-10 px-3 rounded-10 bg-app-bg border border-app-border text-sm text-app-text focus:outline-none focus:border-sage-strong transition-colors"
              />
            </div>
            <button
              onClick={handleApply} disabled={isFetching}
              className="h-10 px-5 rounded-10 bg-sage-strong text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-2"
            >
              {isFetching ? <RefreshCw size={14} className="animate-spin" /> : null}
              Aplicar
            </button>
          </div>
          {/* Quick range shortcuts */}
          <div className="flex gap-2">
            <button
              onClick={setLast30}
              className="text-[11px] font-medium text-app-muted hover:text-sage-strong underline underline-offset-2 transition-colors"
            >
              Últimos 30 días
            </button>
          </div>
        </div>

        {/* Error */}
        {isError && (
          <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-[12px] text-sm text-red-700">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">No se pudo cargar el reporte</p>
              <p className="text-xs text-red-500 mt-0.5">{(error as Error)?.message}</p>
              <button onClick={() => refetch()} className="mt-1.5 text-xs font-medium underline">Reintentar</button>
            </div>
          </div>
        )}

        {/* Summary cards */}
        {!isError && rows.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Usuarios', value: String(totals.distinctUsers) },
              {
                label: 'Total Tokens',
                value: formatTokens(totals.totalTokens),
                sub: `${formatTokens(totals.promptTokens)} in · ${formatTokens(totals.completionTokens)} out`,
              },
              { label: 'Costo Total', value: formatCost(totals.cost), green: true },
              {
                label: 'Costo / Token',
                value: totals.totalTokens > 0 ? `$${((totals.cost / totals.totalTokens) * 1e6).toFixed(2)}/M` : '—',
              },
            ].map(({ label, value, sub, green }) => (
              <div key={label} className="bg-app-surface border border-app-border rounded-[12px] p-4">
                <p className="text-[11px] font-medium text-app-muted uppercase tracking-wider mb-1">{label}</p>
                <p className={`text-xl font-semibold ${green ? 'text-sage-strong' : 'text-app-text'}`}>{value}</p>
                {sub && <p className="text-[11px] text-app-muted mt-0.5">{sub}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app overflow-hidden">
          {isFetching && rows.length === 0 ? (
            <div className="flex items-center justify-center h-40 gap-2 text-sm text-app-muted">
              <RefreshCw size={16} className="animate-spin" /> Cargando...
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
                    {['Usuario','Fecha','Entrada','Salida','Total','Costo (USD)'].map((h, i) => (
                      <th key={h} className={`px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider ${i < 2 ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.user_id}-${row.usage_date}`} className={`border-b border-app-border last:border-0 transition-colors hover:bg-app-bg/60 ${isFetching ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-3 text-app-text font-medium max-w-[200px] truncate">{row.user_label}</td>
                      <td className="px-5 py-3 text-app-muted tabular-nums">{formatDate(row.usage_date)}</td>
                      <td className="px-5 py-3 text-right text-app-muted tabular-nums">{formatTokens(Number(row.prompt_tokens))}</td>
                      <td className="px-5 py-3 text-right text-app-muted tabular-nums">{formatTokens(Number(row.completion_tokens))}</td>
                      <td className="px-5 py-3 text-right text-app-text tabular-nums font-medium">{formatTokens(Number(row.total_tokens))}</td>
                      <td className="px-5 py-3 text-right text-sage-strong tabular-nums font-semibold">{formatCost(Number(row.total_cost_usd))}</td>
                    </tr>
                  ))}
                </tbody>
                {rows.length > 1 && (
                  <tfoot>
                    <tr className="bg-app-bg/60 border-t-2 border-app-border">
                      <td className="px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider" colSpan={2}>Total</td>
                      <td className="px-5 py-3 text-right font-semibold text-app-muted tabular-nums">{formatTokens(totals.promptTokens)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-app-muted tabular-nums">{formatTokens(totals.completionTokens)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-app-text tabular-nums">{formatTokens(totals.totalTokens)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-sage-strong tabular-nums">{formatCost(totals.cost)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ) : null}
        </div>

        <p className="text-[11px] text-app-muted text-center pb-2">
          Precios: Claude Sonnet $3.00/1M entrada · $15.00/1M salida · GPT-4o-mini $0.15/1M entrada · $0.60/1M salida
        </p>

      </div>
    </div>
  );
}
