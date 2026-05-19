import { useState, useRef, useEffect } from 'react';
import { Link } from 'wouter';
import { Zap, X } from 'lucide-react';
import { useTokenStatus } from '../hooks/useTokenStatus';
import { useProfile } from '../hooks/useProfile';

function fmt(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}M`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function pct(used: number, limit: number): number {
  if (!limit) return 0;
  return Math.min(100, (used / limit) * 100);
}

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  power: 'Power',
};

const PLAN_COLORS: Record<string, string> = {
  starter: 'bg-slate-100 text-slate-600',
  pro: 'bg-sky-100 text-sky-700',
  power: 'bg-emerald-100 text-emerald-700',
};

function ProgressBar({ value, pctVal }: { value: number; pctVal: number }) {
  const isCrit = pctVal >= 100;
  const isWarn = !isCrit && pctVal >= 80;
  return (
    <div className="h-1.5 w-full bg-app-border rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${
          isCrit ? 'bg-red-500' : isWarn ? 'bg-amber-400' : 'bg-sage-strong'
        }`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export function HeaderTokenBudget() {
  const status = useTokenStatus();
  const { data: profile } = useProfile();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { dailyUsed, dailyLimit, monthlyUsed, monthlyLimit, isLoaded } = status;
  const planKey = profile?.plan_key ?? 'starter';
  const planLabel = PLAN_LABELS[planKey] ?? 'Starter';
  const planBadgeCls = PLAN_COLORS[planKey] ?? PLAN_COLORS.starter;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (!isLoaded || !dailyLimit) return null;

  const dailyPct = pct(dailyUsed, dailyLimit);
  const monthlyPct = pct(monthlyUsed, monthlyLimit);
  const maxPct = Math.max(dailyPct, monthlyPct);
  const isCritical = maxPct >= 100;
  const isWarning = !isCritical && maxPct >= 80;

  const labelCls = isCritical
    ? 'text-red-600'
    : isWarning
    ? 'text-amber-600'
    : 'text-app-muted';

  return (
    <div ref={containerRef} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        title={isCritical ? 'Límite alcanzado' : 'Presupuesto de tokens'}
        className={`flex items-center gap-1.5 text-[11.5px] font-medium transition-opacity hover:opacity-70 ${labelCls}`}
      >
        <Zap size={11} className="flex-shrink-0" />
        <span className="hidden sm:inline">
          Hoy&nbsp;{fmt(dailyUsed)}/{fmt(dailyLimit)}
          <span className="mx-1 opacity-40">·</span>
          Mes&nbsp;{fmt(monthlyUsed)}/{fmt(monthlyLimit)}
        </span>
        <span className="sm:hidden">
          {fmt(dailyUsed)}/{fmt(dailyLimit)}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2.5 w-64 bg-app-surface border border-app-border rounded-[14px] shadow-xl z-50 p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-app-muted">
                Tokens
              </span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${planBadgeCls}`}>
                {planLabel}
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-app-muted hover:text-app-text transition-colors p-0.5 -mr-0.5"
            >
              <X size={13} />
            </button>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-app-muted">Hoy</span>
                <span
                  className={`text-xs font-semibold ${
                    dailyPct >= 100
                      ? 'text-red-600'
                      : dailyPct >= 80
                      ? 'text-amber-600'
                      : 'text-app-text'
                  }`}
                >
                  {fmt(dailyUsed)} / {fmt(dailyLimit)}
                </span>
              </div>
              <ProgressBar value={dailyPct} pctVal={dailyPct} />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-app-muted">Este mes</span>
                <span
                  className={`text-xs font-semibold ${
                    monthlyPct >= 100
                      ? 'text-red-600'
                      : monthlyPct >= 80
                      ? 'text-amber-600'
                      : 'text-app-text'
                  }`}
                >
                  {fmt(monthlyUsed)} / {fmt(monthlyLimit)}
                </span>
              </div>
              <ProgressBar value={monthlyPct} pctVal={monthlyPct} />
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-app-muted">
            <span>Reinicio: 00:00 UTC</span>
            {isCritical && (
              <span className="text-red-600 font-semibold">Límite alcanzado</span>
            )}
          </div>

          <div className="border-t border-app-border pt-2.5">
            <Link
              href="/app/settings"
              onClick={() => setOpen(false)}
              className="block text-center text-[12px] font-medium text-sage-strong hover:opacity-70 transition-opacity"
            >
              Ver detalles →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
