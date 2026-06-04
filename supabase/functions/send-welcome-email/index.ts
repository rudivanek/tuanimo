import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://app.tuanimo.app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const APP_URL = "https://app.tuanimo.app";

function welcomeTemplate(firstName: string | null): string {
  const name = firstName ? `, ${firstName}` : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bienvenido/a a Elena</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f9f7f4; font-family: Georgia, 'Times New Roman', serif; color: #2c2c2c; }
    .wrapper { max-width: 560px; margin: 48px auto; padding: 0 24px 48px; }
    .logo { font-size: 18px; font-weight: 600; letter-spacing: 0.06em; color: #2c2c2c; margin-bottom: 40px; font-family: Georgia, serif; }
    .body-text { font-size: 16px; line-height: 1.7; color: #3a3a3a; margin-bottom: 32px; }
    .body-text p { margin: 0 0 20px; }
    .cta-wrap { margin: 36px 0; }
    .cta { display: inline-block; background-color: #2c2c2c; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-weight: 500; letter-spacing: 0.01em; }
    .steps { margin: 32px 0; border-top: 1px solid #e8e4de; padding-top: 28px; }
    .steps-title { font-size: 13px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin-bottom: 20px; }
    .step { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .step-num { flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%; background: #2c2c2c; color: #fff; font-size: 13px; font-weight: 600; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
    .step-body { font-size: 14px; line-height: 1.6; color: #3a3a3a; }
    .step-body strong { font-weight: 600; color: #2c2c2c; display: block; margin-bottom: 2px; }
    .footer { margin-top: 48px; font-size: 13px; color: #999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; }
    .footer a { color: #999; text-decoration: underline; }
    hr { border: none; border-top: 1px solid #e8e4de; margin: 40px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="logo">elena</div>

    <div class="body-text">
      <p>Hola${name}.</p>
      <p>Me alegra que estés aquí.</p>
      <p>Este es tu espacio — para pensar en voz alta, para poner en palabras lo que traes por dentro, para entenderte un poco mejor.</p>
      <p>No tienes que saber por dónde empezar. No tienes que tener algo importante que decir. Un pensamiento, una pregunta, lo que sea que tengas en mente ahora mismo — es suficiente.</p>
    </div>

    <div class="cta-wrap">
      <a href="${APP_URL}/chat" class="cta">Comenzar con Elena</a>
    </div>

    <div class="steps">
      <p class="steps-title">Cómo funciona</p>

      <div class="step">
        <div class="step-num">1</div>
        <div class="step-body">
          <strong>Habla con Elena</strong>
          Cuéntale cómo te sientes, qué tienes en mente, o simplemente qué pasó hoy. Elena escucha y te hace preguntas que ayudan a clarificar lo que traes por dentro.
        </div>
      </div>

      <div class="step">
        <div class="step-num">2</div>
        <div class="step-body">
          <strong>Escribe en tu diario</strong>
          Al terminar una conversación, puedes guardarla como entrada de diario. Con el tiempo, se convierte en un registro de tu proceso — tuyo, privado, encriptado.
        </div>
      </div>

      <div class="step">
        <div class="step-num">3</div>
        <div class="step-body">
          <strong>Descubre tus patrones</strong>
          Después de algunos días, Elena empieza a notar temas que aparecen y reaparecen. Esos insights semanales te ayudan a ver lo que quizás no es tan fácil ver desde adentro.
        </div>
      </div>
    </div>

    <hr />
    <div class="footer">
      Recibes este mensaje porque te registraste en Elena.<br />
      Si no quieres recibir más correos, puedes <a href="${APP_URL}/settings">ajustar tus preferencias aquí</a>.
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Verify the caller is an authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for DB writes
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Check if welcome email was already sent (idempotency guard)
    const { data: alreadySent } = await adminClient
      .from("email_lifecycle_events")
      .select("id")
      .eq("user_id", user.id)
      .eq("email_type", "day1_empieza_simple")
      .eq("status", "sent")
      .maybeSingle();

    if (alreadySent) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "already_sent" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull first name from profiles
    const { data: profile } = await adminClient
      .from("profiles")
      .select("first_name")
      .eq("id", user.id)
      .maybeSingle();

    const firstName = profile?.first_name ?? null;
    const html = welcomeTemplate(firstName);

    // Send via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY")!;
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Elena <hi@tuanimo.app>",
        to: [user.email!],
        subject: "Bienvenido/a a Elena",
        html,
      }),
    });

    const resendBody = await resendRes.json();
    if (!resendRes.ok) {
      throw new Error(`Resend error: ${JSON.stringify(resendBody)}`);
    }

    const resendId = resendBody.id as string;

    // Log the send so the scheduler skips step 1 for this user
    await adminClient.from("email_lifecycle_events").insert({
      user_id: user.id,
      email_type: "day1_empieza_simple",
      status: "sent",
      resend_message_id: resendId,
      sent_at: new Date().toISOString(),
      metadata: { source: "signup" },
    });

    // Also set lifecycle_started_at and step so the scheduler picks up from step 2
    await adminClient.from("profiles").update({
      lifecycle_started_at: new Date().toISOString(),
      email_sequence_step: 1,
      last_email_sent_at: new Date().toISOString(),
      last_email_type: "day1_empieza_simple",
      email_sequence_status: "active",
    }).eq("id", user.id);

    return new Response(JSON.stringify({ ok: true, resend_id: resendId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("send-welcome-email error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
