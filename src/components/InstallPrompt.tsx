import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

// How many days to wait before showing the prompt again after dismissal
const SNOOZE_DAYS = 7;
const STORAGE_KEY = 'conelena_install_prompt';

type PromptState = {
  dismissedAt?: number; // timestamp
};

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

function isMobile(): boolean {
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

function shouldShowPrompt(): boolean {
  if (!isMobile()) return false;
  if (isInStandaloneMode()) return false;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return true;
    const state: PromptState = JSON.parse(raw);
    if (!state.dismissedAt) return true;
    const daysSince = (Date.now() - state.dismissedAt) / (1000 * 60 * 60 * 24);
    return daysSince >= SNOOZE_DAYS;
  } catch {
    return true;
  }
}

function saveDismissal() {
  const state: PromptState = { dismissedAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function InstallPrompt() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<'android' | 'ios' | null>(null);
  const deferredPrompt = useRef<Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> } | null>(null);

  useEffect(() => {
    if (!user) return;
    if (!shouldShowPrompt()) return;

    if (isIOS()) {
      // Show after a short delay so the app has settled
      const t = setTimeout(() => {
        setPlatform('ios');
        setVisible(true);
      }, 3000);
      return () => clearTimeout(t);
    }

    // Android: wait for the browser's beforeinstallprompt event
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as typeof deferredPrompt.current;
      const t = setTimeout(() => {
        setPlatform('android');
        setVisible(true);
      }, 3000);
      // Store timeout id for cleanup — we use a closure ref trick
      (handler as { _t?: ReturnType<typeof setTimeout> })._t = t;
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      const t = (handler as { _t?: ReturnType<typeof setTimeout> })._t;
      if (t) clearTimeout(t);
    };
  }, [user]);

  const handleInstall = async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === 'accepted') {
      setVisible(false);
    }
    deferredPrompt.current = null;
    saveDismissal();
  };

  const handleDismiss = () => {
    setVisible(false);
    saveDismissal();
  };

  if (!visible || !platform) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6 pointer-events-none">
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl pointer-events-auto"
        style={{ border: '1px solid #e5e7eb', animation: 'slideUp 0.35s cubic-bezier(0.22,1,0.36,1) both' }}
      >
        {/* Top accent bar */}
        <div className="h-1 rounded-t-2xl bg-gradient-to-r from-green-500 to-teal-400" />

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center text-2xl">
              🌿
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-[15px] leading-snug">
                Lleva a Elena contigo
              </p>
              <p className="text-gray-500 text-[13px] mt-0.5">
                Instala Con Elena para acceder más rápido
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors p-1 -mt-1 -mr-1"
              aria-label="Cerrar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {platform === 'android' && (
            <>
              <p className="text-gray-600 text-[13.5px] leading-relaxed mb-4">
                Agrega Con Elena a tu pantalla de inicio para abrirla al instante, sin buscarla en el navegador.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDismiss}
                  className="flex-1 py-2.5 rounded-xl text-[13.5px] font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Ahora no
                </button>
                <button
                  onClick={handleInstall}
                  className="flex-1 py-2.5 rounded-xl text-[13.5px] font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors"
                >
                  Instalar
                </button>
              </div>
            </>
          )}

          {platform === 'ios' && (
            <>
              <p className="text-gray-600 text-[13.5px] leading-relaxed mb-4">
                Para instalarla en tu iPhone, sigue estos pasos:
              </p>

              {/* Steps */}
              <div className="space-y-3 mb-5">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-green-100 text-green-700 font-semibold text-[12px] flex items-center justify-center">
                    1
                  </div>
                  <div className="flex items-center gap-2 text-[13.5px] text-gray-700">
                    <span>Toca el botón</span>
                    {/* Safari share icon */}
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-gray-100 text-blue-500">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                        <polyline points="16 6 12 2 8 6" />
                        <line x1="12" y1="2" x2="12" y2="15" />
                      </svg>
                    </span>
                    <span className="text-gray-500">en Safari</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-green-100 text-green-700 font-semibold text-[12px] flex items-center justify-center">
                    2
                  </div>
                  <p className="text-[13.5px] text-gray-700">
                    Desplázate y elige{' '}
                    <span className="font-semibold text-gray-900">"Agregar a pantalla de inicio"</span>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-green-100 text-green-700 font-semibold text-[12px] flex items-center justify-center">
                    3
                  </div>
                  <p className="text-[13.5px] text-gray-700">
                    Toca <span className="font-semibold text-gray-900">"Agregar"</span> — ¡listo!
                  </p>
                </div>
              </div>

              <button
                onClick={handleDismiss}
                className="w-full py-2.5 rounded-xl text-[13.5px] font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Entendido, después lo hago
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

