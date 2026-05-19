import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { CrisisResourceModal } from './CrisisResourceModal';

export function CrisisAlert() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="flex items-start gap-3 px-4 py-3.5 bg-red-50 border border-red-200 rounded-[14px] text-sm">
        <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-danger" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-red-800">Detectamos señales de angustia</p>
          <p className="text-red-700 mt-0.5 text-[13px] leading-snug">
            Si estás pasando por un momento difícil, hay ayuda disponible.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex-shrink-0 text-[12px] font-semibold text-danger hover:underline whitespace-nowrap"
        >
          Ver recursos
        </button>
      </div>

      {showModal && <CrisisResourceModal onClose={() => setShowModal(false)} />}
    </>
  );
}
