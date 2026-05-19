import { useRef, useState } from 'react';
import { Info } from 'lucide-react';

const UNSAFE_LABEL_PATTERN =
  /itinerario|lugares|d[oó]nde comer|tips|viaje|presupuesto|top|mejor|paso|checklist|plan/i;

interface Props {
  chips: string[];
  onSelect: (chip: string) => void;
  source: 'emotion_allowlist';
  isAdaptive?: boolean;
  tooltipCopy?: string;
}

export function SuggestionChips({ chips, onSelect, source, isAdaptive = false, tooltipCopy }: Props) {
  const lastClickRef = useRef<number>(0);
  const [showTooltip, setShowTooltip] = useState(false);

  if (source !== 'emotion_allowlist') return null;
  if (!chips || chips.length === 0) return null;

  const blocked = chips.filter(c => UNSAFE_LABEL_PATTERN.test(c));
  if (blocked.length > 0) {
    console.warn('[Chips] blocked unsafe labels', { blocked });
  }

  const safeChips = chips.filter(c => !UNSAFE_LABEL_PATTERN.test(c));
  if (safeChips.length === 0) return null;

  const handleClick = (chip: string) => {
    const now = Date.now();
    if (now - lastClickRef.current < 300) return;
    lastClickRef.current = now;
    onSelect(chip);
  };

  return (
    <div className="mt-2.5">
      <div className="flex flex-wrap gap-2 items-center">
        {safeChips.map((chip, index) => (
          <button
            key={chip}
            onClick={() => handleClick(chip)}
            className="
              px-3.5 py-1.5 text-[13px] font-medium rounded-full
              bg-sage-soft text-sage-strong border border-sage/40
              hover:bg-sage/20 hover:border-sage-strong/40
              active:scale-95
              transition-all duration-150 ease-out
              min-h-[36px] leading-tight text-left
              opacity-0 animate-fade-in
            "
            style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'forwards' }}
          >
            {chip}
          </button>
        ))}
        {isAdaptive && (
          <div className="relative">
            <button
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onFocus={() => setShowTooltip(true)}
              onBlur={() => setShowTooltip(false)}
              className="p-1 text-app-muted hover:text-app-text transition-colors opacity-0 animate-fade-in"
              style={{ animationDelay: `${safeChips.length * 60 + 30}ms`, animationFillMode: 'forwards' }}
              aria-label="Por qué estas sugerencias"
            >
              <Info size={13} />
            </button>
            {showTooltip && (
              <div className="
                absolute bottom-full mb-2 right-0
                bg-app-surface border border-app-border
                rounded-xl shadow-lg px-3 py-2
                text-[12px] text-app-muted leading-snug
                w-[220px] z-30
              ">
                {tooltipCopy ?? 'Sugerencias basadas en cómo suena tu mensaje (puedes ignorarlas).'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
