import { useState, useEffect } from 'react';
import { APP_VERSION } from '../lib/appVersion';

export function UpdateBanner() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready.then((reg) => {
      setRegistration(reg);

      // Check if there's already a waiting worker on load
      if (reg.waiting) setVisible(true);

      // Listen for a new service worker installing
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setVisible(true);
          }
        });
      });

      // Poll for updates every 60 seconds
      const interval = setInterval(() => reg.update(), 60 * 1000);
      return () => clearInterval(interval);
    });
  }, []);

  const handleUpdate = () => {
    if (!registration?.waiting) return;
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  };

  if (!visible) return null;

  return (
   <div
  className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 px-4 py-3 text-white shadow-lg"
  style={{ 
    backgroundColor: '#5F8672',
    paddingTop: 'max(12px, env(safe-area-inset-top))'
  }}
>
      <span className="text-sm font-medium">
        ✨ Nueva versión disponible (v{APP_VERSION})
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setVisible(false)}
          className="text-white/70 hover:text-white text-xs px-2 py-1 rounded transition-colors"
        >
          Después
        </button>
        <button
          onClick={handleUpdate}
          className="bg-white text-sage-medium text-sm font-semibold px-4 py-1.5 rounded-full hover:bg-white/90 transition-colors"
        >
          Actualizar
        </button>
      </div>
    </div>
  );
}
