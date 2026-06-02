import { useState, useEffect, useRef } from 'react';
import { TrendingUp, MessageCircle, BookOpen } from 'lucide-react';
import { useLocation } from 'wouter';
import { useAuth } from '../../contexts/AuthContext';
import { useProfile } from '../../hooks/useProfile';
import { supabase } from '../../lib/supabaseClient';
import { encryptForUser } from '../../lib/encryption';
import type { WeeklyInsightSummary } from '../../lib/insightWeekly';
import { buildWeeklyMiniInsight } from '../../lib/insightMiniCard';
import { generateAIMiniInsight } from '../../lib/api';

type SignalType = 'positive' | 'stress' | 'anxiety' | 'gratitude';

export type WeeklyInsightCardProps = {
  summary: WeeklyInsightSummary;
  onDismiss?: () => void;
  sourceLabel?: string;
  isNew?: boolean;
};

const SIGNAL_LABEL: Record<SignalType, string> = {
  stress: 'Estrés',
  anxiety: 'Ansiedad',
  positive: 'Ánimo positivo',
  gratitude: 'Gratitud',
};

const SIGNAL_SUGGESTION: Record<SignalType, string> = {
  stress: '¿Qué sientes que pide más espacio ahora mismo?',
  anxiety: '¿Qué parte de esto se siente más presente en este momento?',
  gratitude: '¿Qué de esta semana quisieras llevar contigo?',
  positive: '¿Qué de esta semana quisieras que siguiera?',
};

const SIGNAL_DRAFT_BODY: Record<SignalType, string> = {
  stress:
    'Esta semana hubo algo que se sintió pesado.\n\nLo que más lo hizo presente fue:\n\nLo que alivió un poco:\n\nLo que sigue ahí ahora mismo:\n',
  anxiety:
    'Esta semana hubo bastante inquietud.\n\nLo que se sentía más presente era:\n\nLo que lo hacía más liviano:\n\nLo que todavía no termina de asentarse:\n',
  gratitude:
    'Esta semana hubo momentos que valió la pena notar.\n\nLo que más me quedó:\n\nPor qué importa:\n\nLo que quisiera seguir viendo:\n',
  positive:
    'Esta semana se sintió con más ligereza.\n\nLo que lo hizo diferente:\n\nEl momento que más lo muestra:\n\nLo que me gustaría que siguiera:\n',
};

const SIGNAL_DRAFT_TITLE: Record<SignalType, string> = {
  stress: 'Lo que se sintió pesado esta semana',
  anxiety: 'Lo que estuvo presente e inquieto esta semana',
  gratitude: 'Lo que valió la pena notar esta semana',
  positive: 'Lo que trajo ligereza esta semana',
};

function buildWeeklyDraft(signal: SignalType): { title: string; content: string; tags: string[] } {
  return {
    title: SIGNAL_DRAFT_TITLE[signal],
    content: SIGNAL_DRAFT_BODY[signal],
    tags: ['Reflexión', 'Resumen semanal'],
  };
}

function weeklySourceFooter(sourceLabel?: string): string {
  switch (sourceLabel) {
    case 'Chats':
      return 'Basado en tus chats (últimos 7 días)';
    case 'Diario':
      return 'Basado en tu diario (últimos 7 días)';
    case 'Mixto':
      return 'Basado en tus chats y diario (últimos 7 días)';
    default:
      return 'Basado en tu actividad reciente';
  }
}

function deltaLine(delta: number): string {
  if (delta > 0) return `↑ Más que la semana pasada (+${delta})`;
  if (delta < 0) return `↓ Menos que la semana pasada (${delta})`;
  return '≈ Igual que la semana pasada';
}

function deltaColorClass(delta: number, type: SignalType): string {
  if (delta === 0) return 'text-app-muted';
  if (type === 'stress' || type === 'anxiety') {
    return delta > 0 ? 'text-rose-500' : 'text-emerald-600';
  }
  return delta > 0 ? 'text-emerald-600' : 'text-rose-500';
}

export default function WeeklyInsightCard({ summary, onDismiss, sourceLabel, isNew }: WeeklyInsightCardProps) {
  const { dominantThisWeek, change } = summary;
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const aiFetchedKeyRef = useRef<string | null>(null);

  const ruleResult = buildWeeklyMiniInsight(summary);
  const dominantDelta = dominantThisWeek ? Math.round(change[dominantThisWeek]) : 0;

  useEffect(() => {
    const cacheKey = dominantThisWeek
      ? `mini_insight_${dominantThisWeek}_${dominantDelta}`
      : null;

    if (!cacheKey || ruleResult.confidence !== 'high') {
      setAiText(null);
      return;
    }

    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setAiText(cached);
        return;
      }
    } catch {}

    if (aiFetchedKeyRef.current === cacheKey) return;
    aiFetchedKeyRef.current = cacheKey;
    setAiText(null);

    let cancelled = false;
    (async () => {
      try {
        const result = await generateAIMiniInsight({
          dominantSignal: dominantThisWeek,
          delta: dominantDelta,
          basis: ruleResult.basis,
          sourceLabel: sourceLabel ?? null,
        });
        if (!cancelled && result.text) {
          try { sessionStorage.setItem(cacheKey, result.text); } catch {}
          setAiText(result.text);
        }
      } catch {
        // Fail silently — rule-based text remains active
      }
    })();

    return () => { cancelled = true; };
  }, [dominantThisWeek, dominantDelta, ruleResult.confidence, ruleResult.basis, sourceLabel]);

  if (!dominantThisWeek) return null;

  const label = SIGNAL_LABEL[dominantThisWeek];
  const mainLine = aiText ?? ruleResult.text;
  const suggestion = SIGNAL_SUGGESTION[dominantThisWeek];
  const delta = Math.round(change[dominantThisWeek]);
  const deltaText = deltaLine(delta);
  const deltaColor = deltaColorClass(delta, dominantThisWeek);

  const handleSuggestion = () => {
    navigate(`/chat?prefill=${encodeURIComponent(suggestion)}`);
  };

  const handleChatCTA = () => {
    const prefill = 'Quiero entender mejor qué pasó esta semana y qué puedo ajustar.';
    navigate(`/chat?prefill=${encodeURIComponent(prefill)}`);
  };

  const handleCreateDraft = async () => {
    if (!user || !profile || isCreatingDraft) return;
    setIsCreatingDraft(true);
    try {
      const draft = buildWeeklyDraft(dominantThisWeek);
      const encryptedContent = await encryptForUser(draft.content, profile);
      const { data, error } = await supabase
        .from('journal_entries')
        .insert({
          user_id: user.id,
          title: draft.title,
          content_enc: encryptedContent,
          enc_version: 2,
          tags: draft.tags,
          sort_order: 0,
          is_draft: true,
          origin: 'insights',
          saved_at: null,
        })
        .select('id')
        .maybeSingle();

      if (error || !data) {
        console.error('[WeeklyInsightCard] Draft creation failed', error);
        return;
      }

      sessionStorage.setItem('diaryAutoOpen', data.id);
      navigate('/journal');
    } catch (err) {
      console.error('[WeeklyInsightCard] Draft creation error', err);
    } finally {
      setIsCreatingDraft(false);
    }
  };

  return (
    <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold text-app-text flex items-center gap-2">
          <TrendingUp size={16} className="text-sage" />
          Resumen de la semana
          {sourceLabel && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-app-bg text-app-muted border border-app-border">
              {sourceLabel}
            </span>
          )}
          {isNew && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Nuevo
            </span>
          )}
        </h2>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-xs text-app-muted opacity-60 hover:opacity-100 transition-opacity"
          >
            Ocultar hoy
          </button>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-app-muted uppercase tracking-wide">
          {label}
        </p>
        <p className="text-sm text-app-text leading-relaxed">{mainLine}</p>
        <p className={`text-[12px] font-medium ${deltaColor}`}>{deltaText}</p>
      </div>

      <div className="flex items-center gap-2 mt-4 flex-wrap">
        {sourceLabel === 'Chats' && (
          <button
            onClick={handleChatCTA}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-sage-soft border border-sage text-sage-strong text-[12px] font-medium rounded-full hover:bg-sage hover:text-white transition-colors"
          >
            <MessageCircle size={12} />
            Hablar en chat
          </button>
        )}

        {(sourceLabel === 'Diario' || sourceLabel === 'Mixto') && user && profile && (
          <button
            onClick={handleCreateDraft}
            disabled={isCreatingDraft}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-app-hover border border-app-border text-app-text text-[12px] font-medium rounded-full hover:bg-app-border transition-colors disabled:opacity-50"
          >
            <BookOpen size={12} />
            {isCreatingDraft ? 'Creando…' : sourceLabel === 'Mixto' ? 'Reflexionar' : 'Crear borrador'}
          </button>
        )}

        {!sourceLabel && (
          <>
            <button
              onClick={handleSuggestion}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-sage-soft border border-sage text-sage-strong text-[12px] font-medium rounded-full hover:bg-sage hover:text-white transition-colors"
            >
              <MessageCircle size={12} />
              Sugerencia
            </button>
            {user && profile && (
              <button
                onClick={handleCreateDraft}
                disabled={isCreatingDraft}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-app-hover border border-app-border text-app-text text-[12px] font-medium rounded-full hover:bg-app-border transition-colors disabled:opacity-50"
              >
                <BookOpen size={12} />
                {isCreatingDraft ? 'Creando…' : 'Crear borrador'}
              </button>
            )}
          </>
        )}
      </div>

      <p className="text-[11px] text-app-muted/70 mt-3">
        {weeklySourceFooter(sourceLabel)}
      </p>
    </div>
  );
}
