import { Download, FileText } from 'lucide-react';
import type { ScenarioResult, RunSummary, RunConfig } from '../../lib/simulator/types';
import { exportCSV, exportJSON, downloadBlob } from '../../lib/simulator/export';

interface Props {
  results: ScenarioResult[];
  summary: RunSummary | null;
  config: RunConfig | null;
  isRunning: boolean;
  progress: number;
  total: number;
  elapsed_ms: number;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-app-bg border border-app-border rounded-12 p-3 space-y-0.5">
      <p className="text-[11px] text-app-muted font-medium uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-app-text tabular-nums leading-none">{value}</p>
      {sub && <p className="text-[11px] text-app-muted">{sub}</p>}
    </div>
  );
}

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: decimals });
}

function fmtCost(n: number): string {
  if (n < 0.001) return `$${n.toFixed(6)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function fmtElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function SimulatorResults({ results, summary, config, isRunning, progress, total, elapsed_ms }: Props) {
  if (!isRunning && results.length === 0) {
    return (
      <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app p-10 flex flex-col items-center justify-center text-center min-h-[300px]">
        <div className="w-12 h-12 rounded-full bg-app-bg border border-app-border flex items-center justify-center mb-4">
          <FileText size={20} className="text-app-muted" />
        </div>
        <p className="text-sm font-semibold text-app-text mb-1">Sin resultados</p>
        <p className="text-xs text-app-muted max-w-xs">
          Configura la simulación y presiona "Ejecutar" para ver el análisis de tokens y costos.
        </p>
      </div>
    );
  }

  const handleCSV = () => {
    if (!summary || !config) return;
    const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
    downloadBlob(exportCSV(results, config, summary), `sim_run_${ts}.csv`, 'text/csv');
  };

  const handleJSON = () => {
    if (!summary || !config) return;
    const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
    downloadBlob(exportJSON(results, config, summary), `sim_run_${ts}.json`, 'application/json');
  };

  return (
    <div className="space-y-4">
      {(isRunning || progress > 0) && (
        <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isRunning && (
                <span className="w-2 h-2 rounded-full bg-sage-strong animate-pulse inline-block" />
              )}
              <span className="text-sm font-semibold text-app-text">
                {isRunning ? 'Ejecutando...' : 'Completado'}
              </span>
            </div>
            <span className="text-xs text-app-muted tabular-nums">
              {progress} / {total} sesiones · {fmtElapsed(elapsed_ms)}
            </span>
          </div>
          <div className="w-full bg-app-bg rounded-full h-2 overflow-hidden">
            <div
              className="h-2 bg-sage-strong rounded-full transition-all duration-300"
              style={{ width: total > 0 ? `${(progress / total) * 100}%` : '0%' }}
            />
          </div>
        </div>
      )}

      {summary && (
        <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-app-text uppercase tracking-widest">Resumen</h3>
            <div className="flex gap-2">
              <button
                onClick={handleCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-8 bg-app-bg border border-app-border text-xs font-medium text-app-text hover:border-sage-strong transition-colors"
              >
                <Download size={12} />
                CSV
              </button>
              <button
                onClick={handleJSON}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-8 bg-app-bg border border-app-border text-xs font-medium text-app-text hover:border-sage-strong transition-colors"
              >
                <Download size={12} />
                JSON
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Costo total"
              value={fmtCost(summary.total_cost_usd)}
              sub={`${fmt(summary.total_sessions)} sesiones`}
            />
            <StatCard
              label="Costo promedio"
              value={fmtCost(summary.avg_cost_per_session)}
              sub={`p90 ${fmtCost(summary.p90_cost_per_session)}`}
            />
            <StatCard
              label="Tokens promedio"
              value={fmt(summary.avg_tokens_per_session)}
              sub={`p90 ${fmt(summary.p90_tokens_per_session)}`}
            />
            <StatCard
              label="Total tokens"
              value={fmt(summary.total_tokens)}
              sub={`${fmt(summary.total_turns)} turnos`}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-app-border">
                  {['Métrica', 'Promedio', 'Mediana', 'P90', 'P95'].map((h) => (
                    <th key={h} className="py-2 px-2 text-left font-semibold text-app-muted first:pl-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                <tr>
                  <td className="py-2 px-2 pl-0 text-app-text font-medium">Tokens / sesión</td>
                  <td className="py-2 px-2 tabular-nums text-app-text">{fmt(summary.avg_tokens_per_session)}</td>
                  <td className="py-2 px-2 tabular-nums text-app-text">{fmt(summary.median_tokens_per_session)}</td>
                  <td className="py-2 px-2 tabular-nums text-app-text">{fmt(summary.p90_tokens_per_session)}</td>
                  <td className="py-2 px-2 tabular-nums text-app-text">{fmt(summary.p95_tokens_per_session)}</td>
                </tr>
                <tr>
                  <td className="py-2 px-2 pl-0 text-app-text font-medium">Costo / sesión</td>
                  <td className="py-2 px-2 tabular-nums text-app-text">{fmtCost(summary.avg_cost_per_session)}</td>
                  <td className="py-2 px-2 tabular-nums text-app-text">{fmtCost(summary.median_cost_per_session)}</td>
                  <td className="py-2 px-2 tabular-nums text-app-text">{fmtCost(summary.p90_cost_per_session)}</td>
                  <td className="py-2 px-2 tabular-nums text-app-text">{fmtCost(summary.p95_cost_per_session)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app overflow-hidden">
          <div className="px-4 py-3 border-b border-app-border">
            <h3 className="text-[13px] font-semibold text-app-text uppercase tracking-widest">
              Detalle por sesión
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-app-border bg-app-bg/50">
                  {[
                    'Scenario ID',
                    'Tipo',
                    'Persona',
                    'Lang',
                    'Turnos',
                    'Prompt tk',
                    'Compl. tk',
                    'Total tk',
                    'Costo USD',
                    'Latencia',
                  ].map((h) => (
                    <th
                      key={h}
                      className="py-2.5 px-3 text-left font-semibold text-app-muted whitespace-nowrap first:pl-4 last:pr-4"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {results.map((r, i) => (
                  <tr
                    key={`${r.scenario_id}-${i}`}
                    className="hover:bg-app-bg/40 transition-colors"
                  >
                    <td className="py-2 px-3 pl-4 text-app-text font-mono text-[11px] whitespace-nowrap max-w-[160px] truncate">
                      {r.scenario_id}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span
                        className={`px-1.5 py-0.5 rounded-4 text-[10px] font-semibold ${
                          r.type === 'chat'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {r.type}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-app-muted max-w-[140px] truncate">{r.persona_label}</td>
                    <td className="py-2 px-3 text-app-muted uppercase font-mono text-[11px]">{r.language}</td>
                    <td className="py-2 px-3 tabular-nums text-app-text text-center">{r.turns_count}</td>
                    <td className="py-2 px-3 tabular-nums text-app-text">{fmt(r.prompt_tokens)}</td>
                    <td className="py-2 px-3 tabular-nums text-app-text">{fmt(r.completion_tokens)}</td>
                    <td className="py-2 px-3 tabular-nums text-app-text font-medium">{fmt(r.total_tokens)}</td>
                    <td className="py-2 px-3 tabular-nums text-app-text">{fmtCost(r.cost_usd)}</td>
                    <td className="py-2 px-3 pr-4 tabular-nums text-app-muted">{fmtElapsed(r.total_latency_ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
