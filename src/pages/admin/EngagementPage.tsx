import { useState, useCallback, useMemo } from 'react';
import { Activity, ChevronLeft, RefreshCw, AlertCircle, Inbox, Download } from 'lucide-react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EngagementRow {
  user_id: string;
  email: string;
  name: string;
  chats: number;
  diario: number;
}

interface UserOption {
  user_id: string;
  user_label: string;
}

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

// ── Page ──────────────────────────────────────────────────────────────────────

export function EngagementPage() {
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

  // Report data
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

  const totals = useMemo(() => ({
    users:  rows.length,
    active: rows.filter(r => (Number(r.chats) + Number(r.diario)) > 0).length,
    chats:  rows.reduce((s, r) => s + Number(r.chats), 0),
    diario: rows.reduce((s, r) => s + Number(r.diario), 0),
  }), [rows]);

  const handleExport = useCallback(() => {
    if (rows.length === 0) return;
    const esc = (v: string | number) => {
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : `${s}`;
    };
    const headers = ['Correo', 'Nombre', 'Chats', 'Diario'];
    const data: (string | number)[][] = rows.map(r => [r.email, r.name, Number(r.chats), Number(r.diario)]);
    data.push(['TOTAL', '', totals.chats, totals.diario]);
    const csv = '\uFEFF' + [headers, ...data].map(r => r.map(esc).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
      download: `conelena-actividad_${appliedFrom}_${appliedUntil}.csv`,
    });
    a.click(); URL.revokeObjectURL(a.href);
  }, [rows, totals, appliedFrom, appliedUntil]);

  return (
    <div className="bg-app-bg p-5 space-y-5" style={{ minHeight: 'calc(100dvh - var(--chrome-total))', paddingBottom: 'calc(var(--nav-total) + 1.5rem)' }}>
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-start gap-4">
          <Link href="/app/admin" className="mt-0.5 p-2 rounded-10 bg-app-surface border border-app-border hover:border-sage-strong transition-colors text-app-muted hover:text-sage-strong">
            <ChevronLeft size={16} />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Activity size={20} className="text-sage-strong" />
              <h1 className="text-2xl font-semibold text-app-text">Actividad de Usuarios</h1>
              {isFetching && <RefreshCw size={14} className="animate-spin text-app-muted" />}
            </div>
            <p className="text-sm text-app-muted mt-0.5">Cuántos mensajes de chat y entradas de Diario hace cada usuario</p>
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
          <button onClick={setLast30} className="text-[11px] font-medium text-app-muted hover:text-sage-strong underline underline-offset-2 transition-colors">
            Últimos 30 días
          </button>
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

        {/* Table */}
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

        <p className="text-[11px] text-app-muted text-center pb-2">
          Chats = mensajes enviados por el usuario (no incluye respuestas de Elena) · Diario incluye borradores · Fechas en hora local de México
        </p>

      </div>
    </div>
  );
}

