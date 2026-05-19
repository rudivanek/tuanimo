import { useState, useRef, useCallback } from 'react';
import { computeRunSummary } from '../lib/simulator/stats';
import {
  computeTurnCost,
  estimateLatencyMs,
  estimateTextTokens,
  COMPLETION_TOKEN_RANGES,
  SYSTEM_PROMPT_TOKENS,
} from '../lib/simulator/costModel';
import type { RunConfig, ScenarioResult, SimRunState, Scenario, TurnDetail } from '../lib/simulator/types';

const BATCH_SIZE = 50;

function lcgRand(seed: number, idx: number): number {
  const a = 1664525;
  const c = 1013904223;
  let s = ((seed + idx * 2654435761) >>> 0);
  s = (((a * s + c) >>> 0) * a + c) >>> 0;
  return (s >>> 0) / 0xffffffff;
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(lcgRand(seed, i) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function sampleRepeat<T>(pool: T[], count: number, seed: number): T[] {
  if (pool.length === 0 || count === 0) return [];
  let result: T[] = [];
  let pass = 0;
  while (result.length < count) {
    const shuffled = seededShuffle(pool, seed + pass * 997);
    result = result.concat(shuffled);
    pass++;
  }
  return result.slice(0, count);
}

function sampleCompletionTokens(model: string, seed: number, globalIdx: number): number {
  const range = COMPLETION_TOKEN_RANGES[model] ?? COMPLETION_TOKEN_RANGES['gpt-4o-mini'];
  const r = lcgRand(seed, globalIdx);
  return Math.round(range.min + r * (range.max - range.min));
}

function prepareTurns(scenario: Scenario, config: RunConfig, seedOffset: number): string[] {
  const sourceTurns: string[] = (scenario.turns as Array<string | { user_entry: string }>).map((t) =>
    typeof t === 'string' ? t : t.user_entry
  );

  let targetCount: number;
  if (config.turns_mode === 'fixed') {
    targetCount = config.turns_fixed;
  } else {
    const r = lcgRand(config.seed, seedOffset);
    targetCount = Math.round(config.turns_min + r * (config.turns_max - config.turns_min));
  }
  targetCount = Math.max(1, targetCount);

  let turns: string[] = [];
  while (turns.length < targetCount) {
    turns = turns.concat(sourceTurns);
  }
  return turns.slice(0, targetCount);
}

function simulateScenario(
  scenario: Scenario,
  turns: string[],
  model: string,
  seed: number,
  scenarioGlobalIdx: number
): ScenarioResult {
  let contextTokens = 0;
  let totalPrompt = 0;
  let totalCompletion = 0;
  let totalLatency = 0;
  const turnDetails: TurnDetail[] = [];

  for (let i = 0; i < turns.length; i++) {
    const userTokens = estimateTextTokens(turns[i]);
    const promptTokens = SYSTEM_PROMPT_TOKENS + contextTokens + userTokens;
    const completionTokens = sampleCompletionTokens(model, seed, scenarioGlobalIdx * 100 + i);
    const latency = estimateLatencyMs(completionTokens, model);

    totalPrompt += promptTokens;
    totalCompletion += completionTokens;
    totalLatency += latency;
    contextTokens += userTokens + completionTokens;

    turnDetails.push({
      turn_index: i,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
      latency_ms: latency,
    });
  }

  return {
    scenario_id: scenario.scenario_id,
    type: scenario.type,
    persona_label: scenario.persona_label,
    language: scenario.language,
    turns_count: turns.length,
    prompt_tokens: totalPrompt,
    completion_tokens: totalCompletion,
    total_tokens: totalPrompt + totalCompletion,
    cost_usd: computeTurnCost(totalPrompt, totalCompletion, model),
    total_latency_ms: totalLatency,
    turn_details: turnDetails,
  };
}

export function sampleScenarios(allScenarios: Scenario[], config: RunConfig): Scenario[] {
  const filtered = allScenarios.filter((s) => {
    if (!config.include_edge_cases && s.tags.includes('edge_case')) return false;
    if (!config.include_crisis_signals && s.tags.includes('crisis_signal')) return false;
    return true;
  });

  const chatEn = filtered.filter((s) => s.type === 'chat' && s.language === 'en');
  const chatEs = filtered.filter((s) => s.type === 'chat' && s.language === 'es');
  const journalEn = filtered.filter((s) => s.type === 'journal' && s.language === 'en');
  const journalEs = filtered.filter((s) => s.type === 'journal' && s.language === 'es');

  const N = Math.min(Math.max(1, config.number_of_sessions), 500);
  const nChat = Math.round(N * (config.chat_pct / 100));
  const nJournal = N - nChat;
  const nChatEn = Math.round(nChat * (config.lang_en_pct / 100));
  const nChatEs = nChat - nChatEn;
  const nJournalEn = Math.round(nJournal * (config.lang_en_pct / 100));
  const nJournalEs = nJournal - nJournalEn;

  const sampled: Scenario[] = [
    ...sampleRepeat(chatEn, nChatEn, config.seed + 1),
    ...sampleRepeat(chatEs, nChatEs, config.seed + 2),
    ...sampleRepeat(journalEn, nJournalEn, config.seed + 3),
    ...sampleRepeat(journalEs, nJournalEs, config.seed + 4),
  ];

  return seededShuffle(sampled, config.seed + 5);
}

const DEFAULT_STATE: SimRunState = {
  status: 'idle',
  config: null,
  results: [],
  summary: null,
  progress: 0,
  total: 0,
  elapsed_ms: 0,
};

export function useSimulator() {
  const [state, setState] = useState<SimRunState>(DEFAULT_STATE);
  const cancelRef = useRef(false);
  const startTimeRef = useRef<number>(0);

  const runSimulation = useCallback(async (config: RunConfig, allScenarios: Scenario[]) => {
    try {
      cancelRef.current = false;
      startTimeRef.current = Date.now();

      const sampled = sampleScenarios(allScenarios, config);
      const total = sampled.length;

      if (total === 0) {
        setState({
          status: 'error',
          config,
          results: [],
          summary: computeRunSummary([]),
          progress: 0,
          total: 0,
          elapsed_ms: 0,
          error: 'No hay escenarios disponibles. Activa los casos extremos o ajusta el mix.',
        });
        return;
      }

      setState({
        status: 'running',
        config,
        results: [],
        summary: null,
        progress: 0,
        total,
        elapsed_ms: 0,
      });

      await new Promise<void>((r) => setTimeout(r, 0));

      const allResults: ScenarioResult[] = [];

      for (let i = 0; i < sampled.length; i += BATCH_SIZE) {
        if (cancelRef.current) break;

        const batch = sampled.slice(i, i + BATCH_SIZE);

        for (let j = 0; j < batch.length; j++) {
          const globalIdx = i + j;
          const turns = prepareTurns(batch[j], config, globalIdx);
          allResults.push(simulateScenario(batch[j], turns, config.model, config.seed, globalIdx));
        }

        const snap = [...allResults];
        setState({
          status: 'running',
          config,
          results: snap,
          summary: computeRunSummary(snap),
          progress: snap.length,
          total,
          elapsed_ms: Date.now() - startTimeRef.current,
        });

        await new Promise<void>((r) => setTimeout(r, 0));
      }

      const finalResults = [...allResults];
      setState({
        status: cancelRef.current ? 'cancelled' : 'completed',
        config,
        results: finalResults,
        summary: computeRunSummary(finalResults),
        progress: finalResults.length,
        total,
        elapsed_ms: Date.now() - startTimeRef.current,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error inesperado en la simulación';
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: message,
        elapsed_ms: Date.now() - startTimeRef.current,
      }));
    }
  }, []);

  const cancel = useCallback(() => {
    cancelRef.current = true;
    setState((prev) => ({
      ...prev,
      status: 'cancelled',
      elapsed_ms: Date.now() - startTimeRef.current,
    }));
  }, []);

  const reset = useCallback(() => {
    cancelRef.current = false;
    setState(DEFAULT_STATE);
  }, []);

  return { state, runSimulation, cancel, reset };
}
