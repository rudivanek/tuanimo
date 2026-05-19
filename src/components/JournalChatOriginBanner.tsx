import { useQuery } from '@tanstack/react-query';
import { MessageCircle, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface JournalChatOriginBannerProps {
  sourceChatId: string;
  isDraft: boolean;
  onNavigate: () => void;
}

async function checkThreadExists(sourceChatId: string): Promise<boolean> {
  const { data } = await supabase
    .from('chat_threads')
    .select('id')
    .eq('id', sourceChatId)
    .maybeSingle();
  const exists = !!data?.id;
  if (import.meta.env.DEV) {
    console.debug('[JournalChatOriginBanner] thread check', { sourceChatId, exists });
  }
  return exists;
}

export function JournalChatOriginBanner({ sourceChatId, isDraft, onNavigate }: JournalChatOriginBannerProps) {
  const { data: threadExists, isLoading } = useQuery({
    queryKey: ['chat-thread-exists', sourceChatId],
    queryFn: () => checkThreadExists(sourceChatId),
    enabled: !!sourceChatId,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    retry: 0,
    refetchOnWindowFocus: false,
  });

  if (!isLoading && threadExists === false) return null;

  const body = isDraft
    ? 'Este borrador surgió a partir de una conversación.'
    : 'Esta reflexión surgió a partir de una conversación.';

  return (
    <div className="animate-in fade-in slide-in-from-top-1 duration-300 flex-shrink-0">
      <div className="flex items-center gap-3 px-4 py-3 bg-app-surface border-b border-app-border">
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-sage-soft flex items-center justify-center">
          <MessageCircle size={13} className="text-sage-strong" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10.5px] text-app-muted font-semibold uppercase tracking-wide mb-0.5">
            Creado desde una conversación
          </p>
          <p className="text-[12.5px] text-app-text leading-snug">{body}</p>
        </div>
        {threadExists && (
          <button
            type="button"
            onClick={onNavigate}
            className="
              flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5
              bg-sage-soft text-sage-strong text-[12px] font-medium
              rounded-[10px] border border-sage-soft hover:bg-sage-strong hover:text-white
              transition-colors whitespace-nowrap
            "
          >
            Volver al chat
            <ArrowRight size={11} />
          </button>
        )}
      </div>
    </div>
  );
}
