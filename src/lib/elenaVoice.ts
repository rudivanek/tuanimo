// Elena's spoken replies (voice beta).
//
// Only used when the person dictated their message AND their profile has
// voice_enabled = true (set by an admin). The text is always shown first;
// voice is an extra on top. Any failure here is silent: no audio, chat unchanged.
//
// iOS Safari only lets audio play shortly after a tap. unlockElenaVoice() must be
// called inside the tap that sends the dictated message ("Enviar a Elena"), so the
// shared <audio> element is allowed to play the reply when it arrives.
import { supabase } from './supabaseClient';

// 0.05 s of silence (8 kHz WAV), used to unlock the audio element on iOS.
const SILENCE =
  'data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';

let audioEl: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
let currentRequest: AbortController | null = null;

function getAudio(): HTMLAudioElement {
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.preload = 'auto';
  }
  return audioEl;
}

/** Call synchronously inside the user's tap that sends a dictated message. */
export function unlockElenaVoice(): void {
  try {
    const a = getAudio();
    a.muted = true;
    a.src = SILENCE;
    const p = a.play();
    if (p) p.then(() => { a.pause(); a.muted = false; }).catch(() => { a.muted = false; });
  } catch {
    /* ignore: voice is optional */
  }
}

/** Stop any reply that is playing or still being generated. */
export function stopElenaVoice(): void {
  currentRequest?.abort();
  currentRequest = null;
  if (audioEl) {
    audioEl.pause();
    audioEl.removeAttribute('src');
  }
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
}

/** Speak Elena's reply. Never throws; failures only log a warning. */
export async function speakElena(text: string): Promise<void> {
  stopElenaVoice();
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return;

  const controller = new AbortController();
  currentRequest = controller;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elena-tts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'speak', text: clean }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn('[elena-voice] no audio:', res.status, await res.text().catch(() => ''));
      return;
    }
    const blob = await res.blob();
    if (controller.signal.aborted) return;

    currentUrl = URL.createObjectURL(blob);
    const a = getAudio();
    a.muted = false;
    a.src = currentUrl;
    await a.play();
  } catch (err) {
    if ((err as Error)?.name !== 'AbortError') console.warn('[elena-voice] playback failed:', err);
  } finally {
    if (currentRequest === controller) currentRequest = null;
  }
}

/** Admin only: list the voices in the ElevenLabs account. */
export async function listElenaVoices(): Promise<Array<{ voice_id: string; name: string; category?: string; labels?: Record<string, string> }>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sesión expirada');
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elena-tts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'voices' }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error === 'voice_not_configured'
    ? 'Falta la clave ELEVENLABS_API_KEY en los secretos de Supabase.'
    : `Error ${res.status}: ${body?.detail ?? body?.error ?? ''}`);
  return body.voices ?? [];
}

/** Admin only: hear a voice/model before saving it. */
export async function previewElenaVoice(text: string, voiceId: string, model: string): Promise<void> {
  stopElenaVoice();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sesión expirada');
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elena-tts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'preview', text, voice_id: voiceId, model }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Error ${res.status}: ${body?.error ?? ''}`);
  }
  currentUrl = URL.createObjectURL(await res.blob());
  const a = getAudio();
  a.muted = false;
  a.src = currentUrl;
  await a.play();
}