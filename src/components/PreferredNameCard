import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

/**
 * Lets the user choose the name Elena uses.
 * Falls back to profiles.first_name when preferred_name is null.
 */
export function PreferredNameCard() {
  const { user } = useAuth();
  const [value, setValue] = useState('');
  const [fallback, setFallback] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    supabase
      .from('profiles')
      .select('preferred_name, first_name')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setValue(data?.preferred_name ?? '');
        setFallback(data?.first_name ?? '');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [user]);

  const save = async () => {
    if (!user || saving) return;
    setSaving(true);
    setSaved(false);

    const trimmed = value.trim();
    const { error } = await supabase
      .from('profiles')
      .update({ preferred_name: trimmed === '' ? null : trimmed })
      .eq('id', user.id);

    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  const placeholder = fallback || 'Tu nombre';

  return (
    <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5">
      <div className="flex items-center gap-2 mb-1">
        <UserRound size={16} className="text-sage-strong flex-shrink-0" />
        <h2 className="text-[15px] font-semibold text-app-text">¿Cómo quieres que te llame?</h2>
        {saving && <span className="ml-auto text-[11px] text-app-muted">Guardando…</span>}
        {saved && !saving && (
          <span className="ml-auto text-[11px] text-sage-strong">Guardado</span>
        )}
      </div>
      <p className="text-[12.5px] text-app-muted mb-4 leading-snug">
        Elena usará este nombre cuando te hable. Puedes cambiarlo cuando quieras.
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          disabled={loading}
          maxLength={40}
          placeholder={placeholder}
          className="flex-1 px-4 py-2.5 rounded-12 border border-app-border bg-app-surface text-app-text placeholder:text-app-muted text-sm focus:outline-none transition disabled:opacity-50"
          style={{ boxShadow: 'none' }}
          onFocus={(e) => (e.currentTarget.style.boxShadow = '0 0 0 3px var(--focus)')}
        />
      </div>

      {!loading && value.trim() === '' && fallback && (
        <p className="text-[11.5px] text-app-muted mt-2">
          Ahora te llama <span className="text-app-text">{fallback}</span>.
        </p>
      )}
    </div>
  );
}
