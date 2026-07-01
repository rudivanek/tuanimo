import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { useTokenStatus } from '../hooks/useTokenStatus';
import { useAdmin } from '../hooks/useAdmin';
import { Zap, DollarSign, TrendingUp, Calendar, Clock } from 'lucide-react';

const OPERATION_LABELS: Record<string, string> = {
  chat:                  'Chat con Elena',
  journal_prompts:       'Sugerencias de escritura',
  mood_insights:         'Insights de ánimo',
  generate_title:        'Generación de títulos',
  ai_reflection_prompt:  'Reflexiones del diario',
  chat_to_journal:       'Resumen a diario',
  ai_mini_insight:       'Micro-insights',
};

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  power: 'Power',
};

interface BreakdownItem {
  operation: string;
  model: string;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
}

interface UsageSummary {
  daily_used: number;
  daily_limit: number;
  daily_cost: number;
  cycle_used: number;
  cycle_limit: number;
  cycle_cost: number;
  cycle_start: string;
  plan_key: string;
  breakdown: BreakdownItem[];
}

function formatCost(usd: number): string {
  if (usd < 0.0001) return '< $0.0001';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

interface BudgetBarProps {
  label: string;
  icon: React.ReactNode;
  used: number;
  limit: number;
  resetNote: string;
}

function BudgetBar({ label, icon, used, limit, resetNote }: BudgetBarProps) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const color =
    pct >= 90 ? 'bg-danger' :
    pct >= 70 ? 'bg-amber-500' :
    'bg-sage-strong';

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-1.5 text-sm text-app-muted">
          {icon}
          {label}
        </span>
        <span className="text-sm font-semibold text-app-text tabular-nums">
          {formatTokens(used)} <span className="text-app-muted font-normal">/ {formatTokens(limit)}</span>
        </span>
      </div>
      <div className="h-2 bg-app-surface-2 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[11px] text-app-muted">{pct.toFixed(1)}% utilizado</span>
        <span className="text-[11px] text-app-muted">{resetNote}</span>
      </div>
    </div>
  );
}

function getNextCycleReset(signupAt: string | null | undefined): string {
  if (!signupAt) return '—';
  const signup = new Date(signupAt);
  const now = new Date();
  const signupDay = signup.getDate();
  let candidate = new Date(now.getFullYear(), now.getMonth(), signupDay,
    signup.getHours(), signup.getMinutes(), signup.getSeconds());
  if (candidate <= now) {
    candidate = new Date(now.getFullYear(), now.getMonth() + 1, signupDay,
      signup.getHours(), signup.getMinutes(), signup.getSeconds());
  }
  return candidate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function TokenUsageSection() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const budget = useTokenStatus();
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const cycleResetLabel = getNextCycleReset(user?.created_at);
  const { data: isAdmin } = useAdmin();

  useEffect(() => {
    if (!user) return;
    loadUsage();
  }, [user]);

  const loadUsage = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.rpc('get_my_usage_summary');
    if (!error && data) {
      const summary = data as UsageSummary;
      const sorted = [...(summary.breakdown ?? [])].sort((a, b) => b.total_tokens - a.total_tokens);
      setBreakdown(sorted);
      setTotalCost(summary.cycle_cost ?? 0);
    }
    setIsLoading(false);
  };
  const planLabel = PLAN_LABELS[profile?.plan_key ?? 'starter'] ?? 'Starter';

  return (
    <div className="space-y-4">
      <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold text-app-text flex items-center gap-2">
            <Zap size={17} className="text-sage-strong" />
            Uso de tokens
          </h2>
          <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sage-strong/10 text-sage-strong">
            Plan {planLabel}
          </span>
        </div>

        {!budget.isLoaded ? (
          <p className="text-sm text-app-muted">Cargando...</p>
        ) : (
          <div className="space-y-4">
            <BudgetBar
              label="Hoy"
              icon={<Clock size={13} />}
              used={budget.dailyUsed}
              limit={budget.dailyLimit}
              resetNote="Se restablece cada día a las 00:00 UTC"
            />
            <BudgetBar
              label="Este ciclo"
              icon={<Calendar size={13} />}
              used={budget.monthlyUsed}
              limit={budget.monthlyLimit}
              resetNote={`Se renueva el ${cycleResetLabel}`}
            />

            {!isLoading && isAdmin && (
              <div className="flex items-center justify-between pt-3 border-t border-app-border">
                <div className="flex items-center gap-2 text-sm text-app-muted">
                  <DollarSign size={15} className="text-sage-strong" />
                  Costo total estimado (histórico)
                </div>
                <span className="text-sm font-semibold text-app-text">{formatCost(totalCost)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {!isLoading && breakdown.length > 0 && (
        <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5">
          <h2 className="text-[15px] font-semibold text-app-text mb-4 flex items-center gap-2">
            <TrendingUp size={17} className="text-sage-strong" />
            Desglose por operación
          </h2>

          <div className="space-y-3">
            {breakdown.map((op) => (
              <div
                key={op.operation}
                className="p-3.5 bg-app-bg rounded-14 border border-app-border"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="text-sm font-medium text-app-text">
                      {OPERATION_LABELS[op.operation] ?? op.operation}
                    </div>
                    <div className="text-[11px] text-app-muted mt-0.5">{op.model}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-semibold text-app-text">{formatCost(op.cost)}</div>
                    <div className="text-[11px] text-app-muted mt-0.5">{op.total_tokens.toLocaleString()} tokens</div>
                  </div>
                </div>

                <div className="flex gap-3 text-[11px] text-app-muted">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-sage inline-block" />
                    Entrada: {op.prompt_tokens.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-sage-strong inline-block" />
                    Salida: {op.completion_tokens.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-app-muted mt-3 leading-relaxed">
            Los costos mostrados son exactos e incluyen descuentos por caché de contexto.
          </p>
        </div>
      )}

      {!isLoading && breakdown.length === 0 && (
        <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5 text-center">
          <p className="text-sm text-app-muted">Aún no hay datos de uso de tokens.</p>
        </div>
      )}
    </div>
  );
}
