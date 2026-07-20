import { useState, useEffect } from 'react';
import { Leaf, Eye, EyeOff, RefreshCw, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Redirect } from 'wouter';

type Step = 'checking' | 'request' | 'sent' | 'set_new' | 'done';

export function ResetPasswordPage() {
  const [step, setStep] = useState<Step>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Supabase processes the recovery token in the URL as soon as the client
  // initialises, which happens before this lazily-loaded page mounts. That
  // means the PASSWORD_RECOVERY event has usually already fired by the time
  // we subscribe, so we cannot rely on the listener alone — we also check
  // for an active session on mount.
  useEffect(() => {
    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setStep('set_new');
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      setStep((current) => {
        // Don't override a step the user has already moved past.
        if (current !== 'checking') return current;
        return session ? 'set_new' : 'request';
      });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // ── Step 1: Request reset email ──────────────────────────────────────────
  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message || 'Error al enviar el correo. Intenta de nuevo.');
    } else {
      setStep('sent');
    }
    setLoading(false);
  };

  // ── Step 2: Set new password ──────────────────────────────────────────────
  const handleSetNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== passwordConfirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message || 'Error al actualizar la contraseña. Intenta de nuevo.');
      setLoading(false);
      return;
    }

    // Clear the recovery session so the user signs in fresh with the new
    // password, rather than being silently dropped into the app.
    await supabase.auth.signOut();
    setStep('done');
    setLoading(false);
  };

  const focusStyle = '0 0 0 3px var(--focus)';
  const inputClass = 'w-full px-4 py-3 rounded-12 border border-app-border bg-app-surface text-app-text placeholder:text-app-muted text-sm focus:outline-none transition';

  if (step === 'done') {
    return <Redirect to="/login" />;
  }

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center p-5">
      <div className="max-w-md w-full bg-app-surface rounded-[18px] shadow-app p-8">

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 bg-sage-soft rounded-full flex items-center justify-center">
            <Leaf className="w-7 h-7 text-sage-strong" />
          </div>
        </div>

        <div className="text-center mb-2">
          <span className="text-[20px] font-semibold tracking-tight text-sage-strong">Con Elena</span>
        </div>

        {/* ── Checking for a recovery session ── */}
        {step === 'checking' && (
          <div className="flex justify-center py-10">
            <RefreshCw size={20} className="animate-spin text-app-muted" />
          </div>
        )}

        {/* ── Sent confirmation ── */}
        {step === 'sent' && (
          <div className="text-center mt-6">
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-10 h-10 text-sage-strong" />
            </div>
            <p className="text-[15px] font-semibold text-app-text mb-2">Revisa tu correo</p>
            <p className="text-sm text-app-muted leading-relaxed">
              Te enviamos un enlace a <span className="font-medium text-app-text">{email}</span>. Haz clic en él para crear una nueva contraseña.
            </p>
            <p className="text-xs text-app-muted mt-4">
              ¿No llegó? Revisa tu carpeta de spam.
            </p>
          </div>
        )}

        {/* ── Request form ── */}
        {step === 'request' && (
          <>
            <p className="text-center text-app-muted text-sm mb-8">
              Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
            </p>
            <form onSubmit={handleRequest} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-app-text mb-1.5">
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={inputClass}
                  style={{ boxShadow: 'none' }}
                  onFocus={(e) => (e.currentTarget.style.boxShadow = focusStyle)}
                  onBlur={(e) => (e.currentTarget.style.boxShadow = 'none')}
                  placeholder="tu@email.com"
                />
              </div>

              {error && (
                <p className="text-sm text-danger">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-sage-strong hover:bg-[#4e7260] text-white font-semibold py-3 rounded-12 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
              >
                {loading && <RefreshCw size={14} className="animate-spin" />}
                {loading ? 'Enviando...' : 'Enviar enlace'}
              </button>

              <div className="text-center pt-1">
                <a href="/login" className="text-sm text-app-muted hover:text-app-text transition-colors">
                  Volver al inicio de sesión
                </a>
              </div>
            </form>
          </>
        )}

        {/* ── Set new password form ── */}
        {step === 'set_new' && (
          <>
            <p className="text-center text-app-muted text-sm mb-8">
              Elige una nueva contraseña para tu cuenta.
            </p>
            <form onSubmit={handleSetNew} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-app-text mb-1.5">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-4 pr-11 py-3 rounded-12 border border-app-border bg-app-surface text-app-text placeholder:text-app-muted text-sm focus:outline-none transition"
                    style={{ boxShadow: 'none' }}
                    onFocus={(e) => (e.currentTarget.style.boxShadow = focusStyle)}
                    onBlur={(e) => (e.currentTarget.style.boxShadow = 'none')}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-app-muted hover:text-app-text transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="passwordConfirm" className="block text-sm font-medium text-app-text mb-1.5">
                  Confirmar contraseña
                </label>
                <input
                  id="passwordConfirm"
                  type={showPassword ? 'text' : 'password'}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                  minLength={6}
                  className={inputClass}
                  style={{ boxShadow: 'none' }}
                  onFocus={(e) => (e.currentTarget.style.boxShadow = focusStyle)}
                  onBlur={(e) => (e.currentTarget.style.boxShadow = 'none')}
                  placeholder="Repite la contraseña"
                />
              </div>

              {error && (
                <p className="text-sm text-danger">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-sage-strong hover:bg-[#4e7260] text-white font-semibold py-3 rounded-12 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
              >
                {loading && <RefreshCw size={14} className="animate-spin" />}
                {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
              </button>
            </form>
          </>
        )}

      </div>
    </div>
  );
}


