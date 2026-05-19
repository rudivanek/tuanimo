import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ClassifyRequest {
  message: string;
  context?: string[];
}

type MoodKey =
  | "joy" | "calm" | "sadness" | "anxiety" | "anger"
  | "stress" | "loneliness" | "overwhelm" | "uncertainty" | "neutral";

interface MoodResponse {
  mood: MoodKey;
  valence: number;
  arousal: number;
  confidence: number;
  reasons: string[];
}

const FALLBACK: MoodResponse = {
  mood: "neutral", valence: 0, arousal: 0.5, confidence: 0.3, reasons: [],
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function validateMoodResponse(data: unknown): MoodResponse {
  if (!data || typeof data !== "object") return FALLBACK;
  const d = data as Record<string, unknown>;
  const validMoods: MoodKey[] = [
    "joy", "calm", "sadness", "anxiety", "anger",
    "stress", "loneliness", "overwhelm", "uncertainty", "neutral",
  ];
  const mood = validMoods.includes(d.mood as MoodKey) ? (d.mood as MoodKey) : "neutral";
  const valence = clamp(Number(d.valence) || 0, -1, 1);
  const arousal = clamp(Number(d.arousal) || 0.5, 0, 1);
  const confidence = clamp(Number(d.confidence) || 0.5, 0, 1);
  const reasons = Array.isArray(d.reasons)
    ? d.reasons.filter(r => typeof r === "string").slice(0, 3)
    : [];
  return { mood, valence, arousal, confidence, reasons };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify(FALLBACK), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { message, context = [] }: ClassifyRequest = await req.json();
    if (!message?.trim()) {
      return new Response(JSON.stringify(FALLBACK), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(JSON.stringify(FALLBACK), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contextBlock = context.length > 0
      ? `\nContexto anterior (últimos mensajes del usuario):\n${context.slice(-2).map((m, i) => `[${i + 1}] ${m}`).join("\n")}`
      : "";

    const userPrompt = `${contextBlock}\nMensaje actual: "${message.slice(0, 500)}"`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 150,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Eres un clasificador de estado emocional. Solo emites JSON. Sin consejos. Sin texto adicional.

Clasifica el mensaje del usuario en UNA de estas categorías emocionales:
joy, calm, sadness, anxiety, anger, stress, loneliness, overwhelm, uncertainty, neutral

Devuelve SOLO este JSON:
{
  "mood": "<categoría>",
  "valence": <número -1 a 1>,
  "arousal": <número 0 a 1>,
  "confidence": <número 0 a 1>,
  "reasons": ["<frase corta>", "<frase corta>"]
}

Reglas:
- valence: negativo = difícil/malo, positivo = bien/alegre
- arousal: bajo = tranquilo/lento, alto = intenso/activado
- confidence: qué tan seguro estás de la clasificación
- reasons: frases cortas del texto que justifican la clasificación`,
          },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!openaiRes.ok) {
      return new Response(JSON.stringify(FALLBACK), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiData = await openaiRes.json();
    const raw = openaiData.choices?.[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    const result = validateMoodResponse(parsed);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("mood-classify error:", err);
    return new Response(JSON.stringify(FALLBACK), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
