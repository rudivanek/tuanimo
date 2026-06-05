import { useState, useEffect } from 'react';
import { ChevronLeft, Bot, RefreshCw, Save, CheckCircle, AlertCircle } from 'lucide-react';
import { Link } from 'wouter';
import { supabase } from '../../lib/supabaseClient';

interface AiSettings {
  chat_model: string;
  history_cap_enabled: string;
  history_cap_messages: string;
  max_tokens: string;
}

const MODELS = [
  { value: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6',        note: 'Recomendado · mejor calidad' },
  { value: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5',         note: '4x más barato · calidad menor' },
  { value: 'claude-opus-4-6',            label: 'Claude Opus 4.6',          note: 'Máxima calidad · más caro' },
];

export function AISettingsPage() {
  const [settings, setSettings] = useState<AiSettings>({
    chat_model: 'claude-sonnet-4-6',
    history_cap_enabled: 'false',
    history_cap_messages: '12',
    max_tokens: '1024',
  });
  const [original, setOriginal] = useState<AiSettings | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [status, setStatus]     = useState<'idle' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    setLoading(true);
    const { data, error } = await supabase
      .from('ai_settings')
      .select('key, value');
    if (error) { setLoading(false); return; }
    const map: Record<string, string> = {};
    (data ?? []).forEach((r: { key: string; value: string }) => { map[r.key] = r.value; });
    const loaded: AiSettings = {
      chat_model:           map.chat_model           ?? 'claude-sonnet-4-6',
      history_cap_enabled:  map.history_cap_enabled  ?? 'false',
      history_cap_messages: map.history_cap_messages ?? '12',
      max_tokens:           map.max_tokens           ?? '1024',
    };
    setSettings(loaded);
    setOriginal(loaded);
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    setStatus('idle');
    const rows = Object.entries(settings).map(([key, value]) => ({ key, value }));
    const { error } = await supabase
      .from('ai_settings')
      .upsert(rows, { onConflict: 'key' });
    if (error) {
      setStatus('error');
      setErrorMsg(error.message);
    } else {
      setStatus('saved');
      setOriginal(settings);
      setTimeout(() => setStatus('idle'), 3000);
    }
    setSaving(false);
  }

  const isDirty = original && JSON.stringify(settings) !== JSON.stringify(original);
  const capEnabled = settings.history_cap_enabled === 'true';

  if (loading) {
    return (
      <div className="bg-app-bg flex items-center justify-center" style={{ minHeight: 'calc(100dvh - var(--chrome-total))' }}>
        <RefreshCw size={20} className="animate-spin text-app-muted" />
      </div>
    );
  }

  return (
    <div className="bg-app-bg p-5 space-y-5"
      style={{ minHeight: 'calc(100dvh - var(--chrome-total))', paddingBottom: 'calc(var(--nav-total) + 1.5rem)' }}>
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-start gap-4">
          <Link href="/app/admin"
            className="mt-0.5 p-2 rounded-10 bg-app-surface border border-app-border hover:border-sage-strong transition-colors text-app-muted hover:text-sage-strong">
            <ChevronLeft size={16} />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Bot size={20} className="text-sage-strong" />
              <h1 className="text-2xl font-semibold text-app-text">Configuración IA</h1>
            </div>
            <p className="text-sm text-app-muted mt-0.5">Ajusta el modelo y comportamiento de Elena en tiempo real</p>
          </div>
        </div>

        {/* Model selection */}
        <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app p-5 space-y-4">
          <div>
            <h2 className="text-[13px] font-semibold text-app-text uppercase tracking-wider mb-0.5">Modelo de IA</h2>
            <p className="text-xs text-app-muted">El modelo que Elena usa para responder. Cambiar aquí afecta inmediatamente a todos los usuarios.</p>
          </div>
          <div className="space-y-2">
            {MODELS.map(m => (
              <label key={m.value}
                className={`flex items-center gap-4 p-4 rounded-[12px] border cursor-pointer transition-colors ${
                  settings.chat_model === m.value
                    ? 'border-sage-strong bg-sage-strong/5'
                    : 'border-app-border hover:border-sage-strong/50'
                }`}>
                <input
                  type="radio"
                  name="chat_model"
                  value={m.value}
                  checked={settings.chat_model === m.value}
                  onChange={e => setSettings(s => ({ ...s, chat_model: e.target.value }))}
                  className="accent-sage-strong"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-app-text">{m.label}</p>
                  <p className="text-xs text-app-muted">{m.note}</p>
                </div>
                {settings.chat_model === m.value && (
                  <span className="text-[11px] font-semibold text-sage-strong uppercase tracking-wider">Activo</span>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* History cap */}
        <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app p-5 space-y-4">
          <div>
            <h2 className="text-[13px] font-semibold text-app-text uppercase tracking-wider mb-0.5">Historial de conversación</h2>
            <p className="text-xs text-app-muted">Limitar el historial reduce costos en sesiones largas, pero Elena recordará menos del inicio de la conversación.</p>
          </div>

          {/* Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-app-text">Limitar historial</p>
              <p className="text-xs text-app-muted mt-0.5">
                {capEnabled ? `Elena recordará los últimos ${settings.history_cap_messages} mensajes` : 'Elena recibe toda la conversación'}
              </p>
            </div>
            <button
              onClick={() => setSettings(s => ({ ...s, history_cap_enabled: s.history_cap_enabled === 'true' ? 'false' : 'true' }))}
              className={`relative w-12 h-6 rounded-full transition-colors ${capEnabled ? 'bg-sage-strong' : 'bg-app-border'}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${capEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Message count slider — only show when enabled */}
          {capEnabled && (
            <div className="space-y-2 pt-2 border-t border-app-border">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-app-text">Mensajes a recordar</label>
                <span className="text-sm font-semibold text-sage-strong">{settings.history_cap_messages}</span>
              </div>
              <input
                type="range" min="6" max="30" step="2"
                value={settings.history_cap_messages}
                onChange={e => setSettings(s => ({ ...s, history_cap_messages: e.target.value }))}
                className="w-full accent-sage-strong"
              />
              <div className="flex justify-between text-[10px] text-app-muted">
                <span>6 (más barato)</span>
                <span>30 (más contexto)</span>
              </div>
              <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-[8px]">
                <p className="text-xs text-amber-700">⚠️ Limitar el historial puede interrumpir el caché de Claude y aumentar el costo en sesiones cortas. Recomendado solo para sesiones de más de 20 mensajes.</p>
              </div>
            </div>
          )}
        </div>

        {/* Max tokens */}
        <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app p-5 space-y-4">
          <div>
            <h2 className="text-[13px] font-semibold text-app-text uppercase tracking-wider mb-0.5">Longitud máxima de respuesta</h2>
            <p className="text-xs text-app-muted">Tokens máximos que Elena puede usar en cada respuesta. Más tokens = respuestas más largas = más costo.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-app-text">Max tokens</label>
              <span className="text-sm font-semibold text-sage-strong">{settings.max_tokens}</span>
            </div>
            <input
              type="range" min="256" max="2048" step="128"
              value={settings.max_tokens}
              onChange={e => setSettings(s => ({ ...s, max_tokens: e.target.value }))}
              className="w-full accent-sage-strong"
            />
            <div className="flex justify-between text-[10px] text-app-muted">
              <span>256 (muy corto)</span>
              <span>1024 (normal)</span>
              <span>2048 (largo)</span>
            </div>
          </div>
        </div>

        {/* Status & Save */}
        {status === 'error' && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-[12px] text-sm text-red-700">
            <AlertCircle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}
        {status === 'saved' && (
          <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-[12px] text-sm text-green-700">
            <CheckCircle size={15} />
            <span>Configuración guardada. Elena ya usa los nuevos ajustes.</span>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="w-full h-11 rounded-[12px] bg-sage-strong text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </button>

        <p className="text-[11px] text-app-muted text-center pb-2">
          Los cambios aplican inmediatamente al siguiente mensaje que envíe cualquier usuario.
        </p>

      </div>
    </div>
  );
}
