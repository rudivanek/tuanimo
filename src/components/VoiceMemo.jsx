/**
 * VoiceMemo.jsx
 * 
 * Drop-in voice recording button for TuAnimo.
 * Works in both Chat and Journal contexts.
 * 
 * Props:
 *   context: 'chat' | 'journal'           — controls copy & behavior
 *   onTranscript(text): fn                — called with final text when user confirms
 *   supabaseClient                        — your existing supabase client instance
 *   className?: string                    — optional extra classes on the outer wrapper
 * 
 * Usage (Chat):
 *   <VoiceMemo
 *     context="chat"
 *     supabaseClient={supabase}
 *     onTranscript={(text) => sendMessage(text)}
 *   />
 * 
 * Usage (Journal):
 *   <VoiceMemo
 *     context="journal"
 *     supabaseClient={supabase}
 *     onTranscript={(text) => setEntryText(text)}
 *   />
 */

import { useState, useRef, useCallback, useEffect } from "react";

// ─── iOS / Safari polyfill detection ────────────────────────────────────────
// Safari on iOS only recently got stable MediaRecorder. We detect and warn.
function getSupportedMimeType() {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const type of types) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return ""; // fallback — browser will choose
}

// ─── States ──────────────────────────────────────────────────────────────────
const STATE = {
  IDLE: "idle",
  RECORDING: "recording",
  PROCESSING: "processing",
  CONFIRMING: "confirming",
  ERROR: "error",
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function VoiceMemo({ context = "chat", onTranscript, supabaseClient, className = "" }) {
  const [state, setState] = useState(STATE.IDLE);
  const [transcript, setTranscript] = useState("");
  const [editedTranscript, setEditedTranscript] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [recordingDuration, setRecordingDuration] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const MAX_DURATION = 120; // 2 minutes max

  // ── Clean up on unmount ──
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // ── Start recording ──
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        clearInterval(timerRef.current);
        stream.getTracks().forEach((t) => t.stop());
        await transcribeAudio();
      };

      recorder.start(250); // collect chunks every 250ms
      setState(STATE.RECORDING);
      setRecordingDuration(0);

      // Auto-stop at max duration
      timerRef.current = setInterval(() => {
        setRecordingDuration((d) => {
          if (d + 1 >= MAX_DURATION) {
            stopRecording();
            return MAX_DURATION;
          }
          return d + 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Microphone error:", err);
      setErrorMsg(
        err.name === "NotAllowedError"
          ? "Necesitamos permiso para usar el micrófono."
          : "No se pudo acceder al micrófono. Verifica tu dispositivo."
      );
      setState(STATE.ERROR);
    }
  }, []);

  // ── Stop recording ──
  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state !== "inactive") {
      setState(STATE.PROCESSING);
      mediaRecorderRef.current.stop();
    }
  }, []);

  // ── Send to edge function ──
  const transcribeAudio = useCallback(async () => {
    try {
      const chunks = audioChunksRef.current;
      if (!chunks.length) {
        setErrorMsg("No se grabó audio. Inténtalo de nuevo.");
        setState(STATE.ERROR);
        return;
      }

      const mimeType = getSupportedMimeType() || "audio/webm";
      const blob = new Blob(chunks, { type: mimeType });

      // Get session token
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) {
        setErrorMsg("Sesión expirada. Vuelve a iniciar sesión.");
        setState(STATE.ERROR);
        return;
      }

      const form = new FormData();
      form.append("audio", blob, "memo.webm");
      form.append("context", context);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/transcribe-audio`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }

      const { transcript: text } = await res.json();

      if (!text || text.length < 2) {
        setErrorMsg("No se entendió el audio. ¿Puedes intentarlo de nuevo?");
        setState(STATE.ERROR);
        return;
      }

      setTranscript(text);
      setEditedTranscript(text);
      setState(STATE.CONFIRMING);
    } catch (err) {
      console.error("Transcription error:", err);
      setErrorMsg("Hubo un problema al transcribir. Inténtalo de nuevo.");
      setState(STATE.ERROR);
    }
  }, [context, supabaseClient]);

  // ── Confirm & send ──
  const confirmTranscript = useCallback(() => {
    onTranscript?.(editedTranscript.trim());
    reset();
  }, [editedTranscript, onTranscript]);

  // ── Reset ──
  const reset = useCallback(() => {
    setState(STATE.IDLE);
    setTranscript("");
    setEditedTranscript("");
    setErrorMsg("");
    setRecordingDuration(0);
    audioChunksRef.current = [];
  }, []);

  const isChat = context === "chat";
  const confirmLabel = isChat ? "Enviar a Elena" : "Guardar nota";
  const editPlaceholder = isChat
    ? "¿Esto es lo que quieres decirle a Elena?"
    : "¿Esto es lo que querías escribir?";

  // ─── IDLE ───────────────────────────────────────────────────────────────────
  if (state === STATE.IDLE) {
    return (
      <button
        onClick={startRecording}
        title="Grabar nota de voz"
        className={`voice-memo-btn voice-memo-idle ${className}`}
        aria-label="Grabar nota de voz"
      >
        <MicIcon />
      </button>
    );
  }

  // ─── RECORDING ──────────────────────────────────────────────────────────────
  if (state === STATE.RECORDING) {
    const pct = (recordingDuration / MAX_DURATION) * 100;
    return (
      <div className={`voice-memo-recording-wrapper ${className}`}>
        <button
          onClick={stopRecording}
          className="voice-memo-btn voice-memo-stop"
          aria-label="Detener grabación"
          title="Detener"
        >
          <StopIcon />
        </button>
        <span className="voice-memo-timer">
          {formatDuration(recordingDuration)}
        </span>
        <span className="voice-memo-pulse" aria-hidden="true" />
        {/* thin progress bar shown when approaching limit */}
        {pct > 70 && (
          <div className="voice-memo-limit-bar" title="Límite de 2 minutos">
            <div style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
    );
  }

  // ─── PROCESSING ─────────────────────────────────────────────────────────────
  if (state === STATE.PROCESSING) {
    return (
      <div className={`voice-memo-processing ${className}`} aria-live="polite">
        <SpinnerIcon />
        <span>Transcribiendo…</span>
      </div>
    );
  }

  // ─── CONFIRMING ─────────────────────────────────────────────────────────────
  if (state === STATE.CONFIRMING) {
    return (
      <div className={`voice-memo-confirm-wrapper ${className}`} aria-live="polite">
        <p className="voice-memo-confirm-label">{editPlaceholder}</p>
        <textarea
          value={editedTranscript}
          onChange={(e) => setEditedTranscript(e.target.value)}
          rows={3}
          className="voice-memo-textarea"
          aria-label="Texto transcrito, puedes editarlo"
          autoFocus
        />
        <div className="voice-memo-confirm-actions">
          <button onClick={confirmTranscript} className="voice-memo-btn-primary">
            {confirmLabel}
          </button>
          <button onClick={reset} className="voice-memo-btn-ghost">
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // ─── ERROR ──────────────────────────────────────────────────────────────────
  if (state === STATE.ERROR) {
    return (
      <div className={`voice-memo-error ${className}`} role="alert">
        <span>{errorMsg}</span>
        <button onClick={reset} className="voice-memo-btn-ghost voice-memo-retry">
          Reintentar
        </button>
      </div>
    );
  }

  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDuration(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ─── Icons (inline SVG, no dependency) ───────────────────────────────────────
function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" className="voice-memo-spinner">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}