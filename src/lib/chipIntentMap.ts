
const intentVariants: Record<string, string[]> = {
  value_importance: [
    "Quiero hablar más sobre por qué ese valor es tan importante para mí.",
    "Siento que ese valor tiene mucho peso en mi vida y quiero explorarlo mejor.",
    "Ese valor significa mucho para mí y quiero entenderlo más profundamente.",
  ],
  activity_energy: [
    "Quiero profundizar en esa actividad porque me da mucha energía.",
    "Siento que esa actividad me conecta con algo importante dentro de mí.",
    "Me gustaría explorar más por qué esa actividad me hace sentir tan bien.",
  ],
  happiness_moment: [
    "Quiero hablar más sobre ese momento feliz y lo que significó para mí.",
    "Ese momento me hizo sentir algo especial y quiero profundizar en ello.",
    "Quiero entender mejor por qué ese momento fue tan significativo para mí.",
  ],
  apply_daily: [
    "Me gustaría explorar cómo puedo llevar esto a mi vida cotidiana.",
    "Quiero entender mejor cómo aplicar esto en mi día a día.",
    "Siento que hay formas concretas de llevarlo a la práctica y quiero descubrirlas.",
  ],
  practical_examples: [
    "Me ayudaría mucho ver esto de forma más concreta y práctica.",
    "Quiero explorar ejemplos que me acerquen a esto desde lo cotidiano.",
    "Me gustaría entenderlo mejor a través de situaciones reales.",
  ],
  share_more: [
    "Quiero contarte más sobre lo que estoy sintiendo con esto.",
    "Hay algo más que quiero expresar sobre todo esto.",
    "Siento que hay mucho más que quiero compartir sobre lo que viví.",
  ],
  understand_better: [
    "Me gustaría entender mejor qué hay detrás de lo que siento.",
    "Quiero explorar más a fondo lo que esto significa para mí.",
    "Siento que aún no termino de comprender del todo lo que me pasa.",
  ],
  go_deeper: [
    "Quiero profundizar más en esto porque siento que hay algo importante.",
    "Me gustaría ir más allá en esta exploración.",
    "Siento que hay algo más profundo aquí que quiero entender.",
  ],
  more_practical: [
    "Prefiero que lo veamos desde un ángulo más práctico y concreto.",
    "Me resulta más útil abordarlo con pasos concretos.",
    "Quiero explorar esto desde algo más aplicado a mi realidad.",
  ],

  joy_explore: [
    "Quiero entender más profundamente qué me genera esta alegría.",
    "Me gustaría explorar qué hay detrás de este bienestar que siento.",
    "Siento que esta felicidad tiene algo importante que quiero comprender mejor.",
  ],
  joy_share: [
    "Quiero contarte más sobre lo que me hace sentir tan bien.",
    "Siento que esta alegría tiene algo importante que quiero expresar.",
    "Me gustaría hablar más sobre este momento de felicidad y lo que significa.",
  ],
  joy_gratitude: [
    "Quiero hablar sobre lo agradecido/a que me siento en este momento.",
    "Siento mucha gratitud y me gustaría explorar de dónde viene.",
    "Me gustaría entender mejor por qué me siento tan afortunado/a.",
  ],

  calm_peace: [
    "Me gustaría explorar qué es lo que me genera esa sensación de paz.",
    "Quiero entender mejor qué situaciones me dan tranquilidad interior.",
    "Siento que este estado de calma tiene algo que quiero explorar más.",
  ],
  calm_moment: [
    "Quiero conectar con este estado de calma y entenderlo mejor.",
    "Me gustaría hablar sobre lo que me tiene sintiéndome tan tranquilo/a.",
    "Siento que este equilibrio que tengo ahora merece ser explorado.",
  ],

  sadness_pain: [
    "Quiero explorar más sobre lo que siento y por qué duele tanto.",
    "Necesito hablar sobre este dolor y lo que lo está causando.",
    "Siento que este sufrimiento necesita ser expresado y comprendido.",
  ],
  sadness_understand: [
    "Me gustaría entender mejor de dónde viene esta tristeza.",
    "Quiero explorar qué hay detrás de lo que siento.",
    "Necesito comprender por qué me afecta tanto esta situación.",
  ],
  sadness_loss: [
    "Quiero hablar sobre esta pérdida y lo que significa para mí.",
    "Siento que hay mucho que procesar sobre lo que perdí.",
    "Me gustaría explorar cómo estoy llevando esta pérdida por dentro.",
  ],

  anxiety_worry: [
    "Quiero hablar más sobre lo que me está generando tanta preocupación.",
    "Me gustaría explorar qué es lo que más me angustia de esta situación.",
    "Siento que hay algo específico detrás de mi ansiedad que quiero entender.",
  ],
  anxiety_calm: [
    "Quiero entender qué necesito para sentirme más tranquilo/a.",
    "Me gustaría explorar cómo puedo manejar mejor esta ansiedad.",
    "Siento que necesito encontrar algo que me ayude a calmar este malestar.",
  ],
  anxiety_triggers: [
    "Me gustaría explorar qué situaciones son las que más me generan ansiedad.",
    "Quiero entender cuáles son los desencadenantes de lo que siento.",
    "Siento que si identifico qué me dispara esta ansiedad, podría manejarlo mejor.",
  ],

  anger_express: [
    "Necesito expresar todo lo que siento sin filtros.",
    "Quiero hablar sobre esta rabia que llevo por dentro.",
    "Siento que hay mucha energía acumulada que necesito sacar.",
  ],
  anger_understand: [
    "Me gustaría entender mejor qué hay detrás de este enojo.",
    "Quiero explorar qué está generando esta reacción tan intensa en mí.",
    "Siento que detrás de esta rabia hay algo más profundo que quiero ver.",
  ],
  anger_release: [
    "Quiero explorar cómo puedo liberar toda esta tensión de forma sana.",
    "Me gustaría encontrar una manera de soltar todo esto que siento.",
    "Siento que necesito un espacio para procesar esta frustración.",
  ],

  stress_exhaustion: [
    "Quiero hablar más sobre lo que me está dejando tan agotado/a.",
    "Necesito explorar todo lo que me está pesando en este momento.",
    "Siento que hay mucha presión acumulada que quiero nombrar.",
  ],
  stress_relief: [
    "Me gustaría entender qué necesito para sentirme menos presionado/a.",
    "Quiero explorar cómo puedo aliviar un poco toda esta carga.",
    "Siento que necesito encontrar alguna forma de alivio real.",
  ],
  stress_limits: [
    "Me gustaría explorar qué límites necesito poner para cuidarme más.",
    "Quiero entender qué es lo que más me está consumiendo la energía.",
    "Siento que necesito identificar dónde está el mayor desgaste.",
  ],

  loneliness_feeling: [
    "Quiero hablar sobre esta sensación de soledad y lo que significa para mí.",
    "Me gustaría explorar por qué me siento tan desconectado/a.",
    "Siento que esta soledad dice algo importante sobre lo que necesito.",
  ],
  loneliness_connection: [
    "Quiero entender mejor qué tipo de conexión necesito en mi vida.",
    "Me gustaría explorar cómo puedo sentirme más acompañado/a.",
    "Siento que hay algo que quiero en los demás que todavía no encuentro.",
  ],
  loneliness_self: [
    "Me gustaría explorar qué significa estar solo/a para mí en este momento.",
    "Quiero entender si esta soledad viene de afuera o de algo dentro de mí.",
    "Siento que hay algo sobre mi relación conmigo mismo/a que quiero explorar.",
  ],

  overwhelm_weight: [
    "Necesito hablar sobre todo lo que siento que me está aplastando.",
    "Quiero explorar qué es lo que más me está agobiando en este momento.",
    "Siento que hay demasiado encima y quiero nombrarlo todo.",
  ],
  overwhelm_clarity: [
    "Me gustaría ordenar un poco todo lo que tengo en la cabeza.",
    "Quiero entender mejor qué es lo más urgente para mí ahora mismo.",
    "Siento que necesito claridad y quiero explorar cómo encontrarla.",
  ],
  overwhelm_priority: [
    "Quiero explorar qué es lo que realmente importa entre todo lo que siento.",
    "Me gustaría entender qué debo soltar para poder respirar un poco.",
    "Siento que necesito identificar qué viene primero.",
  ],

  uncertainty_confusion: [
    "Quiero hablar sobre lo que no sé y cómo eso me afecta.",
    "Me gustaría explorar qué hay detrás de esta falta de claridad.",
    "Siento que esta confusión me dice algo importante que quiero entender.",
  ],
  uncertainty_direction: [
    "Quiero entender mejor qué es lo que realmente quiero.",
    "Me gustaría explorar qué dirección tomar en esta situación.",
    "Siento que hay algo en mí que sabe qué camino seguir y quiero encontrarlo.",
  ],
  uncertainty_fear: [
    "Me gustaría explorar qué es lo que más temo de esta incertidumbre.",
    "Quiero entender si el miedo a equivocarme me está paralizando.",
    "Siento que la incertidumbre me genera algo más que quiero explorar.",
  ],
};

const labelToIntent: Record<string, string> = {
  "Un valor que me importa mucho": "value_importance",
  "Una actividad que me da energía": "activity_energy",
  "Un momento que me hizo feliz": "happiness_moment",
  "Aplicarlo en mi día a día": "apply_daily",
  "Ejemplos prácticos": "practical_examples",
  "Quiero contarte más": "share_more",
  "Me gustaría entenderlo mejor": "understand_better",
  "Quiero profundizar en esto": "go_deeper",
  "Prefiero algo más práctico": "more_practical",

  "Explorar esta alegría": "joy_explore",
  "Compartir lo que me alegra": "joy_share",
  "Lo que me hace sentir bien": "joy_share",
  "Lo que me trae gratitud": "joy_gratitude",

  "Lo que me da paz": "calm_peace",
  "Lo que me tranquiliza": "calm_peace",
  "Aprovechar este momento": "calm_moment",

  "Hablar de este dolor": "sadness_pain",
  "Entender mi tristeza": "sadness_understand",
  "Lo que perdí": "sadness_loss",
  "Esta pérdida que siento": "sadness_loss",

  "Lo que me preocupa": "anxiety_worry",
  "Lo que más me angustia": "anxiety_worry",
  "Calmar esta ansiedad": "anxiety_calm",
  "Qué me dispara la ansiedad": "anxiety_triggers",

  "Expresar lo que siento": "anger_express",
  "Entender este enojo": "anger_understand",
  "Soltar esta tensión": "anger_release",
  "Lo que me frustra": "anger_understand",

  "Lo que me tiene agotado/a": "stress_exhaustion",
  "Encontrar alivio": "stress_relief",
  "Mis límites ahora mismo": "stress_limits",

  "Esta soledad que siento": "loneliness_feeling",
  "Lo que necesito de los demás": "loneliness_connection",
  "Mi relación conmigo mismo/a": "loneliness_self",

  "Todo lo que me pesa": "overwhelm_weight",
  "Poner orden en mi mente": "overwhelm_clarity",
  "Qué viene primero": "overwhelm_priority",

  "Esta confusión que tengo": "uncertainty_confusion",
  "Encontrar dirección": "uncertainty_direction",
  "El miedo a equivocarme": "uncertainty_fear",
};


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
      `Siento que hay algo importante en lo que me pasa cuando ${fragment}.`,
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

  if (lower.startsWith("me ") || lower.startsWith("quiero ") || lower.startsWith("siento ") || lower.startsWith("necesito ")) {
    return label.endsWith(".") ? label : `${label}.`;
  }

  return pickRandom([
    `Me gustaría hablar sobre ${label.toLowerCase()} y lo que eso significa para mí.`,
    `Quiero explorar más sobre ${label.toLowerCase()}.`,
    `Siento que ${label.toLowerCase()} es algo importante que quiero entender mejor.`,
  ]);
}

export function getHumanizedInsertText(chipLabel: string): string {
  const intentKey = labelToIntent[chipLabel];
  if (intentKey) {
    const variants = intentVariants[intentKey];
    if (variants?.length) return pickRandom(variants);
  }
  return wrapDynamicChip(chipLabel);
}
