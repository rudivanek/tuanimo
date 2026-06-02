import { useState } from 'react';
import { MessageCircle, BookOpen, Sparkles } from 'lucide-react';
import { useLocation } from 'wouter';
import { useAuth } from '../../contexts/AuthContext';
import { useProfile } from '../../hooks/useProfile';
import { supabase } from '../../lib/supabaseClient';
import { encryptForUser } from '../../lib/encryption';
import type { WeeklyInsightSummary } from '../../lib/insightWeekly';

type SignalType = 'positive' | 'stress' | 'anxiety' | 'gratitude';

export type WeeklyInsightCardProps = {
  summary: WeeklyInsightSummary;
  onDismiss?: () => void;
  sourceLabel?: string;
  isNew?: boolean;
};

// What Elena noticed — framed as an opening, not a label
const SIGNAL_OPENING: Record<SignalType, string> = {
  stress:    'Algo pesado estuvo presente esta semana.',
  anxiety:   'Hubo inquietud o tensión en lo que compartiste esta semana.',
  gratitude: 'Apareció gratitud en lo que viviste esta semana.',
  positive:  'Hubo ligereza o energía positiva en esta semana.',
};

// Invitation to continue — existential, not prescriptive
const SIGNAL_INVITATION: Record<SignalType, string> = {
  stress:    '¿Qué parte de eso todavía sientes presente?',
  anxiety:   '¿Qué es lo que más está pidiendo tu atención ahora mismo?',
  gratitude: '¿Qué de esta semana quisieras no perder de vista?',
  positive:  '¿Qué hizo posible esta semana que fuera así?',
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
  stress:    'Lo que se sintió pesado esta semana',
  anxiety:   'Lo que estuvo presente e inquieto esta semana',
  gratitude: 'Lo que valió la pena notar esta semana',
  positive:  'Lo que trajo ligereza esta semana',
};

function weeklySourceFooter(sourceLabel?: string): string {
  switch (sourceLabel) {
    case 'Chats':  return 'Basado en tus chats (últimos 7 días)';
    case 'Diario': return 'Basado en tu diario (últimos 7 días)';
    case 'Mixto':  return 'Basado en tus chats y diario (últimos 7 días)';
    default:       return 'Basado en tu actividad reciente';
  }
}

export default function WeeklyInsightCard({ summary, onDismiss, sourceLabel, isNew }: WeeklyInsightCardProps) {
  const { dominantThisWeek } = summary;
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);

  if (!dominantThisWeek) return null;

  const opening    = SIGNAL_OPENING[dominantThisWeek];
  const invitation = SIGNAL_INVITATION[dominantThisWeek];

  const handleChatCTA = () => {
    navigate(`/chat?prefill=${encodeURIComponent(invitation)}`);
  };

  const handleCreateDraft = async () => {
    if (!user || !profile || isCreatingDraft) return;
    setIsCreatingDraft(true);
    try {
      const title   = SIGNAL_DRAFT_TITLE[dominantThisWeek];
      const content = SIGNAL_DRAFT_BODY[dominantThisWeek];
      const encryptedContent = await encryptForUser(content, profile);
      const { data, error } = await supabase
        .from('journal_entries')
        .insert({
          user_id:      user.id,
          title,
          content_enc:  encryptedContent,
          enc_version:  2,
          tags:         ['Reflexión', 'Resumen semanal'],
          sort_order:   0,
          is_draft:     true,
          origin:       'insights',
          saved_at:     null,
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

  const showChatButton   = sourceLabel === 'Chats' || sourceLabel === 'Mixto' || !sourceLabel;
  const showJournalButton = (sourceLabel === 'Diario' || sourceLabel === 'Mixto' || !sourceLabel) && !!user && !!profile;

  return (
    <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5">

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold text-app-text flex items-center gap-2">
          <Sparkles size={15} className="text-sage" />
          Resumen de la semana
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

      {/* Body */}
      <div className="space-y-2">
        <p className="text-sm text-app-text leading-relaxed">{opening}</p>
        <p className="text-[13px] text-sage-strong leading-relaxed italic">{invitation}</p>
      </div>

      {/* CTAs */}
      <div className="flex items-center gap-2 mt-4 flex-wrap">
        {showChatButton && (
          <button
            onClick={handleChatCTA}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-sage-soft border border-sage text-sage-strong text-[12px] font-medium rounded-full hover:bg-sage hover:text-white transition-colors"
          >
            <MessageCircle size={12} />
            Hablar con Elena
          </button>
        )}
        {showJournalButton && (
          <button
            onClick={handleCreateDraft}
            disabled={isCreatingDraft}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-app-hover border border-app-border text-app-text text-[12px] font-medium rounded-full hover:bg-app-border transition-colors disabled:opacity-50"
          >
            <BookOpen size={12} />
            {isCreatingDraft ? 'Creando…' : 'Escribir en el diario'}
          </button>
        )}
      </div>

      {/* Footer */}
      <p className="text-[11px] text-app-muted/70 mt-3">
        {weeklySourceFooter(sourceLabel)}
      </p>
    </div>
  );
}
