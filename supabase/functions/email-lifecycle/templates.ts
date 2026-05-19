import { APP_URL } from "./types.ts";

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

export function getTemplate(
  type: string,
  firstName: string | null
): { html: string; subject: string } | null {
  const map: Record<string, { html: string; subject: string }> = {
    day1_empieza_simple:       { subject: "Empieza simple",                              html: templateDay1(firstName) },
    day2_dos_minutos:          { subject: "2 minutos son suficientes",                   html: templateDay2(firstName) },
    day3_mas_cerca:            { subject: "Estás más cerca de lo que crees",             html: templateDay3(firstName) },
    day4_empieza_interesante:  { subject: "Aquí es donde empieza a ponerse interesante", html: templateDay4(firstName) },
    day5_mayoria_se_detiene:   { subject: "La mayoría se detiene demasiado pronto",      html: templateDay5(firstName) },
  };
  return map[type] ?? null;
}
