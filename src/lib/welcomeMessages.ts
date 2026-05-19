export type Tone = 'calm' | 'energetic' | 'reflective' | 'mature' | 'youthful';

export const TONE_LABELS: Record<Tone, string> = {
  calm: 'Calma',
  energetic: 'Energética',
  reflective: 'Reflexiva',
  mature: 'Serena',
  youthful: 'Joven',
};

export const WELCOME_MESSAGES: Record<Tone, string[]> = {
  calm: [
    'Hola, soy Elena 🌷\nEstoy aquí para escucharte.\n¿Cómo te sientes hoy?\nSi quieres, cuéntame qué está pasando por tu mente.',
    'Hola, soy Elena 🌷\nPodemos ir despacio.\nDime lo que te gustaría compartir hoy.\nEstoy aquí contigo.',
  ],
  energetic: [
    '¡Hola! Soy Elena 🌷\nQué bueno verte por aquí.\nCuéntame, ¿qué te gustaría mejorar o entender hoy?',
    'Hola, soy Elena 🌷\nGracias por estar aquí.\n¿Quieres hablar de algo que te entusiasma, te preocupa o simplemente de tu día?',
  ],
  reflective: [
    'Hola, soy Elena 🌷\nEste espacio es para ti.\nSi pudieras ponerle un nombre a lo que sientes ahora, ¿cuál sería?',
    'Hola, soy Elena 🌷\nMe alegra que estés aquí.\n¿Qué ha estado ocupando más tu mente últimamente?',
  ],
  mature: [
    'Hola, soy Elena.\nEstoy aquí para acompañarte con calma y respeto.\n¿En qué te gustaría que me enfoque contigo hoy?',
    'Hola, soy Elena.\nPodemos trabajar esto paso a paso.\nCuéntame qué situación o emoción te gustaría explorar ahora.',
  ],
  youthful: [
    'Holaa, soy Elena 🌷\nAquí puedes decir lo que sea, sin juicio.\n¿Qué onda hoy… qué traes en la cabeza?',
    'Hola, soy Elena 🌷\nMe da gusto que llegaste.\nCuéntame: ¿cómo vas hoy?',
  ],
};

export function selectTone(): Tone {
  return 'calm';
}

export function getPreferredGreetingName(profile: {
  first_name?: string | null;
  full_name?: string | null;
}): string | null {
  const firstName = profile.first_name?.trim();
  if (firstName) return firstName;

  const fullName = profile.full_name?.trim();
  if (fullName) {
    const firstToken = fullName.split(/\s+/)[0];
    if (firstToken) return firstToken;
  }

  return null;
}

function personalizeGreeting(text: string, name: string | null): string {
  if (!name) return text;
  return text
    .replace(/^(¡Hola)!/m, `$1 ${name}!`)
    .replace(/^(Holaa?),/m, `$1 ${name},`);
}

export function getWelcomeMessage(
  tone: Tone,
  profile?: { first_name?: string | null; full_name?: string | null } | null,
): { text: string; variant: number } {
  const variants = WELCOME_MESSAGES[tone];
  const variant = Math.floor(Math.random() * variants.length);
  const name = profile ? getPreferredGreetingName(profile) : null;
  const text = personalizeGreeting(variants[variant], name);
  return { text, variant };
}
