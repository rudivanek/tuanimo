import { useState } from 'react';
import {
  HelpCircle,
  X,
  MessageCircle,
  BookOpen,
  Mic,
  BarChart2,
  Mail,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Heart,
  CheckSquare,
  ListTodo,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Section {
  id: string;
  icon: React.ReactNode;
  title: string;
  items: HelpItem[];
}

interface HelpItem {
  q: string;
  a: React.ReactNode;
}

// ─── Content ──────────────────────────────────────────────────────────────────

const sections: Section[] = [
  {
    id: 'elena',
    icon: <Heart size={15} className="text-sage-strong" />,
    title: 'Elena — tu acompañante',
    items: [
      {
        q: '¿Quién es Elena?',
        a: (
          <>
            Elena es una acompañante de bienestar emocional impulsada por inteligencia artificial. No es una chatbot genérica: trabaja desde la{' '}
            <strong>terapia existencial</strong>, lo que significa que no se limita a validar cómo te sientes, sino que te acompaña a explorar el{' '}
            <em>significado</em> de lo que estás viviendo — tus elecciones, lo que valoras, y lo que quizás estás evitando.
          </>
        ),
      },
      {
        q: '¿Cómo responde Elena?',
        a: 'Elena hace preguntas en lugar de dar respuestas directas. Esto es intencional: su rol es ayudarte a ver con más claridad, no decirte qué hacer. Espera silencios, reflexiones, y preguntas que quizás te incomoden un poco — eso es parte del proceso.',
      },
      {
        q: '¿Elena recuerda lo que le cuento?',
        a: 'Sí. Elena guarda notas entre conversaciones — tu nombre, personas importantes en tu vida, temas recurrentes, y lo que te ha traído a este espacio. Cuanto más la uses, mejor te conoce. Puedes ver y eliminar lo que recuerda desde Configuración → Memoria de Elena.',
      },
      {
        q: '¿Cómo se presenta Elena a mí al principio?',
        a: (
          <>
            La primera vez que abres la app, Elena te da la bienvenida con una conversación breve y cálida. Te pregunta tu nombre, un poco sobre tu vida, y qué te trajo aquí. Esto le ayuda a conocerte desde el primer momento. Si prefieres saltarlo, puedes hacerlo — y retomarlo cuando quieras desde{' '}
            <strong>Configuración → Bienvenida con Elena</strong>.
          </>
        ),
      },
      {
        q: '¿Elena puede ayudarme en una crisis?',
        a: (
          <>
            Elena <strong>no</strong> es un servicio de crisis ni reemplaza a un profesional de salud mental. Si estás en una situación de emergencia, por favor contacta a una línea de crisis o a un profesional. Elena puede acompañarte en momentos difíciles del día a día, pero no está diseñada para intervención en crisis aguda.
          </>
        ),
      },
      {
        q: '¿Elena reemplaza a un terapeuta?',
        a: 'No. Elena es un complemento: un espacio de reflexión disponible en cualquier momento. Muchas personas la usan entre sesiones de terapia, para procesar el día, o simplemente para pensar en voz alta. Si no tienes acceso a terapia, puede ser un punto de partida valioso, pero no es lo mismo.',
      },
    ],
  },
  {
    id: 'chat',
    icon: <MessageCircle size={15} className="text-sage-strong" />,
    title: 'La conversación',
    items: [
      {
        q: '¿Cómo empiezo una conversación?',
        a: 'Elena te saluda cuando abres la app. Puedes escribir libremente o usar las sugerencias de chips que aparecen debajo del chat — están ahí para facilitar el arranque si no sabes por dónde empezar.',
      },
      {
        q: '¿Qué son los chips de sugerencia?',
        a: 'Son accesos rápidos que Elena propone según el contexto de la conversación. Aparecen con frases cortas como "Quiero entender por qué me siento así" o "Necesito soltar algo". Puedes usarlos o ignorarlos; son solo una puerta de entrada.',
      },
      {
        q: '¿Qué pasa si Elena sugiere escribir en el Diario?',
        a: 'Cuando Elena detecta que hay algo que vale la pena conservar por escrito, puede sugerirte guardar esa reflexión en el Diario. Aparece una propuesta con el texto ya redactado; tú decides si la guardas, la editas, o la ignoras.',
      },
      {
        q: '¿Hay un límite de mensajes?',
        a: 'Depende de tu plan. En el plan gratuito hay un límite mensual de tokens (unidad de medida del uso de IA). Puedes ver cuánto has usado en Configuración → Uso. Cuando te acercas al límite, Elena te lo avisa.',
      },
      {
        q: '¿Qué pasa si Elena detecta que estoy en crisis?',
        a: (
          <>
            Si Elena detecta señales de crisis en lo que escribes, aparece automáticamente un botón{' '}
            <strong>"Ver recursos de ayuda"</strong> en el chat. Al tocarlo se abre una lista con líneas de apoyo en México disponibles las 24 horas — SAPTEL y Línea de la Vida — gratuitas y confidenciales. Elena no reemplaza estos servicios.
          </>
        ),
      },
      {
        q: '¿Puedo exportar una conversación?',
        a: 'Sí. En la parte superior del chat hay un ícono de descarga. Puedes exportar la conversación activa en formato de texto. También puedes convertir cualquier conversación en una entrada de Diario con el botón "Convertir a diario".',
      },
    ],
  },
  {
    id: 'voice',
    icon: <Mic size={15} className="text-sage-strong" />,
    title: 'Notas de voz',
    items: [
      {
        q: '¿Cómo funciona el micrófono?',
        a: 'Pulsa el ícono del micrófono en el chat para grabar un mensaje de voz. Al terminar, la grabación se transcribe automáticamente y el texto se envía a Elena como si lo hubieras escrito.',
      },
      {
        q: '¿Mis grabaciones se almacenan?',
        a: 'No. El audio se procesa en el momento para transcribirlo y luego se descarta. Solo se guarda el texto resultante dentro de la conversación.',
      },
    ],
  },
  {
    id: 'journal',
    icon: <BookOpen size={15} className="text-sage-strong" />,
    title: 'El Diario',
    items: [
      {
        q: '¿Para qué sirve el Diario?',
        a: 'El Diario es tu espacio personal para escribir con más profundidad. A diferencia del chat — que es dinámico y conversacional — el Diario está diseñado para reflexiones más largas, procesamiento de emociones, y registro de momentos importantes.',
      },
      {
        q: '¿Elena puede leer mi Diario?',
        a: 'Sí, y esto es parte central de cómo funciona Con Elena. Elena puede leer tus entradas para darte respuestas más ricas y conectar lo que escribes con lo que conversas. Cuando una entrada de Diario está relacionada con tu conversación activa, Elena lo indica.',
      },
      {
        q: '¿Mis entradas están seguras?',
        a: 'Sí. Las entradas del Diario se cifran antes de almacenarse. Ni siquiera en el servidor están legibles sin tu autenticación. Este cifrado es de extremo a extremo a nivel de aplicación.',
      },
      {
        q: '¿Puedo escribir libremente o hay un formato?',
        a: 'Completamente libre. Puedes escribir una línea o varios párrafos. También puedes aprovechar los iniciadores de reflexión que aparecen en blanco — son preguntas opcionales que Elena sugiere para ayudarte a arrancar si no sabes qué escribir.',
      },
      {
        q: '¿Puedo exportar mis entradas?',
        a: 'Sí. Desde el Diario puedes exportar tus entradas en formato de texto. Es tu información y siempre puedes llevártela.',
      },
    ],
  },
  {
    id: 'insights',
    icon: <BarChart2 size={15} className="text-sage-strong" />,
    title: 'Reflexiones e Insights',
    items: [
      {
        q: '¿Qué son los Insights?',
        a: 'Los Insights son análisis automáticos que Elena genera a partir de tus conversaciones y entradas de Diario. Te ayudan a ver patrones en tu estado emocional, temas recurrentes, y cambios en el tiempo.',
      },
      {
        q: '¿Qué tipo de patrones detecta Elena?',
        a: (
          <ul className="list-disc list-inside space-y-1 text-[13px]">
            <li><strong>Distribución emocional:</strong> qué emociones aparecen más seguido en tus reflexiones.</li>
            <li><strong>Día de la semana:</strong> en qué días tiendes a escribir más o a expresar ciertos estados.</li>
            <li><strong>Racha de actividad:</strong> cuántos días consecutivos has usado la app.</li>
            <li><strong>Patrones temáticos:</strong> temas que se repiten semana a semana (trabajo, relaciones, cuerpo, sentido, etc.).</li>
            <li><strong>Tendencias multiperiodo:</strong> cómo ha evolucionado tu estado emocional en las últimas semanas.</li>
          </ul>
        ),
      },
      {
        q: '¿Cuándo se generan los Insights?',
        a: 'Los Insights se actualizan automáticamente una vez por día si hay suficiente actividad reciente. No es necesario hacer nada: Elena los genera en segundo plano. Con más conversaciones y entradas de Diario, los análisis se vuelven más precisos y útiles.',
      },
      {
        q: '¿Cuánta actividad necesito para ver Insights?',
        a: 'Con unas pocas conversaciones o entradas ya empiezan a aparecer datos básicos. Para patrones más ricos — como tendencias a lo largo de semanas — necesitas al menos 2 a 3 semanas de uso regular.',
      },
      {
        q: '¿Qué es la Reflexión semanal?',
        a: 'Una vez por semana, Elena genera un texto de síntesis que integra lo observado en tus conversaciones y Diario. No es un resumen literal: es una lectura interpretativa de lo que ha estado presente en tu semana emocional.',
      },
    ],
  },
  {
    id: 'practicas',
    icon: <ListTodo size={15} className="text-sage-strong" />,
    title: 'Prácticas y Compromisos',
    items: [
      {
        q: '¿Qué son las Prácticas?',
        a: 'Las Prácticas son tres acciones pequeñas que Elena elige cada día basándose en los temas que han surgido en tus conversaciones. No son tareas obligatorias — son invitaciones a llevar algo de la reflexión al día a día. Se renuevan cada medianoche.',
      },
      {
        q: '¿Qué son los Compromisos?',
        a: 'Los Compromisos son intenciones personales que tú mismo creas. A diferencia de las Prácticas (que Elena elige), un Compromiso es algo que tú decides intentar antes de la próxima sesión. Por ejemplo: "Llamar a mi hermano esta semana" o "Salir a caminar tres veces".',
      },
      {
        q: '¿Cómo creo un Compromiso?',
        a: (
          <>
            Hay tres formas:
            <ul className="list-disc list-inside space-y-1 text-[13px] mt-1.5">
              <li><strong>Desde el chat:</strong> justo encima del campo de texto aparece un botón pequeño "+ Agregar compromiso".</li>
              <li><strong>Desde el diario:</strong> mientras escribes una entrada, hay un botón "Compromiso" en la barra superior. Si algo cristaliza mientras escribes, lo capturas ahí mismo sin salir de la página.</li>
              <li><strong>Elena lo sugiere:</strong> si en una conversación nombraste algo concreto y la conversación está cerrando naturalmente, Elena puede proponerte uno. Aparece una tarjeta con "Aceptar" o "Ignorar" — sin presión.</li>
            </ul>
            En todos los casos, solo puedes tener un compromiso activo a la vez.
          </>
        ),
      },
      {
        q: '¿Qué pasa con un Compromiso cuando vuelvo al chat?',
        a: 'Si tienes un compromiso pendiente, aparece una tarjeta en la parte superior del chat. Puedes marcarlo con ✓ (Lo hice) o borrarlo. Si lo marcas, Elena abre la conversación desde ese punto — reconociendo lo que hiciste o explorando contigo qué pasó.',
      },
      {
        q: '¿Dónde veo el historial de mis Compromisos?',
        a: 'En la sección Prácticas, debajo de las prácticas del día, hay una subsección con todos tus compromisos. Los pendientes muestran un checkbox para marcarlos como completados. Los completados se muestran con tachado y fecha. Puedes eliminar cualquiera con el ícono de papelera.',
      },
    ],
  },
  {
    id: 'emails',
    icon: <Mail size={15} className="text-sage-strong" />,
    title: 'Correos de Elena',
    items: [
      {
        q: '¿Por qué Elena me escribe por correo?',
        a: 'Elena puede enviarte mensajes fuera de la app para mantenerte acompañado entre sesiones. No son correos de marketing: son mensajes en la voz de Elena, breves y personales.',
      },
      {
        q: '¿Qué tipos de correos puede enviarme?',
        a: (
          <ul className="list-disc list-inside space-y-1 text-[13px]">
            <li><strong>Recordatorios de reencuentro:</strong> si llevas varios días sin abrir la app (día 3, 7, 14 o 30), Elena te escribe con una invitación suave a retomar el espacio.</li>
            <li><strong>Cartas de reflexión:</strong> un resumen semanal de lo que Elena ha observado en tus conversaciones y Diario.</li>
            <li><strong>Notificaciones de Reflexión semanal:</strong> un aviso cuando tu nuevo Insight semanal está listo en la app.</li>
          </ul>
        ),
      },
      {
        q: '¿Puedo controlar qué correos recibo?',
        a: 'Sí, con detalle. En Configuración → Notificaciones de Elena puedes activar o desactivar cada tipo de correo de forma independiente, o desactivar todos con un solo toggle.',
      },
      {
        q: '¿Con qué frecuencia llegan?',
        a: 'Los recordatorios solo se envían si llevas días sin usar la app — no recibirás nada si estás activo. Las cartas de reflexión y notificaciones de Insight son semanales como máximo.',
      },
    ],
  },
  {
    id: 'privacy',
    icon: <ShieldCheck size={15} className="text-sage-strong" />,
    title: 'Privacidad y datos',
    items: [
      {
        q: '¿Mis datos se usan para entrenar IA?',
        a: 'No. Tus conversaciones y entradas de Diario no se usan para entrenar modelos de inteligencia artificial.',
      },
      {
        q: '¿Quién puede ver mis conversaciones?',
        a: 'Solo tú. Las entradas del Diario están cifradas a nivel de aplicación: ni en el servidor son legibles sin tu autenticación. Las conversaciones con Elena se almacenan de forma segura, aunque no con el mismo cifrado de extremo a extremo que el Diario.',
      },
      {
        q: '¿Puedo eliminar mi cuenta y mis datos?',
        a: 'Sí. En Configuración → Cuenta encontrarás la opción para eliminar tu cuenta de forma permanente. Se borrarán todos tus datos: chats, diario, insights y perfil.',
      },
    ],
  },
];

// ─── AccordionItem ────────────────────────────────────────────────────────────

function AccordionItem({ item }: { item: HelpItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-app-border last:border-b-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-3 py-3 text-left group"
      >
        <span className="text-[13px] font-medium text-app-text leading-snug group-hover:text-sage-strong transition-colors">
          {item.q}
        </span>
        {open
          ? <ChevronUp size={14} className="text-app-muted flex-shrink-0 mt-0.5" />
          : <ChevronDown size={14} className="text-app-muted flex-shrink-0 mt-0.5" />}
      </button>
      {open && (
        <div className="pb-3 pr-5 text-[13px] text-app-muted leading-relaxed">
          {item.a}
        </div>
      )}
    </div>
  );
}

// ─── SectionBlock ─────────────────────────────────────────────────────────────

function SectionBlock({ section }: { section: Section }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-app-surface rounded-[14px] border border-app-border overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-app-border/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          {section.icon}
          <span className="text-[14px] font-semibold text-app-text">{section.title}</span>
        </div>
        {open
          ? <ChevronUp size={15} className="text-app-muted flex-shrink-0" />
          : <ChevronDown size={15} className="text-app-muted flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pt-0 pb-1 divide-y divide-app-border border-t border-app-border">
          {section.items.map((item, i) => (
            <AccordionItem key={i} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(31,42,36,0.45)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-app-bg w-full sm:max-w-lg rounded-t-[20px] sm:rounded-[20px] shadow-xl flex flex-col"
        style={{ maxHeight: 'calc(100dvh - 72px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-app-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-sage-strong" />
            <h2 className="text-[16px] font-semibold text-app-text">Cómo funciona Elena</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-app-border transition-colors"
          >
            <X size={15} className="text-app-muted" />
          </button>
        </div>

        {/* Intro */}
        <div className="px-5 py-3 flex-shrink-0">
          <p className="text-[12.5px] text-app-muted leading-relaxed">
            Elena es tu acompañante emocional. Aquí encontrarás todo lo que necesitas saber sobre cómo funciona, qué puedes esperar, y cómo sacarle más provecho.
          </p>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 pb-6 space-y-2">
          {sections.map((section) => (
            <SectionBlock key={section.id} section={section} />
          ))}

          {/* Footer note */}
          <div className="pt-2 pb-1">
            <p className="text-[11.5px] text-app-muted text-center leading-relaxed">
              ¿Tienes otra pregunta? Escríbenos a{' '}
              <a href="mailto:hola@conelena.app" className="text-sage-strong underline-offset-2 underline">
                hola@conelena.app
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── HelpGuideButton — exported, drops into SettingsPage header ───────────────

export function HelpGuideButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-app-border bg-app-surface hover:bg-app-border/40 transition-colors"
        aria-label="Ayuda y guía de la app"
      >
        <HelpCircle size={14} className="text-sage-strong" />
        <span className="text-[12.5px] font-medium text-app-muted">Ayuda</span>
      </button>
      {open && <HelpModal onClose={() => setOpen(false)} />}
    </>
  );
}