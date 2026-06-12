import { useState, useCallback, useRef } from 'react';
import { Link } from 'wouter';
import {
  ChevronLeft, BarChart2, RefreshCw, AlertCircle, Inbox,
  Download, Filter, X, Database, CalendarDays,
  TrendingUp, Zap, DollarSign, Users,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

// ─── Types ──────────────────────────────────────────────────────────────────

type TabMode = 'raw' | 'daily';

interface Filters {
  date_from: string;
  date_to:   string;
  user_id:   string;
  operations: string[];
  models:    string[];
}

interface RawRow {
  event_id: string; event_at: string; event_date: string; event_week: string; event_month: string;
  operation: string; model: string;
  input_tokens: number; output_tokens: number; total_tokens: number; cost_usd: number;
  user_id: string; email: string; full_name: string; plan_key: string;
  is_admin: boolean; is_disabled: boolean; language: string; timezone: string;
  signup_at: string; first_session_at: string; last_active_at: string; sessions_count: number;
  email_opt_in: boolean; email_sequence_status: string; email_sequence_step: number;
  last_email_sent_at: string; last_email_type: string;
}

interface DailyRow {
  day: string; week: string; month: string;
  user_id: string; email: string; full_name: string; plan_key: string; is_admin: boolean;
  events_count: number; input_tokens: number; output_tokens: number; total_tokens: number;
  cost_usd: number;
  tokens_chat: number; tokens_extract_memories: number; tokens_chat_to_journal: number;
  tokens_journal_prompt: number; tokens_ai_reflection: number;
  tokens_ai_mini_insight: number; tokens_weekly_insights: number; tokens_voice: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const OPERATIONS = [
  'chat', 'extract-memories', 'chat-to-journal',
  'journal-prompt', 'ai-reflection-prompt',
  'ai-mini-insight', 'weekly-insights', 'voice-transcription',
];

const MODELS = ['claude-sonnet-4-6', 'claude-haiku-4-5', 'gpt-4o-mini'];

const OP_LABELS: Record<string, string> = {
  'chat':                 'Chat',
  'extract-memories':     'Memorias',
  'chat-to-journal':      'Chat → Diario',
  'journal-prompt':       'Prompt Diario',
  'ai-reflection-prompt': 'Reflexión',
  'ai-mini-insight':      'Mini Insight',
  'weekly-insights':      'Insight Semanal',
  'voice-transcription':  'Voz',
};

const PLAN_COLORS: Record<string, string> = {
  starter: 'bg-app-bg text-app-muted border border-app-border',
  pro:     'bg-sage-strong/10 text-sage-strong border border-sage-strong/20',
  power:   'bg-amber-50 text-amber-700 border border-amber-200',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function today() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function fmt(n: number) { return n.toLocaleString('en-US'); }
function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return fmt(n);
}
function fmtCost(n: number) {
  if (n === 0)     return '$0.000000';
  if (n < 0.0001)  return `$${n.toFixed(8)}`;
  if (n < 0.01)    return `$${n.toFixed(6)}`;
  if (n < 1)       return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}
function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const header = keys.join(',');
  const lines = rows.map(row =>
    keys.map(k => {
      const v = row[k] ?? '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    }).join(',')
  );
  return [header, ...lines].join('\n');
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlanBadge({ planKey }: { planKey: string }) {
  const cls = PLAN_COLORS[planKey] ?? PLAN_COLORS['starter'];
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${cls}`}>
      {planKey}
    </span>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="bg-app-surface border border-app-border rounded-[16px] p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-[8px] flex items-center justify-center ${color}`}>
          <Icon size={13} className="text-current" />
        </div>
        <p className="text-[11px] font-semibold text-app-muted uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-xl font-semibold text-app-text tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-app-muted mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON_KEY      = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

async function fetchAnalytics(mode: TabMode, filters: Filters) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('No auth token');

  const body: Record<string, unknown> = { mode };
  if (filters.date_from) body.date_from = filters.date_from;
  if (filters.date_to)   body.date_to   = filters.date_to;
  if (filters.user_id)   body.user_id   = filters.user_id;
  if (filters.operations.length) body.operations = filters.operations;
  if (filters.models.length)     body.models     = filters.models;

  const res = await fetch(`${FUNCTIONS_URL}/admin-analytics`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Apikey: ANON_KEY },
    body:    JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Error loading data');
  return json;
}

export function AdminAnalyticsPage() {
  const [tab, setTab] = useState<TabMode>('raw');

  const defaultFilters: Filters = {
    date_from:  daysAgo(30),
    date_to:    today(),
    user_id:    '',
    operations: [],
    models:     [],
  };

  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [rawRows,   setRawRows]   = useState<RawRow[]>([]);
  const [dailyRows, setDailyRows] = useState<DailyRow[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [hasRun, setHasRun]       = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (mode: TabMode, f: Filters) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAnalytics(mode, f);
      if (mode === 'raw')   setRawRows(result.rows ?? []);
      else                  setDailyRows(result.rows ?? []);
      setHasRun(true);
    } catch (e: any) {
      setError(e.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRun = () => run(tab, filters);

  const handleTabChange = (t: TabMode) => {
    setTab(t);
    setHasRun(false);
    setError(null);
  };

  const toggleOp = (op: string) =>
    setFilters(f => ({
      ...f,
      operations: f.operations.includes(op)
        ? f.operations.filter(x => x !== op)
        : [...f.operations, op],
    }));

  const toggleModel = (m: string) =>
    setFilters(f => ({
      ...f,
      models: f.models.includes(m)
        ? f.models.filter(x => x !== m)
        : [...f.models, m],
    }));

  const clearFilters = () => setFilters(defaultFilters);

  const handleExport = () => {
    const rows = tab === 'raw' ? rawRows : dailyRows;
    if (!rows.length) return;
    const csv = rowsToCsv(rows as unknown as Record<string, unknown>[]);
    const ts  = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `tuanimo_${tab}_${ts}.csv`);
  };

  // ── KPIs ─────────────────────────────────────────────────────────────────

  const rawKpis = {
    totalCost:    rawRows.reduce((s, r) => s + r.cost_usd, 0),
    totalTokens:  rawRows.reduce((s, r) => s + r.total_tokens, 0),
    totalEvents:  rawRows.length,
    uniqueUsers:  new Set(rawRows.map(r => r.user_id)).size,
  };
  const dailyKpis = {
    totalCost:   dailyRows.reduce((s, r) => s + r.cost_usd, 0),
    totalTokens: dailyRows.reduce((s, r) => s + r.total_tokens, 0),
    totalDays:   dailyRows.length,
    uniqueUsers: new Set(dailyRows.map(r => r.user_id)).size,
  };

  const rows = tab === 'raw' ? rawRows : dailyRows;
  const kpis = tab === 'raw' ? rawKpis : dailyKpis;

  return (
    <div
      className="bg-app-bg p-5 space-y-5"
      style={{ minHeight: 'calc(100dvh - var(--chrome-total))', paddingBottom: 'calc(var(--nav-total) + 1.5rem)' }}
    >
      <div className="max-w-6xl mx-auto space-y-5">

        {/* ── Header ── */}
        <div className="flex items-start gap-4">
          <Link
            href="/admin"
            className="mt-0.5 p-2 rounded-10 bg-app-surface border border-app-border hover:border-sage-strong transition-colors text-app-muted hover:text-sage-strong"
          >
            <ChevronLeft size={16} />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <BarChart2 size={20} className="text-sage-strong" />
              <h1 className="text-2xl font-semibold text-app-text">Analytics</h1>
              {loading && <RefreshCw size={14} className="animate-spin text-app-muted" />}
            </div>
            <p className="text-sm text-app-muted mt-0.5">Exporta datos de tokens, usuarios y costos</p>
          </div>
          <button
            onClick={handleExport}
            disabled={!rows.length || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] bg-sage-strong text-white text-sm font-semibold disabled:opacity-40 hover:bg-sage-strong/90 transition-colors"
          >
            <Download size={14} />
            Exportar CSV
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 bg-app-surface border border-app-border rounded-[12px] p-1 w-fit">
          {(['raw', 'daily'] as TabMode[]).map(t => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={`flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-semibold transition-colors ${
                tab === t ? 'bg-sage-strong text-white' : 'text-app-muted hover:text-app-text'
              }`}
            >
              {t === 'raw' ? <Database size={13} /> : <CalendarDays size={13} />}
              {t === 'raw' ? 'Eventos Raw' : 'Agregado Diario'}
            </button>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="bg-app-surface border border-app-border rounded-[16px] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-sage-strong" />
            <span className="text-[13px] font-semibold text-app-text">Filtros</span>
            <button onClick={clearFilters} className="ml-auto text-[11px] text-app-muted hover:text-app-text flex items-center gap-1 transition-colors">
              <X size={11} /> Limpiar
            </button>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-app-muted uppercase tracking-wider block mb-1">Desde</label>
              <input
                type="date"
                value={filters.date_from}
                onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
                className="w-full bg-app-bg border border-app-border rounded-[8px] px-3 py-2 text-sm text-app-text focus:outline-none focus:border-sage-strong"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-app-muted uppercase tracking-wider block mb-1">Hasta</label>
              <input
                type="date"
                value={filters.date_to}
                onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
                className="w-full bg-app-bg border border-app-border rounded-[8px] px-3 py-2 text-sm text-app-text focus:outline-none focus:border-sage-strong"
              />
            </div>
          </div>

          {/* Quick date presets */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { label: 'Hoy',      from: today(),      to: today() },
              { label: '7 días',   from: daysAgo(7),   to: today() },
              { label: '30 días',  from: daysAgo(30),  to: today() },
              { label: '90 días',  from: daysAgo(90),  to: today() },
              { label: 'Todo',     from: '2026-01-01', to: today() },
            ].map(p => (
              <button
                key={p.label}
                onClick={() => setFilters(f => ({ ...f, date_from: p.from, date_to: p.to }))}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  filters.date_from === p.from && filters.date_to === p.to
                    ? 'bg-sage-strong text-white border-sage-strong'
                    : 'bg-app-bg border-app-border text-app-muted hover:border-sage-strong hover:text-app-text'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Operations */}
          <div>
            <label className="text-[11px] font-semibold text-app-muted uppercase tracking-wider block mb-2">Operaciones (vacío = todas)</label>
            <div className="flex flex-wrap gap-2">
              {OPERATIONS.map(op => (
                <button
                  key={op}
                  onClick={() => toggleOp(op)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    filters.operations.includes(op)
                      ? 'bg-sage-strong text-white border-sage-strong'
                      : 'bg-app-bg border-app-border text-app-muted hover:border-sage-strong'
                  }`}
                >
                  {OP_LABELS[op] ?? op}
                </button>
              ))}
            </div>
          </div>

          {/* Models */}
          <div>
            <label className="text-[11px] font-semibold text-app-muted uppercase tracking-wider block mb-2">Modelos (vacío = todos)</label>
            <div className="flex flex-wrap gap-2">
              {MODELS.map(m => (
                <button
                  key={m}
                  onClick={() => toggleModel(m)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors font-mono ${
                    filters.models.includes(m)
                      ? 'bg-sage-strong text-white border-sage-strong'
                      : 'bg-app-bg border-app-border text-app-muted hover:border-sage-strong'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Run button */}
          <button
            onClick={handleRun}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[10px] bg-sage-strong text-white text-sm font-semibold disabled:opacity-50 hover:bg-sage-strong/90 transition-colors"
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <TrendingUp size={14} />}
            {loading ? 'Cargando...' : 'Ejecutar consulta'}
          </button>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-[12px] text-sm text-red-700">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Error al cargar datos</p>
              <p className="text-xs text-red-500 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* ── KPIs ── */}
        {hasRun && !error && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard icon={DollarSign} label="Costo total" value={fmtCost(kpis.totalCost)} color="bg-emerald-50 text-emerald-600" />
            <KpiCard icon={Zap}        label="Tokens"      value={fmtTokens(kpis.totalTokens)} color="bg-blue-50 text-blue-500" />
            <KpiCard icon={Users}      label="Usuarios"    value={fmt(kpis.uniqueUsers)} color="bg-violet-50 text-violet-500" />
            <KpiCard
              icon={BarChart2}
              label={tab === 'raw' ? 'Eventos' : 'Filas / día'}
              value={fmt(tab === 'raw' ? (kpis as typeof rawKpis).totalEvents : (kpis as typeof dailyKpis).totalDays)}
              color="bg-amber-50 text-amber-500"
            />
          </div>
        )}

        {/* ── Table ── */}
        {hasRun && !error && (
          <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app overflow-hidden">
            <div className="px-5 py-4 border-b border-app-border flex items-center justify-between">
              <span className="text-[13px] font-semibold text-app-text">
                {tab === 'raw' ? 'Eventos Raw' : 'Agregado Diario'}
              </span>
              <span className="text-[11px] text-app-muted tabular-nums">
                {fmt(rows.length)} filas
              </span>
            </div>

            {rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-app-muted">
                <Inbox size={28} strokeWidth={1.5} />
                <p className="text-sm">Sin datos para los filtros seleccionados</p>
              </div>
            ) : tab === 'raw' ? (
              <RawTable rows={rawRows} />
            ) : (
              <DailyTable rows={dailyRows} />
            )}
          </div>
        )}

        {!hasRun && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-app-muted">
            <BarChart2 size={32} strokeWidth={1.5} />
            <p className="text-sm">Configura los filtros y ejecuta la consulta</p>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Raw table ────────────────────────────────────────────────────────────────

function RawTable({ rows }: { rows: RawRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs whitespace-nowrap">
        <thead>
          <tr className="border-b border-app-border bg-app-bg/60">
            {['Fecha', 'Usuario', 'Plan', 'Operación', 'Modelo',
              'In tokens', 'Out tokens', 'Total tokens', 'Costo USD',
              'Sesiones', 'Último activo'].map(h => (
              <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-app-muted uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.event_id} className="border-b border-app-border last:border-0 hover:bg-app-bg/40 transition-colors">
              <td className="px-4 py-2.5 text-app-muted">{r.event_date}</td>
              <td className="px-4 py-2.5 text-app-text font-medium max-w-[180px] truncate">
                <span title={r.email}>{r.email || r.user_id.slice(0, 8)}</span>
              </td>
              <td className="px-4 py-2.5"><PlanBadge planKey={r.plan_key} /></td>
              <td className="px-4 py-2.5 text-app-text">{OP_LABELS[r.operation] ?? r.operation}</td>
              <td className="px-4 py-2.5 text-app-muted font-mono">{r.model}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-app-muted">{fmt(r.input_tokens)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-app-muted">{fmt(r.output_tokens)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-app-text font-medium">{fmtTokens(r.total_tokens)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-sage-strong">{fmtCost(r.cost_usd)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-app-muted">{fmt(r.sessions_count)}</td>
              <td className="px-4 py-2.5 text-app-muted">{fmtDate(r.last_active_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Daily table ──────────────────────────────────────────────────────────────

function DailyTable({ rows }: { rows: DailyRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs whitespace-nowrap">
        <thead>
          <tr className="border-b border-app-border bg-app-bg/60">
            {['Día', 'Semana', 'Usuario', 'Plan',
              'Eventos', 'In tokens', 'Out tokens', 'Total', 'Costo USD',
              'Chat', 'Memorias', 'Diario', 'Reflexión', 'Insight', 'Voz'].map(h => (
              <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-app-muted uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-app-border last:border-0 hover:bg-app-bg/40 transition-colors">
              <td className="px-4 py-2.5 text-app-muted font-medium">{r.day}</td>
              <td className="px-4 py-2.5 text-app-muted">{r.week}</td>
              <td className="px-4 py-2.5 text-app-text font-medium max-w-[160px] truncate">
                <span title={r.email}>{r.email || r.user_id.slice(0, 8)}</span>
              </td>
              <td className="px-4 py-2.5"><PlanBadge planKey={r.plan_key} /></td>
              <td className="px-4 py-2.5 text-right tabular-nums text-app-muted">{fmt(r.events_count)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-app-muted">{fmt(r.input_tokens)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-app-muted">{fmt(r.output_tokens)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-app-text font-medium">{fmtTokens(r.total_tokens)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-sage-strong">{fmtCost(r.cost_usd)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-app-muted">{fmtTokens(r.tokens_chat)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-app-muted">{fmtTokens(r.tokens_extract_memories)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-app-muted">{fmtTokens(r.tokens_chat_to_journal + r.tokens_journal_prompt)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-app-muted">{fmtTokens(r.tokens_ai_reflection)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-app-muted">{fmtTokens(r.tokens_ai_mini_insight + r.tokens_weekly_insights)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-app-muted">{fmtTokens(r.tokens_voice)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
