/**
 * OnboardingConversation.tsx
 *
 * Full-screen onboarding overlay — shown once per user (tracked via
 * `onboarding_v2_completed` column in `profiles`).
 *
 * Flow:
 *   1. Elena opens with a warm greeting and asks the user's name.
 *   2. Live AI conversation via `onboarding-chat` edge function.
 *   3. When Elena signals completion ([ONBOARDING_COMPLETE] token),
 *      a "Comenzar" button appears.
 *   4. On "Comenzar": memories extracted, flag flipped, overlay unmounts.
 *
 * Exports:
 *   OnboardingConversation  — mounted in App.tsx
 *   useOnboarding           — { resetOnboarding } for SettingsPage (admin only)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { getFreshAccessToken } from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: 'elena' | 'user';
  text: string;
}

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

// ─── useOnboarding hook ───────────────────────────────────────────────────────

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

// ─── Opening message ──────────────────────────────────────────────────────────

const OPENING_MESSAGE =
  '¡Hola! Soy Elena 🌷 Me alegra mucho que estés aquí. Para que podamos caminar juntos desde el principio... ¿cómo te llamas? ¿Cómo te gusta que te llamen?';

// ─── OnboardingConversation ───────────────────────────────────────────────────

interface Props {
  onComplete: () => void;
}

export function OnboardingConversation({ onComplete }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'elena', text: OPENING_MESSAGE },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showBegin, setShowBegin] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showBegin]);

  // Focus input on mount
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
    if (!text || loading || showBegin) return;

    const userMsg: Message = { role: 'user', text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const token = await getFreshAccessToken();
      const res = await fetch(`${FUNCTIONS_URL}/onboarding-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: buildApiMessages(newMessages) }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const replyText: string = data.reply ?? '';
      const isComplete = replyText.includes('[ONBOARDING_COMPLETE]');
      const cleanReply = replyText.replace('[ONBOARDING_COMPLETE]', '').trim();

      setMessages((prev) => [
        ...prev,
        { role: 'elena', text: cleanReply || 'Gracias por compartir esto conmigo.' },
      ]);

      if (isComplete) {
        setTimeout(() => setShowBegin(true), 600);
      }
    } catch (err) {
      console.error('[onboarding-chat] error:', err);
      setMessages((prev) => [
        ...prev,
        { role: 'elena', text: 'Tuve un pequeño problema. ¿Puedes intentarlo de nuevo?' },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, loading, messages, showBegin]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleBegin = async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      const token = await getFreshAccessToken();
      const transcript = messages
        .map((m) => `${m.role === 'elena' ? 'Elena' : 'Usuario'}: ${m.text}`)
        .join('\n');
      await fetch(`${FUNCTIONS_URL}/extract-memories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ transcript, source: 'onboarding' }),
      });
    } catch {
      // Non-fatal — memories extracted in background
    }
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
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

        {showBegin && (
          <div className="flex flex-col items-center gap-3 pt-4 pb-2">
            <p className="text-[13px] text-app-muted text-center px-6">
              Tus conversaciones ayudan a Elena a conocerte mejor con el tiempo.
            </p>
            <button
              onClick={handleBegin}
              disabled={finishing}
              className="flex items-center gap-2 px-8 py-3 bg-sage-strong text-white rounded-full text-[15px] font-semibold shadow-md active:scale-95 transition-transform disabled:opacity-60"
            >
              {finishing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <span>✨</span>
              )}
              Comenzar
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!showBegin && (
        <div
          className="flex-none px-4 pt-3 border-t border-app-border bg-app-surface"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.5rem)' }}
        >
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Auto-resize
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="Escribe aquí..."
              rows={1}
              disabled={loading}
              className="flex-1 resize-none rounded-2xl border border-app-border bg-app-bg px-4 py-3 text-[14.5px] text-app-text placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-sage-strong/30 disabled:opacity-50 overflow-y-auto"
              style={{ lineHeight: '1.5', minHeight: '44px', maxHeight: '120px' }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="flex-none w-10 h-10 rounded-full bg-sage-strong text-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
