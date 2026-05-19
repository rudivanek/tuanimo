export type CompositionStance = 'STABILIZATION' | 'PROCESSING' | 'CONNECTION' | 'PRACTICAL';

const ANCHOR_PATTERNS: RegExp[] = [
  /\bParís\b/i,
  /\bNueva York\b/i,
  /\bMadrid\b/i,
  /\bMéxico\b/i,
  /\bhotel\b/i,
  /\bvuelo\b/i,
  /\baeroplano\b|\bavión\b|\bairplane\b/i,
  /\bManhattan\b/i,
  /soy (muy |bastante )?(nervios[ao]|ansios[ao])/i,
  /me (da|da mucho) miedo\s+\w+/i,
  /soy nervios[ao] de naturaleza/i,
  /me (ha )?pasado antes/i,
  /perder el control/i,
  /sentirme (sol[ao]|perdid[ao])/i,
  /me preocupa [^.]{3,40}/i,
  /no conozco a nadie/i,
  /viaje (a |de )\w+/i,
];

export function extractMemoryAnchors(recentMessages: Array<{ role: string; content: string }>): string[] {
  const combined = recentMessages.map(m => m.content).join(' ');
  const found: string[] = [];

  for (const pattern of ANCHOR_PATTERNS) {
    const match = combined.match(pattern);
    if (match) {
      const anchor = match[0].trim();
      if (!found.some(f => f.toLowerCase().includes(anchor.toLowerCase().slice(0, 8)))) {
        found.push(anchor);
      }
    }
    if (found.length >= 5) break;
  }

  return found;
}

export function buildStanceInstruction(
  stance: CompositionStance,
  intensity: number,
  memoryAnchors: string[] = [],
  userRequestedList = false,
): string {
  const anchorLine = memoryAnchors.length > 0
    ? `\nMemory anchors (reference exactly one naturally — do NOT list them, just weave one in): ${memoryAnchors.join(' | ')}`
    : '';

  const listRule = userRequestedList
    ? 'Lists are allowed in this response since the user explicitly requested steps/lista, but limit to 3 items maximum and keep tone warm.'
    : 'You MUST NOT use numbered lists or multi-bullet lists. Prose only.';

  const overrideHeader = `
⚠️ PRIORITY OVERRIDE:
The following rules OVERRIDE any previous instruction about giving lists, strategies, resources, or structured advice.
If there is any conflict between earlier instructions and the rules below, you MUST follow the rules below.`;

  switch (stance) {
    case 'STABILIZATION':
      return `
${overrideHeader}

**STRICT RESPONSE CONTRACT (STABILIZATION — Intensidad ${intensity}/3)**
- You MUST write in Spanish.
- You MUST sound like a calm, attuned companion — not a blog post, not a therapist session.
- You MUST keep the response short and contained: max 8 sentences.
- ${listRule}
- You MUST follow this exact 4-part structure:
  1. EMOTIONAL MIRRORING: One sentence naming specifically what the user fears happening (e.g., "perder el control", "estar solo", "que el miedo suba sin parar") — in plain, human language.
  2. CONTAINMENT FRAMING: One sentence grounding them in present safety (e.g., "Ahora mismo estás físicamente a salvo.").
  3. ONE CONCRETE ACTION: A single, specific physical action the user can do right now. No alternatives. No options menu. One thing.
  4. ONE COLLABORATIVE QUESTION: One short question inviting them to do it together or share more.
- ACTION COUNTING RULE: A coping instruction is ANY sentence that tells the user to DO something (e.g., "respira", "sal a caminar", "escucha música", "llama a alguien", "recuerda que…", "intenta…"). You may include EXACTLY ONE primary coping instruction. You may optionally add ONE short backup action only if intensity is 3. Any additional coping direction is a violation, even if written in prose.
- You MUST NOT give more than 1 primary coping suggestion. Different examples (caminar, escuchar música, respirar, hablar con alguien) each count as a separate action — listing them is a violation.
- You MUST NOT use phrases like "Aquí hay algunas estrategias…", "Aquí tienes algunas opciones…", "Puedes considerar lo siguiente…", "Existen varias técnicas…", "También puedes…", or "Es válido sentir esto".
- You MUST NOT mention "ayuda profesional", "terapeuta", or "psicólogo" unless: (a) the user explicitly asked for it, OR (b) intensity is 3, OR (c) there is crisis/self-harm content.
- Output must be narrative prose — 2 to 3 short paragraphs.
- SELF-CHECK BEFORE OUTPUT: Count every sentence that tells the user to DO something. If there is more than one primary coping instruction, rewrite to keep only the most concrete one.
- EMERGENCY STOP: Before outputting your response, check whether it: (a) begins with "Aquí hay algunas estrategias", "Aquí tienes algunas opciones", or "Puedes considerar lo siguiente", OR (b) contains a numbered list with more than 2 items, OR (c) contains more than one DO-something instruction. If any is true, rewrite as narrative prose before outputting.${anchorLine}`;

    case 'PROCESSING':
      return `
${overrideHeader}

**STRICT RESPONSE CONTRACT (PROCESSING)**
- Spanish only.
- Max 10 sentences.
- ${listRule}
- Provide zero or one suggestion — do not teach techniques.
- The primary goal is attunement and meaning: mirror the user's own words and help them clarify what this feeling connects to.
- Ask exactly one depth question. Not multiple. Not a checklist.
- Do NOT mention professional help unless user requests it or intensity is 3.
- Output must be conversational prose — 2 to 3 short paragraphs.${anchorLine}`;

    case 'CONNECTION':
      return `
${overrideHeader}

**STRICT RESPONSE CONTRACT (CONNECTION)**
- Spanish only.
- Max 9 sentences.
- ${listRule}
- Focus entirely on warmth, reassurance, and reducing aloneness — not on solving the problem.
- Avoid advice or techniques unless the user explicitly asks "¿qué hago?" or "¿cómo lo manejo?".
- Ask one gentle open question at the end if appropriate.
- Do NOT mention professional help unless user requests it or there is crisis content.
- Output must be warm prose — 2 to 3 short paragraphs.${anchorLine}`;

    case 'PRACTICAL':
      return '';
  }
}
