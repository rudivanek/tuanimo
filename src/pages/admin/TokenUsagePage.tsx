import { useState, useCallback, useMemo } from 'react';
import { BarChart3, ChevronLeft, RefreshCw, AlertCircle, Inbox, Download, Users, List, Zap, MessageSquare } from 'lucide-react';
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

interface ModelRow {
  model: string;
  calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  total_tokens: number;
  cost_usd: number;
}

// Original baseline config (what was hardcoded before AI settings)
const BASELINE = {
  model:            'claude-sonnet-4-6',
  history_cap:      false,
  history_messages: 0,
  max_tokens:       2500,
};

interface SessionRow {
  usage_id: string;
  user_email: string;
  thread_id: string | null;
  thread_title: string;
  operation: string;
  model: string;
  created_at_local: string;
  prompt_tokens: number;
  completion_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  total_tokens: number;
  cost_usd: number;
  cost_if_sonnet: number;
  saving_pct: number;
  cfg_model: string;
  cfg_history_cap: boolean;
  cfg_history_messages: number;
  cfg_max_tokens: number;
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

const MODEL_LABELS: Record<string,{ label: string; color: string }> = {
  'claude-sonnet-4-6':         { label: 'Claude Sonnet 4.6',       color: 'text-sage-strong' },
  'claude-haiku-4-5-20251001': { label: 'Claude Haiku 4.5',        color: 'text-blue-500' },
  'claude-haiku-4-5':          { label: 'Claude Haiku 4.5',        color: 'text-blue-500' },
  'claude-opus-4-6':           { label: 'Claude Opus 4.6',         color: 'text-purple-500' },
  'gpt-4o-mini':               { label: 'GPT-4o mini',             color: 'text-emerald-500' },
  'gpt-4o':                    { label: 'GPT-4o',                  color: 'text-emerald-600' },
};

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

// ── Sessions view component ──────────────────────────────────────────────────

interface ChatGroup {
  key: string;
  thread_title: string;
  user_email: string;
  calls: number;
  total_tokens: number;
  cost_usd: number;
  cost_if_sonnet: number;
  saving_pct: number;
  models: string[];
  first_at: string;
  cfg_models: string[];
  cfg_history_cap: boolean;
  cfg_history_messages: number;
  cfg_max_tokens: number[];
  is_baseline: boolean; // true if config matches original baseline
}

function buildGroups(rows: SessionRow[]): ChatGroup[] {
  const map = new Map<string, ChatGroup>();
  for (const row of rows) {
    const key = row.thread_id ?? `no-thread-${row.user_email}-${row.created_at_local.slice(0,10)}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        thread_title: row.thread_title,
        user_email: row.user_email,
        calls: 0,
        total_tokens: 0,
        cost_usd: 0,
        cost_if_sonnet: 0,
        saving_pct: 0,
        models: [],
        first_at: row.created_at_local,
        cfg_models: [],
        cfg_history_cap: false,
        cfg_history_messages: 0,
        cfg_max_tokens: [],
        is_baseline: true,
      });
    }
    const g = map.get(key)!;
    g.calls          += 1;
    g.total_tokens   += Number(row.total_tokens);
    g.cost_usd       += Number(row.cost_usd);
    g.cost_if_sonnet += Number(row.cost_if_sonnet);
    if (!g.models.includes(row.model)) g.models.push(row.model);
    if (row.created_at_local < g.first_at) g.first_at = row.created_at_local;
    // Config tracking
    if (row.cfg_model && !g.cfg_models.includes(row.cfg_model)) g.cfg_models.push(row.cfg_model);
    if (row.cfg_history_cap) g.cfg_history_cap = true;
    if (row.cfg_history_messages > 0) g.cfg_history_messages = row.cfg_history_messages;
    if (row.cfg_max_tokens && !g.cfg_max_tokens.includes(row.cfg_max_tokens)) g.cfg_max_tokens.push(row.cfg_max_tokens);
    // Check if differs from baseline
    if (row.cfg_model !== BASELINE.model ||
        row.cfg_history_cap !== BASELINE.history_cap ||
        row.cfg_max_tokens !== BASELINE.max_tokens) {
      g.is_baseline = false;
    }
  }
  for (const g of map.values()) {
    g.saving_pct = g.cost_if_sonnet > 0
      ? Math.round((g.cost_usd - g.cost_if_sonnet) / g.cost_if_sonnet * 1000) / 10
      : 0;
  }
  return Array.from(map.values()).sort((a, b) => b.first_at.localeCompare(a.first_at));
}

function SessionsView({
  sessionRows, fetchingSessions, errorSessions,
  selectedUser, setSelectedUser, dateFrom, dateUntil,
  setDateFrom, setDateUntil, handleApply, setLast30, users,
}: {
  sessionRows: SessionRow[]; fetchingSessions: boolean; errorSessions: boolean;
  selectedUser: string; setSelectedUser: (v: string) => void;
  dateFrom: string; dateUntil: string;
  setDateFrom: (v: string) => void; setDateUntil: (v: string) => void;
  handleApply: () => void; setLast30: () => void;
  users: UserOption[];
}) {
  const groups = useMemo(() => buildGroups(sessionRows), [sessionRows]);

  const totalReal   = groups.reduce((s, g) => s + g.cost_usd, 0);
  const totalSonnet = groups.reduce((s, g) => s + g.cost_if_sonnet, 0);
  const totalSaving = totalSonnet > 0
    ? Math.round((totalReal - totalSonnet) / totalSonnet * 1000) / 10
    : 0;

  return (
    <div className="space-y-4">
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
          <button onClick={handleApply} disabled={fetchingSessions}
            className="h-10 px-5 rounded-10 bg-sage-strong text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-2">
            {fetchingSessions ? <RefreshCw size={14} className="animate-spin" /> : null}
            Aplicar
          </button>
        </div>
        <button onClick={setLast30} className="text-[11px] font-medium text-app-muted hover:text-sage-strong underline underline-offset-2 transition-colors">
          Últimos 30 días
        </button>
      </div>

      {/* Summary cards */}
      {groups.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-app-surface border border-app-border rounded-[12px] p-4">
            <p className="text-[11px] font-medium text-app-muted uppercase tracking-wider mb-1">Costo real</p>
            <p className="text-xl font-semibold text-sage-strong">{formatCost(totalReal)}</p>
            <p className="text-[11px] text-app-muted mt-0.5">con modelo activo</p>
          </div>
          <div className="bg-app-surface border border-app-border rounded-[12px] p-4">
            <p className="text-[11px] font-medium text-app-muted uppercase tracking-wider mb-1">Si fuera Sonnet</p>
            <p className="text-xl font-semibold text-app-text">{formatCost(totalSonnet)}</p>
            <p className="text-[11px] text-app-muted mt-0.5">costo equivalente</p>
          </div>
          <div className="bg-app-surface border border-app-border rounded-[12px] p-4">
            <p className="text-[11px] font-medium text-app-muted uppercase tracking-wider mb-1">Ahorro total</p>
            <p className={`text-xl font-semibold ${totalSaving < 0 ? 'text-green-600' : totalSaving > 0 ? 'text-red-500' : 'text-app-text'}`}>
              {totalSaving === 0 ? '—' : `${totalSaving > 0 ? '+' : ''}${totalSaving}%`}
            </p>
            <p className="text-[11px] text-app-muted mt-0.5">{formatCost(Math.abs(totalReal - totalSonnet))} {totalReal < totalSonnet ? 'ahorrado' : 'extra'}</p>
          </div>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-[12px] px-4 py-3 text-xs text-amber-700">
        💡 Título del chat disponible solo en conversaciones iniciadas después del último deployment.
      </div>

      {/* Flat table — one row per chat */}
      <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app overflow-hidden">
        {fetchingSessions && sessionRows.length === 0 ? (
          <div className="flex items-center justify-center h-40 gap-2 text-sm text-app-muted">
            <RefreshCw size={16} className="animate-spin" /> Cargando...
          </div>
        ) : errorSessions ? (
          <div className="flex items-center justify-center h-40 text-sm text-red-500">Error al cargar sesiones</div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-app-muted">
            <Inbox size={28} strokeWidth={1.5}/>
            <p className="text-sm">Sin datos para el período seleccionado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-app-border">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">Chat</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">Usuario</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">Modelo</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">Configuración</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">Llamadas</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">Tokens</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">Costo real</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">Si Sonnet</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">Ahorro</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(g => {
                  const allSonnet = g.models.every(m => m === 'claude-sonnet-4-6');
                  const savingColor = g.saving_pct < 0 ? 'text-green-600 font-semibold' : g.saving_pct > 0 ? 'text-red-500' : 'text-app-muted';
                  return (
                    <tr key={g.key} className="border-b border-app-border last:border-0 hover:bg-app-bg/60">
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="text-sm font-medium text-app-text truncate">{g.thread_title}</p>
                        <p className="text-[10px] text-app-muted">{g.first_at.slice(0,10)}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-app-muted max-w-[140px] truncate">{g.user_email}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          {g.models.map(m => {
                            const meta = MODEL_LABELS[m] ?? { label: m, color: 'text-app-text' };
                            return <span key={m} className={`text-[11px] font-medium ${meta.color}`}>{meta.label}</span>;
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {g.is_baseline ? (
                          <span className="text-[10px] text-app-muted">Original</span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {g.cfg_history_cap && (
                              <span className="text-[10px] text-amber-600 font-medium">Cap: {g.cfg_history_messages} msgs</span>
                            )}
                            {g.cfg_max_tokens.filter(t => t !== BASELINE.max_tokens).map(t => (
                              <span key={t} className="text-[10px] text-blue-500 font-medium">Max: {t} tokens</span>
                            ))}
                            {g.cfg_models.some(m => m !== BASELINE.model) && (
                              <span className="text-[10px] text-purple-500 font-medium">Modelo cambiado</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-app-muted tabular-nums">{g.calls}</td>
                      <td className="px-4 py-3 text-right text-xs text-app-text tabular-nums font-medium">{formatTokens(g.total_tokens)}</td>
                      <td className="px-4 py-3 text-right text-xs text-sage-strong tabular-nums font-semibold">{formatCost(g.cost_usd)}</td>
                      <td className="px-4 py-3 text-right text-xs text-app-muted tabular-nums">{formatCost(g.cost_if_sonnet)}</td>
                      <td className={`px-4 py-3 text-right text-xs tabular-nums ${savingColor}`}>
                        {allSonnet ? '—' : `${g.saving_pct > 0 ? '+' : ''}${g.saving_pct}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {groups.length > 1 && (
                <tfoot>
                  <tr className="bg-app-bg/60 border-t-2 border-app-border">
                    <td className="px-4 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider" colSpan={5}>Total</td>
                    <td className="px-4 py-3 text-right font-semibold text-app-text tabular-nums text-xs">
                      {formatTokens(groups.reduce((s,g)=>s+g.total_tokens,0))}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-sage-strong tabular-nums text-xs">{formatCost(totalReal)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-app-muted tabular-nums text-xs">{formatCost(totalSonnet)}</td>
                    <td className={`px-4 py-3 text-right font-semibold tabular-nums text-xs ${totalSaving < 0 ? 'text-green-600' : totalSaving > 0 ? 'text-red-500' : 'text-app-muted'}`}>
                      {totalSaving === 0 ? '—' : `${totalSaving > 0 ? '+' : ''}${totalSaving}%`}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────// ── Main page ─────────────────────────────────────────────────────────────────

type ViewMode = 'detail' | 'summary' | 'models' | 'sessions';

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

  // Model breakdown view data
  const { data: modelRows = [], isFetching: fetchingModels, isError: errorModels } =
    useQuery<ModelRow[]>({
      queryKey: ['admin-token-by-model', appliedUser, appliedFrom, appliedUntil],
      queryFn: async () => {
        const { data, error } = await supabase.rpc('admin_token_usage_by_model', {
          p_date_from: appliedFrom, p_date_until: appliedUntil,
          p_user_id: appliedUser || null,
        });
        if (error) throw error;
        return data as ModelRow[];
      },
      staleTime: 0,
      enabled: viewMode === 'models',
    });

  // Sessions tab data
  const { data: sessionRows = [], isFetching: fetchingSessions, isError: errorSessions } =
    useQuery<SessionRow[]>({
      queryKey: ['admin-token-sessions', appliedUser, appliedFrom, appliedUntil],
      queryFn: async () => {
        const { data, error } = await supabase.rpc('admin_token_usage_sessions', {
          p_date_from: appliedFrom, p_date_until: appliedUntil,
          p_user_id: appliedUser || null,
        });
        if (error) throw error;
        return data as SessionRow[];
      },
      staleTime: 0,
      enabled: viewMode === 'sessions',
    });

  const isFetching = viewMode === 'detail' ? fetchingRows : viewMode === 'summary' ? fetchingSummary : viewMode === 'models' ? fetchingModels : fetchingSessions;

  const totals = useMemo(() => ({
    distinctUsers:    new Set(rows.map(r => r.user_id)).size,
    promptTokens:     rows.reduce((s,r) => s + Number(r.prompt_tokens), 0),
    completionTokens: rows.reduce((s,r) => s + Number(r.completion_tokens), 0),
    totalTokens:      rows.reduce((s,r) => s + Number(r.total_tokens), 0),
    cost:             rows.reduce((s,r) => s + Number(r.total_cost_usd), 0),
  }), [rows]);

  // CSV export
  const handleExport = useCallback(() => {
    if (viewMode === 'sessions') {
      if (sessionRows.length === 0) return;
      const esc = (v: string|number) => { const s=String(v); return s.includes(',')||s.includes('"')?`"${s.replace(/"/g,'""')}"`:`${s}`; };
      const headers = ['Usuario','Chat','Operación','Modelo','Fecha/Hora','Tokens','Costo Real (USD)','Costo si Sonnet (USD)','Ahorro %'];
      const data = sessionRows.map(r => [
        r.user_email, r.thread_title, r.operation, r.model,
        r.created_at_local,
        Number(r.total_tokens), Number(r.cost_usd), Number(r.cost_if_sonnet),
        r.saving_pct === 0 ? 'baseline' : Number(r.saving_pct)+'%'
      ]);
      const csvLines = [headers,...data].map(r=>r.map(esc).join(','));
      const csv = '\uFEFF' + csvLines.join('\n');
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})), download:`conelena-sesiones_${appliedFrom}_${appliedUntil}.csv` });
      a.click(); URL.revokeObjectURL(a.href);
      return;
    }
    if (viewMode === 'models') {
      if (modelRows.length === 0) return;
      const esc = (v: string|number) => { const s=String(v); return s.includes(',')||s.includes('"')?`"${s.replace(/"/g,'""')}"`:`${s}`; };
      const sonnetRow = modelRows.find(r => r.model === 'claude-sonnet-4-6');
      const headers = ['Modelo','Llamadas','Tokens Entrada','Tokens Salida','Cache Read','Cache Write','Total Tokens','Costo (USD)','% del Total','vs Sonnet'];
      const totalCost = modelRows.reduce((s,r) => s + Number(r.cost_usd), 0);
      const data = modelRows.map(r => {
        const pct = totalCost > 0 ? ((Number(r.cost_usd)/totalCost)*100).toFixed(1)+'%' : '0%';
        const vsSonnet = sonnetRow && r.model !== 'claude-sonnet-4-6'
          ? ((Number(r.cost_usd) - Number(sonnetRow.cost_usd)) / Number(sonnetRow.cost_usd) * 100).toFixed(1)+'%'
          : 'baseline';
        return [MODEL_LABELS[r.model]?.label ?? r.model, Number(r.calls), Number(r.prompt_tokens), Number(r.completion_tokens), Number(r.cache_read_tokens), Number(r.cache_write_tokens), Number(r.total_tokens), Number(r.cost_usd), pct, vsSonnet];
      });
      const csv = '\uFEFF' + [headers,...data].map(r=>r.map(esc).join(',')).join('\n');
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})), download:`conelena-modelos_${appliedFrom}_${appliedUntil}.csv` });
      a.click(); URL.revokeObjectURL(a.href);
      return;
    }
    if (viewMode === 'detail') {
      if (rows.length === 0) return;
      const esc = (v: string|number) => { const s=String(v); return s.includes(',')||s.includes('"')||s.includes('\n')?`"${s.replace(/"/g,'""')}"`:`${s}`; };
      const headers = ['Usuario','Fecha','Tokens Entrada','Tokens Salida','Total Tokens','Costo (USD)'];
      const data: (string|number)[][] = rows.map(r => [r.user_label, formatDate(r.usage_date), Number(r.prompt_tokens), Number(r.completion_tokens), Number(r.total_tokens), Number(r.total_cost_usd)]);
      data.push(['TOTAL','',totals.promptTokens,totals.completionTokens,totals.totalTokens,totals.cost]);
      const csv = '\uFEFF' + [headers,...data].map(r=>r.map(esc).join(',')).join('\n');
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})), download:`conelena-tokens_${appliedFrom}_${appliedUntil}.csv` });
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
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})), download:`conelena-ciclos_${localToday()}.csv` });
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
            <button
              onClick={() => setViewMode('models')}
              title="Comparar modelos"
              className={`flex items-center gap-1.5 h-7 px-3 rounded-[8px] text-xs font-medium transition-colors ${viewMode==='models' ? 'bg-sage-strong text-white' : 'text-app-muted hover:text-app-text'}`}
            >
              <Zap size={13} /> Modelos
            </button>
            <button
              onClick={() => setViewMode('sessions')}
              title="Sesiones detalladas"
              className={`flex items-center gap-1.5 h-7 px-3 rounded-[8px] text-xs font-medium transition-colors ${viewMode==='sessions' ? 'bg-sage-strong text-white' : 'text-app-muted hover:text-app-text'}`}
            >
              <MessageSquare size={13} /> Sesiones
            </button>
          </div>

          <button
            onClick={handleExport}
            disabled={(viewMode==='detail' ? rows.length===0 : viewMode==='summary' ? summaryRows.length===0 : viewMode==='models' ? modelRows.length===0 : sessionRows.length===0) || isFetching}
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

        {/* ── MODELS VIEW ── */}
        {viewMode === 'models' && (
          <div className="space-y-4">
            {/* Filters (reuse same date/user filters) */}
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
                <button onClick={handleApply} disabled={fetchingModels}
                  className="h-10 px-5 rounded-10 bg-sage-strong text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-2">
                  {fetchingModels ? <RefreshCw size={14} className="animate-spin" /> : null}
                  Aplicar
                </button>
              </div>
              <button onClick={setLast30} className="text-[11px] font-medium text-app-muted hover:text-sage-strong underline underline-offset-2 transition-colors">
                Últimos 30 días
              </button>
            </div>

            {/* Model comparison table */}
            <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app overflow-hidden">
              {fetchingModels && modelRows.length === 0 ? (
                <div className="flex items-center justify-center h-40 gap-2 text-sm text-app-muted"><RefreshCw size={16} className="animate-spin" /> Cargando...</div>
              ) : errorModels ? (
                <div className="flex items-center justify-center h-40 text-sm text-red-500">Error al cargar datos</div>
              ) : modelRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2 text-app-muted"><Inbox size={28} strokeWidth={1.5}/><p className="text-sm">Sin datos para el período seleccionado</p></div>
              ) : (() => {
                const totalCost = modelRows.reduce((s,r) => s + Number(r.cost_usd), 0);
                const totalTokens = modelRows.reduce((s,r) => s + Number(r.total_tokens), 0);
                const sonnetRow = modelRows.find(r => r.model === 'claude-sonnet-4-6');
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-app-border">
                          <th className="text-left px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">Modelo</th>
                          <th className="text-right px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">Llamadas</th>
                          <th className="text-right px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">Total Tokens</th>
                          <th className="text-right px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">Costo (USD)</th>
                          <th className="text-right px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">% del total</th>
                          <th className="text-right px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider">vs Sonnet</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modelRows.map(row => {
                          const pct = totalCost > 0 ? (Number(row.cost_usd)/totalCost*100) : 0;
                          const meta = MODEL_LABELS[row.model] ?? { label: row.model, color: 'text-app-text' };
                          let vsSonnet: string | null = null;
                          let vsSonnetColor = 'text-app-muted';
                          if (sonnetRow && row.model !== 'claude-sonnet-4-6' && Number(sonnetRow.cost_usd) > 0) {
                            const diff = (Number(row.cost_usd) - Number(sonnetRow.cost_usd)) / Number(sonnetRow.cost_usd) * 100;
                            vsSonnet = `${diff > 0 ? '+' : ''}${diff.toFixed(0)}%`;
                            vsSonnetColor = diff < 0 ? 'text-green-600 font-semibold' : diff > 0 ? 'text-red-500' : 'text-app-muted';
                          }
                          return (
                            <tr key={row.model} className="border-b border-app-border last:border-0 hover:bg-app-bg/60">
                              <td className="px-5 py-4">
                                <p className={`text-sm font-semibold ${meta.color}`}>{meta.label}</p>
                                <p className="text-[10px] text-app-muted font-mono mt-0.5">{row.model}</p>
                              </td>
                              <td className="px-5 py-4 text-right text-app-muted tabular-nums">{Number(row.calls).toLocaleString()}</td>
                              <td className="px-5 py-4 text-right text-app-text tabular-nums font-medium">{formatTokens(Number(row.total_tokens))}</td>
                              <td className="px-5 py-4 text-right text-sage-strong tabular-nums font-semibold">{formatCost(Number(row.cost_usd))}</td>
                              <td className="px-5 py-4 text-right tabular-nums">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 h-1.5 bg-app-border rounded-full overflow-hidden">
                                    <div className="h-full bg-sage-strong rounded-full" style={{ width:`${pct}%` }} />
                                  </div>
                                  <span className="text-xs text-app-muted">{pct.toFixed(1)}%</span>
                                </div>
                              </td>
                              <td className={`px-5 py-4 text-right tabular-nums text-sm ${vsSonnetColor}`}>
                                {row.model === 'claude-sonnet-4-6' ? <span className="text-[11px] text-app-muted">baseline</span> : vsSonnet ?? '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-app-bg/60 border-t-2 border-app-border">
                          <td className="px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider" colSpan={2}>Total</td>
                          <td className="px-5 py-3 text-right font-semibold text-app-text tabular-nums">{formatTokens(totalTokens)}</td>
                          <td className="px-5 py-3 text-right font-semibold text-sage-strong tabular-nums">{formatCost(totalCost)}</td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── SESSIONS VIEW ── */}
        {viewMode === 'sessions' && (
          <SessionsView
            sessionRows={sessionRows}
            fetchingSessions={fetchingSessions}
            errorSessions={errorSessions}
            selectedUser={selectedUser}
            setSelectedUser={setSelectedUser}
            dateFrom={dateFrom}
            dateUntil={dateUntil}
            setDateFrom={setDateFrom}
            setDateUntil={setDateUntil}
            handleApply={handleApply}
            setLast30={setLast30}
            users={users}
          />
        )}

        <p className="text-[11px] text-app-muted text-center pb-2">
          Precios: Claude Sonnet $3.00/1M entrada · $15.00/1M salida · GPT-4o-mini $0.15/1M entrada · $0.60/1M salida
        </p>

      </div>
    </div>
  );
}

