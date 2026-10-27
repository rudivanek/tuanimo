// Voice beta — admin chooses Elena's voice and model (ai_settings.tts_voice_id / tts_model).
// Saved on its own, so it never touches the chat-model settings above it.
// Who hears the voice is set per user in Usuarios → "Voz (beta)".
import { useEffect, useState } from 'react';
import { Volume2, RefreshCw, Save, CheckCircle, AlertCircle, Play } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { listElenaVoices, previewElenaVoice } from '../../lib/elenaVoice';

const TTS_MODELS = [
  { value: 'eleven_multilingual_v2', label: 'Multilingual v2', note: 'Más natural y cálido · ~1 crédito por carácter' },
  { value: 'eleven_flash_v2_5',      label: 'Flash v2.5',      note: 'Más rápido · ~0.5 créditos por carácter' },
  { value: 'eleven_v3',              label: 'Eleven v3',       note: 'Más expresivo' },
];

const SAMPLE =
  'Le escribiste, aunque llevabas semanas dándole vueltas. Eso ya es tuyo, conteste o no. ¿Cómo te sentiste al mandarlo?';

type Voice = { voice_id: string; name: string; category?: string; labels?: Record<string, string> };

export function ElenaVoiceSettings() {
  const [voices, setVoices]     = useState<Voice[]>([]);
  const [voiceId, setVoiceId]   = useState('');
  const [model, setModel]       = useState('eleven_multilingual_v2');
  const [customModel, setCustomModel] = useState('');
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [status, setStatus]     = useState<'idle' | 'saved' | 'error'>('idle');
  const [message, setMessage]   = useState('');

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setLoadError('');
    const { data } = await supabase.from('ai_settings').select('key, value').in('key', ['tts_voice_id', 'tts_model']);
    const map: Record<string, string> = {};
    (data ?? []).forEach((r: { key: string; value: string }) => { map[r.key] = r.value; });
    setVoiceId(map.tts_voice_id ?? '');
    const m = map.tts_model ?? 'eleven_multilingual_v2';
    if (TTS_MODELS.some(x => x.value === m)) setModel(m);
    else { setModel('custom'); setCustomModel(m); }
    try {
      setVoices(await listElenaVoices());
    } catch (err) {
      setLoadError((err as Error).message);
    }
    setLoading(false);
  }

  const effectiveModel = model === 'custom' ? customModel.trim() : model;

  async function handlePreview() {
    if (!voiceId || !effectiveModel) return;
    setPreviewing(true);
    setStatus('idle');
    try {
      await previewElenaVoice(SAMPLE, voiceId, effectiveModel);
    } catch (err) {
      setStatus('error');
      setMessage(`No se pudo reproducir: ${(err as Error).message}`);
    }
    setPreviewing(false);
  }

  async function handleSave() {
    setSaving(true);
    setStatus('idle');
    const { error } = await supabase.from('ai_settings').upsert(
      [
        { key: 'tts_voice_id', value: voiceId },
        { key: 'tts_model', value: effectiveModel || 'eleven_multilingual_v2' },
      ],
      { onConflict: 'key' },
    );
    if (error) {
      setStatus('error');
      setMessage(error.message);
    } else {
      setStatus('saved');
      setMessage(voiceId
        ? 'Voz guardada. Aplica al siguiente mensaje dictado de los usuarios con voz activada.'
        : 'Sin voz elegida: Elena no habla con nadie.');
      setTimeout(() => setStatus('idle'), 4000);
    }
    setSaving(false);
  }

  return (
    <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app p-5 space-y-4">
      <div className="flex items-start gap-2">
        <Volume2 size={18} className="text-sage-strong mt-0.5" />
        <div>
          <h2 className="text-[13px] font-semibold text-app-text uppercase tracking-wider mb-0.5">Voz de Elena (beta)</h2>
          <p className="text-xs text-app-muted">
            Elena habla solo cuando la persona dictó su mensaje, solo a usuarios con «Voz (beta)» activada en Usuarios, y nunca en crisis. Sin voz elegida, Elena no habla con nadie.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><RefreshCw size={16} className="animate-spin text-app-muted" /></div>
      ) : (
        <>
          {loadError && (
            <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-[10px] text-xs text-red-700">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>No se pudieron cargar las voces de ElevenLabs: {loadError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-app-text" htmlFor="tts-voice">Voz</label>
            <select
              id="tts-voice"
              value={voiceId}
              onChange={e => setVoiceId(e.target.value)}
              className="w-full rounded-[10px] border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text"
            >
              <option value="">— Sin voz (Elena no habla) —</option>
              {voiceId && !voices.some(v => v.voice_id === voiceId) && (
                <option value={voiceId}>Voz guardada ({voiceId})</option>
              )}
              {voices.map(v => {
                const tags = [v.category === 'cloned' ? 'clonada' : v.category, v.labels?.accent, v.labels?.language]
                  .filter(Boolean).join(', ');
                return <option key={v.voice_id} value={v.voice_id}>{tags ? `${v.name} (${tags})` : v.name}</option>;
              })}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-app-text" htmlFor="tts-model">Modelo</label>
            <select
              id="tts-model"
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full rounded-[10px] border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text"
            >
              {TTS_MODELS.map(m => <option key={m.value} value={m.value}>{m.label} — {m.note}</option>)}
              <option value="custom">Otro (escribir el ID)</option>
            </select>
            {model === 'custom' && (
              <input
                value={customModel}
                onChange={e => setCustomModel(e.target.value)}
                placeholder="ID del modelo de ElevenLabs, por ejemplo el de Eleven v4"
                className="w-full rounded-[10px] border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text"
              />
            )}
          </div>

          {status === 'error' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-[10px] text-xs text-red-700">
              <AlertCircle size={14} /><span>{message}</span>
            </div>
          )}
          {status === 'saved' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-[10px] text-xs text-green-700">
              <CheckCircle size={14} /><span>{message}</span>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handlePreview}
              disabled={previewing || !voiceId || !effectiveModel}
              className="flex-1 h-10 rounded-[12px] border border-sage-strong text-sage-strong text-sm font-semibold hover:bg-sage-strong/5 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {previewing ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
              Escuchar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || (model === 'custom' && !customModel.trim())}
              className="flex-1 h-10 rounded-[12px] bg-sage-strong text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar voz
            </button>
          </div>
        </>
      )}
    </div>
  );
}

