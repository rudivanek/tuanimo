type GuidedStarterPromptProps = {
  prompt: string;
  onInsert: (text: string) => void;
  onDismiss: () => void;
  onTryAnother: () => void;
};

export function GuidedStarterPrompt({ prompt, onInsert, onDismiss, onTryAnother }: GuidedStarterPromptProps) {
  return (
    <div className="mb-4 px-1 py-2">
      <button
        onClick={() => onInsert(prompt)}
        className="text-[13.5px] text-app-muted hover:text-app-text/70 italic text-left transition-colors leading-snug w-full"
      >
        {prompt}
      </button>
      <div className="flex items-center gap-3 mt-1.5">
        <button
          onClick={onTryAnother}
          className="text-[11.5px] text-app-muted/50 hover:text-app-muted transition-colors"
        >
          Otra pregunta
        </button>
        <span className="text-app-muted/25 text-[10px]">·</span>
        <button
          onClick={onDismiss}
          className="text-[11.5px] text-app-muted/50 hover:text-app-muted transition-colors"
          aria-label="Cerrar sugerencia"
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}
