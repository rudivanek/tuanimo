import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT_TOKENS = 350;

const COMPLETION_RANGES: Record<string, { min: number; max: number }> = {
  "gpt-4o-mini":       { min: 140, max: 320 },
  "gpt-4o":            { min: 180, max: 420 },
  "gpt-4-turbo":       { min: 200, max: 480 },
  "gpt-3.5-turbo":     { min: 110, max: 280 },
  "claude-3-5-sonnet": { min: 180, max: 460 },
  "claude-3-haiku":    { min: 90,  max: 240 },
  "gemini-1.5-flash":  { min: 130, max: 300 },
  "gemini-1.5-pro":    { min: 200, max: 460 },
};

const LATENCY: Record<string, { base: number; per_token: number }> = {
  "gpt-4o-mini":       { base: 600,  per_token: 3.5 },
  "gpt-4o":            { base: 800,  per_token: 5.0 },
  "gpt-4-turbo":       { base: 1200, per_token: 7.0 },
  "gpt-3.5-turbo":     { base: 400,  per_token: 2.5 },
  "claude-3-5-sonnet": { base: 900,  per_token: 5.5 },
  "claude-3-haiku":    { base: 350,  per_token: 2.0 },
  "gemini-1.5-flash":  { base: 500,  per_token: 3.0 },
  "gemini-1.5-pro":    { base: 950,  per_token: 6.0 },
};

const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini":       { input: 0.15,   output: 0.60  },
  "gpt-4o":            { input: 2.50,   output: 10.00 },
  "gpt-4-turbo":       { input: 10.00,  output: 30.00 },
  "gpt-3.5-turbo":     { input: 0.50,   output: 1.50  },
  "claude-3-5-sonnet": { input: 3.00,   output: 15.00 },
  "claude-3-haiku":    { input: 0.25,   output: 1.25  },
  "gemini-1.5-flash":  { input: 0.075,  output: 0.30  },
  "gemini-1.5-pro":    { input: 3.50,   output: 10.50 },
};

function lcgRand(seed: number, idx: number): number {
  const a = 1664525;
  const c = 1013904223;
  const m = 2 ** 32;
  let s = ((seed + idx * 2654435761) >>> 0);
  s = ((a * s + c) >>> 0);
  s = ((a * s + c) >>> 0);
  return (s >>> 0) / m;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function sampleCompletionTokens(model: string, seed: number, globalIdx: number): number {
  const range = COMPLETION_RANGES[model] ?? COMPLETION_RANGES["gpt-4o-mini"];
  const r = lcgRand(seed, globalIdx);
  return Math.round(range.min + r * (range.max - range.min));
}

function computeCost(promptTokens: number, completionTokens: number, model: string): number {
  const p = PRICING[model] ?? PRICING["gpt-4o-mini"];
  return (promptTokens / 1_000_000) * p.input + (completionTokens / 1_000_000) * p.output;
}

function estimateLatency(completionTokens: number, model: string): number {
  const lat = LATENCY[model] ?? LATENCY["gpt-4o-mini"];
  return Math.round(lat.base + completionTokens * lat.per_token);
}

interface JournalTurn { prompt: string; user_entry: string; }
interface ScenarioPayload {
  scenario_id: string;
  type: "chat" | "journal";
  persona_label: string;
  language: string;
  turns: Array<string | JournalTurn>;
}
interface BatchRequest {
  model: string;
  seed: number;
  scenarios: ScenarioPayload[];
}

function simulateScenario(
  scenario: ScenarioPayload,
  model: string,
  seed: number,
  scenarioGlobalIdx: number
) {
  let contextTokens = 0;
  let totalPrompt = 0;
  let totalCompletion = 0;
  let totalLatency = 0;
  const turnDetails: object[] = [];

  const turnTexts: string[] = scenario.turns.map((t) =>
    typeof t === "string" ? t : t.user_entry
  );

  for (let i = 0; i < turnTexts.length; i++) {
    const userTokens = estimateTokens(turnTexts[i]);
    const promptTokens = SYSTEM_PROMPT_TOKENS + contextTokens + userTokens;
    const completionTokens = sampleCompletionTokens(model, seed, scenarioGlobalIdx * 100 + i);
    const latency = estimateLatency(completionTokens, model);

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

  const totalTokens = totalPrompt + totalCompletion;
  const costUsd = computeCost(totalPrompt, totalCompletion, model);

  return {
    scenario_id: scenario.scenario_id,
    type: scenario.type,
    persona_label: scenario.persona_label,
    language: scenario.language,
    turns_count: turnTexts.length,
    prompt_tokens: totalPrompt,
    completion_tokens: totalCompletion,
    total_tokens: totalTokens,
    cost_usd: costUsd,
    total_latency_ms: totalLatency,
    turn_details: turnDetails,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin", {
      p_uid: user.id,
      p_email: user.email ?? "",
    });
    if (adminError || !isAdmin) throw new Error("Forbidden");

    const body: BatchRequest = await req.json();
    const { model = "gpt-4o-mini", seed = 42, scenarios = [] } = body;

    if (!Array.isArray(scenarios) || scenarios.length === 0) {
      throw new Error("No scenarios provided");
    }

    if (scenarios.length > 500) {
      throw new Error("Batch size exceeds maximum of 500 sessions");
    }

    const results = scenarios.map((scenario, idx) =>
      simulateScenario(scenario, model, seed, idx)
    );

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const status =
      err.message === "Unauthorized" ? 401 :
      err.message === "Forbidden"    ? 403 : 500;

    return new Response(
      JSON.stringify({ error: err.message ?? "Internal server error" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
