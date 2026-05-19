import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { useTokenStatus } from '../hooks/useTokenStatus';
import { Zap, DollarSign, TrendingUp, Calendar, Clock } from 'lucide-react';

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4': { input: 30.00, output: 60.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
};

const OPERATION_LABELS: Record<string, string> = {
  chat: 'Chat con Elena',
  journal_prompts: 'Sugerencias de escritura',
  mood_insights: 'Insights de ánimo',
};

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  power: 'Power',
};

interface UsageRow {
  operation: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface AggregatedOperation {
  operation: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

function calcCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING['gpt-4o-mini'];
  return (promptTokens / 1_000_000) * pricing.input + (completionTokens / 1_000_000) * pricing.output;
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

export function TokenUsageSection() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const budget = useTokenStatus();
  const [aggregated, setAggregated] = useState<AggregatedOperation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadUsage();
  }, [user]);

  const loadUsage = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('token_usage')
      .select('operation, model, prompt_tokens, completion_tokens, total_tokens')
      .eq('user_id', user!.id);

    if (!error && data) {
      const map = new Map<string, AggregatedOperation>();

      (data as UsageRow[]).forEach((row) => {
        const key = row.operation;
        const existing = map.get(key);
        if (existing) {
          existing.promptTokens += row.prompt_tokens;
          existing.completionTokens += row.completion_tokens;
          existing.totalTokens += row.total_tokens;
          existing.estimatedCost = calcCost(existing.model, existing.promptTokens, existing.completionTokens);
        } else {
          map.set(key, {
            operation: row.operation,
            model: row.model,
            promptTokens: row.prompt_tokens,
            completionTokens: row.completion_tokens,
            totalTokens: row.total_tokens,
            estimatedCost: calcCost(row.model, row.prompt_tokens, row.completion_tokens),
          });
        }
      });

      setAggregated(Array.from(map.values()).sort((a, b) => b.totalTokens - a.totalTokens));
    }
    setIsLoading(false);
  };

  const totalCost = aggregated.reduce((sum, op) => sum + op.estimatedCost, 0);
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
              resetNote="Se restablece a las 00:00 UTC"
            />
            <BudgetBar
              label="Este mes"
              icon={<Calendar size={13} />}
              used={budget.monthlyUsed}
              limit={budget.monthlyLimit}
              resetNote="Se restablece el 1 de cada mes"
            />

            {!isLoading && (
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

      {!isLoading && aggregated.length > 0 && (
        <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5">
          <h2 className="text-[15px] font-semibold text-app-text mb-4 flex items-center gap-2">
            <TrendingUp size={17} className="text-sage-strong" />
            Desglose por operación
          </h2>

          <div className="space-y-3">
            {aggregated.map((op) => (
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
                    <div className="text-sm font-semibold text-app-text">{formatCost(op.estimatedCost)}</div>
                    <div className="text-[11px] text-app-muted mt-0.5">{op.totalTokens.toLocaleString()} tokens</div>
                  </div>
                </div>

                <div className="flex gap-3 text-[11px] text-app-muted">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-sage inline-block" />
                    Entrada: {op.promptTokens.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-sage-strong inline-block" />
                    Salida: {op.completionTokens.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-app-muted mt-3 leading-relaxed">
            Precios de referencia: gpt-4o-mini $0.15/1M tokens entrada · $0.60/1M tokens salida
          </p>
        </div>
      )}

      {!isLoading && aggregated.length === 0 && (
        <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5 text-center">
          <p className="text-sm text-app-muted">Aún no hay datos de uso de tokens.</p>
        </div>
      )}
    </div>
  );
}
