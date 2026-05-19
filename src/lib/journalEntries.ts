import { supabase } from './supabaseClient';
import { encryptForUser } from './encryption';
import type { ProfileForEncryption } from './encryption';

export async function createJournalEntryFromInsight({
  userId,
  profile,
  title,
  content,
}: {
  userId: string;
  profile: ProfileForEncryption;
  title: string;
  content: string;
}): Promise<string> {
  const contentEnc = await encryptForUser(content, profile);

  const { data, error } = await supabase
    .from('journal_entries')
    .insert({
      user_id: userId,
      title,
      content_enc: contentEnc,
      enc_version: 2,
      tags: ['Insight'],
      sort_order: 0,
      is_draft: false,
      origin: 'insights',
      trigger_reason: 'weekly_insight',
      saved_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error('No entry id returned');

  return data.id;
}
