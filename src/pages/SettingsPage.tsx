import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Volume2, VolumeX, Bell, RefreshCw } from 'lucide-react';
import { TokenUsageSection } from '../components/TokenUsageSection';
import { useSoundSettings } from '../hooks/useSoundSettings';
import { supabase } from '../lib/supabaseClient';

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
  saving,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  saving?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 py-3 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-app-text">{label}</p>
        {description && <p className="text-[12px] text-app-muted mt-0.5 leading-snug">{description}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {saving && <RefreshCw size={11} className="animate-spin text-app-muted" />}
        <Toggle checked={checked} onChange={onChange} disabled={disabled || saving} />
      </div>
    </div>
  );
}

// ─── Email notification preferences ──────────────────────────────────────────

interface EmailPrefs {
  email_opt_in: boolean;
  email_reminders_opt_in: boolean;
  email_insights_opt_in: boolean;
  email_weekly_insight_opt_in: boolean;
}

function useEmailPrefs() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<EmailPrefs>({
    email_opt_in: true,
    email_reminders_opt_in: true,
    email_insights_opt_in: true,
    email_weekly_insight_opt_in: true,
  });
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('email_opt_in, email_reminders_opt_in, email_insights_opt_in, email_weekly_insight_opt_in')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPrefs({
            email_opt_in: data.email_opt_in ?? true,
            email_reminders_opt_in: data.email_reminders_opt_in ?? true,
            email_insights_opt_in: data.email_insights_opt_in ?? true,
            email_weekly_insight_opt_in: data.email_weekly_insight_opt_in ?? true,
          });
        }
        setLoading(false);
      });
  }, [user]);

  async function update(field: keyof EmailPrefs, value: boolean) {
    if (!user) return;
    setSavingField(field);
    setPrefs((prev) => ({ ...prev, [field]: value }));
    await supabase
      .from('profiles')
      .update({ [field]: value })
      .eq('id', user.id);
    setSavingField(null);
  }

  return { prefs, loading, savingField, update };
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { signOut, user } = useAuth();
  const { settings, update: updateSound, isSaving: isSavingSound } = useSoundSettings();
  const { prefs, loading: loadingPrefs, savingField, update: updateEmailPref } = useEmailPrefs();

  return (
    <div className="bg-app-bg p-5 space-y-5" style={{ minHeight: 'calc(100dvh - var(--chrome-total))', paddingBottom: 'calc(var(--nav-total) + 1.5rem)' }}>
      <div className="max-w-2xl mx-auto space-y-5">
        <h1 className="text-2xl font-semibold text-app-text">Configuración</h1>

        <TokenUsageSection />

        {/* ── Sound settings ── */}
        <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5">
          <div className="flex items-center gap-2 mb-1">
            {settings.soundEnabled
              ? <Volume2 size={16} className="text-sage-strong flex-shrink-0" />
              : <VolumeX size={16} className="text-app-muted flex-shrink-0" />
            }
            <h2 className="text-[15px] font-semibold text-app-text">Sonidos</h2>
            {isSavingSound && (
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
              onChange={(v) => updateSound({ soundEnabled: v })}
            />
            <SettingRow
              label="Sonido al responder"
              description="Un suave tono cuando Elena termina de responder"
              checked={settings.soundResponseEnabled}
              onChange={(v) => updateSound({ soundResponseEnabled: v })}
              disabled={!settings.soundEnabled}
            />
            <SettingRow
              label="Sonido al sugerir Diario"
              description="Doble tono cuando aparece la sugerencia de crear una entrada"
              checked={settings.soundJournalSuggestionEnabled}
              onChange={(v) => updateSound({ soundJournalSuggestionEnabled: v })}
              disabled={!settings.soundEnabled}
            />
            <SettingRow
              label="Sonido al guardar Diario"
              description="Acorde suave al guardar una entrada del diario"
              checked={settings.soundJournalSavedEnabled}
              onChange={(v) => updateSound({ soundJournalSavedEnabled: v })}
              disabled={!settings.soundEnabled}
            />
          </div>
        </div>

        {/* ── Email notification preferences ── */}
        <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5">
          <div className="flex items-center gap-2 mb-1">
            <Bell size={16} className="text-sage-strong flex-shrink-0" />
            <h2 className="text-[15px] font-semibold text-app-text">Notificaciones de Elena</h2>
          </div>
          <p className="text-[12.5px] text-app-muted mb-4 leading-snug">
            Elena puede escribirte por correo. Tú decides qué quieres recibir.
          </p>

          {loadingPrefs ? (
            <div className="flex items-center gap-2 py-4 text-sm text-app-muted">
              <RefreshCw size={13} className="animate-spin" /> Cargando preferencias…
            </div>
          ) : (
            <div className="divide-y divide-app-border">
              <SettingRow
                label="Todos los correos de Elena"
                description="Activa o desactiva todos los mensajes por correo"
                checked={prefs.email_opt_in}
                onChange={(v) => updateEmailPref('email_opt_in', v)}
                saving={savingField === 'email_opt_in'}
              />
              <SettingRow
                label="Recordatorios"
                description="Elena te escribe cuando llevas varios días sin pasar por aquí"
                checked={prefs.email_reminders_opt_in}
                onChange={(v) => updateEmailPref('email_reminders_opt_in', v)}
                disabled={!prefs.email_opt_in}
                saving={savingField === 'email_reminders_opt_in'}
              />
              <SettingRow
                label="Cartas de reflexión"
                description="Una carta semanal de Elena con lo que ha observado en tus conversaciones"
                checked={prefs.email_insights_opt_in}
                onChange={(v) => updateEmailPref('email_insights_opt_in', v)}
                disabled={!prefs.email_opt_in}
                saving={savingField === 'email_insights_opt_in'}
              />
              <SettingRow
                label="Reflexiones semanales"
                description="Elena te escribe cuando tiene una nueva reflexión sobre tu semana"
                checked={prefs.email_weekly_insight_opt_in}
                onChange={(v) => updateEmailPref('email_weekly_insight_opt_in', v)}
                disabled={!prefs.email_opt_in}
                saving={savingField === 'email_weekly_insight_opt_in'}
              />
            </div>
          )}
        </div>

        {/* ── Account ── */}
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
