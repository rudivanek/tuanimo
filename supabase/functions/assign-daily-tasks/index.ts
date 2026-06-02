// DEPLOY REQUIREMENT: verify_jwt MUST be false
// This function performs its own auth via auth.getUser().
// Deploying with verify_jwt:true causes a 401 at the Supabase gateway
// before the function even runs. Always deploy with verify_jwt: false.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Maps existing chat signal types → task themes
// A user strong in "anxiety" gets anxiety + avoidance tasks.
// "stress" maps to avoidance + meaning. "positive" gets meaning + relationships.
// "gratitude" gets relationships + meaning.
// Falls back to a balanced mix when no strong signal exists.
const SIGNAL_TO_THEMES: Record<string, string[]> = {
  anxiety:   ["anxiety", "avoidance"],
  stress:    ["avoidance", "meaning"],
  positive:  ["meaning", "relationships"],
  gratitude: ["relationships", "meaning"],
};

const ALL_THEMES = ["meaning", "avoidance", "grief", "identity", "relationships", "anxiety"];

// Returns up to 3 theme names weighted by the user's recent signals.
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

  // Fill remaining slots with themes not yet selected, in a fixed order
  // that ensures variety: grief and identity get surfaced over time.
  const fallback = ALL_THEMES.filter(t => !ranked.includes(t));
  return [...ranked, ...fallback].slice(0, 3);
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const userId = user.id;

    // ── GET: return today's tasks (assign if not yet assigned) ──────────────
    if (req.method === "GET") {
      const url = new URL(req.url);
      const force = url.searchParams.get("force") === "true";
      const todayDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

      // If force=true, delete today's existing assignments so we reassign fresh
      if (force) {
        await supabase
          .from("user_daily_tasks")
          .delete()
          .eq("user_id", userId)
          .eq("assigned_date", todayDate);
      }

      // Check if tasks already assigned today (skip if force-deleted above)
      if (!force) {
        const { data: existing, error: existingError } = await supabase
          .from("user_daily_tasks")
          .select(`
            id,
            task_id,
            assigned_date,
            completed,
            completed_at,
            tasks (
              id,
              theme,
              action_text,
              reflection_prompt,
              duration_minutes
            )
          `)
          .eq("user_id", userId)
          .eq("assigned_date", todayDate);

        if (existingError) throw existingError;

        if (existing && existing.length > 0) {
          return new Response(JSON.stringify({ tasks: existing }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // ── No tasks assigned yet today — select and assign ─────────────────

      // 1. Read recent signals (last 14 days) to find dominant themes
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const { data: signalRows } = await supabase
        .from("chat_signal_daily_agg")
        .select("signal_type, score")
        .eq("user_id", userId)
        .gte("signal_date", fourteenDaysAgo.toISOString().split("T")[0]);

      // Aggregate signal scores
      const signalTotals: Record<string, number> = {};
      for (const row of signalRows ?? []) {
        signalTotals[row.signal_type] = (signalTotals[row.signal_type] ?? 0) + (Number(row.score) || 0);
      }

      // 2. Select 3 themes based on signals
      const selectedThemes = selectThemes(signalTotals);

      // 3. Find tasks assigned in the last 14 days (avoid repeats)
      const { data: recentAssignments } = await supabase
        .from("user_daily_tasks")
        .select("task_id")
        .eq("user_id", userId)
        .gte("assigned_date", fourteenDaysAgo.toISOString().split("T")[0]);

      const recentTaskIds = new Set((recentAssignments ?? []).map((r: { task_id: string }) => r.task_id));

      // 4. Fetch candidate tasks for selected themes, excluding recent ones
      const { data: candidates, error: candidatesError } = await supabase
        .from("tasks")
        .select("id, theme, action_text, reflection_prompt, duration_minutes")
        .in("theme", selectedThemes)
        .eq("active", true);

      if (candidatesError) throw candidatesError;

      // Filter out recently assigned tasks
      const fresh = (candidates ?? []).filter((t: { id: string }) => !recentTaskIds.has(t.id));

      // 5. Pick one task per theme (prioritise variety across themes)
      const picked: typeof fresh = [];
      for (const theme of selectedThemes) {
        const pool = fresh.filter((t: { theme: string }) => t.theme === theme);
        if (pool.length === 0) continue;
        // Pick randomly within the theme pool
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        picked.push(chosen);
        if (picked.length === 3) break;
      }

      // If we still need more (edge case: all themes exhausted), fill from any fresh task
      if (picked.length < 3) {
        const pickedIds = new Set(picked.map((t: { id: string }) => t.id));
        const remaining = fresh.filter((t: { id: string }) => !pickedIds.has(t.id));
        while (picked.length < 3 && remaining.length > 0) {
          const idx = Math.floor(Math.random() * remaining.length);
          picked.push(remaining.splice(idx, 1)[0]);
        }
      }

      if (picked.length === 0) {
        // Absolute fallback: no fresh tasks available — reset and pick any
        const { data: anyTasks } = await supabase
          .from("tasks")
          .select("id, theme, action_text, reflection_prompt, duration_minutes")
          .eq("active", true)
          .limit(3);
        picked.push(...(anyTasks ?? []));
      }

      // 6. Insert assignments into user_daily_tasks
      const inserts = picked.map((t: { id: string }) => ({
        user_id: userId,
        task_id: t.id,
        assigned_date: todayDate,
        completed: false,
      }));

      const { data: inserted, error: insertError } = await supabase
        .from("user_daily_tasks")
        .insert(inserts)
        .select(`
          id,
          task_id,
          assigned_date,
          completed,
          completed_at,
          tasks (
            id,
            theme,
            action_text,
            reflection_prompt,
            duration_minutes
          )
        `);

      if (insertError) throw insertError;

      return new Response(JSON.stringify({ tasks: inserted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── POST: mark a task complete / incomplete ─────────────────────────────
    if (req.method === "POST") {
      const body = await req.json();
      const { userDailyTaskId, completed } = body as {
        userDailyTaskId: string;
        completed: boolean;
      };

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

    throw new Error("Method not allowed");

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
