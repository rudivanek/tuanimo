import { useState } from 'react';
import { Eye, EyeOff, Leaf } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Redirect } from 'wouter';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { signIn, user } = useAuth();

  if (user) return <Redirect to="/app/chat" />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { error } = await signIn(email, password);

    if (error) {
      setMessage(error.message || 'Error. Por favor, intenta de nuevo.');
    }

    setLoading(false);
  };

  const focusStyle = '0 0 0 3px var(--focus)';

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center p-5">
      <div className="max-w-md w-full bg-app-surface rounded-[18px] shadow-app p-8">
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 bg-sage-soft rounded-full flex items-center justify-center">
            <Leaf className="w-7 h-7 text-sage-strong" />
          </div>
        </div>

        <div className="text-center mb-2">
          <span className="text-[20px] font-semibold tracking-tight text-app-text">Tu-Animo</span>
          <span className="text-[20px] font-semibold tracking-tight text-sage-strong">.app</span>
        </div>
        <p className="text-center text-app-muted text-sm mb-8">
          Tu espacio seguro para el bienestar emocional
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              className="w-full px-4 py-3 rounded-12 border border-app-border bg-app-surface text-app-text placeholder:text-app-muted text-sm focus:outline-none transition"
              style={{ boxShadow: 'none' }}
              onFocus={(e) => e.currentTarget.style.boxShadow = focusStyle}
              onBlur={(e) => e.currentTarget.style.boxShadow = 'none'}
              placeholder="tu@email.com"
            />
          </div>

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
                className="w-full pl-4 pr-11 py-3 rounded-12 border border-app-border bg-app-surface text-app-text placeholder:text-app-muted text-sm focus:outline-none transition"
                style={{ boxShadow: 'none' }}
                onFocus={(e) => e.currentTarget.style.boxShadow = focusStyle}
                onBlur={(e) => e.currentTarget.style.boxShadow = 'none'}
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
            disabled={loading}
            className="w-full bg-sage-strong hover:bg-[#4e7260] text-white font-semibold py-3 rounded-12 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {loading ? 'Procesando...' : 'Iniciar sesión'}
          </button>
        </form>

        {message && (
          <div className={`mt-4 p-3.5 rounded-12 text-sm ${
            message.includes('Error')
              ? 'bg-red-50 text-danger border border-red-100'
              : 'bg-sage-soft text-sage-strong border border-sage-soft'
          }`}>
            {message}
          </div>
        )}

        <p className="mt-6 text-xs text-center text-app-muted leading-relaxed">
          Al continuar, aceptas nuestros términos de servicio y política de privacidad
        </p>
      </div>
    </div>
  );
}
