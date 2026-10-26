// DEPLOY REQUIREMENT: verify_jwt MUST be false
// This function performs its own auth via auth.getUser().
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Token budget (same contract as chat-ai enforceBudget). Fails open on RPC error.
async function enforceBudget(userId: string): Promise<Response | null> {
  const svc = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  const { data, error } = await svc.rpc("check_token_budget", { p_user_id: userId });
  if (error) {
    console.error("enforceBudget: check_token_budget failed", JSON.stringify(error));
    return null;
  }
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || result.allowed) return null;
  const isDailyLimit = result.reason === "DAILY_LIMIT_REACHED";
  const message = isDailyLimit
    ? `Has alcanzado tu límite diario de ${result.daily_limit.toLocaleString()} tokens. Se restablece a medianoche (hora del centro de México).`
    : `Has alcanzado tu límite mensual de ${result.monthly_limit.toLocaleString()} tokens. Se restablece al iniciar tu siguiente ciclo mensual.`;
  return new Response(
    JSON.stringify({ error: result.reason, message, daily_used: result.daily_used, daily_limit: result.daily_limit, monthly_used: result.monthly_used, monthly_limit: result.monthly_limit }),
    { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const budgetResponse = await enforceBudget(user.id);
    if (budgetResponse) return budgetResponse;

    // Read multipart form data (audio blob + optional context)
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    const context = formData.get("context") as string | null; // 'journal' | 'chat'

    if (!audioFile) {
      return new Response(JSON.stringify({ error: "No audio file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "OpenAI key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Forward to Whisper
    const whisperForm = new FormData();
    whisperForm.append("file", audioFile, "audio.webm");
    whisperForm.append("model", "whisper-1");
    whisperForm.append("language", "es");
    // Optional prompt to nudge Whisper toward natural Spanish
    whisperForm.append("prompt", "Esta es una nota personal o mensaje de voz en español.");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openaiKey}` },
      body: whisperForm,
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      console.error("Whisper error:", errText);
      return new Response(JSON.stringify({ error: "Transcription failed", detail: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    
    const whisperData = await whisperRes.json();
    const transcript = whisperData.text?.trim() ?? "";

    return new Response(
      JSON.stringify({ transcript, context: context ?? "chat" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("transcribe-audio error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
