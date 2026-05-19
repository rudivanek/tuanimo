import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { SimulatorControls } from '../../components/admin/SimulatorControls';
import { SimulatorResults } from '../../components/admin/SimulatorResults';
import { MonthlyProjection } from '../../components/admin/MonthlyProjection';
import { useSimulator } from '../../hooks/useSimulator';
import type { RunConfig } from '../../lib/simulator/types';
import scenariosData from '../../data/sim_scenarios.json';

const DEFAULT_CONFIG: RunConfig = {
  model: 'gpt-4o-mini',
  temperature: 0.8,
  top_p: 1.0,
  number_of_sessions: 30,
  chat_pct: 70,
  journal_pct: 30,
  turns_mode: 'range',
  turns_fixed: 5,
  turns_min: 2,
  turns_max: 10,
  lang_en_pct: 50,
  lang_es_pct: 50,
  include_edge_cases: true,
  include_crisis_signals: false,
  seed: 42,
};

export function SimulatorPage() {
  const [config, setConfig] = useState<RunConfig>(DEFAULT_CONFIG);
  const { state, runSimulation, cancel } = useSimulator();

  const isRunning = state.status === 'running';

  const handleConfigChange = (patch: Partial<RunConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      next.journal_pct = 100 - next.chat_pct;
      next.lang_es_pct = 100 - next.lang_en_pct;
      if (next.turns_min > next.turns_max) next.turns_max = next.turns_min;
      if (next.turns_max < next.turns_min) next.turns_min = next.turns_max;
      return next;
    });
  };

  const handleRun = () => {
    runSimulation(config, scenariosData.scenarios as any);
  };

  return (
    <div
      className="bg-app-bg p-5 space-y-5"
      style={{
        minHeight: 'calc(100dvh - var(--chrome-total))',
        paddingBottom: 'calc(var(--nav-total) + 1.5rem)',
      }}
    >
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-app-text">Simulador de Costos</h1>
            <p className="text-sm text-app-muted mt-1">
              Estima el consumo de tokens y costos sin realizar llamadas reales a la IA.
            </p>
          </div>
          {state.status === 'error' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-10 text-xs text-red-700">
              <AlertTriangle size={13} />
              {state.error ?? 'Error desconocido'}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 items-start">
          <div className="lg:sticky lg:top-[calc(var(--header-h)+1.25rem)]">
            <SimulatorControls
              config={config}
              onChange={handleConfigChange}
              onRun={handleRun}
              onCancel={cancel}
              isRunning={isRunning}
              disabled={isRunning}
            />
          </div>

          <div className="space-y-5 min-w-0">
            <MonthlyProjection model={config.model} summary={state.summary} />

            <SimulatorResults
              results={state.results}
              summary={state.summary}
              config={state.config}
              isRunning={isRunning}
              progress={state.progress}
              total={state.total}
              elapsed_ms={state.elapsed_ms}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
