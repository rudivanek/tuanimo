import { useAuth } from '../contexts/AuthContext';
import { LogOut, Volume2, VolumeX } from 'lucide-react';
import { TokenUsageSection } from '../components/TokenUsageSection';
import { useSoundSettings } from '../hooks/useSoundSettings';

function Toggle({
  checked,
  onChange,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-6 w-10 flex-shrink-0 rounded-full border-2 border-transparent',
        'transition-colors duration-200 ease-in-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-strong/40 focus-visible:ring-offset-2',
        checked ? 'bg-sage-strong' : 'bg-app-border',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow',
          'transform transition duration-200 ease-in-out',
          checked ? 'translate-x-4' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  );
}

function SettingRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 py-3 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-app-text">{label}</p>
        {description && <p className="text-[12px] text-app-muted mt-0.5 leading-snug">{description}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export function SettingsPage() {
  const { signOut, user } = useAuth();
  const { settings, update, isSaving } = useSoundSettings();

  return (
    <div className="bg-app-bg p-5 space-y-5" style={{ minHeight: 'calc(100dvh - var(--chrome-total))', paddingBottom: 'calc(var(--nav-total) + 1.5rem)' }}>
      <div className="max-w-2xl mx-auto space-y-5">
        <h1 className="text-2xl font-semibold text-app-text">Configuración</h1>

        <TokenUsageSection />

        <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5">
          <div className="flex items-center gap-2 mb-1">
            {settings.soundEnabled
              ? <Volume2 size={16} className="text-sage-strong flex-shrink-0" />
              : <VolumeX size={16} className="text-app-muted flex-shrink-0" />
            }
            <h2 className="text-[15px] font-semibold text-app-text">Sonidos</h2>
            {isSaving && (
              <span className="ml-auto text-[11px] text-app-muted">Guardando…</span>
            )}
          </div>
          <p className="text-[12.5px] text-app-muted mb-4 leading-snug">
            Suaves tonos que acompañan las respuestas de Elena. Puedes desactivarlos en cualquier momento.
          </p>

          <div className="divide-y divide-app-border">
            <SettingRow
              label="Sonidos de Elena"
              description="Activa o desactiva todos los sonidos de la app"
              checked={settings.soundEnabled}
              onChange={(v) => update({ soundEnabled: v })}
            />
            <SettingRow
              label="Sonido al responder"
              description="Un suave tono cuando Elena termina de responder"
              checked={settings.soundResponseEnabled}
              onChange={(v) => update({ soundResponseEnabled: v })}
              disabled={!settings.soundEnabled}
            />
            <SettingRow
              label="Sonido al sugerir Diario"
              description="Doble tono cuando aparece la sugerencia de crear una entrada"
              checked={settings.soundJournalSuggestionEnabled}
              onChange={(v) => update({ soundJournalSuggestionEnabled: v })}
              disabled={!settings.soundEnabled}
            />
            <SettingRow
              label="Sonido al guardar Diario"
              description="Acorde suave al guardar una entrada del diario"
              checked={settings.soundJournalSavedEnabled}
              onChange={(v) => update({ soundJournalSavedEnabled: v })}
              disabled={!settings.soundEnabled}
            />
          </div>
        </div>

        <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5">
          <h2 className="text-[15px] font-semibold text-app-text mb-4">Cuenta</h2>
          {user?.email && (
            <div className="mb-4 pb-4 border-b border-app-border">
              <p className="text-[11px] font-medium text-app-muted uppercase tracking-wider mb-1">Sesión iniciada como</p>
              <p className="text-sm text-app-text font-medium">{user.email}</p>
            </div>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-2 px-5 py-2.5 bg-danger text-white rounded-12 hover:opacity-90 transition-opacity text-sm font-medium"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
