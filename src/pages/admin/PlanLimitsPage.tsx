import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, SlidersHorizontal, Save, CheckCircle, AlertCircle, RefreshCw, HardDrive, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAdmin } from '../../hooks/useAdmin';

interface PlanLimit {
  plan_key: string;
  daily_token_limit: number;
  monthly_token_limit: number;
  journal_storage_bytes: number;
  updated_at: string;
}

interface RowDraft {
  daily: string;
  monthly: string;
}

type RowState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'success'; saved_at: number }
  | { status: 'error'; message: string };

const PLAN_META: Record<string, { label: string; cls: string; desc: string }> = {
  starter: {
    label: 'Starter',
    cls: 'bg-app-bg text-app-muted border border-app-border',
    desc: 'Plan gratuito / entrada',
  },
  pro: {
    label: 'Pro',
    cls: 'bg-sage-strong/10 text-sage-strong border border-sage-strong/20',
    desc: 'Plan profesional',
  },
  power: {
    label: 'Power',
    cls: 'bg-amber-50 text-amber-700 border border-amber-200',
    desc: 'Plan máxima potencia',
  },
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 1 })}M`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString('en-US', { maximumFractionDigits: 0 })}K`;
  return n.toLocaleString('en-US');
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(0)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} MB`;
  return `${bytes} B`;
}

function parseTokenInput(raw: string): number | null {
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return null;
  const mMatch = trimmed.match(/^(\d+(?:\.\d+)?)M$/);
  if (mMatch) return Math.round(parseFloat(mMatch[1]) * 1_000_000);
  const kMatch = trimmed.match(/^(\d+(?:\.\d+)?)K$/);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1_000);
  const plain = parseInt(trimmed, 10);
  if (isNaN(plain)) return null;
  return plain;
}

async function fetchPlanLimits(): Promise<PlanLimit[]> {
  const { data, error } = await supabase.rpc('admin_get_token_plan_limits');
  if (error) throw error;
  return (data ?? []) as PlanLimit[];
}

async function savePlanLimit(
  plan_key: string,
  daily: number,
  monthly: number,
): Promise<PlanLimit> {
  const { data, error } = await supabase.rpc('admin_update_token_plan_limits', {
    p_plan_key: plan_key,
    p_daily: daily,
    p_monthly: monthly,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as PlanLimit;
}

export function PlanLimitsPage() {
  const { data: isAdmin } = useAdmin();
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});

  const { data: limits = [], isFetching, isError, error, refetch } = useQuery<PlanLimit[]>({
    queryKey: ['admin-plan-limits'],
    queryFn: fetchPlanLimits,
    staleTime: 60_000,
  });

  function getDraft(plan_key: string, field: 'daily' | 'monthly', fallback: number): string {
    return drafts[plan_key]?.[field] ?? String(fallback);
  }

  function setDraftField(plan_key: string, field: 'daily' | 'monthly', value: string) {
    setDrafts((prev) => ({
      ...prev,
      [plan_key]: {
        daily: prev[plan_key]?.daily ?? '',
        monthly: prev[plan_key]?.monthly ?? '',
        [field]: value,
      },
    }));
    setRowStates((prev) => ({ ...prev, [plan_key]: { status: 'idle' } }));
  }

  function isDirty(row: PlanLimit): boolean {
    const d = drafts[row.plan_key];
    if (!d) return false;
    const dailyEdited = d.daily !== '' && d.daily !== String(row.daily_token_limit);
    const monthlyEdited = d.monthly !== '' && d.monthly !== String(row.monthly_token_limit);
    return dailyEdited || monthlyEdited;
  }

  async function handleSave(row: PlanLimit) {
    const rawDaily = drafts[row.plan_key]?.daily ?? String(row.daily_token_limit);
    const rawMonthly = drafts[row.plan_key]?.monthly ?? String(row.monthly_token_limit);

    const daily = parseTokenInput(rawDaily) ?? row.daily_token_limit;
    const monthly = parseTokenInput(rawMonthly) ?? row.monthly_token_limit;

    if (daily <= 0) {
      setRowStates((prev) => ({ ...prev, [row.plan_key]: { status: 'error', message: 'El límite diario debe ser mayor a 0.' } }));
      return;
    }
    if (monthly < daily) {
      setRowStates((prev) => ({ ...prev, [row.plan_key]: { status: 'error', message: 'El límite mensual debe ser ≥ al diario.' } }));
      return;
    }

    setRowStates((prev) => ({ ...prev, [row.plan_key]: { status: 'saving' } }));

    try {
      const updated = await savePlanLimit(row.plan_key, daily, monthly);
      qc.setQueryData<PlanLimit[]>(['admin-plan-limits'], (prev = []) =>
        prev.map((r) => (r.plan_key === updated.plan_key ? updated : r)),
      );
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[row.plan_key];
        return next;
      });
      setRowStates((prev) => ({ ...prev, [row.plan_key]: { status: 'success', saved_at: Date.now() } }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar.';
      setRowStates((prev) => ({ ...prev, [row.plan_key]: { status: 'error', message: msg } }));
    }
  }

  if (!isAdmin) {
    return (
      <div
        className="bg-app-bg flex items-center justify-center"
        style={{ minHeight: 'calc(100dvh - var(--chrome-total))' }}
      >
        <p className="text-sm text-app-muted">Acceso restringido.</p>
      </div>
    );
  }

  return (
    <div
      className="bg-app-bg p-5 space-y-5"
      style={{
        minHeight: 'calc(100dvh - var(--chrome-total))',
        paddingBottom: 'calc(var(--nav-total) + 1.5rem)',
      }}
    >
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center gap-2">
          <Link
            href="/app/admin"
            className="flex items-center gap-1 text-sm text-app-muted hover:text-app-text transition-colors"
          >
            <ChevronLeft size={16} />
            Admin
          </Link>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-12 bg-sage-strong/10 flex items-center justify-center flex-shrink-0">
              <SlidersHorizontal size={18} className="text-sage-strong" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-app-text">Límites de Plan</h1>
              <p className="text-sm text-app-muted">Configura los presupuestos de tokens por plan. Los cambios aplican en la siguiente solicitud de cada usuario.</p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-10 text-xs font-medium text-app-muted hover:text-app-text border border-app-border hover:border-sage-strong transition-all"
          >
            <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
            Refrescar
          </button>
        </div>

        {isError && (
          <div className="flex items-center gap-2 p-3 rounded-12 bg-red-50 border border-red-200 text-red-700 text-sm">
            <AlertCircle size={15} className="flex-shrink-0" />
            {error instanceof Error ? error.message : 'Error al cargar los límites de plan.'}
          </div>
        )}

        <div className="space-y-3">
          {(limits.length === 0 && isFetching
            ? [{ plan_key: 'starter' }, { plan_key: 'pro' }, { plan_key: 'power' }] as PlanLimit[]
            : limits
          ).map((row) => {
            const meta = PLAN_META[row.plan_key] ?? PLAN_META['starter'];
            const state = rowStates[row.plan_key] ?? { status: 'idle' };
            const saving = state.status === 'saving';
            const dailyVal = getDraft(row.plan_key, 'daily', row.daily_token_limit);
            const monthlyVal = getDraft(row.plan_key, 'monthly', row.monthly_token_limit);
            const dirty = isDirty(row);

            return (
              <div
                key={row.plan_key}
                className="bg-app-surface border border-app-border rounded-[16px] shadow-app p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`inline-flex items-center text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${meta.cls}`}>
                      {meta.label}
                    </span>
                    <span className="text-sm text-app-muted">{meta.desc}</span>
                  </div>
                  {row.updated_at && (
                    <span className="text-[11px] text-app-muted flex-shrink-0">
                      Actualizado {new Date(row.updated_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[12px] font-semibold text-app-muted uppercase tracking-wider">
                      <Zap size={12} />
                      Límite Diario (tokens)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={dailyVal}
                        onChange={(e) => setDraftField(row.plan_key, 'daily', e.target.value)}
                        disabled={saving || isFetching}
                        placeholder={row.daily_token_limit ? formatTokens(row.daily_token_limit) : '—'}
                        className="w-full px-3 py-2 rounded-10 border border-app-border bg-app-bg text-app-text text-sm focus:outline-none focus:border-sage-strong focus:ring-1 focus:ring-sage-strong/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      />
                      {row.daily_token_limit > 0 && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-app-muted pointer-events-none">
                          {formatTokens(row.daily_token_limit)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-app-muted">Acepta números, K o M (ej: 200K, 2M)</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[12px] font-semibold text-app-muted uppercase tracking-wider">
                      <Zap size={12} />
                      Límite Mensual (tokens)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={monthlyVal}
                        onChange={(e) => setDraftField(row.plan_key, 'monthly', e.target.value)}
                        disabled={saving || isFetching}
                        placeholder={row.monthly_token_limit ? formatTokens(row.monthly_token_limit) : '—'}
                        className="w-full px-3 py-2 rounded-10 border border-app-border bg-app-bg text-app-text text-sm focus:outline-none focus:border-sage-strong focus:ring-1 focus:ring-sage-strong/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      />
                      {row.monthly_token_limit > 0 && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-app-muted pointer-events-none">
                          {formatTokens(row.monthly_token_limit)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-app-muted">Debe ser ≥ límite diario</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[12px] font-semibold text-app-muted uppercase tracking-wider">
                      <HardDrive size={12} />
                      Almacenamiento Diario
                    </label>
                    <div className="px-3 py-2 rounded-10 border border-app-border bg-app-bg/60 text-sm text-app-muted">
                      {row.journal_storage_bytes ? formatBytes(row.journal_storage_bytes) : '—'}
                    </div>
                    <p className="text-[11px] text-app-muted">Solo lectura · derivado del plan</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="min-h-[22px]">
                    {state.status === 'success' && (
                      <div className="flex items-center gap-1.5 text-sage-strong text-[13px]">
                        <CheckCircle size={14} />
                        Guardado correctamente
                      </div>
                    )}
                    {state.status === 'error' && (
                      <div className="flex items-center gap-1.5 text-red-600 text-[13px]">
                        <AlertCircle size={14} />
                        {state.message}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleSave(row)}
                    disabled={saving || isFetching || (!dirty && state.status !== 'error')}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-10 text-sm font-medium bg-sage-strong text-white hover:bg-sage-strong/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    {saving ? (
                      <RefreshCw size={13} className="animate-spin" />
                    ) : (
                      <Save size={13} />
                    )}
                    {saving ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app p-4 space-y-2">
          <p className="text-[12px] font-semibold text-app-muted uppercase tracking-wider">Notas</p>
          <ul className="space-y-1.5 text-sm text-app-muted">
            <li className="flex gap-2">
              <span className="text-sage-strong font-semibold flex-shrink-0">·</span>
              Los contadores se reinician a las <strong className="text-app-text">00:00 UTC</strong> (diario) y el primer día de cada mes UTC (mensual).
            </li>
            <li className="flex gap-2">
              <span className="text-sage-strong font-semibold flex-shrink-0">·</span>
              Los límites aplican inmediatamente en la siguiente llamada a <code className="text-[12px] bg-app-bg px-1 py-0.5 rounded-4">check_token_budget</code> — sin caché.
            </li>
            <li className="flex gap-2">
              <span className="text-sage-strong font-semibold flex-shrink-0">·</span>
              El almacenamiento de diario es fijo por tier y se actualiza automáticamente al cambiar el plan del usuario.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
