export type ScenarioType = 'chat' | 'journal';
export type Language = 'en' | 'es';
export type SimStatus = 'idle' | 'running' | 'completed' | 'cancelled' | 'error';

export interface JournalTurn {
  prompt: string;
  user_entry: string;
}

export interface Scenario {
  scenario_id: string;
  type: ScenarioType;
  persona_label: string;
  language: Language;
  tags: string[];
  turns: Array<string | JournalTurn>;
}

export interface RunConfig {
  model: string;
  temperature: number;
  top_p: number;
  number_of_sessions: number;
  chat_pct: number;
  journal_pct: number;
  turns_mode: 'fixed' | 'range';
  turns_fixed: number;
  turns_min: number;
  turns_max: number;
  lang_en_pct: number;
  lang_es_pct: number;
  include_edge_cases: boolean;
  include_crisis_signals: boolean;
  seed: number;
}

export interface TurnDetail {
  turn_index: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  latency_ms: number;
}

export interface ScenarioResult {
  scenario_id: string;
  type: ScenarioType;
  persona_label: string;
  language: Language;
  turns_count: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  total_latency_ms: number;
  turn_details: TurnDetail[];
  error?: string;
}

export interface RunSummary {
  total_sessions: number;
  total_turns: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
  avg_tokens_per_session: number;
  median_tokens_per_session: number;
  p90_tokens_per_session: number;
  p95_tokens_per_session: number;
  avg_cost_per_session: number;
  median_cost_per_session: number;
  p90_cost_per_session: number;
  p95_cost_per_session: number;
  avg_latency_ms: number;
}

export interface SimRunState {
  status: SimStatus;
  config: RunConfig | null;
  results: ScenarioResult[];
  summary: RunSummary | null;
  progress: number;
  total: number;
  elapsed_ms: number;
  error?: string;
}

export interface ModelPricing {
  label: string;
  provider: string;
  input_per_1m: number;
  output_per_1m: number;
}
