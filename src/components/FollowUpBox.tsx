import { useState } from 'react';
import { Heart, Wind, BookOpen, AlertCircle, ArrowRight, X } from 'lucide-react';
import type { FollowUp } from '../types/chat';
import { CrisisResourceModal } from './CrisisResourceModal';

interface FollowUpBoxProps {
  followUp: FollowUp;
  onFollowUpClick: (followUp: FollowUp) => void;
}

export function FollowUpBox({ followUp, onFollowUpClick }: FollowUpBoxProps) {
  const [showBreathingModal, setShowBreathingModal] = useState(false);
  const [showResourceModal, setShowResourceModal] = useState(false);

  const handleFollowUpClick = () => {
    onFollowUpClick(followUp);
    if (followUp.kind === 'action') {
      if (followUp.actionType === 'breathing') {
        setShowBreathingModal(true);
      } else if (followUp.actionType === 'resource') {
        setShowResourceModal(true);
      }
    }
  };

  const getIcon = () => {
    if (followUp.kind === 'action') {
      switch (followUp.actionType) {
        case 'breathing':
          return <Wind size={18} className="text-sage-strong" />;
        case 'resource':
          return <AlertCircle size={18} className="text-danger" />;
        case 'save_memory':
          return <Heart size={18} className="text-sage-strong" />;
        case 'journal':
          return <BookOpen size={18} className="text-sage-strong" />;
      }
    }
    return <ArrowRight size={18} className="text-app-muted" />;
  };

  return (
    <>
      <div className="mt-2.5">
        <button
          onClick={handleFollowUpClick}
          className="w-full text-left px-4 py-3 rounded-14 transition-all border border-sage-soft bg-sage-soft/50 hover:bg-sage-soft hover:border-sage/40"
        >
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">{getIcon()}</div>
            <div className="flex-1">
              <p className="text-[11px] text-app-muted font-medium mb-0.5 uppercase tracking-wide">Siguiente paso</p>
              <p className="text-sm text-app-text leading-snug">{followUp.text}</p>
            </div>
          </div>
        </button>
      </div>

      {showBreathingModal && (
        <div className="fixed inset-0 bg-app-text/40 backdrop-blur-sm flex items-center justify-center z-50 p-5">
          <div className="bg-app-surface rounded-[18px] shadow-app max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-sage-soft rounded-full flex items-center justify-center">
                  <Wind className="text-sage-strong" size={18} />
                </div>
                <h3 className="text-[16px] font-semibold text-app-text">Respiración 4-7-8</h3>
              </div>
              <button
                onClick={() => setShowBreathingModal(false)}
                className="p-1.5 hover:bg-app-surface-2 rounded-xl transition-colors text-app-muted"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-app-text text-sm leading-relaxed">
              <p className="text-app-muted">Este ejercicio te ayudará a calmar la ansiedad:</p>
              <ol className="space-y-2">
                {[
                  ['Inhala suavemente por la nariz durante', '4 segundos'],
                  ['Mantén el aire en tus pulmones por', '7 segundos'],
                  ['Exhala lentamente por la boca durante', '8 segundos'],
                ].map(([label, time], i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-sage-soft text-sage-strong rounded-full flex items-center justify-center text-xs font-semibold">
                      {i + 1}
                    </span>
                    <span>{label} <strong className="text-sage-strong">{time}</strong></span>
                  </li>
                ))}
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-sage-soft text-sage-strong rounded-full flex items-center justify-center text-xs font-semibold">4</span>
                  <span>Repite este ciclo 4 veces</span>
                </li>
              </ol>
              <p className="text-xs text-app-muted mt-3 pt-3 border-t border-app-border">
                Coloca una mano en tu pecho y otra en tu abdomen. Siente cómo el aire entra y sale de tu cuerpo.
              </p>
            </div>
            <button
              onClick={() => setShowBreathingModal(false)}
              className="mt-5 w-full bg-sage-strong text-white rounded-12 px-4 py-2.5 hover:bg-[#4e7260] transition-colors text-sm font-medium"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {showResourceModal && (
        <CrisisResourceModal onClose={() => setShowResourceModal(false)} />
      )}
    </>
  );
}
