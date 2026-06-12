import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Volume2, VolumeX, Bell, RefreshCw, Trash2, AlertTriangle, Brain, ChevronRight } from 'lucide-react';
import { TokenUsageSection } from '../components/TokenUsageSection';
import { useSoundSettings } from '../hooks/useSoundSettings';
import { supabase } from '../lib/supabaseClient';
import { HelpGuideButton } from '../components/HelpGuide';
import { useTour } from '../components/OnboardingTour';
import { useOnboarding, ElenaEditPresentacion } from '../components/OnboardingConversation';
import { useAdmin } from '../hooks/useAdmin';
import { deleteOwnAccount } from '../lib/adminUsers';
import { APP_VERSION } from '../lib/appVersion';

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

// ─── Delete account confirmation dialog ──────────────────────────────────────

function DeleteAccountDialog({
  onCancel,
  onConfirm,
  loading,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const [typed, setTyped] = useState('');
  const confirmed = typed.trim().toLowerCase() === 'eliminar';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-app-surface rounded-[18px] shadow-app border border-app-border w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={16} className="text-danger" />
          </div>
          <h2 className="text-[16px] font-semibold text-app-text">Eliminar cuenta</h2>
        </div>

        <p className="text-sm text-app-muted leading-relaxed mb-4">
          Esta acción es <strong className="text-app-text">permanente e irreversible</strong>. Se eliminarán todos tus chats, entradas del diario, insights y datos personales. No hay forma de recuperarlos.
        </p>

        <p className="text-[12.5px] text-app-muted mb-2">
          Escribe <span className="font-semibold text-app-text">eliminar</span> para confirmar:
        </p>
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="eliminar"
          className="w-full px-4 py-2.5 rounded-12 border border-app-border bg-app-bg text-app-text text-sm focus:outline-none focus:ring-2 focus:ring-danger/30 mb-5"
          autoComplete="off"
          autoCapitalize="none"
        />

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-12 border border-app-border text-app-text text-sm font-medium hover:bg-app-bg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={!confirmed || loading}
            className="flex-1 py-2.5 rounded-12 bg-danger text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading
              ? <><RefreshCw size={13} className="animate-spin" /> Eliminando…</>
              : <><Trash2 size={13} /> Eliminar todo</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const [, navigate] = useLocation();
  const { signOut, user } = useAuth();
  const { settings, update: updateSound, isSaving: isSavingSound } = useSoundSettings();
  const { prefs, loading: loadingPrefs, savingField, update: updateEmailPref } = useEmailPrefs();
  const { resetTour } = useTour();
  const { resetOnboarding } = useOnboarding();
  const { data: isAdmin } = useAdmin();

  const [showEditPresentation, setShowEditPresentation] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await deleteOwnAccount();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Error al eliminar cuenta');
      setDeleteLoading(false);
    }
  };

  return (
    <div className="bg-app-bg p-5 space-y-5" style={{ minHeight: 'calc(100dvh - var(--chrome-total))', paddingBottom: 'calc(var(--nav-total) + 1.5rem)' }}>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2 min-w-0">
            <h1 className="text-2xl font-semibold text-app-text">Configuración</h1>
            <span className="sm:hidden text-xs font-medium text-app-muted whitespace-nowrap">v{APP_VERSION}</span>
          </div>
          <HelpGuideButton />
        </div>

        <TokenUsageSection />

        {/* ── Memory ── */}
        <button
          onClick={() => navigate('/memory')}
          className="w-full bg-app-surface rounded-[16px] shadow-app border border-app-border p-5 flex items-center gap-3 hover:bg-app-surface/80 transition-colors text-left"
        >
          <Brain size={18} className="text-primary flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-app-text">Memoria de Elena</p>
            <p className="text-xs text-app-muted mt-0.5">Ve y elimina lo que Elena recuerda de ti</p>
          </div>
          <ChevronRight size={16} className="text-app-muted" />
        </button>

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
          <div className="flex flex-col gap-3">
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-5 py-2.5 bg-danger text-white rounded-12 hover:opacity-90 transition-opacity text-sm font-medium w-fit"
            >
              <LogOut size={16} />
              Cerrar sesión
            </button>

            <div className="pt-1 border-t border-app-border mt-1">
              <p className="text-[12px] text-app-muted mb-3 leading-snug">
                Al eliminar tu cuenta se borrarán permanentemente todos tus datos: chats, diario, insights y perfil.
              </p>
              {deleteError && (
                <p className="text-[12px] text-danger mb-3">{deleteError}</p>
              )}
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-12 border border-red-200 text-danger text-sm font-medium hover:bg-red-50 transition-colors w-fit"
              >
                <Trash2 size={14} />
                Eliminar mi cuenta
              </button>
            </div>
          </div>
        </div>

        {/* ── Onboarding tour ── */}
        <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sage-strong text-[15px]">✦</span>
            <h2 className="text-[15px] font-semibold text-app-text">Guía de introducción</h2>
          </div>
          <p className="text-[12.5px] text-app-muted mb-4 leading-snug">
            Vuelve a ver la guía que aparece la primera vez que abres la app.
          </p>
          <button
            onClick={resetTour}
            className="flex items-center gap-2 px-4 py-2 rounded-12 border border-app-border text-app-text text-sm font-medium hover:bg-app-surface-2 transition-colors"
          >
            Ver guía de introducción
          </button>
        </div>

        {/* ── Tu presentación con Elena ── */}
        <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[15px]">🌷</span>
            <h2 className="text-[15px] font-semibold text-app-text">Tu presentación con Elena</h2>
          </div>
          <p className="text-[12.5px] text-app-muted mb-4 leading-snug">
            Cuéntale a Elena algo nuevo sobre ti, corrige algo, o actualiza lo que quieres que tenga presente.
          </p>
          <button
            onClick={() => setShowEditPresentation(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-12 border border-app-border text-app-text text-sm font-medium hover:bg-app-surface-2 transition-colors"
          >
            ✏️ Actualizar mi presentación
          </button>
        </div>

        {/* ── Admin: reset Elena onboarding (only visible to admins) ── */}
        {isAdmin && (
          <div className="bg-app-surface rounded-[16px] shadow-app border border-amber-200 p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-amber-500 text-[15px]">🔧</span>
              <h2 className="text-[15px] font-semibold text-app-text">
                Bienvenida con Elena
                <span className="text-[11px] font-normal text-amber-500 ml-2">Solo admin</span>
              </h2>
            </div>
            <p className="text-[12.5px] text-app-muted mb-4 leading-snug">
              Vuelve a ver la conversación de bienvenida con Elena. La app se recargará.
            </p>
            <button
              onClick={resetOnboarding}
              className="flex items-center gap-2 px-4 py-2 rounded-12 border border-amber-200 text-amber-700 text-sm font-medium hover:bg-amber-50 transition-colors"
            >
              🌷 Repetir bienvenida con Elena
            </button>
          </div>
        )}

      </div>

      {/* ── Edit presentation modal ── */}
      {showEditPresentation && (
        <ElenaEditPresentacion onClose={() => setShowEditPresentation(false)} />
      )}

      {/* ── Delete confirmation modal ── */}
      {showDeleteDialog && (
        <DeleteAccountDialog
          onCancel={() => { setShowDeleteDialog(false); setDeleteError(null); }}
          onConfirm={handleDeleteAccount}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}
