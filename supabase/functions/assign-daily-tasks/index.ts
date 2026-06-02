// DEPLOY REQUIREMENT: verify_jwt MUST be false
// This function performs its own auth via auth.getUser().
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Maps existing chat signal types → task themes
const SIGNAL_TO_THEMES: Record<string, string[]> = {
  anxiety:   ["anxiety", "avoidance"],
  stress:    ["avoidance", "meaning"],
  positive:  ["meaning", "relationships"],
  gratitude: ["relationships", "meaning"],
};

const ALL_THEMES = ["meaning", "avoidance", "grief", "identity", "relationships", "anxiety"];

function selectThemes(signals: Record<string, number>): string[] {
  const scored: Record<string, number> = {};
  for (const [signal, score] of Object.entries(signals)) {
    const themes = SIGNAL_TO_THEMES[signal];
    if (!themes) continue;
    for (const theme of themes) {
      scored[theme] = (scored[theme] ?? 0) + score;
    }
  }
  const ranked = Object.entries(scored)
    .sort((a, b) => b[1] - a[1])
    .map(([theme]) => theme);
  if (ranked.length >= 3) return ranked.slice(0, 3);
  const fallback = ALL_THEMES.filter(t => !ranked.includes(t));
  return [...ranked, ...fallback].slice(0, 3);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const userId = user.id;
    const body = await req.json() as { action: string; force?: boolean; userDailyTaskId?: string; completed?: boolean };
    const { action } = body;

    // ── action: get_tasks — return today's tasks, assign if needed ────────────
    if (action === "get_tasks") {
      const force = body.force === true;
      const todayDate = new Date().toISOString().split("T")[0];

      if (force) {
        await supabase
          .from("user_daily_tasks")
          .delete()
          .eq("user_id", userId)
          .eq("assigned_date", todayDate);
      }

      if (!force) {
        const { data: existing, error: existingError } = await supabase
          .from("user_daily_tasks")
          .select(`id, task_id, assigned_date, completed, completed_at,
            tasks ( id, theme, action_text, reflection_prompt, duration_minutes )`)
          .eq("user_id", userId)
          .eq("assigned_date", todayDate);

        if (existingError) throw existingError;
        if (existing && existing.length > 0) {
          return new Response(JSON.stringify({ tasks: existing }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Select and assign fresh tasks
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const { data: signalRows } = await supabase
        .from("chat_signal_daily_agg")
        .select("signal_type, score")
        .eq("user_id", userId)
        .gte("signal_date", fourteenDaysAgo.toISOString().split("T")[0]);

      const signalTotals: Record<string, number> = {};
      for (const row of signalRows ?? []) {
        signalTotals[row.signal_type] = (signalTotals[row.signal_type] ?? 0) + (Number(row.score) || 0);
      }

      const selectedThemes = selectThemes(signalTotals);

      const { data: recentAssignments } = await supabase
        .from("user_daily_tasks")
        .select("task_id")
        .eq("user_id", userId)
        .gte("assigned_date", fourteenDaysAgo.toISOString().split("T")[0]);

      const recentTaskIds = new Set((recentAssignments ?? []).map((r: { task_id: string }) => r.task_id));

      const { data: candidates, error: candidatesError } = await supabase
        .from("tasks")
        .select("id, theme, action_text, reflection_prompt, duration_minutes")
        .in("theme", selectedThemes)
        .eq("active", true);

      if (candidatesError) throw candidatesError;

      const fresh = (candidates ?? []).filter((t: { id: string }) => !recentTaskIds.has(t.id));

      const picked: typeof fresh = [];
      for (const theme of selectedThemes) {
        const pool = fresh.filter((t: { theme: string }) => t.theme === theme);
        if (pool.length === 0) continue;
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        picked.push(chosen);
        if (picked.length === 3) break;
      }

      if (picked.length < 3) {
        const pickedIds = new Set(picked.map((t: { id: string }) => t.id));
        const remaining = fresh.filter((t: { id: string }) => !pickedIds.has(t.id));
        while (picked.length < 3 && remaining.length > 0) {
          const idx = Math.floor(Math.random() * remaining.length);
          picked.push(remaining.splice(idx, 1)[0]);
        }
      }

      if (picked.length === 0) {
        const { data: anyTasks } = await supabase
          .from("tasks")
          .select("id, theme, action_text, reflection_prompt, duration_minutes")
          .eq("active", true)
          .limit(3);
        picked.push(...(anyTasks ?? []));
      }

      const inserts = picked.map((t: { id: string }) => ({
        user_id: userId,
        task_id: t.id,
        assigned_date: todayDate,
        completed: false,
      }));

      const { data: inserted, error: insertError } = await supabase
        .from("user_daily_tasks")
        .insert(inserts)
        .select(`id, task_id, assigned_date, completed, completed_at,
          tasks ( id, theme, action_text, reflection_prompt, duration_minutes )`);

      if (insertError) throw insertError;

      return new Response(JSON.stringify({ tasks: inserted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── action: complete_task — mark a task complete/incomplete ───────────────
    if (action === "complete_task") {
      const { userDailyTaskId, completed } = body;
      if (!userDailyTaskId || typeof completed !== "boolean") {
        throw new Error("Missing required fields: userDailyTaskId and completed");
      }

      const { data, error } = await supabase
        .from("user_daily_tasks")
        .update({
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", userDailyTaskId)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ task: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Unknown action");

  } catch (error) {
    console.error("assign-daily-tasks error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: error.message === "Unauthorized" ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
