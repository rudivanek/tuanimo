import { useState, useEffect } from 'react';


export function UpdateBanner() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const checkForWaiting = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting) {
        setWaiting(reg.waiting);
        setVisible(true);
      }
    };

    navigator.serviceWorker.ready.then((reg) => {
      // Already waiting on load?
      checkForWaiting(reg);

      // New worker found while app is open
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaiting(newWorker);
            setVisible(true);
          }
        });
      });

      // Poll every 60s
      const interval = setInterval(() => reg.update(), 60 * 1000);
      return () => clearInterval(interval);
    });

    // When the new SW takes control, do a clean reload
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }, []);

  const handleUpdate = () => {
    if (!waiting) {
      window.location.reload();
      return;
    }
    // Tell the waiting SW to skip waiting → triggers controllerchange → reload
    waiting.postMessage({ type: 'SKIP_WAITING' });
  };

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 px-4 py-3 text-white shadow-lg"
      style={{
        backgroundColor: '#5F8672',
        paddingTop: 'max(12px, env(safe-area-inset-top))',
      }}
    >
      <span className="text-sm font-medium">
        ✨ Nueva versión disponible
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
          className="text-sm font-semibold px-4 py-1.5 rounded-full transition-colors"
          style={{ backgroundColor: 'white', color: '#5F8672' }}
        >
          Actualizar
        </button>
      </div>
    </div>
  );
}
