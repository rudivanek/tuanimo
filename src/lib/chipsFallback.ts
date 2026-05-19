export function isStrongInvitationQuestion(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed.endsWith('?')) return false;

  const patterns = [
    /¿te gustaría/i,
    /¿quieres/i,
    /¿prefieres/i,
    /¿hay alguna/i,
    /¿hay algún/i,
    /¿cómo te gustaría/i,
    /¿te gustaría explorar/i,
    /¿te gustaría compartir/i,
    /¿te gustaría profundizar/i,
  ];

  return patterns.some((p) => p.test(trimmed));
}

export function generateFallbackChips(message: string): string[] {
  const lower = message.toLowerCase();

  if (lower.includes('actividad') || lower.includes('valor')) {
    return ['Un valor que me importa mucho', 'Una actividad que me da energía'];
  }

  if (lower.includes('aplicar') || lower.includes('vida diaria')) {
    return ['Aplicarlo en mi día a día', 'Ejemplos prácticos'];
  }

  if (
    lower.includes('compartir') ||
    lower.includes('situación') ||
    lower.includes('impactado')
  ) {
    return ['Quiero contarte más', 'Me gustaría entenderlo mejor'];
  }

  return ['Quiero profundizar en esto', 'Prefiero algo más práctico'];
}
