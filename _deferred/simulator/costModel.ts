import type { ModelPricing } from './types';

export const PRICING: Record<string, ModelPricing> = {
  'gpt-4o-mini': {
    label: 'GPT-4o Mini',
    provider: 'OpenAI',
    input_per_1m: 0.15,
    output_per_1m: 0.60,
  },
  'gpt-4o': {
    label: 'GPT-4o',
    provider: 'OpenAI',
    input_per_1m: 2.50,
    output_per_1m: 10.00,
  },
  'gpt-4-turbo': {
    label: 'GPT-4 Turbo',
    provider: 'OpenAI',
    input_per_1m: 10.00,
    output_per_1m: 30.00,
  },
  'gpt-3.5-turbo': {
    label: 'GPT-3.5 Turbo',
    provider: 'OpenAI',
    input_per_1m: 0.50,
    output_per_1m: 1.50,
  },
  'claude-3-5-sonnet': {
    label: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    input_per_1m: 3.00,
    output_per_1m: 15.00,
  },
  'claude-3-haiku': {
    label: 'Claude 3 Haiku',
    provider: 'Anthropic',
    input_per_1m: 0.25,
    output_per_1m: 1.25,
  },
  'gemini-1.5-flash': {
    label: 'Gemini 1.5 Flash',
    provider: 'Google',
    input_per_1m: 0.075,
    output_per_1m: 0.30,
  },
  'gemini-1.5-pro': {
    label: 'Gemini 1.5 Pro',
    provider: 'Google',
    input_per_1m: 3.50,
    output_per_1m: 10.50,
  },
};

export const COMPLETION_TOKEN_RANGES: Record<string, { min: number; max: number }> = {
  'gpt-4o-mini':       { min: 140, max: 320 },
  'gpt-4o':            { min: 180, max: 420 },
  'gpt-4-turbo':       { min: 200, max: 480 },
  'gpt-3.5-turbo':     { min: 110, max: 280 },
  'claude-3-5-sonnet': { min: 180, max: 460 },
  'claude-3-haiku':    { min: 90,  max: 240 },
  'gemini-1.5-flash':  { min: 130, max: 300 },
  'gemini-1.5-pro':    { min: 200, max: 460 },
};

export const ESTIMATED_LATENCY_MS: Record<string, { base: number; per_output_token: number }> = {
  'gpt-4o-mini':       { base: 600,  per_output_token: 3.5 },
  'gpt-4o':            { base: 800,  per_output_token: 5.0 },
  'gpt-4-turbo':       { base: 1200, per_output_token: 7.0 },
  'gpt-3.5-turbo':     { base: 400,  per_output_token: 2.5 },
  'claude-3-5-sonnet': { base: 900,  per_output_token: 5.5 },
  'claude-3-haiku':    { base: 350,  per_output_token: 2.0 },
  'gemini-1.5-flash':  { base: 500,  per_output_token: 3.0 },
  'gemini-1.5-pro':    { base: 950,  per_output_token: 6.0 },
};

export const SYSTEM_PROMPT_TOKENS = 350;

/**
 * Compute cost for a single API call in USD.
 */
export function computeTurnCost(
  promptTokens: number,
  completionTokens: number,
  model: string
): number {
  const pricing = PRICING[model] ?? PRICING['gpt-4o-mini'];
  return (
    (promptTokens / 1_000_000) * pricing.input_per_1m +
    (completionTokens / 1_000_000) * pricing.output_per_1m
  );
}

/**
 * Estimate latency for a single API call in milliseconds.
 */
export function estimateLatencyMs(completionTokens: number, model: string): number {
  const lat = ESTIMATED_LATENCY_MS[model] ?? ESTIMATED_LATENCY_MS['gpt-4o-mini'];
  return Math.round(lat.base + completionTokens * lat.per_output_token);
}

/**
 * Rough tokens estimate from raw text (chars / 4 + small overhead).
 */
export function estimateTextTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export interface MonthlyCostInput {
  users: number;
  chats_per_month: number;
  inputs_per_chat: number;
  avg_tokens_per_turn: number;
  journal_entries_per_month: number;
  sparkle_click_rate: number;
  tokens_per_sparkle_call: number;
  model: string;
  pricing_mode: 'split' | 'blended';
  blended_rate: number;
}

export interface MonthlyCostResult {
  chat_turns_month: number;
  chat_tokens_month: number;
  sparkle_calls_month: number;
  sparkle_tokens_month: number;
  total_tokens_month: number;
  total_cost_usd: number;
}

const INPUT_SPLIT = 0.4;

export function computeMonthlyCost(input: MonthlyCostInput): MonthlyCostResult {
  const chat_turns_month = input.users * input.chats_per_month * input.inputs_per_chat;
  const chat_tokens_month = chat_turns_month * input.avg_tokens_per_turn;
  const sparkle_calls_month = input.users * input.journal_entries_per_month * (input.sparkle_click_rate / 100);
  const sparkle_tokens_month = sparkle_calls_month * input.tokens_per_sparkle_call;
  const total_tokens_month = chat_tokens_month + sparkle_tokens_month;

  let total_cost_usd: number;
  if (input.pricing_mode === 'blended') {
    total_cost_usd = (total_tokens_month / 1_000_000) * input.blended_rate;
  } else {
    const pricing = PRICING[input.model] ?? PRICING['gpt-4o-mini'];
    total_cost_usd =
      (total_tokens_month * INPUT_SPLIT / 1_000_000) * pricing.input_per_1m +
      (total_tokens_month * (1 - INPUT_SPLIT) / 1_000_000) * pricing.output_per_1m;
  }

  return {
    chat_turns_month: Math.round(chat_turns_month),
    chat_tokens_month: Math.round(chat_tokens_month),
    sparkle_calls_month: Math.round(sparkle_calls_month),
    sparkle_tokens_month: Math.round(sparkle_tokens_month),
    total_tokens_month: Math.round(total_tokens_month),
    total_cost_usd,
  };
}

export function computeMonthlyProjection(
  dau: number,
  sessionsPerUserPerWeek: number,
  avgTurnsPerSession: number,
  avgTokensPerTurn: number,
  model: string
): { monthly_sessions: number; monthly_tokens: number; monthly_cost_usd: number } {
  const monthly_sessions = dau * sessionsPerUserPerWeek * 4.33;
  const monthly_tokens = monthly_sessions * avgTurnsPerSession * avgTokensPerTurn;
  const pricing = PRICING[model] ?? PRICING['gpt-4o-mini'];
  const split = 0.4;
  const monthly_cost_usd =
    (monthly_tokens * split / 1_000_000) * pricing.input_per_1m +
    (monthly_tokens * (1 - split) / 1_000_000) * pricing.output_per_1m;
  return { monthly_sessions: Math.round(monthly_sessions), monthly_tokens: Math.round(monthly_tokens), monthly_cost_usd };
}
