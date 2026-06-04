import { useState } from 'react';
import { CheckCircle2, XCircle, X, Sparkles } from 'lucide-react';
import type { Commitment } from '../lib/commitments';
import { resolveCommitment, dismissCommitment } from '../lib/commitments';

interface CommitmentCardProps {
  commitment: Commitment;
  /** Called after user picks "Lo hice" or "No del todo" — parent opens chat with a pre-filled opener */
  onReflect: (outcome: 'done' | 'not_done', commitmentText: string) => void;
  /** Called after the card is dismissed or resolved so parent can clear it */
  onDismissed: () => void;
}

export function CommitmentCard({ commitment, onReflect, onDismissed }: CommitmentCardProps) {
  const [loading, setLoading] = useState(false);

  async function handleOutcome(outcome: 'done' | 'not_done') {
    setLoading(true);
    await resolveCommitment(commitment.id, outcome);
    setLoading(false);
    onReflect(outcome, commitment.text);
    onDismissed();
  }

  async function handleDismiss() {
    await dismissCommitment(commitment.id);
    onDismissed();
  }

  return (
    <div className="mx-3 mb-3 rounded-2xl border border-[#AFA9EC]/40 bg-[#EEEDFE] p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-[#534AB7] shrink-0 mt-0.5" />
          <span className="text-xs font-medium text-[#3C3489] uppercase tracking-wide">
            {commitment.source === 'elena' ? 'Compromiso con Elena' : 'Tu compromiso'}
          </span>
        </div>
        <button
          onClick={handleDismiss}
          className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
          aria-label="Descartar compromiso"
        >
          <X size={14} />
        </button>
      </div>

      {/* Commitment text */}
      <p className="text-sm text-[var(--color-text-primary)] leading-relaxed mb-4">
        {commitment.text}
      </p>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => handleOutcome('done')}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-3 text-sm font-medium
            bg-[var(--color-background-success-subtle,#e8f5f0)] text-[var(--color-text-success,#0f6e56)]
            hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <CheckCircle2 size={15} />
          Lo hice
        </button>
        <button
          onClick={() => handleOutcome('not_done')}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-3 text-sm font-medium
            bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)]
            border border-[var(--color-border-secondary)]
            hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <XCircle size={15} />
          No del todo
        </button>
      </div>
    </div>
  );
}
