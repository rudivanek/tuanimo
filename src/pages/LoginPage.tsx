import { useState } from 'react';
import { Eye, EyeOff, Leaf } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { Redirect } from 'wouter';

type Mode = 'login' | 'register';

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const { signIn, signUp, user, accountBlocked } = useAuth();

  if (user) return <Redirect to="/app/chat" />;

  const switchMode = (next: Mode) => {
    setMode(next);
    setMessage('');
    setIsError(false);
  };

  const handleGoogleAuth = async () => {
    setGoogleLoading(true);
    setMessage('');
    setIsError(false);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/app/chat`,
      },
    });

    if (error) {
      setIsError(true);
      setMessage(error.message || 'No se pudo continuar con Google. Intenta de nuevo.');
      setGoogleLoading(false);
    }
    // On success the browser navigates away to Google; no need to reset loading.
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setIsError(false);

    if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) {
        setIsError(true);
        setMessage(error.message || 'Error. Por favor, intenta de nuevo.');
      }
    } else {
      const { error } = await signUp(email, password, firstName, lastName);
      if (error) {
        setIsError(true);
        setMessage(error.message || 'Error al crear la cuenta. Intenta de nuevo.');
      } else {
        // Auto sign-in after successful registration
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          setIsError(false);
          setMessage('Cuenta creada. Ya puedes iniciar sesión.');
        }
      }
    }

    setLoading(false);
  };

  const focusStyle = '0 0 0 3px var(--focus)';

  const inputClass =
    'w-full px-4 py-3 rounded-12 border border-app-border bg-app-surface text-app-text placeholder:text-app-muted text-sm focus:outline-none transition';

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
          <span className="font-display text-[20px] font-semibold text-app-text">Con <em>Elena</em></span>
        </div>
        <p className="text-center text-app-muted text-sm mb-7">
          Un espacio para entenderte, sin juicios 
        </p>

        {/* Mode toggle */}
        <div className="flex rounded-12 border border-app-border overflow-hidden mb-6">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              mode === 'login'
                ? 'bg-sage-strong text-white'
                : 'bg-app-surface text-app-muted hover:text-app-text'
            }`}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              mode === 'register'
                ? 'bg-sage-strong text-white'
                : 'bg-app-surface text-app-muted hover:text-app-text'
            }`}
          >
            Crear cuenta
          </button>
        </div>

        {/* Google OAuth */}
        <button
          type="button"
          onClick={handleGoogleAuth}
          disabled={googleLoading || loading}
          className="w-full flex items-center justify-center gap-2.5 border border-sage-soft bg-app-surface hover:bg-sage-soft text-app-text font-semibold py-3 rounded-12 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          <svg className="w-[18px] h-[18px]" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.35 0-4.34-1.58-5.05-3.71H.96v2.33A9 9 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.95 10.71a5.4 5.4 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l2.99-2.33z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l2.99 2.33C4.66 5.16 6.65 3.58 9 3.58z"/>
          </svg>
          {googleLoading ? 'Conectando...' : 'Continuar con Google'}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-app-border" />
          <span className="text-xs text-app-muted">o</span>
          <div className="flex-1 h-px bg-app-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Name fields — register only */}
          {mode === 'register' && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label htmlFor="firstName" className="block text-sm font-medium text-app-text mb-1.5">
                  Nombre
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className={inputClass}
                  style={{ boxShadow: 'none' }}
                  onFocus={(e) => (e.currentTarget.style.boxShadow = focusStyle)}
                  onBlur={(e) => (e.currentTarget.style.boxShadow = 'none')}
                  placeholder="Tu nombre"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="lastName" className="block text-sm font-medium text-app-text mb-1.5">
                  Apellido
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputClass}
                  style={{ boxShadow: 'none' }}
                  onFocus={(e) => (e.currentTarget.style.boxShadow = focusStyle)}
                  onBlur={(e) => (e.currentTarget.style.boxShadow = 'none')}
                  placeholder="Tu apellido"
                />
              </div>
            </div>
          )}

          {/* Email */}
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

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-app-text mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className={`w-full pl-4 pr-11 py-3 rounded-12 border border-app-border bg-app-surface text-app-text placeholder:text-app-muted text-sm focus:outline-none transition`}
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
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full bg-sage-strong hover:bg-[#4e7260] text-white font-semibold py-3 rounded-12 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {loading
              ? 'Procesando...'
              : mode === 'login'
              ? 'Iniciar sesión'
              : 'Crear cuenta'}
          </button>
        </form>

      {(message || accountBlocked) && (
          <div
            className={`mt-4 p-3.5 rounded-12 text-sm ${
              isError
                ? 'bg-red-50 text-danger border border-red-100'
                : 'bg-sage-soft text-sage-strong border border-sage-soft'
            }`}
          >
            {message}
          </div>
        )}

        {mode === 'login' && (
          <div className="mt-4 text-center">
            <a
              href="/reset-password"
              className="text-sm text-app-muted hover:text-app-text transition-colors"
            >
              ¿Olvidaste tu contraseña?
            </a>
          </div>
        )}

        <p className="mt-4 text-xs text-center text-app-muted leading-relaxed">
          Al continuar, aceptas nuestros{' '}
          <a href="https://conelena.app/terminos-condiciones/" target="_blank" rel="noopener noreferrer" className="underline hover:text-app-text transition-colors">términos de servicio</a>
          {' '}y{' '}
          <a href="https://conelena.app/terminos-condiciones/" target="_blank" rel="noopener noreferrer" className="underline hover:text-app-text transition-colors">política de privacidad</a>
        </p>
      </div>
    </div>
  );
}
