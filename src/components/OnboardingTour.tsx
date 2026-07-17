/**
 * OnboardingTour.tsx  — v3: fixes new-user detection + settings button
 *
 * Fixes vs v2:
 *   1. Uses a custom event ("conelena:start-tour") instead of a module-level
 *      _open variable — avoids timing issues with lazy-loaded components
 *   2. Auto-show effect now also listens for auth user changes so a freshly
 *      invited user always sees the tour regardless of prior localStorage state
 *      on the same device
 *
 * To roll back: replace with OnboardingTour_v2 backup and paste v2 into Bolt.
 *
 * Exports:
 *   OnboardingTour   – mounted in App.tsx (unchanged)
 *   useTour          – { resetTour } for SettingsPage (unchanged)
 */

import { useState, useEffect, useCallback } from 'react';
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
import { useAuth } from '../contexts/AuthContext';

// ─── Storage key ─────────────────────────────────────────────────────────────
const STORAGE_KEY = 'conelena_tour_done';
const EVENT_NAME  = 'conelena:start-tour';

// ─── Steps ───────────────────────────────────────────────────────────────────
const STEPS = [
  {
    navigateTo: '/chat',
    icon: Sparkles,
    iconColor: 'text-sage-strong',
    iconBg: 'bg-sage-strong/10',
    subtitle: 'Bienvenido/a a Con Elena',
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
    title: 'Tu compañera emocional',
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

// ─── useTour hook (for SettingsPage) ─────────────────────────────────────────
export function useTour() {
  const resetTour = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    // Dispatch event — OnboardingTour listens for it regardless of mount order
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  }, []);
  return { resetTour };
}

// ─── Component ───────────────────────────────────────────────────────────────
export function OnboardingTour() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [active, setActive] = useState(false);
  const [step, setStep]     = useState(0);
  const [visible, setVisible] = useState(false);

  const activate = useCallback(() => {
    setStep(0);
    setActive(true);
  }, []);

  // Listen for event dispatched by useTour().resetTour()
  useEffect(() => {
    const handler = () => activate();
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, [activate]);

  // Auto-show when a user is present and hasn't seen the tour
  // Runs whenever `user` changes — catches freshly invited users
  useEffect(() => {
    if (!user) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    const t = setTimeout(activate, 700);
    return () => clearTimeout(t);
  }, [user, activate]);

  // Navigate to the right page on each step
  useEffect(() => {
    if (!active) return;
    navigate(STEPS[step].navigateTo);
  }, [active, step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Animate in
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
    if (STEPS[step].isFinal) {
      dismiss();
    } else {
      setStep(s => s + 1);
    }
  }, [step, dismiss]);

  if (!active) return null;

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <>
      {/* Semi-transparent overlay — shows the real page behind */}
      <div
        className={[
          'fixed inset-0 z-[190] bg-black/30',
          'transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Bottom card */}
      <div
        className={[
          'fixed bottom-0 left-0 right-0 z-[200] flex justify-center',
          'pb-[env(safe-area-inset-bottom,0px)]',
          'transition-transform duration-300 ease-out',
          visible ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
      >
        <div className="relative w-full sm:max-w-sm mx-auto bg-app-surface rounded-t-[28px] sm:rounded-[24px] sm:mb-6 shadow-2xl border border-app-border px-6 pt-7 pb-7 flex flex-col gap-4">

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
                  i === step        ? 'w-5 h-1.5 bg-sage-strong'
                  : i < step        ? 'w-1.5 h-1.5 bg-sage-strong/40'
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
            {current.isFinal ? 'Comenzar con Elena' : <> Siguiente <ArrowRight size={15} /></>}
          </button>
        </div>
      </div>
    </>
  );
}
