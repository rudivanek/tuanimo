/**
 * OnboardingTour.tsx
 *
 * First-launch guided tour for TuAnimo.
 * – Shows automatically on first login (localStorage key: tuanimo_tour_done)
 * – Full-screen card sequence, works on mobile + desktop
 * – "Saltar" link on every card
 * – Can be re-triggered from Configuración via resetTour() / startTour()
 *
 * Exports:
 *   OnboardingTour        – mount once in App.tsx inside the authenticated zone
 *   useTour               – hook: { startTour, resetTour } for SettingsPage button
 */

import { useState, useEffect, useCallback } from 'react';
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

// ─── Storage key ────────────────────────────────────────────────────────────
const STORAGE_KEY = 'tuanimo_tour_done';

// ─── Tour steps ─────────────────────────────────────────────────────────────
const STEPS = [
  {
    icon: Sparkles,
    iconColor: 'text-sage-strong',
    iconBg: 'bg-sage-strong/10',
    title: 'Bienvenido/a a Tu-Animo',
    subtitle: 'Tu espacio de bienestar personal',
    body: 'En unos segundos te mostramos todo lo que puedes hacer aquí. Es rápido, te lo prometemos.',
  },
  {
    icon: MessageCircle,
    iconColor: 'text-sage-strong',
    iconBg: 'bg-sage-strong/10',
    title: 'Hola, soy Elena',
    subtitle: 'Tu consejera de IA',
    body: 'Puedes contarme lo que sientes, lo que te preocupa o simplemente lo que tienes en mente. No tengo prisa — estoy aquí cuando me necesites.',
  },
  {
    icon: BookOpen,
    iconColor: 'text-sky-600',
    iconBg: 'bg-sky-50',
    title: 'Tu Diario',
    subtitle: 'Tu espacio privado',
    body: 'Escribe lo que quieras: reflexiones, sueños, miedos. Está cifrado y solo tú puedes leerlo. Elena puede referenciarlo en conversación si tú lo decides.',
  },
  {
    icon: CheckSquare,
    iconColor: 'text-violet-600',
    iconBg: 'bg-violet-50',
    title: 'Prácticas',
    subtitle: 'Pequeños pasos, cambios reales',
    body: 'Elena te sugiere ejercicios y reflexiones breves adaptados a lo que estás viviendo. Los puedes hacer a tu ritmo.',
  },
  {
    icon: BarChart3,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-50',
    title: 'Insights',
    subtitle: 'Elena te conoce con el tiempo',
    body: 'Cada semana analiza tus patrones y te comparte una reflexión personalizada basada en lo que has compartido. También recibirás un mensaje de Elena si llevas unos días sin aparecer.',
  },
  {
    icon: Settings,
    iconColor: 'text-app-muted',
    iconBg: 'bg-app-surface-2',
    title: 'Configuración',
    subtitle: 'Tu cuenta y preferencias',
    body: 'Ajusta tu perfil, activa o desactiva notificaciones y accede a esta guía de nuevo cuando quieras.',
  },
  {
    icon: Sparkles,
    iconColor: 'text-sage-strong',
    iconBg: 'bg-sage-strong/10',
    title: '¡Ya estás listo/a!',
    subtitle: 'Sin prisa, sin presión',
    body: 'Elena está aquí cuando la necesites. Empieza cuando quieras — puedes escribir, o simplemente explorar.',
    isFinal: true,
  },
] as const;

// ─── Hook (used by SettingsPage) ─────────────────────────────────────────────
let _setVisibleGlobal: ((v: boolean) => void) | null = null;

export function useTour() {
  const startTour = useCallback(() => {
    _setVisibleGlobal?.(true);
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    _setVisibleGlobal?.(true);
  }, []);

  return { startTour, resetTour };
}

// ─── Main component ──────────────────────────────────────────────────────────
export function OnboardingTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);

  // Register global setter so useTour() can open this
  useEffect(() => {
    _setVisibleGlobal = setVisible;
    return () => { _setVisibleGlobal = null; };
  }, []);

  // Auto-show on first launch
  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      // Small delay so the app has painted behind it
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      setExiting(false);
      setStep(0);
      localStorage.setItem(STORAGE_KEY, 'true');
    }, 300);
  }, []);

  const next = useCallback(() => {
    const current = STEPS[step];
    if ('isFinal' in current && current.isFinal) {
      dismiss();
    } else {
      setStep(s => s + 1);
    }
  }, [step, dismiss]);

  if (!visible) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isFinal = 'isFinal' in current && current.isFinal;
  const progress = step / (STEPS.length - 1);

  return (
    <div
      className={[
        'fixed inset-0 z-[200] flex items-end sm:items-center justify-center',
        'bg-black/50 backdrop-blur-sm',
        'transition-opacity duration-300',
        exiting ? 'opacity-0' : 'opacity-100',
      ].join(' ')}
      // Tap outside does nothing — intentional, forces explicit choice
    >
      {/* Card */}
      <div
        className={[
          'relative w-full sm:max-w-sm',
          'bg-app-surface rounded-t-[28px] sm:rounded-[24px]',
          'shadow-2xl border border-app-border',
          'px-6 pt-8 pb-8',
          'flex flex-col gap-5',
          'transition-transform duration-300',
          exiting ? 'translate-y-8 sm:translate-y-0 sm:scale-95' : 'translate-y-0 sm:scale-100',
        ].join(' ')}
      >
        {/* Skip / close */}
        {!isFinal && (
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 flex items-center gap-1 text-[12px] text-app-muted hover:text-app-text transition-colors"
            aria-label="Saltar guía"
          >
            <X size={13} />
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

        {/* Icon */}
        <div className="flex justify-center">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${current.iconBg}`}>
            <Icon size={30} className={current.iconColor} strokeWidth={1.8} />
          </div>
        </div>

        {/* Text */}
        <div className="text-center space-y-1.5">
          <p className="text-[13px] font-medium text-sage-strong tracking-wide uppercase">
            {current.subtitle}
          </p>
          <h2 className="text-[20px] font-semibold text-app-text leading-snug">
            {current.title}
          </h2>
          <p className="text-[14.5px] text-app-muted leading-relaxed mt-1">
            {current.body}
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={next}
          className={[
            'w-full flex items-center justify-center gap-2',
            'py-3.5 rounded-[14px]',
            'text-[15px] font-semibold',
            'transition-all duration-150 active:scale-[0.98]',
            isFinal
              ? 'bg-sage-strong text-white hover:opacity-90'
              : 'bg-sage-strong text-white hover:opacity-90',
          ].join(' ')}
        >
          {isFinal ? (
            <>Comenzar con Elena</>
          ) : (
            <>
              Siguiente
              <ArrowRight size={16} />
            </>
          )}
        </button>

        {/* Progress bar (subtle, at bottom) */}
        <div className="h-[3px] rounded-full bg-app-border overflow-hidden -mx-1">
          <div
            className="h-full bg-sage-strong/40 rounded-full transition-all duration-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
