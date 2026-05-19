import type { MoodKey } from '../../types/mood';
import type { ChipIntentKey } from './adaptiveChips';

export const chipCopyByMood: Record<MoodKey, Partial<Record<ChipIntentKey, string[]>>> = {
  anxiety: {
    small_next_step: [
      "Me gustaría enfocarme en un paso pequeño que sí puedo dar ahora.",
      "Quiero elegir una acción mínima para sentir un poco más de control.",
      "Quiero identificar algo concreto y pequeño que pueda hacer hoy.",
    ],
    name_need: [
      "Creo que lo que necesito ahora es claridad y calma; quiero identificarlo mejor.",
      "Quiero entender qué estoy necesitando en este momento.",
      "Me gustaría nombrar lo que más me falta ahora mismo.",
    ],
    body_signal: [
      "Quiero notar qué está pasando en mi cuerpo cuando me siento así.",
      "Me gustaría describir cómo se siente esto físicamente en mí.",
      "Quiero explorar las señales que mi cuerpo me está enviando.",
    ],
    self_compassion: [
      "Quiero hablarme con más paciencia; esto se siente difícil para mí.",
      "Me gustaría tratarme con más amabilidad en este momento.",
      "Quiero recordarme que está bien sentir lo que estoy sintiendo.",
    ],
    problem_to_action: [
      "Quiero transformar esta preocupación en algo que sí puedo hacer.",
      "Me gustaría encontrar un paso concreto que me ayude a avanzar.",
    ],
    explore_feeling: [
      "Quiero ponerle nombre a exactamente qué parte de esto me genera más ansiedad.",
      "Me gustaría explorar de dónde viene esta sensación que tengo.",
    ],
    journal_deeper: [
      "Quiero escribir con más detalle sobre lo que estoy sintiendo.",
      "Me gustaría profundizar en esto a través de la escritura.",
    ],
  },

  stress: {
    small_next_step: [
      "Quiero elegir una sola cosa para hacer hoy y soltar el resto.",
      "Me gustaría enfocarme en lo más urgente y dejar lo demás para después.",
      "Quiero identificar el paso más pequeño que me saque del punto muerto.",
    ],
    name_need: [
      "Quiero entender qué es lo que más necesito en este momento.",
      "Me gustaría identificar si lo que necesito es descanso, apoyo o claridad.",
      "Quiero nombrar lo que me está pesando para poder manejarlo mejor.",
    ],
    body_signal: [
      "Quiero notar cómo el estrés se manifiesta en mi cuerpo.",
      "Me gustaría prestar atención a las señales físicas de agotamiento.",
    ],
    self_compassion: [
      "Quiero recordarme que no tengo que poder con todo solo/a.",
      "Me gustaría ser más compasivo/a conmigo mismo/a frente a este estrés.",
    ],
    boundary: [
      "Quiero explorar qué límites necesito poner para proteger mi energía.",
      "Me gustaría pensar en qué puedo decir que no para cuidarme mejor.",
      "Quiero identificar dónde necesito poner un límite saludable.",
    ],
    problem_to_action: [
      "Quiero transformar todo esto que me abruma en algo más manejable.",
      "Me gustaría dividir el problema en partes para ver qué puedo hacer primero.",
    ],
    journal_deeper: [
      "Quiero escribir todo lo que me está pesando para organizarlo un poco.",
    ],
  },

  overwhelm: {
    small_next_step: [
      "Quiero elegir solamente una cosa para hacer ahora y olvidar el resto por un momento.",
      "Me gustaría encontrar el paso más pequeño posible que me ayude a comenzar.",
      "Quiero enfocarse en algo muy concreto y pequeño para salir de este bloqueo.",
    ],
    name_need: [
      "Quiero entender qué es lo primero que necesito para sentir algo de alivio.",
      "Me gustaría identificar qué me está aplastando más en este momento.",
    ],
    body_signal: [
      "Quiero notar cómo se siente este agobio en mi cuerpo ahora mismo.",
      "Me gustaría hacer una pausa y observar qué señales me está dando mi cuerpo.",
    ],
    self_compassion: [
      "Quiero recordarme que es normal sentirme así cuando hay tanto encima.",
      "Me gustaría tratarme con más gentileza en este momento difícil.",
    ],
    problem_to_action: [
      "Quiero intentar organizar todo lo que siento en algo más manejable.",
      "Me gustaría separar lo urgente de lo que puede esperar.",
    ],
    explore_feeling: [
      "Quiero poner palabras a exactamente qué es lo que más me está agobiando.",
      "Me gustaría explorar qué parte de todo esto me pesa más.",
    ],
    journal_deeper: [
      "Quiero vaciar todo lo que tengo en la cabeza escribiendo para aclarar mis ideas.",
      "Me gustaría escribir todo lo que me genera esta sensación de colapso.",
    ],
  },

  sadness: {
    explore_feeling: [
      "Quiero explorar con más profundidad qué hay detrás de esta tristeza.",
      "Me gustaría ponerle nombre a todo lo que siento en este momento.",
      "Quiero entender de dónde viene exactamente este dolor que siento.",
    ],
    support_request: [
      "Quiero decirte qué tipo de apoyo necesito ahora mismo.",
      "Me gustaría pedir la clase de acompañamiento que me haría sentir mejor.",
      "Quiero expresar lo que necesito para no estar solo/a con esto.",
    ],
    meaningful_memory: [
      "Quiero hablar de un recuerdo que todavía me conmueve cuando pienso en él.",
      "Me gustaría explorar algo que tiene mucho significado para mí.",
      "Quiero contarte sobre algo que me importa profundamente.",
    ],
    self_compassion: [
      "Quiero tratarme con más gentileza mientras atravieso esto.",
      "Me gustaría recordarme que está bien sentir tristeza.",
      "Quiero darme permiso de sentir esto sin juzgarme.",
    ],
    relationship_checkin: [
      "Quiero explorar cómo está afectando esto a mis relaciones más cercanas.",
      "Me gustaría reflexionar sobre con quién cuento y cómo me conecta.",
    ],
    journal_deeper: [
      "Quiero escribir sobre lo que siento para dejar salir un poco de este dolor.",
      "Me gustaría profundizar en esto con más espacio para explorar.",
    ],
  },

  loneliness: {
    explore_feeling: [
      "Quiero explorar qué significa esta soledad para mí en este momento.",
      "Me gustaría entender mejor qué es lo que más me hace sentir desconectado/a.",
      "Quiero ponerle palabras a esta sensación de aislamiento.",
    ],
    support_request: [
      "Quiero decirte qué tipo de presencia necesito ahora.",
      "Me gustaría pedir el tipo de acompañamiento que más necesito.",
      "Quiero explorar cómo podría sentirme menos solo/a ahora mismo.",
    ],
    meaningful_memory: [
      "Quiero recordar un momento en que me sentí verdaderamente acompañado/a.",
      "Me gustaría hablar de alguien o algo que me ha hecho sentir conectado/a.",
    ],
    self_compassion: [
      "Quiero tratarme con amabilidad mientras siento esta soledad.",
      "Me gustaría ser compasivo/a conmigo mismo/a frente a esta necesidad de conexión.",
    ],
    relationship_checkin: [
      "Quiero reflexionar sobre mis vínculos y cómo me siento en ellos.",
      "Me gustaría explorar qué tan satisfactorias son mis relaciones ahora.",
      "Quiero entender qué me dificulta conectar con las personas cercanas.",
    ],
    values: [
      "Quiero explorar qué valores me guían para construir las conexiones que necesito.",
    ],
    journal_deeper: [
      "Quiero escribir sobre esta soledad y lo que me dice sobre mis necesidades.",
    ],
  },

  anger: {
    boundary: [
      "Quiero explorar qué límite se está cruzando y cómo puedo ponerlo.",
      "Me gustaría pensar en cómo protegerme de lo que me está afectando.",
      "Quiero identificar qué necesito decir o hacer para sentir que cuido mis límites.",
    ],
    name_need: [
      "Quiero entender qué necesito que no está pasando en esta situación.",
      "Me gustaría identificar qué es lo que más me está afectando.",
      "Quiero poner palabras a lo que me está faltando.",
    ],
    problem_to_action: [
      "Quiero ver si hay algo concreto que puedo hacer con este enojo.",
      "Me gustaría encontrar una forma de canalizar esta energía en algo útil.",
      "Quiero transformar esta frustración en una acción que tenga sentido.",
    ],
    reframe: [
      "Quiero ver si hay otra forma de mirar esta situación que me quite algo del peso.",
      "Me gustaría explorar si hay algo que estoy interpretando de una forma que me hace daño.",
      "Quiero intentar entender qué hay del otro lado de todo esto.",
    ],
    explore_feeling: [
      "Quiero explorar qué hay detrás de este enojo más allá de la rabia.",
      "Me gustaría entender si hay algo más, como miedo o tristeza, debajo de todo esto.",
    ],
    self_compassion: [
      "Quiero reconocer que es válido sentir este enojo y no rechazarlo.",
      "Me gustaría darme espacio para sentir esto sin juzgarme.",
    ],
    journal_deeper: [
      "Quiero escribir sobre lo que me genera esta rabia para procesarlo mejor.",
    ],
  },

  joy: {
    gratitude: [
      "Quiero registrar qué me está haciendo sentir así de bien hoy.",
      "Me gustaría agradecerme por lo que hice para llegar a este momento.",
      "Quiero tomar un momento para sentir gratitud por esto que estoy viviendo.",
    ],
    meaningful_memory: [
      "Quiero guardar este momento y lo que significa para mí.",
      "Me gustaría describir este recuerdo para volver a él cuando lo necesite.",
      "Quiero explorar qué hace que este momento sea tan especial.",
    ],
    values: [
      "Siento que esto conecta con algo que valoro mucho; quiero explorarlo.",
      "Quiero entender qué valor mío se refleja en esta alegría que siento.",
      "Me gustaría ver qué dice esto sobre lo que es importante para mí.",
    ],
    energy_activity: [
      "Quiero explorar qué actividad o experiencia me está dando esta energía.",
      "Me gustaría entender qué me conecta con este estado de ánimo tan positivo.",
    ],
    journal_deeper: [
      "Quiero escribir más sobre esto para no olvidar cómo me siento ahora.",
      "Me gustaría profundizar en esta experiencia para entenderla mejor.",
    ],
    explore_feeling: [
      "Quiero entender qué es exactamente lo que me hace sentir tan bien.",
      "Me gustaría explorar de dónde viene esta alegría tan intensa.",
    ],
  },

  calm: {
    gratitude: [
      "Quiero reconocer qué me ha llevado a este estado de calma.",
      "Me gustaría tomar un momento para agradecer este equilibrio que siento.",
    ],
    values: [
      "Quiero explorar qué valores me permiten sentirme así de equilibrado/a.",
      "Me gustaría entender qué es lo que me da esta sensación de estabilidad.",
    ],
    meaningful_memory: [
      "Quiero hablar de algo que me conecta con este bienestar.",
      "Me gustaría explorar qué experiencias me llevan a sentirme en paz.",
    ],
    energy_activity: [
      "Quiero explorar qué actividades me mantienen en este estado de calma.",
      "Me gustaría entender qué hábitos me generan este equilibrio.",
    ],
    journal_deeper: [
      "Quiero aprovechar este momento tranquilo para reflexionar un poco.",
      "Me gustaría profundizar en algún tema que tengo pendiente explorar.",
    ],
    explore_feeling: [
      "Quiero entender qué me trajo a este estado de calma.",
      "Me gustaría explorar qué necesito para mantener este equilibrio.",
    ],
  },

  uncertainty: {
    explore_feeling: [
      "Quiero ponerle nombre a lo que estoy sintiendo, aunque sea confuso.",
      "Me gustaría explorar cómo me siento realmente hoy.",
      "Quiero entender mejor qué hay detrás de esta confusión.",
    ],
    values: [
      "Quiero conectar con lo que es importante para mí cuando todo lo demás está confuso.",
      "Me gustaría explorar qué valores pueden guiarme en este momento de duda.",
      "Quiero recordarme qué es lo que realmente importa para mí.",
    ],
    problem_to_action: [
      "Quiero ver si hay algo concreto que pueda hacer para aclarar este panorama.",
      "Me gustaría identificar un pequeño paso que me ayude a avanzar.",
    ],
    journal_deeper: [
      "Quiero escribir un poco para aclarar mis ideas y encontrar más dirección.",
      "Me gustaría profundizar con una reflexión que me ayude a ordenarme.",
      "Quiero usar la escritura para explorar qué es lo que realmente quiero.",
    ],
    name_need: [
      "Quiero entender qué es lo que más necesito ahora mismo para sentirme más seguro/a.",
      "Me gustaría identificar qué me falta para poder tomar decisiones con más claridad.",
    ],
    self_compassion: [
      "Quiero ser amable conmigo mismo/a mientras no tengo todo claro.",
      "Me gustaría recordarme que la incertidumbre no es una falla.",
    ],
  },

  neutral: {
    explore_feeling: [
      "Quiero ponerle nombre a lo que estoy sintiendo, aunque sea confuso.",
      "Me gustaría explorar cómo me siento realmente hoy.",
      "Quiero explorar si hay algo que no estoy reconociendo todavía.",
    ],
    journal_deeper: [
      "Quiero escribir un poco más para aclarar mis ideas.",
      "Me gustaría profundizar con una reflexión corta.",
      "Quiero usar este espacio para pensar en voz alta.",
    ],
    values: [
      "Quiero explorar qué es lo que más valoro en este momento de mi vida.",
      "Me gustaría conectar con lo que me importa de verdad.",
    ],
    problem_to_action: [
      "Quiero transformar alguna inquietud en algo concreto que pueda hacer.",
      "Me gustaría identificar si hay algo pendiente que necesita atención.",
    ],
    meaningful_memory: [
      "Quiero hablar sobre algo que me resulta significativo.",
      "Me gustaría explorar un recuerdo o experiencia importante para mí.",
    ],
  },
};
