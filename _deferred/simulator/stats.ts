import type { ScenarioResult, RunSummary } from './types';

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

export function median(sorted: number[]): number {
  return percentile(sorted, 50);
}

export function computeRunSummary(results: ScenarioResult[]): RunSummary {
  const n = results.length;
  if (n === 0) {
    return {
      total_sessions: 0,
      total_turns: 0,
      total_prompt_tokens: 0,
      total_completion_tokens: 0,
      total_tokens: 0,
      total_cost_usd: 0,
      avg_tokens_per_session: 0,
      median_tokens_per_session: 0,
      p90_tokens_per_session: 0,
      p95_tokens_per_session: 0,
      avg_cost_per_session: 0,
      median_cost_per_session: 0,
      p90_cost_per_session: 0,
      p95_cost_per_session: 0,
      avg_latency_ms: 0,
    };
  }

  const total_turns = results.reduce((s, r) => s + r.turns_count, 0);
  const total_prompt_tokens = results.reduce((s, r) => s + r.prompt_tokens, 0);
  const total_completion_tokens = results.reduce((s, r) => s + r.completion_tokens, 0);
  const total_tokens = results.reduce((s, r) => s + r.total_tokens, 0);
  const total_cost_usd = results.reduce((s, r) => s + r.cost_usd, 0);
  const total_latency = results.reduce((s, r) => s + r.total_latency_ms, 0);

  const sortedTokens = [...results.map((r) => r.total_tokens)].sort((a, b) => a - b);
  const sortedCosts = [...results.map((r) => r.cost_usd)].sort((a, b) => a - b);

  return {
    total_sessions: n,
    total_turns,
    total_prompt_tokens,
    total_completion_tokens,
    total_tokens,
    total_cost_usd,
    avg_tokens_per_session: Math.round(total_tokens / n),
    median_tokens_per_session: Math.round(median(sortedTokens)),
    p90_tokens_per_session: Math.round(percentile(sortedTokens, 90)),
    p95_tokens_per_session: Math.round(percentile(sortedTokens, 95)),
    avg_cost_per_session: total_cost_usd / n,
    median_cost_per_session: median(sortedCosts),
    p90_cost_per_session: percentile(sortedCosts, 90),
    p95_cost_per_session: percentile(sortedCosts, 95),
    avg_latency_ms: Math.round(total_latency / n),
  };
}
