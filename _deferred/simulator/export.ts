import type { ScenarioResult, RunConfig, RunSummary } from './types';

function escapeCSV(val: string | number): string {
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportCSV(results: ScenarioResult[], config: RunConfig, summary: RunSummary): string {
  const headers = [
    'scenario_id',
    'type',
    'persona_label',
    'language',
    'turns',
    'prompt_tokens',
    'completion_tokens',
    'total_tokens',
    'cost_usd',
    'total_latency_ms',
  ];

  const rows = results.map((r) =>
    [
      r.scenario_id,
      r.type,
      r.persona_label,
      r.language,
      r.turns_count,
      r.prompt_tokens,
      r.completion_tokens,
      r.total_tokens,
      r.cost_usd.toFixed(8),
      r.total_latency_ms,
    ]
      .map(escapeCSV)
      .join(',')
  );

  const summaryRows = [
    '',
    '# Summary',
    `total_sessions,${summary.total_sessions}`,
    `total_tokens,${summary.total_tokens}`,
    `total_cost_usd,${summary.total_cost_usd.toFixed(6)}`,
    `avg_tokens_per_session,${summary.avg_tokens_per_session}`,
    `median_tokens_per_session,${summary.median_tokens_per_session}`,
    `p90_tokens_per_session,${summary.p90_tokens_per_session}`,
    `p95_tokens_per_session,${summary.p95_tokens_per_session}`,
    `avg_cost_per_session,${summary.avg_cost_per_session.toFixed(8)}`,
    '',
    '# Config',
    `model,${config.model}`,
    `temperature,${config.temperature}`,
    `top_p,${config.top_p}`,
    `seed,${config.seed}`,
  ];

  return [headers.join(','), ...rows, ...summaryRows].join('\n');
}

export function exportJSON(results: ScenarioResult[], config: RunConfig, summary: RunSummary): string {
  return JSON.stringify({ config, summary, results }, null, 2);
}

export function downloadBlob(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
