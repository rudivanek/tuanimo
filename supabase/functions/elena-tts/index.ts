// DEPLOY REQUIREMENT: verify_jwt MUST be false
// This function performs its own auth via auth.getUser().
//
// elena-tts — Elena's spoken replies (voice beta), via ElevenLabs Text to Speech.
//
// Actions (POST JSON):
//   { action: "speak", text }                       → audio/mpeg. Caller must have
//        profiles.voice_enabled = true, and ai_settings.tts_voice_id must be set.
//   { action: "voices" }                             → admin only. Voices in the account.
//   { action: "preview", text, voice_id, model }     → admin only. audio/mpeg, any voice.
//
// Voice and model come from ai_settings (tts_voice_id, tts_model), chosen by an admin.
// Needs the secret ELEVENLABS_API_KEY (Text to Speech + Voices read).
// Never blocks chat: the client shows the text first and treats any error here as "no audio".
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const API = "https://api.elevenlabs.io/v1";
const MAX_CHARS = 1200; // Elena's hard cap is 800; leave room, refuse anything larger
const MODEL_RE = /^[a-z0-9_]{3,64}$/;
const VOICE_RE = /^[A-Za-z0-9]{10,40}$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function tts(key: string, voiceId: string, model: string, text: string): Promise<Response> {
  const r = await fetch(
    `${API}/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: model, language_code: "es" }),
    },
  );
  if (!r.ok || !r.body) {
    const detail = await r.text().catch(() => "");
    console.error(`elena-tts: ElevenLabs ${r.status} ${detail.slice(0, 500)}`);
    return json({ error: "tts_failed", status: r.status }, 502);
  }
  return new Response(r.body, {
    headers: { ...corsHeaders, "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const key = (Deno.env.get("ELEVENLABS_API_KEY") ?? "").trim();
    if (!key) return json({ error: "voice_not_configured" }, 503);

    const svc = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action ?? "");

    // ── Admin actions ─────────────────────────────────────────────────────
    if (action === "voices" || action === "preview") {
      const { data: isAdmin } = await svc.rpc("is_admin", { p_uid: user.id, p_email: user.email ?? "" });
      if (!isAdmin) return json({ error: "forbidden" }, 403);

      if (action === "voices") {
        const r = await fetch(`${API}/voices`, { headers: { "xi-api-key": key } });
        if (!r.ok) {
          const detail = await r.text().catch(() => "");
          console.error(`elena-tts: voices ${r.status} ${detail.slice(0, 500)}`);
          return json({ error: "voices_failed", status: r.status, detail: detail.slice(0, 300) }, 502);
        }
        const data = await r.json() as { voices?: Array<Record<string, unknown>> };
        const voices = (data.voices ?? []).map(v => ({
          voice_id: v.voice_id,
          name: v.name,
          category: v.category,
          labels: v.labels ?? {},
        }));
        return json({ voices });
      }

      const text = String(body.text ?? "").trim();
      const voiceId = String(body.voice_id ?? "");
      const model = String(body.model ?? "");
      if (!text || text.length > MAX_CHARS) return json({ error: "bad_text" }, 400);
      if (!VOICE_RE.test(voiceId) || !MODEL_RE.test(model)) return json({ error: "bad_voice_or_model" }, 400);
      return await tts(key, voiceId, model, text);
    }

    // ── Chat: speak Elena's reply ─────────────────────────────────────────
    if (action === "speak") {
      const text = String(body.text ?? "").trim();
      if (!text || text.length > MAX_CHARS) return json({ error: "bad_text" }, 400);

      const [{ data: profile }, { data: settings }] = await Promise.all([
        svc.from("profiles").select("voice_enabled").eq("id", user.id).maybeSingle(),
        svc.from("ai_settings").select("key, value").in("key", ["tts_voice_id", "tts_model"]),
      ]);
      if (!profile?.voice_enabled) return json({ error: "voice_not_enabled" }, 403);

      const map: Record<string, string> = {};
      (settings ?? []).forEach((r: { key: string; value: string }) => { map[r.key] = r.value; });
      const voiceId = (map.tts_voice_id ?? "").trim();
      const model = (map.tts_model ?? "eleven_multilingual_v2").trim();
      if (!VOICE_RE.test(voiceId) || !MODEL_RE.test(model)) return json({ error: "voice_not_configured" }, 503);

      return await tts(key, voiceId, model, text);
    }

    return json({ error: "unknown_action" }, 400);
  } catch (err) {
    console.error("elena-tts error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});

