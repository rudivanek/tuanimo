import { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { APP_VERSION } from '../lib/appVersion';

export function UpdateBanner() {
  const [visible, setVisible] = useState(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Check for updates every 60 seconds while the app is open
      if (r) {
        setInterval(() => r.update(), 60 * 1000);
      }
    },
  });

  useEffect(() => {
    if (needRefresh) setVisible(true);
  }, [needRefresh]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 px-4 py-3 bg-sage-medium text-white shadow-lg">
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
          onClick={() => updateServiceWorker(true)}
          className="bg-white text-sage-medium text-sm font-semibold px-4 py-1.5 rounded-full hover:bg-white/90 transition-colors"
        >
          Actualizar
        </button>
      </div>
    </div>
  );
}
