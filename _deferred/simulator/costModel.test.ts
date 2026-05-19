/**
 * Unit tests for the cost model module.
 *
 * Test checklist:
 * - computeTurnCost returns correct USD amount for known inputs
 * - computeTurnCost uses fallback pricing for unknown model
 * - estimateTextTokens returns non-zero for any input
 * - computeMonthlyProjection produces sensible output for typical DAU
 * - PRICING table contains all expected models
 *
 * Run with: npx vitest src/lib/simulator/costModel.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  computeTurnCost,
  estimateTextTokens,
  computeMonthlyProjection,
  computeMonthlyCost,
  PRICING,
} from './costModel';
import type { MonthlyCostInput } from './costModel';

describe('computeTurnCost', () => {
  it('calculates correct USD cost for gpt-4o-mini', () => {
    const cost = computeTurnCost(1000, 500, 'gpt-4o-mini');
    const expected = (1000 / 1_000_000) * 0.15 + (500 / 1_000_000) * 0.60;
    expect(cost).toBeCloseTo(expected, 10);
  });

  it('calculates correct USD cost for gpt-4o', () => {
    const cost = computeTurnCost(2000, 800, 'gpt-4o');
    const expected = (2000 / 1_000_000) * 2.50 + (800 / 1_000_000) * 10.00;
    expect(cost).toBeCloseTo(expected, 10);
  });

  it('calculates correct USD cost for claude-3-5-sonnet', () => {
    const cost = computeTurnCost(1500, 600, 'claude-3-5-sonnet');
    const expected = (1500 / 1_000_000) * 3.00 + (600 / 1_000_000) * 15.00;
    expect(cost).toBeCloseTo(expected, 10);
  });

  it('falls back to gpt-4o-mini pricing for unknown model', () => {
    const cost = computeTurnCost(1000, 500, 'unknown-model-xyz');
    const fallback = computeTurnCost(1000, 500, 'gpt-4o-mini');
    expect(cost).toBeCloseTo(fallback, 10);
  });

  it('returns zero cost when tokens are zero', () => {
    expect(computeTurnCost(0, 0, 'gpt-4o-mini')).toBe(0);
  });

  it('is more expensive for gpt-4o than gpt-4o-mini at same token counts', () => {
    const mini = computeTurnCost(1000, 500, 'gpt-4o-mini');
    const full = computeTurnCost(1000, 500, 'gpt-4o');
    expect(full).toBeGreaterThan(mini);
  });
});

describe('estimateTextTokens', () => {
  it('returns a positive integer for non-empty text', () => {
    const t = estimateTextTokens('Hello, world!');
    expect(t).toBeGreaterThan(0);
    expect(Number.isInteger(t)).toBe(true);
  });

  it('returns 1 for empty string', () => {
    expect(estimateTextTokens('')).toBe(1);
  });

  it('scales with text length', () => {
    const short = estimateTextTokens('Hi');
    const long = estimateTextTokens('a'.repeat(400));
    expect(long).toBeGreaterThan(short);
  });
});

describe('computeMonthlyProjection', () => {
  it('returns expected monthly sessions for 1000 DAU, 1 session/week', () => {
    const { monthly_sessions } = computeMonthlyProjection(1000, 1, 5, 250, 'gpt-4o-mini');
    expect(monthly_sessions).toBeGreaterThan(4000);
    expect(monthly_sessions).toBeLessThan(5000);
  });

  it('monthly cost scales with DAU', () => {
    const low = computeMonthlyProjection(100, 1, 5, 250, 'gpt-4o-mini');
    const high = computeMonthlyProjection(1000, 1, 5, 250, 'gpt-4o-mini');
    expect(high.monthly_cost_usd).toBeCloseTo(low.monthly_cost_usd * 10, 1);
  });

  it('gpt-4o costs more than gpt-4o-mini for same usage', () => {
    const mini = computeMonthlyProjection(500, 2, 6, 300, 'gpt-4o-mini');
    const full = computeMonthlyProjection(500, 2, 6, 300, 'gpt-4o');
    expect(full.monthly_cost_usd).toBeGreaterThan(mini.monthly_cost_usd);
  });
});

describe('computeMonthlyCost', () => {
  const base: MonthlyCostInput = {
    users: 1,
    chats_per_month: 8,
    inputs_per_chat: 5,
    avg_tokens_per_turn: 600,
    journal_entries_per_month: 12,
    sparkle_click_rate: 30,
    tokens_per_sparkle_call: 300,
    model: 'gpt-4o-mini',
    pricing_mode: 'split',
    blended_rate: 0.40,
  };

  it('computes correct chat turns per month', () => {
    const result = computeMonthlyCost(base);
    expect(result.chat_turns_month).toBe(1 * 8 * 5);
  });

  it('computes correct chat tokens per month', () => {
    const result = computeMonthlyCost(base);
    expect(result.chat_tokens_month).toBe(1 * 8 * 5 * 600);
  });

  it('computes correct sparkle calls per month', () => {
    const result = computeMonthlyCost(base);
    expect(result.sparkle_calls_month).toBe(Math.round(1 * 12 * 0.30));
  });

  it('computes correct sparkle tokens per month', () => {
    const result = computeMonthlyCost(base);
    expect(result.sparkle_tokens_month).toBe(Math.round(1 * 12 * 0.30 * 300));
  });

  it('total tokens is sum of chat and sparkle tokens', () => {
    const result = computeMonthlyCost(base);
    expect(result.total_tokens_month).toBe(result.chat_tokens_month + result.sparkle_tokens_month);
  });

  it('journal writing itself contributes 0 tokens when sparkle_click_rate is 0', () => {
    const result = computeMonthlyCost({ ...base, sparkle_click_rate: 0 });
    expect(result.sparkle_calls_month).toBe(0);
    expect(result.sparkle_tokens_month).toBe(0);
    expect(result.total_tokens_month).toBe(result.chat_tokens_month);
  });

  it('scales linearly with user count', () => {
    const one = computeMonthlyCost({ ...base, users: 1 });
    const ten = computeMonthlyCost({ ...base, users: 10 });
    expect(ten.total_tokens_month).toBe(one.total_tokens_month * 10);
  });

  it('blended pricing mode produces correct cost', () => {
    const result = computeMonthlyCost({ ...base, pricing_mode: 'blended', blended_rate: 1.00 });
    const expected = (result.total_tokens_month / 1_000_000) * 1.00;
    expect(result.total_cost_usd).toBeCloseTo(expected, 8);
  });

  it('split pricing produces non-zero cost for non-zero tokens', () => {
    const result = computeMonthlyCost(base);
    expect(result.total_cost_usd).toBeGreaterThan(0);
  });

  it('split pricing is more expensive for gpt-4o than gpt-4o-mini at same usage', () => {
    const mini = computeMonthlyCost({ ...base, model: 'gpt-4o-mini' });
    const full = computeMonthlyCost({ ...base, model: 'gpt-4o' });
    expect(full.total_cost_usd).toBeGreaterThan(mini.total_cost_usd);
  });
});

describe('PRICING table', () => {
  const expectedModels = [
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
    'claude-3-5-sonnet',
    'claude-3-haiku',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
  ];

  for (const model of expectedModels) {
    it(`has pricing entry for ${model}`, () => {
      expect(PRICING[model]).toBeDefined();
      expect(PRICING[model].input_per_1m).toBeGreaterThan(0);
      expect(PRICING[model].output_per_1m).toBeGreaterThan(0);
      expect(PRICING[model].label).toBeTruthy();
      expect(PRICING[model].provider).toBeTruthy();
    });
  }
});
