import { useState, useMemo } from 'react';
import { Calculator, MessageSquare, BookOpen, Sparkles, Users } from 'lucide-react';
import { computeMonthlyCost, PRICING } from '../../lib/simulator/costModel';
import type { MonthlyCostInput } from '../../lib/simulator/costModel';
import type { RunSummary } from '../../lib/simulator/types';

interface Props {
  model: string;
  summary: RunSummary | null;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtCost(n: number): string {
  if (n < 0.01) return `$${n.toFixed(6)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  if (n < 10000) return `$${n.toFixed(2)}`;
  return `$${fmt(Math.round(n))}`;
}

function NumField({
  label,
  note,
  value,
  onChange,
  min,
  step,
  suffix,
  readOnly,
}: {
  label: string;
  note?: string;
  value: number;
  onChange?: (v: number) => void;
  min?: number;
  step?: number;
  suffix?: string;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-xs font-medium text-app-muted leading-tight">{label}</label>
        {note && <span className="text-[10px] text-app-muted/60 italic shrink-0">{note}</span>}
      </div>
      <div className="flex items-center">
        <input
          type="number"
          value={value}
          readOnly={readOnly}
          min={min ?? 0}
          step={step ?? 1}
          onChange={(e) => onChange?.(Number(e.target.value))}
          className={`w-full bg-app-bg border border-app-border rounded-10 px-3 py-2 text-sm text-app-text focus:outline-none focus:border-sage-strong tabular-nums ${readOnly ? 'opacity-60 cursor-default' : ''}`}
        />
        {suffix && (
          <span className="ml-2 text-xs text-app-muted shrink-0">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 pb-1 border-b border-app-border">
      <Icon size={13} className="text-sage-strong" />
      <span className="text-[11px] font-semibold text-app-muted uppercase tracking-widest">{label}</span>
    </div>
  );
}

function ResultRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center py-2.5 ${highlight ? '' : 'border-b border-app-border/60'}`}>
      <span className={`text-sm ${highlight ? 'font-semibold text-app-text text-base' : 'text-app-muted'}`}>
        {label}
      </span>
      <span className={`tabular-nums font-bold ${highlight ? 'text-2xl text-sage-strong' : 'text-app-text text-sm'}`}>
        {value}
      </span>
    </div>
  );
}

const DEFAULT_AVG_TOKENS_PER_TURN = 600;
const DEFAULT_TOKENS_PER_SPARKLE = 300;

export function MonthlyProjection({ model: initialModel, summary }: Props) {
  const measuredTokensPerTurn = summary
    ? Math.round(
        summary.avg_tokens_per_session /
          Math.max(1, summary.total_turns / Math.max(1, summary.total_sessions))
      )
    : null;

  const [users, setUsers] = useState(1);
  const [chatsPerMonth, setChatsPerMonth] = useState(8);
  const [inputsPerChat, setInputsPerChat] = useState(5);
  const [avgTokensPerTurn, setAvgTokensPerTurn] = useState(
    measuredTokensPerTurn ?? DEFAULT_AVG_TOKENS_PER_TURN
  );
  const [journalEntriesPerMonth, setJournalEntriesPerMonth] = useState(12);
  const [sparkleClickRate, setSparkleClickRate] = useState(30);
  const [tokensPerSparkle, setTokensPerSparkle] = useState(DEFAULT_TOKENS_PER_SPARKLE);
  const [selectedModel, setSelectedModel] = useState(initialModel);
  const [pricingMode, setPricingMode] = useState<'split' | 'blended'>('split');
  const [blendedRate, setBlendedRate] = useState(0.40);

  const pricing = PRICING[selectedModel] ?? PRICING['gpt-4o-mini'];

  const input: MonthlyCostInput = {
    users,
    chats_per_month: chatsPerMonth,
    inputs_per_chat: inputsPerChat,
    avg_tokens_per_turn: avgTokensPerTurn,
    journal_entries_per_month: journalEntriesPerMonth,
    sparkle_click_rate: sparkleClickRate,
    tokens_per_sparkle_call: tokensPerSparkle,
    model: selectedModel,
    pricing_mode: pricingMode,
    blended_rate: blendedRate,
  };

  const result = useMemo(() => computeMonthlyCost(input), [
    users, chatsPerMonth, inputsPerChat, avgTokensPerTurn,
    journalEntriesPerMonth, sparkleClickRate, tokensPerSparkle,
    selectedModel, pricingMode, blendedRate,
  ]);

  return (
    <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app overflow-hidden">
      <div className="px-4 py-3 border-b border-app-border flex items-center gap-2">
        <Calculator size={14} className="text-sage-strong" />
        <h3 className="text-[13px] font-semibold text-app-text uppercase tracking-widest">
          Calculadora de Costos Mensual
        </h3>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6">
          <div className="space-y-3">
            <SectionHeader icon={Users} label="A) Usuarios" />
            <NumField
              label="Usuarios"
              value={users}
              onChange={(v) => setUsers(Math.max(1, v))}
              min={1}
            />
          </div>

          <div className="space-y-3">
            <SectionHeader icon={MessageSquare} label="B) Chat" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <NumField
                label="Chats por mes"
                value={chatsPerMonth}
                onChange={(v) => setChatsPerMonth(Math.max(0, v))}
                min={0}
              />
              <NumField
                label="Inputs por chat"
                value={inputsPerChat}
                onChange={(v) => setInputsPerChat(Math.max(1, v))}
                min={1}
              />
              <NumField
                label="Tokens por turno (prom.)"
                note={measuredTokensPerTurn ? `medido: ${measuredTokensPerTurn}` : undefined}
                value={avgTokensPerTurn}
                onChange={(v) => setAvgTokensPerTurn(Math.max(1, v))}
                min={1}
              />
            </div>
            <p className="text-[10px] text-app-muted leading-relaxed">
              1 turno = 1 input del usuario + 1 respuesta de IA (incluye system prompt + contexto).
            </p>
          </div>

          <div className="space-y-3">
            <SectionHeader icon={BookOpen} label="C) Diario" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <NumField
                label="Entradas por mes"
                value={journalEntriesPerMonth}
                onChange={(v) => setJournalEntriesPerMonth(Math.max(0, v))}
                min={0}
              />
              <NumField
                label="Long. promedio (palabras)"
                note="solo informativo"
                value={300}
                readOnly
              />
              <NumField
                label="Tasa de sparkle (%)"
                note="% de entradas donde se usa"
                value={sparkleClickRate}
                onChange={(v) => setSparkleClickRate(Math.min(100, Math.max(0, v)))}
                min={0}
                step={5}
                suffix="%"
              />
            </div>
            <NumField
              label="Tokens por llamada sparkle"
              note={`solo se consume al hacer clic en "Sugerencias de escritura"`}
              value={tokensPerSparkle}
              onChange={(v) => setTokensPerSparkle(Math.max(1, v))}
              min={1}
            />
            <p className="text-[10px] text-app-muted leading-relaxed">
              Escribir en el diario NO consume tokens. Solo consume el boton sparkle cuando el usuario lo presiona.
            </p>
          </div>

          <div className="space-y-3">
            <SectionHeader icon={Sparkles} label="Modelo y Precios" />
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-app-muted">Modelo</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-app-bg border border-app-border rounded-10 px-3 py-2 text-sm text-app-text focus:outline-none focus:border-sage-strong"
              >
                {Object.entries(PRICING).map(([key, p]) => (
                  <option key={key} value={key}>
                    {p.label} — {p.provider}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-app-muted">Modo de precio</label>
                <div className="flex gap-1 ml-auto">
                  {(['split', 'blended'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setPricingMode(mode)}
                      className={`px-3 py-1 rounded-8 text-xs font-medium transition-colors ${
                        pricingMode === mode
                          ? 'bg-sage-strong text-white'
                          : 'bg-app-bg border border-app-border text-app-muted hover:text-app-text'
                      }`}
                    >
                      {mode === 'split' ? 'Entrada / Salida' : 'Combinado'}
                    </button>
                  ))}
                </div>
              </div>

              {pricingMode === 'split' ? (
                <div className="grid grid-cols-2 gap-3">
                  <NumField
                    label="Entrada ($/1M tokens)"
                    value={pricing.input_per_1m}
                    readOnly
                  />
                  <NumField
                    label="Salida ($/1M tokens)"
                    value={pricing.output_per_1m}
                    readOnly
                  />
                </div>
              ) : (
                <NumField
                  label="Tasa combinada ($/1M tokens)"
                  value={blendedRate}
                  onChange={(v) => setBlendedRate(Math.max(0, v))}
                  min={0}
                  step={0.01}
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-app-bg border border-app-border rounded-12 p-4 space-y-1">
            <p className="text-[11px] font-semibold text-app-muted uppercase tracking-widest mb-3">Resultados</p>

            <ResultRow label="Turnos de chat / mes" value={fmt(result.chat_turns_month)} />
            <ResultRow label="Tokens de chat / mes" value={fmt(result.chat_tokens_month)} />
            <ResultRow label="Llamadas sparkle / mes" value={fmt(result.sparkle_calls_month)} />
            <ResultRow label="Tokens sparkle / mes" value={fmt(result.sparkle_tokens_month)} />

            <div className="pt-1 mt-1 border-t border-app-border">
              <ResultRow label="Total tokens / mes" value={fmt(result.total_tokens_month)} />
            </div>

            <div className="pt-3 mt-1 border-t-2 border-app-border">
              <ResultRow label="Costo mensual est." value={fmtCost(result.total_cost_usd)} highlight />
            </div>
          </div>

          <div className="bg-app-bg border border-app-border rounded-12 p-4 space-y-2">
            <p className="text-[11px] font-semibold text-app-muted uppercase tracking-widest">Desglose</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-app-muted">Chat</span>
                <span className="text-app-text tabular-nums font-medium">
                  {result.total_tokens_month > 0
                    ? `${Math.round((result.chat_tokens_month / result.total_tokens_month) * 100)}%`
                    : '—'}
                </span>
              </div>
              {result.total_tokens_month > 0 && (
                <div className="w-full h-2 bg-app-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sage-strong rounded-full transition-all"
                    style={{
                      width: `${Math.round((result.chat_tokens_month / result.total_tokens_month) * 100)}%`,
                    }}
                  />
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-app-muted">Sparkle (diario)</span>
                <span className="text-app-text tabular-nums font-medium">
                  {result.total_tokens_month > 0
                    ? `${Math.round((result.sparkle_tokens_month / result.total_tokens_month) * 100)}%`
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-app-muted leading-relaxed px-1">
            Modelo: <span className="font-semibold">{pricing.label}</span>
            {pricingMode === 'split'
              ? ` — $${pricing.input_per_1m}/1M entrada · $${pricing.output_per_1m}/1M salida (40/60)`
              : ` — $${blendedRate}/1M combinado`}
          </p>
        </div>
      </div>
    </div>
  );
}
