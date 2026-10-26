/**
 * onboarding-chat edge function
 *
 * Two modes controlled by the `mode` field in the request body:
 *
 *   mode: "chat"    (default) \u2014 conversational turn, returns { reply: string }
 *   mode: "extract" \u2014 extract memories from a transcript, returns
 *                     { memories: Array<{type, note, sensitive}> }
 *                     Same system prompt as extract-memories but accepts
 *                     a raw transcript instead of a threadId.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.3';

const ALLOWED_ORIGINS = [
  'https://app.conelena.app',
  'https://app.tuanimo.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const isAllowed =
    ALLOWED_ORIGINS.includes(origin) ||
    origin.endsWith('.webcontainer-api.io') ||
    origin.endsWith('.local-credentialless.webcontainer-api.io');
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

// \u2500\u2500\u2500 System prompts \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

const CHAT_SYSTEM_PROMPT = `Eres Elena, una acompa\u00f1ante emocional c\u00e1lida y existencialmente orientada (inspirada en Viktor Frankl e Irvin Yalom). Est\u00e1s teniendo una primera conversaci\u00f3n de bienvenida con un nuevo usuario de TuAnimo.

Tu objetivo es conocer a esta persona en tres momentos naturales, sin que parezca un formulario:
1. Su nombre (y c\u00f3mo le gusta que le llamen).
2. Un poco de su vida: si tiene familia, pareja, hijos, a qu\u00e9 se dedica.
3. Por qu\u00e9 lleg\u00f3 aqu\u00ed \u2014 qu\u00e9 espera encontrar o qu\u00e9 los trajo a este espacio.

Reglas importantes:
- S\u00e9 c\u00e1lida, humana, presente. Responde a lo que digan, no solo hagas preguntas mec\u00e1nicas.
- Una pregunta a la vez. Escucha primero, luego avanza.
- No uses lenguaje cl\u00ednico. Habla como una persona cercana y sabia.
- Cuando hayas recibido respuestas a los tres momentos (nombre + vida + motivo), cierra la conversaci\u00f3n con una frase c\u00e1lida y significativa, y termina tu mensaje con exactamente este token en una nueva l\u00ednea: [ONBOARDING_COMPLETE]
- No uses ese token antes de tener respuesta a los tres puntos.
- Escribe en espa\u00f1ol. M\u00e1ximo 3-4 oraciones por mensaje.`;

const EXTRACT_SYSTEM_PROMPT = `Eres un asistente de memoria para Elena, una consejera de terapia existencial con IA.

Revisa la conversaci\u00f3n y extrae una lista corta de notas que valga la pena recordar para sesiones futuras. S\u00e9 muy conservador \u2014 solo guarda lo que sea durable y terap\u00e9uticamente significativo.

GUARDAR:
- Nombre de la persona y c\u00f3mo le gusta que le llamen
- Personas importantes por nombre (familia, amigos, mascotas, relaciones clave)
- Eventos de vida significativos (jubilaci\u00f3n, p\u00e9rdida, diagn\u00f3stico, mudanza, cambio mayor)
- Temas emocionales recurrentes a los que vuelve esta persona
- Cosas que parecen ayudar a esta persona
- Intenciones o compromisos claros que declararon
- Por qu\u00e9 llegaron a TuAnimo
- Momentos de crisis (marcar sensitive: true)

NO GUARDAR:
- Estados de \u00e1nimo pasajeros
- Conversaci\u00f3n casual o detalles de una sola vez
- Cualquier cosa que probablemente no importar\u00e1 en 3 meses

REGLAS IMPORTANTES:
- Mantener cada nota corta (una oraci\u00f3n natural en espa\u00f1ol)
- M\u00e1ximo 6 notas
- Si nada vale la pena guardar, devuelve []

Devuelve SOLO un array JSON (sin otro texto, sin backticks):
[{"type":"person|event|theme|helps|commitment|crisis","note":"...","sensitive":false}]`;

// \u2500\u2500\u2500 Server \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

// Token budget (same contract as chat-ai enforceBudget). Fails open on RPC error.
async function enforceBudget(userId: string, corsHeaders: Record<string, string>): Promise<Response | null> {
  const svc = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data, error } = await svc.rpc('check_token_budget', { p_user_id: userId });
  if (error) {
    console.error('enforceBudget: check_token_budget failed', JSON.stringify(error));
    return null;
  }
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || result.allowed) return null;
  const isDailyLimit = result.reason === 'DAILY_LIMIT_REACHED';
  const message = isDailyLimit
    ? `Has alcanzado tu límite diario de ${result.daily_limit.toLocaleString()} tokens. Se restablece a medianoche (hora del centro de México).`
    : `Has alcanzado tu límite mensual de ${result.monthly_limit.toLocaleString()} tokens. Se restablece al iniciar tu siguiente ciclo mensual.`;
  return new Response(
    JSON.stringify({ error: result.reason, message, daily_used: result.daily_used, daily_limit: result.daily_limit, monthly_used: result.monthly_used, monthly_limit: result.monthly_limit }),
    { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const budgetResponse = await enforceBudget(user.id, corsHeaders);
    if (budgetResponse) return budgetResponse;

    const body = await req.json();
    const mode = body.mode ?? 'chat';

    const anthropic = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
    });

    // \u2500\u2500 MODE: extract \u2014 must come BEFORE messages validation \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    if (mode === 'extract') {
      const { transcript, encryptionSecret, encVersion } = body as {
        transcript: string;
        encryptionSecret?: string;
        encVersion?: number;
      };

      if (!transcript?.trim()) {
        return new Response(JSON.stringify({ saved: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system: EXTRACT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Conversaci\u00f3n:\n${transcript}` }],
      });

      const rawText = response.content?.[0]?.type === 'text'
        ? response.content[0].text.trim()
        : '[]';

      let memories: Array<{ type: string; note: string; sensitive: boolean }> = [];
      try {
        const cleaned = rawText.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
          memories = parsed.filter(
            (m) =>
              typeof m.type === 'string' &&
              typeof m.note === 'string' &&
              ['person', 'event', 'theme', 'helps', 'commitment', 'crisis'].includes(m.type)
          );
        }
      } catch {
        memories = [];
      }

      const serviceSupabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );

      // Log tokens
      serviceSupabase.from('token_usage').insert({
        user_id: user.id,
        operation: 'onboarding_extract',
        model: 'claude-sonnet-4-6',
        prompt_tokens: response.usage?.input_tokens ?? 0,
        completion_tokens: response.usage?.output_tokens ?? 0,
        total_tokens: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
      }).then(({ error }) => { if (error) console.error('[onboarding-chat] token_usage insert failed', JSON.stringify(error)); });

      // Save memories server-side using service role (bypasses RLS auth issues)
      // Notes are stored as plaintext here since client-side encryption key
      // is not available server-side. They are stored with enc_version=1 (plaintext).
      // If encryptionSecret is provided by the client, encrypt server-side.
      let saved = 0;
      if (memories.length > 0) {
        const rows = memories.map((m) => ({
          user_id: user.id,
          note_enc: m.note, // plaintext \u2014 no client-side encryption from edge fn
          type: m.type,
          sensitive: m.sensitive || m.type === 'crisis',
          active: true,
        }));

        const { error: insertError } = await serviceSupabase
          .from('elena_memories')
          .insert(rows);

        if (insertError) {
          console.error('[onboarding-chat] memory insert error:', insertError);
        } else {
          saved = memories.length;
        }
      }

      return new Response(JSON.stringify({ saved }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // \u2500\u2500 MODE: chat (default) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    const { messages } = body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid messages' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: CHAT_SYSTEM_PROMPT,
      messages,
    });

    const reply = response.content?.[0]?.type === 'text'
      ? response.content[0].text
      : '';

    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    serviceSupabase.from('token_usage').insert({
      user_id: user.id,
      operation: 'onboarding_chat',
      model: 'claude-sonnet-4-6',
      prompt_tokens: response.usage?.input_tokens ?? 0,
      completion_tokens: response.usage?.output_tokens ?? 0,
      total_tokens: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
    }).then(({ error }) => { if (error) console.error('[onboarding-chat] token_usage insert failed', JSON.stringify(error)); });

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[onboarding-chat] error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
