/**
 * OnboardingTour.tsx  — v2, Option B: navigates to each real page
 *
 * – Auto-shows on first login (localStorage: tuanimo_tour_done)
 * – Navigates to each section so user sees the real UI behind the card
 * – Bottom-sheet card on all screen sizes (no DOM measurement needed)
 * – "Saltar" on every step, final step returns to /chat
 * – Re-triggerable from Configuración via useTour().resetTour()
 *
 * To roll back to v1 (card-only, no navigation):
 *   replace this file with the OnboardingTour_v1.tsx backup
 *
 * Exports:
 *   OnboardingTour   – mount once in App.tsx (already done)
 *   useTour          – { resetTour } for SettingsPage (already wired)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import {
  MessageCircle,
  BookOpen,
  BarChart3,
  Settings,
  CheckSquare,
  Sparkles,
  ArrowRight,
  X,
} from 'lucide-react';

// ─── Storage key ─────────────────────────────────────────────────────────────
const STORAGE_KEY = 'tuanimo_tour_done';

// ─── Steps ───────────────────────────────────────────────────────────────────
// navigateTo: the real route the user will see behind this card
// null = stay on current page (used for welcome + final)
const STEPS = [
  {
    navigateTo: '/chat',
    icon: Sparkles,
    iconColor: 'text-sage-strong',
    iconBg: 'bg-sage-strong/10',
    subtitle: 'Bienvenido/a a Tu-Animo',
    title: 'Tu espacio de bienestar personal',
    body: 'En unos segundos te mostramos todo lo que puedes hacer aquí. Es rápido, te lo prometemos.',
    isFinal: false,
  },
  {
    navigateTo: '/chat',
    icon: MessageCircle,
    iconColor: 'text-sage-strong',
    iconBg: 'bg-sage-strong/10',
    subtitle: 'Hola, soy Elena',
    title: 'Tu consejera de IA',
    body: 'Cuéntame lo que sientes, lo que te preocupa o simplemente lo que tienes en mente. No tengo prisa — estoy aquí cuando me necesites.',
    isFinal: false,
  },
  {
    navigateTo: '/journal',
    icon: BookOpen,
    iconColor: 'text-sky-600',
    iconBg: 'bg-sky-50',
    subtitle: 'Tu espacio privado',
    title: 'El Diario',
    body: 'Escribe lo que quieras: reflexiones, sueños, miedos. Está cifrado y solo tú puedes leerlo. Elena puede referenciarlo en conversación si tú lo decides.',
    isFinal: false,
  },
  {
    navigateTo: '/practicas',
    icon: CheckSquare,
    iconColor: 'text-violet-600',
    iconBg: 'bg-violet-50',
    subtitle: 'Pequeños pasos, cambios reales',
    title: 'Prácticas',
    body: 'Elena te sugiere ejercicios y reflexiones breves adaptados a lo que estás viviendo. Los puedes hacer a tu ritmo.',
    isFinal: false,
  },
  {
    navigateTo: '/insights',
    icon: BarChart3,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-50',
    subtitle: 'Elena te conoce con el tiempo',
    title: 'Insights',
    body: 'Cada semana analiza tus patrones y te comparte una reflexión personalizada. También recibirás un mensaje suyo si llevas unos días sin aparecer.',
    isFinal: false,
  },
  {
    navigateTo: '/settings',
    icon: Settings,
    iconColor: 'text-app-muted',
    iconBg: 'bg-app-surface-2',
    subtitle: 'Tu cuenta y preferencias',
    title: 'Configuración',
    body: 'Ajusta tu perfil, activa o desactiva notificaciones y accede a esta guía de nuevo cuando quieras.',
    isFinal: false,
  },
  {
    navigateTo: '/chat',
    icon: Sparkles,
    iconColor: 'text-sage-strong',
    iconBg: 'bg-sage-strong/10',
    subtitle: 'Sin prisa, sin presión',
    title: '¡Ya estás listo/a!',
    body: 'Elena está aquí cuando la necesites. Empieza cuando quieras — puedes escribir, o simplemente explorar.',
    isFinal: true,
  },
] as const;

// ─── Global opener (used by useTour hook) ────────────────────────────────────
let _open: (() => void) | null = null;

export function useTour() {
  const resetTour = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    _open?.();
  }, []);
  return { resetTour };
}

// ─── Component ───────────────────────────────────────────────────────────────
export function OnboardingTour() {
  const [, navigate] = useLocation();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false); // controls CSS fade-in
  const returnPath = useRef('/chat');

  // Register global opener
  useEffect(() => {
    _open = () => {
      setStep(0);
      setActive(true);
    };
    return () => { _open = null; };
  }, []);

  // Auto-show on first launch
  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => {
        setStep(0);
        setActive(true);
      }, 700);
      return () => clearTimeout(t);
    }
  }, []);

  // Navigate when step changes
  useEffect(() => {
    if (!active) return;
    const target = STEPS[step].navigateTo;
    navigate(target);
  }, [active, step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fade-in after mounting
  useEffect(() => {
    if (active) {
      const t = setTimeout(() => setVisible(true), 30);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [active]);

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      setActive(false);
      setStep(0);
      localStorage.setItem(STORAGE_KEY, 'true');
      navigate('/chat');
    }, 280);
  }, [navigate]);

  const next = useCallback(() => {
    const current = STEPS[step];
    if (current.isFinal) {
      dismiss();
    } else {
      setStep(s => s + 1);
    }
  }, [step, dismiss]);

  if (!active) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const totalSteps = STEPS.length;

  return (
    <>
      {/* Dim overlay — semi-transparent so user can see the page behind */}
      <div
        className={[
          'fixed inset-0 z-[190]',
          'bg-black/30',
          'transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
        onClick={dismiss}         // tap overlay = skip
        aria-hidden="true"
      />

      {/* Bottom card — sits above overlay */}
      <div
        className={[
          'fixed bottom-0 left-0 right-0 z-[200]',
          'flex justify-center',
          // safe-area bottom padding for iOS
          'pb-[env(safe-area-inset-bottom,0px)]',
          'transition-transform duration-300 ease-out',
          visible ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
      >
        <div className="w-full sm:max-w-sm mx-auto bg-app-surface rounded-t-[28px] sm:rounded-[24px] sm:mb-6 shadow-2xl border border-app-border px-6 pt-7 pb-7 flex flex-col gap-4">

          {/* Skip */}
          {!current.isFinal && (
            <button
              onClick={dismiss}
              className="absolute top-4 right-5 flex items-center gap-1 text-[12px] text-app-muted hover:text-app-text transition-colors"
              aria-label="Saltar guía"
            >
              <X size={12} />
              <span>Saltar</span>
            </button>
          )}

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={[
                  'rounded-full transition-all duration-300',
                  i === step
                    ? 'w-5 h-1.5 bg-sage-strong'
                    : i < step
                    ? 'w-1.5 h-1.5 bg-sage-strong/40'
                    : 'w-1.5 h-1.5 bg-app-border',
                ].join(' ')}
              />
            ))}
          </div>

          {/* Icon + text */}
          <div className="flex gap-4 items-start">
            <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${current.iconBg}`}>
              <Icon size={24} className={current.iconColor} strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11.5px] font-semibold text-sage-strong uppercase tracking-wide mb-0.5">
                {current.subtitle}
              </p>
              <h2 className="text-[17px] font-semibold text-app-text leading-snug">
                {current.title}
              </h2>
              <p className="text-[13.5px] text-app-muted leading-relaxed mt-1.5">
                {current.body}
              </p>
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={next}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-[14px] bg-sage-strong text-white text-[14.5px] font-semibold hover:opacity-90 transition-all active:scale-[0.98]"
          >
            {current.isFinal ? (
              'Comenzar con Elena'
            ) : (
              <>Siguiente <ArrowRight size={15} /></>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
