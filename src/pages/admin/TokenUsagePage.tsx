import { useState, useCallback, useMemo } from 'react';
import { BarChart3, ChevronLeft, RefreshCw, AlertCircle, Inbox, Download, Users, List } from 'lucide-react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface CycleSummaryRow {
  user_id: string;
  email: string;
  plan_key: string;
  signup_date: string;
  cycle_start: string;
  cycle_end: string;
  cycle_tokens_used: number;
  cycle_tokens_limit: number;
  cycle_cost_usd: number;
  daily_tokens_used: number;
  daily_tokens_limit: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function localToday(): string {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
}
function localDaysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate()-n);
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
}
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n/1_000).toFixed(1)}k`;
  return n.toLocaleString('en-US');
}
function formatCost(n: number): string {
  if (n === 0)    return '$0.0000';
  if (n < 0.0001) return `$${n.toFixed(8)}`;
  if (n < 0.01)   return `$${n.toFixed(6)}`;
  return `$${n.toFixed(4)}`;
}
function formatDate(iso: string): string { return iso.slice(0,10); }

const PLAN_LABELS: Record<string,string> = { starter:'Starter', pro:'Pro', power:'Power' };

// ── Cycle progress bar ────────────────────────────────────────────────────────

function CycleBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min((used/limit)*100, 100) : 0;
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-sage-strong';
  return (
    <div className="w-full">
      <div className="h-1.5 bg-app-border rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width:`${pct}%` }} />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[10px] text-app-muted">{formatTokens(used)} usado</span>
        <span className="text-[10px] text-app-muted">{formatTokens(limit - used)} restante</span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type ViewMode = 'detail' | 'summary';

export function TokenUsagePage() {
  const [viewMode, setViewMode]     = useState<ViewMode>('detail');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [dateFrom,     setDateFrom]     = useState<string>(() => localToday());
  const [dateUntil,    setDateUntil]    = useState<string>(() => localToday());
  const [appliedUser,  setAppliedUser]  = useState<string>('');
  const [appliedFrom,  setAppliedFrom]  = useState<string>(() => localToday());
  const [appliedUntil, setAppliedUntil] = useState<string>(() => localToday());

  const handleApply = useCallback(() => {
    setAppliedUser(selectedUser);
    setAppliedFrom(dateFrom);
    setAppliedUntil(dateUntil);
  }, [selectedUser, dateFrom, dateUntil]);

  const setLast30 = useCallback(() => {
    const from = localDaysAgo(30), until = localToday();
    setDateFrom(from); setDateUntil(until);
    setAppliedUser(selectedUser); setAppliedFrom(from); setAppliedUntil(until);
  }, [selectedUser]);

  // Users dropdown
  const { data: users = [] } = useQuery<UserOption[]>({
    queryKey: ['admin-users-with-usage'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_users_with_usage');
      if (error) throw error;
      return data as UserOption[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Detail view data
  const { data: rows = [], isFetching: fetchingRows, isError: errorRows, error: errRows, refetch } =
    useQuery<ReportRow[]>({
      queryKey: ['admin-token-usage', appliedUser, appliedFrom, appliedUntil],
      queryFn: async () => {
        const { data, error } = await supabase.rpc('admin_token_usage_report', {
          p_date_from: appliedFrom, p_date_until: appliedUntil,
          p_user_id: appliedUser || null,
        });
        if (error) throw error;
        return data as ReportRow[];
      },
      staleTime: 0,
      enabled: viewMode === 'detail',
    });

  // Summary view data
  const { data: summaryRows = [], isFetching: fetchingSummary, isError: errorSummary } =
    useQuery<CycleSummaryRow[]>({
      queryKey: ['admin-cycle-summary'],
      queryFn: async () => {
        const { data, error } = await supabase.rpc('admin_user_cycle_summary');
        if (error) throw error;
        return data as CycleSummaryRow[];
      },
      staleTime: 60_000,
      enabled: viewMode === 'summary',
    });

  const isFetching = viewMode === 'detail' ? fetchingRows : fetchingSummary;

  const totals = useMemo(() => ({
    distinctUsers:    new Set(rows.map(r => r.user_id)).size,
    promptTokens:     rows.reduce((s,r) => s + Number(r.prompt_tokens), 0),
    completionTokens: rows.reduce((s,r) => s + Number(r.completion_tokens), 0),
    totalTokens:      rows.reduce((s,r) => s + Number(r.total_tokens), 0),
    cost:             rows.reduce((s,r) => s + Number(r.total_cost_usd), 0),
  }), [rows]);

  // CSV export
  const handleExport = useCallback(() => {
    if (viewMode === 'detail') {
      if (rows.length === 0) return;
      const esc = (v: string|number) => { const s=String(v); return s.includes(',')||s.includes('"')||s.includes('\n')?`"${s.replace(/"/g,'""')}"`:`${s}`; };
      const headers = ['Usuario','Fecha','Tokens Entrada','Tokens Salida','Total Tokens','Costo (USD)'];
      const data: (string|number)[][] = rows.map(r => [r.user_label, formatDate(r.usage_date), Number(r.prompt_tokens), Number(r.completion_tokens), Number(r.total_tokens), Number(r.total_cost_usd)]);
      data.push(['TOTAL','',totals.promptTokens,totals.completionTokens,totals.totalTokens,totals.cost]);
      const csv = '\uFEFF' + [headers,...data].map(r=>r.map(esc).join(',')).join('\n');
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})), download:`tuanimo-tokens_${appliedFrom}_${appliedUntil}.csv` });
      a.click(); URL.revokeObjectURL(a.href);
    } else {
      if (summaryRows.length === 0) return;
      const esc = (v: string|number) => { const s=String(v); return s.includes(',')||s.includes('"')?`"${s.replace(/"/g,'""')}"`:`${s}`; };
      const headers = ['Usuario','Plan','Alta','Inicio Ciclo','Fin Ciclo','Tokens Usados','Límite','% Usado','Tokens Restantes','Costo Ciclo (USD)'];
      const data = summaryRows.map(r => {
        const pct = r.cycle_tokens_limit > 0 ? ((r.cycle_tokens_used/r.cycle_tokens_limit)*100).toFixed(1)+'%' : '0%';
        return [r.email, PLAN_LABELS[r.plan_key]??r.plan_key, r.signup_date, formatDate(r.cycle_start), formatDate(r.cycle_end), Number(r.cycle_tokens_used), Number(r.cycle_tokens_limit), pct, Number(r.cycle_tokens_limit)-Number(r.cycle_tokens_used), Number(r.cycle_cost_usd)];
      });
      const csv = '\uFEFF' + [headers,...data].map(r=>r.map(esc).join(',')).join('\n');
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})), download:`tuanimo-ciclos_${localToday()}.csv` });
      a.click(); URL.revokeObjectURL(a.href);
    }
  }, [viewMode, rows, summaryRows, totals, appliedFrom, appliedUntil]);

  return (
    <div className="bg-app-bg p-5 space-y-5" style={{ minHeight:'calc(100dvh - var(--chrome-total))', paddingBottom:'calc(var(--nav-total) + 1.5rem)' }}>
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

          {/* View toggle */}
          <div className="mt-0.5 flex items-center gap-1 bg-app-surface border border-app-border rounded-10 p-1">
            <button
              onClick={() => setViewMode('detail')}
              title="Vista detalle"
              className={`flex items-center gap-1.5 h-7 px-3 rounded-[8px] text-xs font-medium transition-colors ${viewMode==='detail' ? 'bg-sage-strong text-white' : 'text-app-muted hover:text-app-text'}`}
            >
              <List size={13} /> Detalle
            </button>
            <button
              onClick={() => setViewMode('summary')}
              title="Resumen por usuario"
              className={`flex items-center gap-1.5 h-7 px-3 rounded-[8px] text-xs font-medium transition-colors ${viewMode==='summary' ? 'bg-sage-strong text-white' : 'text-app-muted hover:text-app-text'}`}
            >
              <Users size={13} /> Por usuario
            </button>
          </div>

          <button
            onClick={handleExport}
            disabled={(viewMode==='detail' ? rows.length===0 : summaryRows.length===0) || isFetching}
            title="Exportar a CSV"
            className="mt-0.5 flex items-center gap-2 h-9 px-4 rounded-10 bg-app-surface border border-app-border text-sm font-medium text-app-text hover:border-sage-strong hover:text-sage-strong transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={15} />
            <span className="hidden sm:inline">CSV</span>
          </button>
        </div>

        {/* ── DETAIL VIEW ── */}
        {viewMode === 'detail' && (<>

          {/* Filters */}
          <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app p-5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
              <div>
                <label className="text-[11px] font-medium text-app-muted uppercase tracking-wider block mb-1.5">Usuario</label>
                <select value={selectedUser} onChange={e=>setSelectedUser(e.target.value)}
                  className="w-full h-10 px-3 rounded-10 bg-app-bg border border-app-border text-sm text-app-text focus:outline-none focus:border-sage-strong transition-colors">
                  <option value="">Todos los usuarios</option>
                  {users.map(u => <option key={u.user_id} value={u.user_id}>{u.user_label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-app-muted uppercase tracking-wider block mb-1.5">Desde</label>
                <input type="date" value={dateFrom} max={dateUntil} onChange={e=>setDateFrom(e.target.value)}
                  className="h-10 px-3 rounded-10 bg-app-bg border border-app-border text-sm text-app-text focus:outline-none focus:border-sage-strong transition-colors" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-app-muted uppercase tracking-wider block mb-1.5">Hasta</label>
                <input type="date" value={dateUntil} min={dateFrom} onChange={e=>setDateUntil(e.target.value)}
                  className="h-10 px-3 rounded-10 bg-app-bg border border-app-border text-sm text-app-text focus:outline-none focus:border-sage-strong transition-colors" />
              </div>
              <button onClick={handleApply} disabled={fetchingRows}
                className="h-10 px-5 rounded-10 bg-sage-strong text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-2">
                {fetchingRows ? <RefreshCw size={14} className="animate-spin" /> : null}
                Aplicar
              </button>
            </div>
            <button onClick={setLast30} className="text-[11px] font-medium text-app-muted hover:text-sage-strong underline underline-offset-2 transition-colors">
              Últimos 30 días
            </button>
          </div>

          {/* Error */}
          {errorRows && (
            <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-[12px] text-sm text-red-700">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">No se pudo cargar el reporte</p>
                <p className="text-xs text-red-500 mt-0.5">{(errRows as Error)?.message}</p>
                <button onClick={() => refetch()} className="mt-1.5 text-xs font-medium underline">Reintentar</button>
              </div>
            </div>
          )}

          {/* Summary cards */}
          {!errorRows && rows.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label:'Usuarios', value: String(totals.distinctUsers) },
                { label:'Total Tokens', value: formatTokens(totals.totalTokens), sub:`${formatTokens(totals.promptTokens)} in · ${formatTokens(totals.completionTokens)} out` },
                { label:'Costo Total', value: formatCost(totals.cost), green:true },
                { label:'Costo / Token', value: totals.totalTokens>0 ? `$${((totals.cost/totals.totalTokens)*1e6).toFixed(2)}/M` : '—' },
              ].map(({label,value,sub,green}) => (
                <div key={label} className="bg-app-surface border border-app-border rounded-[12px] p-4">
                  <p className="text-[11px] font-medium text-app-muted uppercase tracking-wider mb-1">{label}</p>
                  <p className={`text-xl font-semibold ${green?'text-sage-strong':'text-app-text'}`}>{value}</p>
                  {sub && <p className="text-[11px] text-app-muted mt-0.5">{sub}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Detail table */}
          <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app overflow-hidden">
            {fetchingRows && rows.length===0 ? (
              <div className="flex items-center justify-center h-40 gap-2 text-sm text-app-muted"><RefreshCw size={16} className="animate-spin" /> Cargando...</div>
            ) : !errorRows && rows.length===0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-app-muted"><Inbox size={28} strokeWidth={1.5}/><p className="text-sm">Sin datos para el período seleccionado</p></div>
            ) : !errorRows ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-app-border">
                      {['Usuario','Fecha','Entrada','Salida','Total','Costo (USD)'].map((h,i)=>(
                        <th key={h} className={`px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider ${i<2?'text-left':'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row=>(
                      <tr key={`${row.user_id}-${row.usage_date}`} className={`border-b border-app-border last:border-0 hover:bg-app-bg/60 ${fetchingRows?'opacity-50':''}`}>
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
        </>)}

        {/* ── SUMMARY VIEW ── */}
        {viewMode === 'summary' && (
          <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app overflow-hidden">
            {fetchingSummary && summaryRows.length===0 ? (
              <div className="flex items-center justify-center h-40 gap-2 text-sm text-app-muted"><RefreshCw size={16} className="animate-spin" /> Cargando...</div>
            ) : errorSummary ? (
              <div className="flex items-center justify-center h-40 text-sm text-red-500">Error al cargar resumen</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-app-border">
                      <th className="text-left px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">Usuario</th>
                      <th className="text-left px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">Plan</th>
                      <th className="text-left px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">Ciclo actual</th>
                      <th className="px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">Uso del ciclo</th>
                      <th className="text-right px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">Costo ciclo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryRows.map(row => {
                      const pct = row.cycle_tokens_limit > 0
                        ? Math.min((Number(row.cycle_tokens_used)/Number(row.cycle_tokens_limit))*100, 100)
                        : 0;
                      const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-sage-strong';
                      const remaining = Number(row.cycle_tokens_limit) - Number(row.cycle_tokens_used);
                      return (
                        <tr key={row.user_id} className="border-b border-app-border last:border-0 hover:bg-app-bg/60">
                          <td className="px-5 py-4 text-app-text font-medium max-w-[180px] truncate">
                            {row.email}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              row.plan_key==='power' ? 'bg-sage-strong/10 text-sage-strong' :
                              row.plan_key==='pro'   ? 'bg-blue-50 text-blue-600' :
                              'bg-app-border/60 text-app-muted'
                            }`}>
                              {PLAN_LABELS[row.plan_key] ?? row.plan_key}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-[12px] text-app-muted tabular-nums">
                              {formatDate(row.cycle_start)} → {formatDate(row.cycle_end)}
                            </p>
                          </td>
                          <td className="px-5 py-4 min-w-[200px]">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[12px] text-app-text font-medium">{formatTokens(Number(row.cycle_tokens_used))}</span>
                              <span className="text-[12px] text-app-muted">/ {formatTokens(Number(row.cycle_tokens_limit))}</span>
                            </div>
                            <div className="h-1.5 bg-app-border rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${barColor}`} style={{ width:`${pct}%` }} />
                            </div>
                            <p className="text-[10px] text-app-muted mt-0.5">
                              {pct.toFixed(1)}% · {formatTokens(remaining > 0 ? remaining : 0)} restantes
                            </p>
                          </td>
                          <td className="px-5 py-4 text-right text-sage-strong tabular-nums font-semibold">
                            {formatCost(Number(row.cycle_cost_usd))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <p className="text-[11px] text-app-muted text-center pb-2">
          Precios: Claude Sonnet $3.00/1M entrada · $15.00/1M salida · GPT-4o-mini $0.15/1M entrada · $0.60/1M salida
        </p>

      </div>
    </div>
  );
}