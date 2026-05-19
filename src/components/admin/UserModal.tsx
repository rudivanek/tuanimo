import { useState, useEffect } from 'react';
import { X, User, Zap, AlertCircle, Loader2, Mail, Lock, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { AdminUser, upsertUserProfile, createUser, updateUserPassword } from '../../lib/adminUsers';

interface UserModalProps {
  mode: 'create' | 'edit';
  user?: AdminUser;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  email: string;
  first_name: string;
  last_name: string;
  plan_key: string;
  is_disabled: boolean;
  password: string;
  showPassword: boolean;
}

const PLANS: { key: string; label: string; daily: number; monthly: number }[] = [
  { key: 'starter', label: 'Starter', daily: 50_000, monthly: 500_000 },
  { key: 'pro',     label: 'Pro',     daily: 200_000, monthly: 2_000_000 },
  { key: 'power',   label: 'Power',   daily: 500_000, monthly: 5_000_000 },
];

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function UserModal({ mode, user, onClose, onSaved }: UserModalProps) {
  const defaultPlan = (user as AdminUser & { plan_key?: string })?.plan_key ?? 'starter';

  const [form, setForm] = useState<FormState>({
    email: '',
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    plan_key: defaultPlan,
    is_disabled: user?.is_disabled ?? false,
    password: '',
    showPassword: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const emailValid = form.email.trim().includes('@');
  const passwordProvided = form.password.length > 0;
  const passwordValid = !passwordProvided || form.password.length >= 8;
  const firstNameTrimmed = form.first_name.trim();
  const lastNameTrimmed = form.last_name.trim();
  const firstNameValid = firstNameTrimmed === '' || (firstNameTrimmed.length >= 1 && firstNameTrimmed.length <= 80);
  const lastNameValid = lastNameTrimmed.length <= 120;

  const isValid =
    (mode === 'edit' || emailValid) &&
    !!form.plan_key &&
    passwordValid &&
    firstNameValid &&
    lastNameValid;

  const selectedPlan = PLANS.find(p => p.key === form.plan_key) ?? PLANS[0];

  const handleSubmit = async () => {
    if (!isValid) return;
    setSaving(true);
    setError('');
    try {
      if (mode === 'create') {
        await createUser({
          email: form.email.trim().toLowerCase(),
          first_name: firstNameTrimmed,
          last_name: lastNameTrimmed,
          plan_key: form.plan_key,
          ...(passwordProvided ? { password: form.password } : {}),
        });
      } else {
        await upsertUserProfile({
          user_id: user!.id,
          first_name: firstNameTrimmed || null,
          last_name: lastNameTrimmed || null,
          plan_key: form.plan_key,
          is_disabled: form.is_disabled,
        });
        if (passwordProvided) {
          await updateUserPassword(user!.id, form.password);
        }
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-md bg-app-surface rounded-t-[24px] sm:rounded-[20px] shadow-2xl border border-app-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-10 bg-sage-strong/10 flex items-center justify-center">
              <User size={15} className="text-sage-strong" />
            </div>
            <h2 className="text-[15px] font-semibold text-app-text">
              {mode === 'create' ? 'Añadir usuario' : 'Editar usuario'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-10 text-app-muted hover:text-app-text hover:bg-app-bg transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {mode === 'create' && (
            <div>
              <label className="block text-[11px] font-semibold text-app-muted uppercase tracking-wider mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Mail size={11} />
                  Email de acceso
                </span>
              </label>
              <input
                type="email"
                placeholder="usuario@ejemplo.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full h-10 px-3 rounded-10 bg-app-bg border border-app-border text-sm text-app-text placeholder:text-app-muted/50 focus:outline-none focus:border-sage-strong transition-colors"
                autoFocus
              />
            </div>
          )}

          {mode === 'edit' && user && (
            <div className="px-3 py-2.5 rounded-10 bg-app-bg border border-app-border">
              <p className="text-[11px] text-app-muted uppercase tracking-wider font-medium mb-0.5">Email</p>
              <p className="text-sm text-app-text font-medium">{user.email}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-app-muted uppercase tracking-wider mb-1.5">
                Nombre
              </label>
              <input
                type="text"
                placeholder="Nombre"
                value={form.first_name}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                maxLength={80}
                className={`w-full h-10 px-3 rounded-10 bg-app-bg border text-sm text-app-text placeholder:text-app-muted/50 focus:outline-none focus:border-sage-strong transition-colors ${
                  !firstNameValid ? 'border-red-400' : 'border-app-border'
                }`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-app-muted uppercase tracking-wider mb-1.5">
                Apellido
              </label>
              <input
                type="text"
                placeholder="Apellido"
                value={form.last_name}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                maxLength={120}
                className={`w-full h-10 px-3 rounded-10 bg-app-bg border text-sm text-app-text placeholder:text-app-muted/50 focus:outline-none focus:border-sage-strong transition-colors ${
                  !lastNameValid ? 'border-red-400' : 'border-app-border'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-app-muted uppercase tracking-wider mb-1.5">
              <span className="flex items-center gap-1.5">
                <Zap size={11} />
                Plan
              </span>
            </label>
            <div className="relative">
              <select
                value={form.plan_key}
                onChange={(e) => setForm((f) => ({ ...f, plan_key: e.target.value }))}
                className="w-full h-10 pl-3 pr-8 rounded-10 bg-app-bg border border-app-border text-sm text-app-text focus:outline-none focus:border-sage-strong transition-colors appearance-none cursor-pointer"
              >
                {PLANS.map(p => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-app-muted pointer-events-none" />
            </div>
            <div className="mt-1.5 flex gap-4">
              <span className="text-[11px] text-app-muted">
                Diario: <span className="font-medium text-app-text">{formatTokens(selectedPlan.daily)}</span>
              </span>
              <span className="text-[11px] text-app-muted">
                Mensual: <span className="font-medium text-app-text">{formatTokens(selectedPlan.monthly)}</span>
              </span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-app-muted uppercase tracking-wider mb-1.5">
              <span className="flex items-center gap-1.5">
                <Lock size={11} />
                {mode === 'create' ? 'Contraseña' : 'Nueva contraseña'}
              </span>
            </label>
            <div className="relative">
              <input
                type={form.showPassword ? 'text' : 'password'}
                placeholder={mode === 'create' ? 'Opcional — mínimo 8 caracteres' : 'Dejar vacío para no cambiarla'}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className={`w-full h-10 pl-3 pr-10 rounded-10 bg-app-bg border text-sm text-app-text placeholder:text-app-muted/50 focus:outline-none focus:border-sage-strong transition-colors ${
                  passwordProvided && !passwordValid
                    ? 'border-red-400'
                    : 'border-app-border'
                }`}
              />
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, showPassword: !f.showPassword }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-app-muted hover:text-app-text transition-colors"
                tabIndex={-1}
              >
                {form.showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {passwordProvided && !passwordValid && (
              <p className="text-[11px] text-red-500 mt-1.5">Mínimo 8 caracteres</p>
            )}
            {mode === 'create' && !passwordProvided && (
              <p className="text-[11px] text-app-muted mt-1.5 leading-relaxed">
                Si no se especifica, el usuario deberá establecer su contraseña por correo.
              </p>
            )}
          </div>

          {mode === 'edit' && (
            <div className="flex items-center justify-between py-3 px-3.5 rounded-10 bg-app-bg border border-app-border">
              <div>
                <p className="text-sm font-medium text-app-text">Cuenta deshabilitada</p>
                <p className="text-[11px] text-app-muted mt-0.5">El usuario no podrá acceder si está deshabilitado</p>
              </div>
              <button
                onClick={() => setForm((f) => ({ ...f, is_disabled: !f.is_disabled }))}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
                  form.is_disabled ? 'bg-danger' : 'bg-app-border'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                    form.is_disabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 bg-red-50 border border-red-200 rounded-10 text-sm text-red-700">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-app-border">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-10 bg-app-bg border border-app-border text-sm font-medium text-app-muted hover:text-app-text hover:border-app-text/20 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || saving}
            className="flex-1 h-10 rounded-10 bg-sage-strong text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving
              ? mode === 'create' ? 'Creando...' : 'Guardando...'
              : mode === 'create' ? 'Crear usuario' : 'Guardar'
            }
          </button>
        </div>
      </div>
    </div>
  );
}
