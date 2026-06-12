/**
 * OnboardingConversation.tsx
 *
 * Two modes:
 *   1. ONBOARDING (mode="onboarding") — full-screen first-time welcome.
 *      Elena asks name, life context, reason for coming.
 *      Has a "Saltar por ahora" skip link that permanently dismisses.
 *      Has a "Comenzar" button that appears when Elena signals [ONBOARDING_COMPLETE].
 *
 *   2. EDIT (mode="edit") — free-form "update my presentation" modal.
 *      Elena opens knowing the user already, invites them to share what's new.
 *      "Listo" button always visible — user decides when they're done.
 *      Saves memories and closes.
 *
 * Exports:
 *   OnboardingConversation   — full-screen overlay, mounted in App.tsx
 *   ElenaEditPresentacion    — modal overlay, opened from SettingsPage
 *   useOnboarding            — { resetOnboarding } admin reset hook
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

// ─── Auth token helper ────────────────────────────────────────────────────────

async function getToken(): Promise<string | null> {
  try {
    const mod = await import('../lib/api');
    const t = await mod.getFreshAccessToken();
    if (t) return t;
  } catch { /* ignore */ }
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

function buildHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'apikey': SUPABASE_ANON_KEY,
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: 'elena' | 'user';
  text: string;
}

// ─── useOnboarding hook (admin reset) ────────────────────────────────────────

export function useOnboarding() {
  const { user } = useAuth();

  const resetOnboarding = useCallback(async () => {
    if (!user) return;
    await supabase
      .from('profiles')
      .update({ onboarding_v2_completed: false })
      .eq('id', user.id);
    window.location.reload();
  }, [user]);

  return { resetOnboarding };
}

// ─── Shared: extract memories ─────────────────────────────────────────────────

async function extractMemories(messages: Message[], source: string) {
  try {
    const token = await getToken();
    if (!token) { console.warn('[extractMemories] no token'); return; }
    const transcript = messages
      .map((m) => `${m.role === 'elena' ? 'Elena' : 'Usuario'}: ${m.text}`)
      .join('\n');
    console.log('[extractMemories] calling edge function, source:', source, 'turns:', messages.length);
    const res = await fetch(`${FUNCTIONS_URL}/extract-memories`, {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify({ transcript, source }),
    });
    console.log('[extractMemories] response status:', res.status);
    const body = await res.json().catch(() => ({}));
    console.log('[extractMemories] response body:', body);
  } catch (err) {
    console.error('[extractMemories] error:', err);
  }
}

// ─── Shared chat UI ───────────────────────────────────────────────────────────

interface ChatUIProps {
  messages: Message[];
  input: string;
  loading: boolean;
  finishing: boolean;
  // primary action button
  primaryLabel: string;
  primaryIcon?: React.ReactNode;
  onPrimary: () => void;
  showPrimary: boolean;
  // secondary/skip
  secondaryLabel?: string;
  onSecondary?: () => void;
  // input
  onInputChange: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  bottomRef: React.RefObject<HTMLDivElement>;
  inputDisabled?: boolean;
}

function ChatUI({
  messages, input, loading, finishing,
  primaryLabel, primaryIcon, onPrimary, showPrimary,
  secondaryLabel, onSecondary,
  onInputChange, onSend, onKeyDown, inputRef, bottomRef,
  inputDisabled,
}: ChatUIProps) {
  return (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[82%] px-4 py-3 rounded-2xl text-[14.5px] leading-relaxed ${
                msg.role === 'elena'
                  ? 'bg-app-surface border border-app-border text-app-text rounded-tl-sm'
                  : 'bg-sage-strong text-white rounded-tr-sm'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-app-surface border border-app-border rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-5">
                <span className="w-1.5 h-1.5 rounded-full bg-app-muted animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-app-muted animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-app-muted animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        {showPrimary && (
          <div className="flex flex-col items-center gap-3 pt-4 pb-2">
            <p className="text-[13px] text-app-muted text-center px-6">
              Tus conversaciones ayudan a Elena a conocerte mejor con el tiempo.
            </p>
            <button
              onClick={onPrimary}
              disabled={finishing}
              className="flex items-center gap-2 px-8 py-3 bg-sage-strong text-white rounded-full text-[15px] font-semibold shadow-md active:scale-95 transition-transform disabled:opacity-60"
            >
              {finishing ? <Loader2 size={16} className="animate-spin" /> : primaryIcon}
              {primaryLabel}
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input + skip */}
      <div
        className="flex-none px-4 pt-3 border-t border-app-border bg-app-surface"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.5rem)' }}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              onInputChange(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={onKeyDown}
            placeholder="Escribe aquí..."
            rows={1}
            disabled={loading || inputDisabled}
            className="flex-1 resize-none rounded-2xl border border-app-border bg-app-bg px-4 py-3 text-[14.5px] text-app-text placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-sage-strong/30 disabled:opacity-50 overflow-y-auto"
            style={{ lineHeight: '1.5', minHeight: '44px', maxHeight: '120px' }}
          />
          <button
            onClick={onSend}
            disabled={!input.trim() || loading || inputDisabled}
            className="flex-none w-10 h-10 rounded-full bg-sage-strong text-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
          >
            <Send size={16} />
          </button>
        </div>

        {secondaryLabel && onSecondary && (
          <div className="flex justify-center mt-3">
            <button
              onClick={onSecondary}
              className="text-[12.5px] text-app-muted hover:text-app-text transition-colors underline-offset-2 hover:underline"
            >
              {secondaryLabel}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Shared chat logic ────────────────────────────────────────────────────────

function useChatLogic(
  endpoint: string,
  openingMessage: string,
) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'elena', text: openingMessage },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isComplete]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  const buildApiMessages = (msgs: Message[]) =>
    msgs.map((m) => ({
      role: m.role === 'elena' ? 'assistant' : 'user',
      content: m.text.replace('[ONBOARDING_COMPLETE]', '').trim(),
    }));

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const token = await getToken();
      if (!token) throw new Error('No active session');
      const res = await fetch(`${FUNCTIONS_URL}/${endpoint}`, {
        method: 'POST',
        headers: buildHeaders(token),
        body: JSON.stringify({ messages: buildApiMessages(newMessages) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const replyText: string = data.reply ?? '';
      const complete = replyText.includes('[ONBOARDING_COMPLETE]');
      const cleanReply = replyText.replace('[ONBOARDING_COMPLETE]', '').trim();

      setMessages((prev) => [
        ...prev,
        { role: 'elena', text: cleanReply || 'Gracias por compartir esto conmigo.' },
      ]);
      if (complete) setTimeout(() => setIsComplete(true), 600);
    } catch (err) {
      console.error(`[${endpoint}] error:`, err);
      setMessages((prev) => [
        ...prev,
        { role: 'elena', text: 'Tuve un pequeño problema. ¿Puedes intentarlo de nuevo?' },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, loading, messages, endpoint]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return {
    messages, input, setInput, loading, isComplete, finishing, setFinishing,
    sendMessage, handleKeyDown, bottomRef, inputRef,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. OnboardingConversation — full-screen first-time overlay
// ═══════════════════════════════════════════════════════════════════════════════

const ONBOARDING_OPENING =
  '¡Hola! Soy Elena 🌷 Me alegra mucho que estés aquí. Para que podamos caminar juntos desde el principio... ¿cómo te llamas? ¿Cómo te gusta que te llamen?';

interface OnboardingProps {
  onComplete: () => void;
}

export function OnboardingConversation({ onComplete }: OnboardingProps) {
  const { user } = useAuth();
  const {
    messages, input, setInput, loading, isComplete, finishing, setFinishing,
    sendMessage, handleKeyDown, bottomRef, inputRef,
  } = useChatLogic('onboarding-chat', ONBOARDING_OPENING);

  const handleSkip = useCallback(async () => {
    if (!user) return;
    // Save whatever was shared before skipping — even partial answers are useful
    if (messages.length > 1) {
      await extractMemories(messages, 'onboarding_skipped');
    }
    await supabase
      .from('profiles')
      .update({ onboarding_v2_completed: true })
      .eq('id', user.id);
    onComplete();
  }, [user, onComplete, messages]);

  const handleBegin = async () => {
    if (finishing) return;
    setFinishing(true);
    await extractMemories(messages, 'onboarding');
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-app-bg">
      {/* Header */}
      <div
        className="flex-none px-5 pb-4 border-b border-app-border bg-app-surface"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 1.5rem)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-sage-strong/10 flex items-center justify-center text-lg">
            🌷
          </div>
          <div>
            <p className="text-[15px] font-semibold text-app-text">Elena</p>
            <p className="text-[11px] text-app-muted">Tu acompañante emocional</p>
          </div>
        </div>
      </div>

      <ChatUI
        messages={messages}
        input={input}
        loading={loading}
        finishing={finishing}
        primaryLabel="Comenzar"
        primaryIcon={<span>✨</span>}
        onPrimary={handleBegin}
        showPrimary={isComplete}
        secondaryLabel="Saltar por ahora"
        onSecondary={handleSkip}
        onInputChange={setInput}
        onSend={sendMessage}
        onKeyDown={handleKeyDown}
        inputRef={inputRef as React.RefObject<HTMLTextAreaElement>}
        bottomRef={bottomRef}
        inputDisabled={isComplete}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ElenaEditPresentacion — modal overlay from Settings
// ═══════════════════════════════════════════════════════════════════════════════

const EDIT_OPENING =
  'Hola de nuevo 🌷 ¿Qué quieres que sepa de ti? Puedes contarme algo nuevo, corregir algo, o simplemente lo que sientas que es importante que tenga presente.';

interface EditProps {
  onClose: () => void;
}

export function ElenaEditPresentacion({ onClose }: EditProps) {
  const {
    messages, input, setInput, loading, finishing, setFinishing,
    sendMessage, handleKeyDown, bottomRef, inputRef,
  } = useChatLogic('onboarding-chat', EDIT_OPENING);

  // In edit mode the "Listo" button is always visible (user decides when done)
  const [saved, setSaved] = useState(false);

  const handleListo = async () => {
    if (finishing) return;
    setFinishing(true);
    await extractMemories(messages, 'edit_presentacion');
    setSaved(true);
    setTimeout(() => onClose(), 1200);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-app-bg">
      {/* Header */}
      <div
        className="flex-none px-5 pb-4 border-b border-app-border bg-app-surface"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 1.5rem)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-sage-strong/10 flex items-center justify-center text-lg">
            🌷
          </div>
          <div className="flex-1">
            <p className="text-[15px] font-semibold text-app-text">Elena</p>
            <p className="text-[11px] text-app-muted">Actualizar mi presentación</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-app-muted hover:text-app-text hover:bg-app-surface-2 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {saved ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-8">
            <p className="text-3xl mb-3">🌷</p>
            <p className="text-[15px] font-medium text-app-text">Guardado</p>
            <p className="text-[13px] text-app-muted mt-1">Elena lo tendrá presente.</p>
          </div>
        </div>
      ) : (
        <ChatUI
          messages={messages}
          input={input}
          loading={loading}
          finishing={finishing}
          primaryLabel={finishing ? 'Guardando...' : 'Listo'}
          primaryIcon={<span>✓</span>}
          onPrimary={handleListo}
          showPrimary={true}
          onInputChange={setInput}
          onSend={sendMessage}
          onKeyDown={handleKeyDown}
          inputRef={inputRef as React.RefObject<HTMLTextAreaElement>}
          bottomRef={bottomRef}
        />
      )}
    </div>
  );
}
