import { APP_URL } from "./types.ts";

// ─── Base HTML wrapper ─────────────────────────────────────────────────────────

function baseTemplate(content: string, ctaText: string, ctaUrl: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Elena</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f9f7f4; font-family: Georgia, 'Times New Roman', serif; color: #2c2c2c; }
    .wrapper { max-width: 560px; margin: 48px auto; padding: 0 24px 48px; }
    .logo { font-size: 18px; font-weight: 600; letter-spacing: 0.06em; color: #2c2c2c; margin-bottom: 40px; font-family: Georgia, serif; }
    .body-text { font-size: 16px; line-height: 1.7; color: #3a3a3a; margin-bottom: 32px; }
    .body-text p { margin: 0 0 20px; }
    .cta-wrap { margin: 36px 0; }
    .cta { display: inline-block; background-color: #2c2c2c; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-weight: 500; letter-spacing: 0.01em; }
    .footer { margin-top: 48px; font-size: 13px; color: #999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; }
    .footer a { color: #999; text-decoration: underline; }
    hr { border: none; border-top: 1px solid #e8e4de; margin: 40px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="logo">elena</div>
    <div class="body-text">${content}</div>
    <div class="cta-wrap">
      <a href="${ctaUrl}" class="cta">${ctaText}</a>
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

// ─── Onboarding templates (legacy) ────────────────────────────────────────────

export function templateDay1(firstName: string | null): string {
  const name = firstName ? `, ${firstName}` : "";
  return baseTemplate(
    `<p>Hola${name}.</p>
<p>Solo quería recordarte que Elena está aquí cuando la necesites.</p>
<p>No tienes que escribir mucho. No tienes que saber por dónde empezar. Un pensamiento, una frase, lo que sea que tengas en mente ahora mismo — es suficiente.</p>
<p>Así de simple.</p>`,
    "Abrir Elena",
    `${APP_URL}/chat`
  );
}

export function templateDay2(firstName: string | null): string {
  const name = firstName ? `, ${firstName}` : "";
  return baseTemplate(
    `<p>Hola${name}.</p>
<p>¿Sabías que la mayoría de las personas que usan Elena solo necesitan 2 minutos para sentirse un poco mejor?</p>
<p>No es magia. Es simplemente el efecto de poner en palabras lo que traes por dentro.</p>
<p>Inténtalo hoy. Solo 2 minutos.</p>`,
    "Ir a mi check-in",
    `${APP_URL}/chat`
  );
}

export function templateDay3(firstName: string | null): string {
  const name = firstName ? `, ${firstName}` : "";
  return baseTemplate(
    `<p>Hola${name}.</p>
<p>Entender cómo te sientes no pasa de golpe.</p>
<p>Pasa poco a poco, cada vez que te detienes un momento a prestar atención.</p>
<p>Ya diste el primer paso al registrarte. El siguiente es más fácil de lo que crees.</p>`,
    "Continuar con Elena",
    `${APP_URL}/chat`
  );
}

export function templateDay4(firstName: string | null): string {
  const name = firstName ? `, ${firstName}` : "";
  return baseTemplate(
    `<p>Hola${name}.</p>
<p>Cuando llevas algunos días usando Elena, algo interesante empieza a pasar:</p>
<p>Elena empieza a reconocer patrones. Cómo te sientes según el día, qué temas aparecen más seguido, qué cosas te pesan más.</p>
<p>Para llegar ahí, solo necesitas unos pocos check-ins. Estás muy cerca.</p>`,
    "Ver mis insights",
    `${APP_URL}/insights`
  );
}

export function templateDay5(firstName: string | null): string {
  const name = firstName ? `, ${firstName}` : "";
  return baseTemplate(
    `<p>Hola${name}.</p>
<p>La mayoría de las apps de bienestar se abandonan en la primera semana.</p>
<p>No porque no funcionen — sino porque es fácil posponerlo para mañana.</p>
<p>Tú todavía estás aquí. Y eso ya dice algo.</p>
<p>Este es el mejor momento para hacer tu primer check-in real. Sin presión, sin perfección. Solo tú y Elena.</p>`,
    "Empezar ahora",
    `${APP_URL}/chat`
  );
}

// ─── Reminder templates (inactivity-triggered) ────────────────────────────────

export function templateReminderD3(firstName: string | null): string {
  const name = firstName ? `, ${firstName}` : "";
  return baseTemplate(
    `<p>Hola${name}.</p>
<p>Han pasado unos días. No pasa nada.</p>
<p>No tienes que tener algo importante que decir. A veces lo más útil es simplemente aparecer — escribir lo que sea, aunque parezca pequeño.</p>
<p>Cuando quieras, aquí estoy.</p>`,
    "Volver a Elena",
    `${APP_URL}/chat`
  );
}

export function templateReminderD7(firstName: string | null): string {
  const name = firstName ? `, ${firstName}` : "";
  return baseTemplate(
    `<p>Hola${name}.</p>
<p>Una semana.</p>
<p>A veces el silencio significa que todo va bien. Otras veces significa que algo pesa demasiado como para ponerlo en palabras.</p>
<p>Si es lo segundo — ese es exactamente el momento en que hablar ayuda más.</p>`,
    "Abrir Elena",
    `${APP_URL}/chat`
  );
}

export function templateReminderD14(firstName: string | null): string {
  const name = firstName ? `, ${firstName}` : "";
  return baseTemplate(
    `<p>Hola${name}.</p>
<p>Llevas dos semanas sin pasar por aquí.</p>
<p>No te escribo para hacerte sentir mal. Te escribo porque sé que cuando una persona se aleja de los espacios que le hacen bien, normalmente hay una razón.</p>
<p>No tienes que explicar nada. Solo abre la conversación cuando estés listo.</p>`,
    "Retomar",
    `${APP_URL}/chat`
  );
}

export function templateReminderD30(firstName: string | null): string {
  const name = firstName ? `, ${firstName}` : "";
  return baseTemplate(
    `<p>Hola${name}.</p>
<p>Ha pasado un mes.</p>
<p>Eso es mucho tiempo. Y sé que la vida a veces empuja todo lo demás al último lugar — incluyendo las cosas que nos hacen bien.</p>
<p>No sé qué ha pasado en estas semanas. Pero si hay algo que quieras procesar, ordenar, o simplemente decir en voz alta — aquí sigo.</p>
<p>Sin presión. Sin juicio. Cuando quieras.</p>`,
    "Volver cuando quieras",
    `${APP_URL}/chat`
  );
}

// ─── Insights template (wraps Claude-generated body) ──────────────────────────

export function templateInsights(firstName: string | null, generatedBody: string): string {
  const name = firstName ? `, ${firstName}` : "";
  // generatedBody arrives as plain text paragraphs; wrap each in <p>
  const paragraphs = generatedBody
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, "<br />")}</p>`)
    .join("\n");

  return baseTemplate(
    `<p>Hola${name}.</p>\n${paragraphs}`,
    "Abrir mis insights",
    `${APP_URL}/insights`
  );
}

// ─── Lookup map ───────────────────────────────────────────────────────────────

export function getTemplate(
  type: string,
  firstName: string | null
): { html: string; subject: string } | null {
  const map: Record<string, { subject: string; html: string }> = {
    // Onboarding
    day1_empieza_simple:       { subject: "Empieza simple",                              html: templateDay1(firstName) },
    day2_dos_minutos:          { subject: "2 minutos son suficientes",                   html: templateDay2(firstName) },
    day3_mas_cerca:            { subject: "Estás más cerca de lo que crees",             html: templateDay3(firstName) },
    day4_empieza_interesante:  { subject: "Aquí es donde empieza a ponerse interesante", html: templateDay4(firstName) },
    day5_mayoria_se_detiene:   { subject: "La mayoría se detiene demasiado pronto",      html: templateDay5(firstName) },
    // Reminders
    reminder_d3:   { subject: "¿Todo bien?",         html: templateReminderD3(firstName) },
    reminder_d7:   { subject: "Una semana",           html: templateReminderD7(firstName) },
    reminder_d14:  { subject: "Dos semanas",          html: templateReminderD14(firstName) },
    reminder_d30:  { subject: "Ha pasado un mes",     html: templateReminderD30(firstName) },
  };
  return map[type] ?? null;
}
