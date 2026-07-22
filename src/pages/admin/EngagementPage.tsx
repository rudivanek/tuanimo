import { useState, useCallback, useMemo } from 'react';
import { Activity, ChevronLeft, RefreshCw, AlertCircle, Inbox, Download, List, BarChart3 } from 'lucide-react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabaseClient';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EngagementRow {
  user_id: string;
  email: string;
  name: string;
  chats: number;
  diario: number;
}

interface DailyRow {
  day: string;
  chats: number;
  diario: number;
}

interface UserOption {
  user_id: string;
  user_label: string;
}

type ViewMode = 'table' | 'chart';

// ── Helpers ───────────────────────────────────────────────────────────────────

function localToday(): string {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}
function localFirstOfMonth(): string {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), '01'].join('-');
}
function localDaysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}
// 'YYYY-MM-DD' -> 'DD/MM' for compact axis labels
function shortDay(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
}

// ── Daily bar chart (hand-rolled SVG, no dependencies) ─────────────────────────

function DailyBarChart({ data }: { data: DailyRow[] }) {
  const CHATS_COLOR  = 'var(--sage-strong, #6b8f71)';
  const DIARIO_COLOR = '#c9a24b';

  const max = Math.max(1, ...data.map(d => Math.max(Number(d.chats), Number(d.diario))));

  // Layout
  const H = 240;              // plot height
  const PAD_TOP = 12;
  const PAD_BOTTOM = 44;      // room for rotated date labels
  const PAD_LEFT = 34;        // room for y-axis numbers
  const GROUP_W = 34;         // width allotted per day
  const BAR_W = 12;
  const GAP = 3;              // gap between the two bars in a group
  const W = PAD_LEFT + data.length * GROUP_W + 12;
  const plotH = H - PAD_TOP - PAD_BOTTOM;

  const y = (v: number) => PAD_TOP + plotH - (v / max) * plotH;

  // Y grid lines at 0, 25, 50, 75, 100 %
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(f * max));
  const uniqTicks = Array.from(new Set(ticks));

  // Only label every Nth day if the range is long, to avoid crowding
  const labelEvery = data.length > 20 ? 3 : data.length > 12 ? 2 : 1;

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} className="block" role="img" aria-label="Actividad diaria">
        {/* Grid + y labels */}
        {uniqTicks.map((t) => (
          <g key={t}>
            <line x1={PAD_LEFT} x2={W - 4} y1={y(t)} y2={y(t)} stroke="var(--app-border, #e5e5e5)" strokeWidth={1} />
            <text x={PAD_LEFT - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="var(--app-muted, #999)">{t}</text>
          </g>
        ))}

        {/* Bars */}
        {data.map((d, i) => {
          const gx = PAD_LEFT + i * GROUP_W;
          const chatsH  = (Number(d.chats)  / max) * plotH;
          const diarioH = (Number(d.diario) / max) * plotH;
          const x1 = gx + (GROUP_W - (BAR_W * 2 + GAP)) / 2;
          const x2 = x1 + BAR_W + GAP;
          return (
            <g key={d.day}>
              <rect x={x1} y={y(Number(d.chats))}  width={BAR_W} height={chatsH}  rx={2} fill={CHATS_COLOR}>
                <title>{`${d.day} · Chats: ${d.chats}`}</title>
              </rect>
              <rect x={x2} y={y(Number(d.diario))} width={BAR_W} height={diarioH} rx={2} fill={DIARIO_COLOR}>
                <title>{`${d.day} · Diario: ${d.diario}`}</title>
              </rect>
              {i % labelEvery === 0 && (
                <text
                  x={gx + GROUP_W / 2}
                  y={H - PAD_BOTTOM + 14}
                  textAnchor="end"
                  fontSize={9}
                  fill="var(--app-muted, #999)"
                  transform={`rotate(-45 ${gx + GROUP_W / 2} ${H - PAD_BOTTOM + 14})`}
                >
                  {shortDay(d.day)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 px-2 pt-2">
        <span className="flex items-center gap-1.5 text-[11px] text-app-muted">
          <span className="inline-block w-3 h-3 rounded-[3px]" style={{ background: CHATS_COLOR }} /> Chats
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-app-muted">
          <span className="inline-block w-3 h-3 rounded-[3px]" style={{ background: DIARIO_COLOR }} /> Diario
        </span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function EngagementPage() {
  const [viewMode,     setViewMode]     = useState<ViewMode>('table');

  // Pending (form) state
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [dateFrom,     setDateFrom]     = useState<string>(() => localFirstOfMonth());
  const [dateUntil,    setDateUntil]    = useState<string>(() => localToday());

  // Applied (query) state
  const [appliedUser,  setAppliedUser]  = useState<string>('');
  const [appliedFrom,  setAppliedFrom]  = useState<string>(() => localFirstOfMonth());
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

  // Users dropdown — reuse the existing token-page RPC.
  const { data: users = [] } = useQuery<UserOption[]>({
    queryKey: ['admin-users-with-usage'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_users_with_usage');
      if (error) throw error;
      return data as UserOption[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Earliest activity date — powers the "Todo el tiempo" shortcut.
  const { data: minDate } = useQuery<string | null>({
    queryKey: ['admin-engagement-bounds'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_engagement_bounds');
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row?.min_date as string) ?? null;
    },
    staleTime: 10 * 60 * 1000,
  });

  const setAllTime = useCallback(() => {
    const from = (minDate ?? localFirstOfMonth()).slice(0, 10);
    const until = localToday();
    setDateFrom(from); setDateUntil(until);
    setAppliedUser(selectedUser); setAppliedFrom(from); setAppliedUntil(until);
  }, [minDate, selectedUser]);

  // Table data (totals per user)
  const { data: rows = [], isFetching, isError, error, refetch } = useQuery<EngagementRow[]>({
    queryKey: ['admin-engagement', appliedUser, appliedFrom, appliedUntil],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_engagement_report', {
        p_from_date: appliedFrom,
        p_to_date:   appliedUntil,
        p_user_id:   appliedUser || null,
      });
      if (error) throw error;
      return data as EngagementRow[];
    },
    staleTime: 0,
  });

  // Daily data (for chart + CSV) — respects the same dropdown/date filters.
  const { data: daily = [], isFetching: fetchingDaily } = useQuery<DailyRow[]>({
    queryKey: ['admin-engagement-daily', appliedUser, appliedFrom, appliedUntil],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_engagement_daily', {
        p_from_date: appliedFrom,
        p_to_date:   appliedUntil,
        p_user_id:   appliedUser || null,
      });
      if (error) throw error;
      return data as DailyRow[];
    },
    staleTime: 0,
  });

  const totals = useMemo(() => ({
    users:  rows.length,
    active: rows.filter(r => (Number(r.chats) + Number(r.diario)) > 0).length,
    chats:  rows.reduce((s, r) => s + Number(r.chats), 0),
    diario: rows.reduce((s, r) => s + Number(r.diario), 0),
  }), [rows]);

  const selectedLabel = useMemo(
    () => users.find(u => u.user_id === appliedUser)?.user_label ?? null,
    [users, appliedUser]
  );

  // ── Excel export: two sheets (Por usuario + Por día) ────────────────────────
  const handleExport = useCallback(() => {
    if (rows.length === 0 && daily.length === 0) return;

    const wb = XLSX.utils.book_new();

    // Sheet 1 — totals per user
    const usersAoa: (string | number)[][] = [
      ['Correo', 'Nombre', 'Chats', 'Diario'],
      ...rows.map(r => [r.email, r.name, Number(r.chats), Number(r.diario)]),
      ['TOTAL', '', totals.chats, totals.diario],
    ];
    const wsUsers = XLSX.utils.aoa_to_sheet(usersAoa);
    wsUsers['!cols'] = [{ wch: 34 }, { wch: 26 }, { wch: 8 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, wsUsers, 'Por usuario');

    // Sheet 2 — daily breakdown (select these columns in Excel -> Insert -> Chart)
    const dChats  = daily.reduce((s, d) => s + Number(d.chats), 0);
    const dDiario = daily.reduce((s, d) => s + Number(d.diario), 0);
    const dailyAoa: (string | number)[][] = [
      ['Fecha', 'Chats', 'Diario'],
      ...daily.map(d => [d.day.slice(0, 10), Number(d.chats), Number(d.diario)]),
      ['TOTAL', dChats, dDiario],
    ];
    const wsDaily = XLSX.utils.aoa_to_sheet(dailyAoa);
    wsDaily['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, wsDaily, 'Por día');

    const scope = selectedLabel ? selectedLabel.replace(/[^a-zA-Z0-9]+/g, '-') : 'todos';
    XLSX.writeFile(wb, `conelena-actividad_${scope}_${appliedFrom}_${appliedUntil}.xlsx`);
  }, [rows, daily, totals, selectedLabel, appliedFrom, appliedUntil]);

  const dailyHasData = daily.some(d => (Number(d.chats) + Number(d.diario)) > 0);

  return (
    <div className="bg-app-bg p-5 space-y-5" style={{ minHeight: 'calc(100dvh - var(--chrome-total))', paddingBottom: 'calc(var(--nav-total) + 1.5rem)' }}>
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-start gap-4">
          <Link href="/admin" className="mt-0.5 p-2 rounded-10 bg-app-surface border border-app-border hover:border-sage-strong transition-colors text-app-muted hover:text-sage-strong">
            <ChevronLeft size={16} />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Activity size={20} className="text-sage-strong" />
              <h1 className="text-2xl font-semibold text-app-text">Actividad de Usuarios</h1>
              {(isFetching || fetchingDaily) && <RefreshCw size={14} className="animate-spin text-app-muted" />}
            </div>
            <p className="text-sm text-app-muted mt-0.5">Cuántos mensajes de chat y entradas de Diario hace cada usuario</p>
          </div>

          {/* View toggle */}
          <div className="mt-0.5 flex items-center gap-1 bg-app-surface border border-app-border rounded-10 p-1">
            <button onClick={() => setViewMode('table')} title="Tabla"
              className={`flex items-center gap-1.5 h-7 px-3 rounded-[8px] text-xs font-medium transition-colors ${viewMode === 'table' ? 'bg-sage-strong text-white' : 'text-app-muted hover:text-app-text'}`}>
              <List size={13} /> Tabla
            </button>
            <button onClick={() => setViewMode('chart')} title="Gráfica"
              className={`flex items-center gap-1.5 h-7 px-3 rounded-[8px] text-xs font-medium transition-colors ${viewMode === 'chart' ? 'bg-sage-strong text-white' : 'text-app-muted hover:text-app-text'}`}>
              <BarChart3 size={13} /> Gráfica
            </button>
          </div>

          <button
            onClick={handleExport}
            disabled={(rows.length === 0 && daily.length === 0) || isFetching}
            title="Exportar a Excel"
            className="mt-0.5 flex items-center gap-2 h-9 px-4 rounded-10 bg-app-surface border border-app-border text-sm font-medium text-app-text hover:border-sage-strong hover:text-sage-strong transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={15} />
            <span className="hidden sm:inline">Excel</span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
            <div>
              <label className="text-[11px] font-medium text-app-muted uppercase tracking-wider block mb-1.5">Usuario</label>
              <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
                className="w-full h-10 px-3 rounded-10 bg-app-bg border border-app-border text-sm text-app-text focus:outline-none focus:border-sage-strong transition-colors">
                <option value="">Todos los usuarios</option>
                {users.map(u => <option key={u.user_id} value={u.user_id}>{u.user_label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-app-muted uppercase tracking-wider block mb-1.5">Desde</label>
              <input type="date" value={dateFrom} max={dateUntil} onChange={e => setDateFrom(e.target.value)}
                className="h-10 px-3 rounded-10 bg-app-bg border border-app-border text-sm text-app-text focus:outline-none focus:border-sage-strong transition-colors" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-app-muted uppercase tracking-wider block mb-1.5">Hasta</label>
              <input type="date" value={dateUntil} min={dateFrom} onChange={e => setDateUntil(e.target.value)}
                className="h-10 px-3 rounded-10 bg-app-bg border border-app-border text-sm text-app-text focus:outline-none focus:border-sage-strong transition-colors" />
            </div>
            <button onClick={handleApply} disabled={isFetching}
              className="h-10 px-5 rounded-10 bg-sage-strong text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-2">
              {isFetching ? <RefreshCw size={14} className="animate-spin" /> : null}
              Aplicar
            </button>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={setLast30} className="text-[11px] font-medium text-app-muted hover:text-sage-strong underline underline-offset-2 transition-colors">
              Últimos 30 días
            </button>
            <button onClick={setAllTime} className="text-[11px] font-medium text-app-muted hover:text-sage-strong underline underline-offset-2 transition-colors">
              Todo el tiempo
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
              { label: 'Usuarios', value: String(totals.users) },
              { label: 'Activos', value: String(totals.active), sub: `${totals.users - totals.active} sin actividad` },
              { label: 'Chats', value: totals.chats.toLocaleString('en-US') },
              { label: 'Diario', value: totals.diario.toLocaleString('en-US') },
            ].map(({ label, value, sub }) => (
              <div key={label} className="bg-app-surface border border-app-border rounded-[12px] p-4">
                <p className="text-[11px] font-medium text-app-muted uppercase tracking-wider mb-1">{label}</p>
                <p className="text-xl font-semibold text-app-text">{value}</p>
                {sub && <p className="text-[11px] text-app-muted mt-0.5">{sub}</p>}
              </div>
            ))}
          </div>
        )}

        {/* ── TABLE VIEW ── */}
        {viewMode === 'table' && (
          <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app overflow-hidden">
            {isFetching && rows.length === 0 ? (
              <div className="flex items-center justify-center h-40 gap-2 text-sm text-app-muted"><RefreshCw size={16} className="animate-spin" /> Cargando...</div>
            ) : !isError && rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-app-muted"><Inbox size={28} strokeWidth={1.5} /><p className="text-sm">Sin datos para el período seleccionado</p></div>
            ) : !isError ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-app-border">
                      {['Correo', 'Nombre', 'Chats', 'Diario'].map((h, i) => (
                        <th key={h} className={`px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider ${i < 2 ? 'text-left' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => {
                      const idle = (Number(row.chats) + Number(row.diario)) === 0;
                      return (
                        <tr key={row.user_id} className={`border-b border-app-border last:border-0 hover:bg-app-bg/60 ${isFetching ? 'opacity-50' : ''} ${idle ? 'opacity-55' : ''}`}>
                          <td className="px-5 py-3 text-app-muted max-w-[240px] truncate">{row.email}</td>
                          <td className="px-5 py-3 text-app-text font-medium max-w-[200px] truncate">{row.name}</td>
                          <td className="px-5 py-3 text-right text-app-text tabular-nums font-medium">{Number(row.chats).toLocaleString('en-US')}</td>
                          <td className="px-5 py-3 text-right text-app-text tabular-nums font-medium">{Number(row.diario).toLocaleString('en-US')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {rows.length > 1 && (
                    <tfoot>
                      <tr className="bg-app-bg/60 border-t-2 border-app-border">
                        <td className="px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider" colSpan={2}>Total</td>
                        <td className="px-5 py-3 text-right font-semibold text-app-text tabular-nums">{totals.chats.toLocaleString('en-US')}</td>
                        <td className="px-5 py-3 text-right font-semibold text-app-text tabular-nums">{totals.diario.toLocaleString('en-US')}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            ) : null}
          </div>
        )}

        {/* ── CHART VIEW ── */}
        {viewMode === 'chart' && (
          <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-app-text">
                Actividad diaria{selectedLabel ? ` · ${selectedLabel}` : ' · Todos los usuarios'}
              </p>
              {fetchingDaily && <RefreshCw size={14} className="animate-spin text-app-muted" />}
            </div>
            {fetchingDaily && daily.length === 0 ? (
              <div className="flex items-center justify-center h-40 gap-2 text-sm text-app-muted"><RefreshCw size={16} className="animate-spin" /> Cargando...</div>
            ) : !dailyHasData ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-app-muted"><Inbox size={28} strokeWidth={1.5} /><p className="text-sm">Sin actividad en el período seleccionado</p></div>
            ) : (
              <DailyBarChart data={daily} />
            )}
          </div>
        )}

        <p className="text-[11px] text-app-muted text-center pb-2">
          Chats = mensajes enviados por el usuario (no incluye respuestas de Elena) · Diario incluye borradores · Fechas en hora local de México
        </p>

      </div>
    </div>
  );
}
