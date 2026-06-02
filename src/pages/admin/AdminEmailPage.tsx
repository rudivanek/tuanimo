import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, Mail, Bell, Sparkles, Save, RefreshCw,
  AlertCircle, CheckCircle, ToggleLeft, ToggleRight, Users, X,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAdmin } from '../../hooks/useAdmin';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CampaignConfig {
  campaign_type: 'reminders' | 'insights';
  enabled: boolean;
  frequency_days: number;
  min_sessions: number;
  inactive_trigger_days: number;
  updated_at: string;
}

interface UserOverride {
  id: string;
  user_id: string;
  campaign_type: 'reminders' | 'insights';
  enabled: boolean | null;
  frequency_days: number | null;
  note: string | null;
  updated_at: string;
  // joined
  email?: string;
  first_name?: string | null;
}

interface AdminUser {
  id: string;
  email: string;
  first_name: string | null;
}

type SaveState = 'idle' | 'saving' | 'success' | 'error';

// ─── Constants ────────────────────────────────────────────────────────────────

const FREQUENCY_OPTIONS = [
  { value: 1,  label: 'Cada día' },
  { value: 2,  label: 'Cada 2 días' },
  { value: 3,  label: 'Cada 3 días' },
  { value: 7,  label: 'Semanal' },
  { value: 14, label: 'Cada 2 semanas' },
  { value: 30, label: 'Mensual' },
];

const INACTIVE_OPTIONS = [
  { value: 1,  label: '1 día' },
  { value: 2,  label: '2 días' },
  { value: 3,  label: '3 días' },
  { value: 7,  label: '7 días' },
  { value: 14, label: '14 días' },
  { value: 30, label: '30 días' },
];

const SESSION_OPTIONS = [
  { value: 0, label: 'Sin mínimo' },
  { value: 1, label: '1 sesión' },
  { value: 2, label: '2 sesiones' },
  { value: 3, label: '3 sesiones' },
  { value: 5, label: '5 sesiones' },
];

// ─── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchConfigs(): Promise<CampaignConfig[]> {
  const { data, error } = await supabase
    .from('email_campaign_config')
    .select('*')
    .order('campaign_type');
  if (error) throw error;
  return (data ?? []) as CampaignConfig[];
}

async function fetchOverrides(): Promise<UserOverride[]> {
  const { data, error } = await supabase
    .from('email_user_overrides')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as UserOverride[];
}

async function fetchAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name')
    .eq('is_disabled', false)
    .is('deleted_at', null)
    .order('first_name');
  if (error) throw error;

  // get emails from auth via admin RPC — use existing listUsers pattern
  // We'll return profiles only and show user_id; email lookup is best-effort
  return (data ?? []).map((r: { id: string; first_name: string | null }) => ({
    id: r.id,
    email: r.id, // placeholder — overrides table stores user_id
    first_name: r.first_name,
  }));
}

async function saveConfig(
  campaign_type: string,
  patch: Partial<CampaignConfig>
): Promise<void> {
  const { error } = await supabase
    .from('email_campaign_config')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('campaign_type', campaign_type);
  if (error) throw error;
}

async function upsertOverride(
  user_id: string,
  campaign_type: string,
  patch: { enabled?: boolean | null; frequency_days?: number | null; note?: string | null }
): Promise<void> {
  const { error } = await supabase
    .from('email_user_overrides')
    .upsert(
      { user_id, campaign_type, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,campaign_type' }
    );
  if (error) throw error;
}

async function deleteOverride(id: string): Promise<void> {
  const { error } = await supabase
    .from('email_user_overrides')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SelectField({
  label, value, options, onChange, disabled,
}: {
  label: string;
  value: number;
  options: { value: number; label: string }[];
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 text-[12px] font-semibold text-app-muted uppercase tracking-wider">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full px-3 py-2 rounded-10 border border-app-border bg-app-bg text-app-text text-sm focus:outline-none focus:border-sage-strong focus:ring-1 focus:ring-sage-strong/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function Toggle({
  enabled, onChange, disabled,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-10 border text-sm font-medium transition-all ${
        enabled
          ? 'bg-sage-strong/10 border-sage-strong/30 text-sage-strong'
          : 'bg-app-bg border-app-border text-app-muted'
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {enabled
        ? <ToggleRight size={16} />
        : <ToggleLeft size={16} />}
      {enabled ? 'Activo' : 'Pausado'}
    </button>
  );
}

// ─── Global config card ────────────────────────────────────────────────────────

function CampaignCard({
  config,
  onSaved,
}: {
  config: CampaignConfig;
  onSaved: () => void;
}) {
  const isReminders = config.campaign_type === 'reminders';
  const Icon = isReminders ? Bell : Sparkles;

  const [draft, setDraft] = useState<CampaignConfig>(config);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const isDirty = JSON.stringify(draft) !== JSON.stringify(config);

  async function handleSave() {
    setSaveState('saving');
    try {
      await saveConfig(config.campaign_type, {
        enabled: draft.enabled,
        frequency_days: draft.frequency_days,
        min_sessions: draft.min_sessions,
        inactive_trigger_days: draft.inactive_trigger_days,
      });
      setSaveState('success');
      onSaved();
      setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  }

  return (
    <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-12 bg-sage-strong/10 flex items-center justify-center flex-shrink-0">
            <Icon size={16} className="text-sage-strong" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-app-text">
              {isReminders ? 'Recordatorios' : 'Insights'}
            </p>
            <p className="text-[12px] text-app-muted">
              {isReminders
                ? 'Emails de reactivación cuando el usuario está inactivo'
                : 'Cartas de Elena con reflexiones personalizadas'}
            </p>
          </div>
        </div>
        <Toggle
          enabled={draft.enabled}
          onChange={(v) => setDraft((d) => ({ ...d, enabled: v }))}
        />
      </div>

      {/* Fields */}
      <div className={`grid gap-4 ${isReminders ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <SelectField
          label="Frecuencia"
          value={draft.frequency_days}
          options={FREQUENCY_OPTIONS}
          onChange={(v) => setDraft((d) => ({ ...d, frequency_days: v }))}
          disabled={!draft.enabled}
        />
        <SelectField
          label="Sesiones mínimas"
          value={draft.min_sessions}
          options={SESSION_OPTIONS}
          onChange={(v) => setDraft((d) => ({ ...d, min_sessions: v }))}
          disabled={!draft.enabled}
        />
        {isReminders && (
          <SelectField
            label="Inactivo desde"
            value={draft.inactive_trigger_days}
            options={INACTIVE_OPTIONS}
            onChange={(v) => setDraft((d) => ({ ...d, inactive_trigger_days: v }))}
            disabled={!draft.enabled}
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-[11px] text-app-muted">
          Última edición: {new Date(config.updated_at).toLocaleDateString('es-MX', {
            day: '2-digit', month: 'short', year: 'numeric',
          })}
        </p>
        <div className="flex items-center gap-2">
          {saveState === 'error' && (
            <span className="flex items-center gap-1 text-[12px] text-red-500">
              <AlertCircle size={13} /> Error al guardar
            </span>
          )}
          {saveState === 'success' && (
            <span className="flex items-center gap-1 text-[12px] text-sage-strong">
              <CheckCircle size={13} /> Guardado
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!isDirty || saveState === 'saving'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-10 text-xs font-medium bg-sage-strong text-white hover:bg-sage-strong/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {saveState === 'saving'
              ? <RefreshCw size={13} className="animate-spin" />
              : <Save size={13} />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add override modal ────────────────────────────────────────────────────────

function AddOverrideModal({
  users,
  existingOverrides,
  onAdd,
  onClose,
}: {
  users: AdminUser[];
  existingOverrides: UserOverride[];
  onAdd: (userId: string, campaignType: string, note: string) => Promise<void>;
  onClose: () => void;
}) {
  const [userId, setUserId] = useState('');
  const [campaignType, setCampaignType] = useState<'reminders' | 'insights'>('reminders');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const alreadyExists = existingOverrides.some(
    (o) => o.user_id === userId && o.campaign_type === campaignType
  );

  async function handleAdd() {
    if (!userId || alreadyExists) return;
    setSaving(true);
    try {
      await onAdd(userId, campaignType, note);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-app-surface border border-app-border rounded-[20px] shadow-xl w-full max-w-md space-y-5 p-6">
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-semibold text-app-text">Agregar excepción</p>
          <button onClick={onClose} className="p-1 rounded-8 text-app-muted hover:text-app-text transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[12px] font-semibold text-app-muted uppercase tracking-wider">Usuario</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-3 py-2 rounded-10 border border-app-border bg-app-bg text-app-text text-sm focus:outline-none focus:border-sage-strong focus:ring-1 focus:ring-sage-strong/30 transition-colors"
            >
              <option value="">Selecciona un usuario…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.first_name ?? 'Sin nombre'} — {u.id.slice(0, 8)}…
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-semibold text-app-muted uppercase tracking-wider">Campaña</label>
            <div className="flex gap-2">
              {(['reminders', 'insights'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setCampaignType(t)}
                  className={`flex-1 py-2 rounded-10 border text-sm font-medium transition-all ${
                    campaignType === t
                      ? 'bg-sage-strong/10 border-sage-strong/30 text-sage-strong'
                      : 'bg-app-bg border-app-border text-app-muted hover:border-sage-strong/30'
                  }`}
                >
                  {t === 'reminders' ? 'Recordatorios' : 'Insights'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-semibold text-app-muted uppercase tracking-wider">Nota (opcional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ej: esposa — prueba diaria"
              className="w-full px-3 py-2 rounded-10 border border-app-border bg-app-bg text-app-text text-sm focus:outline-none focus:border-sage-strong focus:ring-1 focus:ring-sage-strong/30 transition-colors"
            />
          </div>

          {alreadyExists && (
            <p className="text-[12px] text-amber-600 flex items-center gap-1">
              <AlertCircle size={13} /> Ya existe una excepción para este usuario y campaña.
            </p>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-10 border border-app-border text-sm text-app-muted hover:text-app-text transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleAdd}
            disabled={!userId || alreadyExists || saving}
            className="flex-1 py-2 rounded-10 bg-sage-strong text-white text-sm font-medium hover:bg-sage-strong/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {saving ? 'Agregando…' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Override row ─────────────────────────────────────────────────────────────

function OverrideRow({
  override,
  globalConfig,
  onChanged,
  onDeleted,
}: {
  override: UserOverride;
  globalConfig: CampaignConfig | undefined;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [enabled, setEnabled] = useState<boolean | null>(override.enabled);
  const [freqDays, setFreqDays] = useState<number | null>(override.frequency_days);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const effectiveEnabled = enabled ?? globalConfig?.enabled ?? true;
  const effectiveFreq = freqDays ?? globalConfig?.frequency_days ?? 7;

  const isDirty =
    enabled !== override.enabled || freqDays !== override.frequency_days;

  async function handleSave() {
    setSaving(true);
    try {
      await upsertOverride(override.user_id, override.campaign_type, {
        enabled,
        frequency_days: freqDays,
        note: override.note,
      });
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteOverride(override.id);
      onDeleted();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-12 bg-app-bg border border-app-border">
      {/* User info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-app-text truncate">
          {override.first_name ?? 'Usuario'}{' '}
          <span className="text-app-muted font-normal text-[12px]">
            {override.user_id.slice(0, 8)}…
          </span>
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
            override.campaign_type === 'reminders'
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : 'bg-sage-strong/10 text-sage-strong border border-sage-strong/20'
          }`}>
            {override.campaign_type === 'reminders' ? 'Recordatorios' : 'Insights'}
          </span>
          {override.note && (
            <span className="text-[11px] text-app-muted truncate">{override.note}</span>
          )}
        </div>
      </div>

      {/* Toggle */}
      <button
        onClick={() => setEnabled(enabled === null ? !effectiveEnabled : enabled ? false : null)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-8 border text-[12px] font-medium transition-all flex-shrink-0 ${
          effectiveEnabled
            ? 'bg-sage-strong/10 border-sage-strong/30 text-sage-strong'
            : 'bg-app-surface border-app-border text-app-muted'
        } ${enabled === null ? 'opacity-60' : ''}`}
        title={enabled === null ? 'Hereda configuración global' : ''}
      >
        {effectiveEnabled ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
        {effectiveEnabled ? 'On' : 'Off'}
        {enabled === null && <span className="text-[10px] opacity-60">*</span>}
      </button>

      {/* Frequency */}
      <select
        value={freqDays ?? ''}
        onChange={(e) => setFreqDays(e.target.value === '' ? null : Number(e.target.value))}
        className="px-2 py-1 rounded-8 border border-app-border bg-app-surface text-app-text text-[12px] focus:outline-none focus:border-sage-strong transition-colors"
        title={freqDays === null ? 'Hereda configuración global' : ''}
      >
        <option value="">Global ({globalConfig?.frequency_days ?? '?'}d)</option>
        {FREQUENCY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Save */}
      {isDirty && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="p-1.5 rounded-8 bg-sage-strong/10 text-sage-strong hover:bg-sage-strong/20 disabled:opacity-40 transition-all flex-shrink-0"
          title="Guardar cambios"
        >
          {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
        </button>
      )}

      {/* Delete */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="p-1.5 rounded-8 text-app-muted hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition-all flex-shrink-0"
        title="Eliminar excepción"
      >
        {deleting ? <RefreshCw size={13} className="animate-spin" /> : <X size={13} />}
      </button>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function AdminEmailPage() {
  const { data: isAdmin } = useAdmin();
  const qc = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: configs = [], isFetching: configFetching, isError: configError, refetch: refetchConfigs } =
    useQuery<CampaignConfig[]>({ queryKey: ['admin-email-configs'], queryFn: fetchConfigs, staleTime: 30_000 });

  const { data: overrides = [], isFetching: overrideFetching, isError: overrideError, refetch: refetchOverrides } =
    useQuery<UserOverride[]>({ queryKey: ['admin-email-overrides'], queryFn: fetchOverrides, staleTime: 30_000 });

  const { data: users = [] } =
    useQuery<AdminUser[]>({ queryKey: ['admin-users-list'], queryFn: fetchAdminUsers, staleTime: 60_000 });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-email-configs'] });
    qc.invalidateQueries({ queryKey: ['admin-email-overrides'] });
  };

  if (!isAdmin) {
    return (
      <div className="bg-app-bg p-5 flex items-center justify-center" style={{ minHeight: 'calc(100dvh - var(--chrome-total))' }}>
        <p className="text-sm text-app-muted">Acceso restringido.</p>
      </div>
    );
  }

  const isFetching = configFetching || overrideFetching;
  const hasError = configError || overrideError;

  const getConfig = (type: string) => configs.find((c) => c.campaign_type === type);

  return (
    <div
      className="bg-app-bg p-5 space-y-6"
      style={{
        minHeight: 'calc(100dvh - var(--chrome-total))',
        paddingBottom: 'calc(var(--nav-total) + 1.5rem)',
      }}
    >
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex items-center gap-1 text-sm text-app-muted hover:text-app-text transition-colors">
              <ChevronLeft size={16} /> Admin
            </Link>
          </div>
          <button
            onClick={() => { refetchConfigs(); refetchOverrides(); }}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-10 text-xs font-medium text-app-muted hover:text-app-text border border-app-border hover:border-sage-strong transition-all"
          >
            <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-12 bg-sage-strong/10 flex items-center justify-center">
            <Mail size={18} className="text-sage-strong" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-app-text">Campañas de Email</h1>
            <p className="text-sm text-app-muted">Configura frecuencia y excepciones por usuario</p>
          </div>
        </div>

        {hasError && (
          <div className="flex items-center gap-2 p-3 rounded-12 bg-red-50 border border-red-200 text-red-700 text-sm">
            <AlertCircle size={15} /> Error al cargar configuración. Intenta actualizar.
          </div>
        )}

        {/* ── Global config ── */}
        <div className="space-y-3">
          <p className="text-[12px] font-semibold text-app-muted uppercase tracking-wider px-1">
            Configuración global
          </p>
          {configs.length === 0 && !configFetching ? (
            <p className="text-sm text-app-muted px-1">No hay configuración disponible. Ejecuta la migración primero.</p>
          ) : (
            configs.map((config) => (
              <CampaignCard key={config.campaign_type} config={config} onSaved={invalidate} />
            ))
          )}
        </div>

        {/* ── Per-user overrides ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div>
              <p className="text-[12px] font-semibold text-app-muted uppercase tracking-wider">
                Excepciones por usuario
              </p>
              <p className="text-[11px] text-app-muted mt-0.5">
                Para pruebas con familia y amigos. * = hereda global.
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-10 text-xs font-medium bg-sage-strong/10 text-sage-strong border border-sage-strong/20 hover:bg-sage-strong/20 transition-all"
            >
              <Users size={13} /> Agregar
            </button>
          </div>

          {overrides.length === 0 ? (
            <div className="p-6 rounded-[16px] border border-dashed border-app-border text-center">
              <p className="text-sm text-app-muted">Sin excepciones. Agrega usuarios de prueba arriba.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {overrides.map((ov) => (
                <OverrideRow
                  key={ov.id}
                  override={{ ...ov, first_name: users.find((u) => u.id === ov.user_id)?.first_name ?? null }}
                  globalConfig={getConfig(ov.campaign_type)}
                  onChanged={invalidate}
                  onDeleted={invalidate}
                />
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="p-4 rounded-12 bg-app-surface border border-app-border space-y-1.5">
          <p className="text-[12px] font-semibold text-app-text">Cómo funciona</p>
          <p className="text-[12px] text-app-muted leading-relaxed">
            <strong className="text-app-text">Recordatorios</strong> se envían cuando el usuario lleva N días inactivo. Se repiten con la frecuencia configurada mientras el usuario siga inactivo.
          </p>
          <p className="text-[12px] text-app-muted leading-relaxed">
            <strong className="text-app-text">Insights</strong> se envían a usuarios con sesiones suficientes, generados por Elena con datos reales del usuario. No dependen de inactividad.
          </p>
          <p className="text-[12px] text-app-muted leading-relaxed">
            Las excepciones por usuario sobrescriben solo los campos que defines. Los campos vacíos (*) heredan la configuración global.
          </p>
        </div>

      </div>

      {showAddModal && (
        <AddOverrideModal
          users={users}
          existingOverrides={overrides}
          onAdd={async (userId, campaignType, note) => {
            await upsertOverride(userId, campaignType, { note: note || null, enabled: null, frequency_days: null });
            invalidate();
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
