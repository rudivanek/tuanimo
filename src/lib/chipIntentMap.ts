/**
 * chipIntentMap.ts — Humanizes chip labels into natural first-person sentences.
 *
 * Used as a fallback when a chip's insertText isn't already set.
 */

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function wrapDynamicChip(label: string): string {
  const lower = label.toLowerCase().trim();

  if (lower.startsWith("cuando ")) {
    const fragment = label.slice(7).toLowerCase();
    return pickRandom([
      `Quiero explorar más sobre cómo me siento cuando ${fragment}.`,
      `Me gustaría hablar sobre lo que experimento cuando ${fragment}.`,
    ]);
  }

  if (lower.startsWith("con ") || lower.startsWith("en ")) {
    return pickRandom([
      `Me gustaría profundizar en lo que siento ${label.toLowerCase()}.`,
      `Quiero entender mejor lo que me ocurre ${label.toLowerCase()}.`,
    ]);
  }

  if (lower.startsWith("porque ") || lower.startsWith("por ")) {
    return pickRandom([
      `Creo que ${label.toLowerCase()} y me gustaría explorarlo más.`,
      `Siento que ${label.toLowerCase()} y quiero entender eso mejor.`,
    ]);
  }

  if (lower.startsWith("me ") || lower.startsWith("quiero ") || lower.startsWith("siento ") || lower.startsWith("necesito ") || lower.startsWith("estoy ") || lower.startsWith("hay ") || lower.startsWith("no ")) {
    return label.endsWith(".") ? label : `${label}.`;
  }

  return pickRandom([
    `Me gustaría hablar sobre ${label.toLowerCase()} y lo que eso significa para mí.`,
    `Quiero explorar más sobre ${label.toLowerCase()}.`,
  ]);
}

export function getHumanizedInsertText(chipLabel: string): string {
  return wrapDynamicChip(chipLabel);
}