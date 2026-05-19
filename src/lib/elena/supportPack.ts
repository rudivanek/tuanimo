export interface SupportRoutine {
  id: string;
  name: string;
  triggerContext: string[];
  steps: string[];
  followUp: string;
}

export const SUPPORT_ROUTINES: SupportRoutine[] = [
  {
    id: 'breathing_426',
    name: 'Respiración 4-2-6',
    triggerContext: ['ansiedad', 'pánico', 'nervios', 'respirar', 'calmar'],
    steps: [
      'Inhala lento por la nariz contando 4.',
      'Retén el aire 2 segundos.',
      'Exhala por la boca contando 6 — lento, como si apagases una vela lejos.',
      'Repite 4 veces.',
    ],
    followUp: '¿Cómo sientes el cuerpo después de hacerlo?',
  },
  {
    id: 'grounding_54321',
    name: '5-4-3-2-1 Grounding',
    triggerContext: ['pánico', 'disociación', 'abrumado', 'aquí', 'presente'],
    steps: [
      'Nombra 5 cosas que puedes VER ahora mismo.',
      'Nombra 4 cosas que puedes TOCAR.',
      'Nombra 3 sonidos que puedes ESCUCHAR.',
      'Nombra 2 cosas que puedes OLER.',
      'Nombra 1 cosa que puedes SABOREAR.',
    ],
    followUp: '¿Qué nota cambia en ti al hacer esto?',
  },
  {
    id: 'pre_flight_plan',
    name: 'Mini-plan antes del vuelo',
    triggerContext: ['vuelo', 'avión', 'volar', 'aeropuerto', 'antes de'],
    steps: [
      'La noche antes: escribe una frase sobre lo que esperas al llegar, no sobre el vuelo.',
      'En el aeropuerto: lleva algo que te ancle — música, un objeto, algo para leer.',
      'Al abordar: inhala 4, retén 2, exhala 6 — tres veces antes de sentarte.',
      'Elige un mantra para el despegue: "Mi cuerpo sabe cómo sobrevivir esto."',
    ],
    followUp: '¿Cuál de estos pasos se siente más alcanzable para ti?',
  },
  {
    id: 'inflight_panic',
    name: 'Script para pánico en el vuelo',
    triggerContext: ['vuelo', 'avión', 'despegue', 'turbulencia', 'durante el vuelo'],
    steps: [
      'Pon las manos en los muslos y presiona suave — siente el peso de tu cuerpo.',
      'Di en voz baja: "Estoy en una silla. Estoy a salvo ahora mismo."',
      'Inhala 4, retén 2, exhala 6. Solo un ciclo.',
      'Mira un punto fijo a tu alrededor — enfoca ahí 10 segundos.',
    ],
    followUp: '¿Qué parte de ese momento te genera más tensión?',
  },
  {
    id: 'self_talk',
    name: 'Frase de autocalmamiento',
    triggerContext: ['miedo', 'ansiedad', 'pensamientos', 'voz interna', 'repetir'],
    steps: [
      'Elige una frase corta que suene real para ti, no perfecta.',
      'Ejemplos: "Esto pasa." / "Lo he manejado antes." / "Un paso a la vez."',
      'Repítela tres veces — despacio, en voz baja.',
      'No tiene que convencerte. Solo interrumpe el bucle de pánico.',
    ],
    followUp: '¿Qué frase resonó más contigo?',
  },
  {
    id: 'control_what_you_can',
    name: '"Controlo lo que puedo"',
    triggerContext: ['control', 'incertidumbre', 'no sé qué va a pasar', 'futuro', 'preocupación'],
    steps: [
      'Escribe o di en voz alta: ¿qué SÍ controlo en esta situación? (aunque sea pequeño)',
      'Escribe: ¿qué NO controlo? Solo nómbralo — no lo analices.',
      'Pon toda tu energía en lo primero. Solo lo primero.',
      'Frase guía: "No necesito controlar todo. Solo lo que está en mis manos ahora."',
    ],
    followUp: '¿Qué es lo más pequeño que sí podrías controlar ahora mismo?',
  },
  {
    id: 'night_before_travel',
    name: 'Rutina nocturna antes del viaje',
    triggerContext: ['noche', 'mañana viajo', 'no puedo dormir', 'antes del viaje', 'nervios nocturnos'],
    steps: [
      'Prepara todo lo físico esta noche — bolso, documentos — para que mañana no haya sorpresas.',
      'Escribe una frase sobre por qué este viaje importa.',
      'Haz 5 respiraciones lentas antes de acostarte.',
      'Si los pensamientos vuelven, diles: "Ya lo pensaré mañana. Ahora descanso."',
    ],
    followUp: '¿Qué parte de mañana te genera más tensión?',
  },
  {
    id: 'body_release',
    name: 'Soltar el cuerpo',
    triggerContext: ['tensión', 'cuerpo tenso', 'rigidez', 'hombros', 'mandíbula', 'estrés físico'],
    steps: [
      'Cierra los ojos un momento.',
      'Lleva atención a los hombros — ¿están subidos? Bájalos con una exhalación.',
      'Aprieta los puños 5 segundos. Suéltalos despacio.',
      'Abre la mandíbula, estira la lengua — suelta toda la tensión de la cara.',
    ],
    followUp: '¿Dónde sientes que más guardas tensión en el cuerpo?',
  },
];

export function getRoutineForContext(keywords: string[]): SupportRoutine {
  const lower = keywords.map(k => k.toLowerCase());
  for (const routine of SUPPORT_ROUTINES) {
    const hit = routine.triggerContext.some(ctx =>
      lower.some(kw => kw.includes(ctx) || ctx.includes(kw))
    );
    if (hit) return routine;
  }
  return SUPPORT_ROUTINES[0];
}

export function buildSupportPackPromptBlock(): string {
  return SUPPORT_ROUTINES.map(r =>
    `[${r.id}] ${r.name}\n${r.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\nFollow-up: ${r.followUp}`
  ).join('\n\n');
}
