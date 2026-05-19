import { supabase } from './supabaseClient';
import { encryptForUser } from './encryption';
import type { ProfileForEncryption } from './encryption';
import { computeChatConversionJournalTitle } from './journalTitles';

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface ChatJournalDraft {
  title: string;
  content: string;
  tags: string[];
  summary_meta: { message_count: number };
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No active session');
  return {
    Authorization: `Bearer ${session.access_token}`,
    apikey: SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };
}

export async function generateJournalDraftFromChat(
  chatId: string,
  messages: Array<{ role: string; content: string }>,
  locale = 'es',
): Promise<ChatJournalDraft> {
  const headers = await getAuthHeaders();
  const body = JSON.stringify({ chat_id: chatId, messages, locale, max_words: 220 });
  let response = await fetch(`${FUNCTIONS_URL}/chat-to-journal`, {
    method: 'POST',
    headers,
    body,
  });

  if (response.status === 401) {
    await supabase.auth.refreshSession();
    const freshHeaders = await getAuthHeaders();
    response = await fetch(`${FUNCTIONS_URL}/chat-to-journal`, {
      method: 'POST',
      headers: freshHeaders,
      body,
    });
  }

  console.log('chat-to-journal response', response.status, response.statusText);

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    console.error('chat-to-journal error body', errBody);
    const errorCode = errBody?.error || `chat-to-journal failed (${response.status})`;
    if (errorCode === 'OPENAI_UNAVAILABLE' || response.status === 503) {
      throw new Error('El servicio está temporalmente no disponible. Por favor intenta de nuevo en unos momentos.');
    }
    throw new Error(errorCode);
  }

  const result = await response.json();
  console.log('chat-to-journal result', result);
  return result;
}

export async function insertJournalDraft(
  draft: ChatJournalDraft,
  chatId: string,
  userId: string,
  profile: ProfileForEncryption,
  chatTitle?: string | null,
  timezone?: string | null,
): Promise<string> {
  const encryptedContent = await encryptForUser(draft.content, profile);
  const tz = timezone ?? 'America/Mexico_City';
  const title = computeChatConversionJournalTitle(chatTitle, tz);
  console.log('[Chat→Journal] chatTitle:', chatTitle);
  console.log('[Chat→Journal] computedJournalTitle:', title);

  const { data, error } = await supabase
    .from('journal_entries')
    .insert({
      user_id: userId,
      title,
      content_enc: encryptedContent,
      enc_version: 2,
      tags: draft.tags ?? [],
      sort_order: 0,
      is_draft: true,
      origin: 'chat',
      source_chat_id: chatId,
    })
    .select('id')
    .single();

  if (error) {
    console.error('insertJournalDraft db error', error);
    throw new Error(error.message);
  }
  if (!data?.id) {
    console.error('insertJournalDraft no id returned', data);
    throw new Error('No entry id returned');
  }

  return data.id;
}

export async function convertChatToJournal(
  chatId: string,
  messages: Array<{ role: string; content: string }>,
  userId: string,
  profile: ProfileForEncryption,
  chatTitle?: string | null,
  timezone?: string | null,
): Promise<string> {
  const draft = await generateJournalDraftFromChat(chatId, messages);
  return insertJournalDraft(draft, chatId, userId, profile, chatTitle, timezone);
}
