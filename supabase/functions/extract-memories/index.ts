import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://app.tuanimo.app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `Eres un asistente de memoria para Elena, una consejera de terapia existencial con IA.

Revisa la conversación y extrae una lista corta de notas que valga la pena recordar para sesiones futuras. Sé muy conservador — solo guarda lo que sea durable y terapéuticamente significativo.

GUARDAR:
- Personas importantes por nombre (familia, amigos, mascotas, relaciones clave)
- Eventos de vida significativos (jubilación, pérdida, diagnóstico, mudanza, cambio mayor)
- Temas emocionales recurrentes a los que vuelve esta persona
- Cosas que parecen ayudar a esta persona
- Intenciones o compromisos claros que declararon
- Momentos de crisis (marcar sensitive: true)

NO GUARDAR:
- Estados de ánimo pasajeros ("hoy estoy cansado")
- Conversación casual o detalles de una sola vez
- Cualquier cosa que probablemente no importará en 3 meses
- Etiquetas permanentes y duras — formula todo como movimiento, no identidad fija

REGLAS IMPORTANTES:
- No duplicar notas ya en existing_notes
- Mantener cada nota corta (una oración natural en español)
- Máximo 5 notas nuevas por conversación
- Si nada vale la pena guardar, devuelve []

Devuelve SOLO un array JSON (sin otro texto, sin backticks):
[{"type":"person|event|theme|helps|commitment|crisis","note":"...","sensitive":false}]`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const { threadId, existingNotes } = body as {
      threadId: string;
      existingNotes?: string[]; // plaintext notes for dedup context
    };

    if (!threadId) throw new Error("Missing threadId");

    // Load messages for this thread
    const { data: messages, error: msgError } = await supabaseClient
      .from("chat_messages")
      .select("sender, content, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(40);

    if (msgError) throw msgError;
    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ memories: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format transcript
    const transcript = messages
      .filter((m) => m.content?.trim())
      .map((m) => `${m.sender === "user" ? "Persona" : "Elena"}: ${m.content.trim()}`)
      .join("\n");

    const existingBlock = existingNotes && existingNotes.length > 0
      ? `Notas existentes (no duplicar):\n${existingNotes.map((n, i) => `${i + 1}. ${n}`).join("\n")}`
      : "Notas existentes: ninguna";

    const userPrompt = `${existingBlock}\n\nConversación:\n${transcript}`;

    // Call GPT-4o-mini
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      throw new Error("OPENAI_UNAVAILABLE");
    }

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 500,
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!openaiResponse.ok) {
      const err = await openaiResponse.json();
      throw new Error(`OpenAI error: ${JSON.stringify(err)}`);
    }

    const openaiData = await openaiResponse.json();
    const rawText = openaiData.choices?.[0]?.message?.content?.trim() ?? "[]";

    let memories: Array<{ type: string; note: string; sensitive: boolean }> = [];
    try {
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        memories = parsed.filter(
          (m) =>
            typeof m.type === "string" &&
            typeof m.note === "string" &&
            ["person", "event", "theme", "helps", "commitment", "crisis"].includes(m.type)
        );
      }
    } catch {
      memories = [];
    }

    // Mark thread as extracted
    await supabaseClient
      .from("chat_threads")
      .update({ memory_extracted_at: new Date().toISOString() })
      .eq("id", threadId)
      .eq("user_id", user.id);

    return new Response(JSON.stringify({ memories }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[extract-memories]", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
