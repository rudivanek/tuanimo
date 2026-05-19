import { PRICING } from '../../lib/simulator/costModel';
import type { RunConfig } from '../../lib/simulator/types';

interface Props {
  config: RunConfig;
  onChange: (patch: Partial<RunConfig>) => void;
  onRun: () => void;
  onCancel: () => void;
  isRunning: boolean;
  disabled: boolean;
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const display = format ? format(value) : String(value);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-app-muted font-medium">{label}</span>
        <span className="text-app-text font-semibold tabular-nums">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 accent-sage-strong rounded-full cursor-pointer"
      />
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative mt-0.5 flex-shrink-0">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div className="w-9 h-5 bg-app-border rounded-full peer peer-checked:bg-sage-strong transition-colors" />
        <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4" />
      </div>
      <div>
        <p className="text-xs font-semibold text-app-text leading-none mb-0.5">{label}</p>
        <p className="text-[11px] text-app-muted leading-snug">{description}</p>
      </div>
    </label>
  );
}

export function SimulatorControls({ config, onChange, onRun, onCancel, isRunning, disabled }: Props) {
  const chatPct = config.chat_pct;
  const journalPct = 100 - chatPct;

  return (
    <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app divide-y divide-app-border">
      <div className="p-4">
        <h2 className="text-[13px] font-semibold text-app-text uppercase tracking-widest">Configuración</h2>
      </div>

      <div className="p-4 space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-app-muted">Modelo</label>
          <select
            value={config.model}
            onChange={(e) => onChange({ model: e.target.value })}
            className="w-full bg-app-bg border border-app-border rounded-10 px-3 py-2 text-sm text-app-text focus:outline-none focus:border-sage-strong"
          >
            {Object.entries(PRICING).map(([key, p]) => (
              <option key={key} value={key}>
                {p.label} — {p.provider}
              </option>
            ))}
          </select>
        </div>

        <SliderRow
          label="Temperature"
          value={config.temperature}
          min={0}
          max={2}
          step={0.1}
          onChange={(v) => onChange({ temperature: v })}
          format={(v) => v.toFixed(1)}
        />

        <SliderRow
          label="Top-P"
          value={config.top_p}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => onChange({ top_p: v })}
          format={(v) => v.toFixed(2)}
        />
      </div>

      <div className="p-4 space-y-5">
        <SliderRow
          label="Sesiones"
          value={config.number_of_sessions}
          min={1}
          max={500}
          step={1}
          onChange={(v) => onChange({ number_of_sessions: v })}
        />

        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-app-muted font-medium">Mix: Chat / Diario</span>
            <span className="text-app-text font-semibold tabular-nums">{chatPct}% / {journalPct}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={config.chat_pct}
            onChange={(e) => onChange({ chat_pct: Number(e.target.value) })}
            className="w-full h-1.5 accent-sage-strong rounded-full cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-app-muted">
            <span>100% Diario</span>
            <span>100% Chat</span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-app-muted font-medium">Idioma: EN / ES</span>
            <span className="text-app-text font-semibold tabular-nums">{config.lang_en_pct}% / {100 - config.lang_en_pct}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={config.lang_en_pct}
            onChange={(e) => onChange({ lang_en_pct: Number(e.target.value) })}
            className="w-full h-1.5 accent-sage-strong rounded-full cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-app-muted">
            <span>100% ES</span>
            <span>100% EN</span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-app-muted">Turnos por sesión</label>
          <div className="flex gap-2">
            {(['fixed', 'range'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onChange({ turns_mode: mode })}
                className={`flex-1 py-1.5 rounded-8 text-xs font-medium transition-colors ${
                  config.turns_mode === mode
                    ? 'bg-sage-strong text-white'
                    : 'bg-app-bg border border-app-border text-app-muted hover:text-app-text'
                }`}
              >
                {mode === 'fixed' ? 'Fijo' : 'Rango'}
              </button>
            ))}
          </div>
        </div>

        {config.turns_mode === 'fixed' ? (
          <SliderRow
            label="Turnos fijos"
            value={config.turns_fixed}
            min={1}
            max={30}
            step={1}
            onChange={(v) => onChange({ turns_fixed: v })}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <SliderRow
              label="Min turnos"
              value={config.turns_min}
              min={1}
              max={config.turns_max}
              step={1}
              onChange={(v) => onChange({ turns_min: v })}
            />
            <SliderRow
              label="Max turnos"
              value={config.turns_max}
              min={config.turns_min}
              max={30}
              step={1}
              onChange={(v) => onChange({ turns_max: v })}
            />
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <Toggle
          label="Casos extremos"
          description="Incluye escenarios con respuestas cortas, errores tipográficos y cambios de idioma"
          checked={config.include_edge_cases}
          onChange={(v) => onChange({ include_edge_cases: v })}
        />
        <Toggle
          label="Señales de crisis"
          description="Incluye escenarios sintéticos que prueban flujos de detección de crisis"
          checked={config.include_crisis_signals}
          onChange={(v) => onChange({ include_crisis_signals: v })}
        />
      </div>

      <div className="p-4 space-y-1.5">
        <label className="text-xs font-medium text-app-muted">Semilla (seed)</label>
        <input
          type="number"
          value={config.seed}
          onChange={(e) => onChange({ seed: Number(e.target.value) })}
          className="w-full bg-app-bg border border-app-border rounded-10 px-3 py-2 text-sm text-app-text focus:outline-none focus:border-sage-strong"
        />
      </div>

      <div className="p-4 flex gap-2">
        {isRunning ? (
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-12 bg-red-50 border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors"
          >
            Cancelar
          </button>
        ) : (
          <button
            onClick={onRun}
            disabled={disabled}
            className="flex-1 py-2.5 rounded-12 bg-sage-strong text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Ejecutar simulación
          </button>
        )}
      </div>
    </div>
  );
}
