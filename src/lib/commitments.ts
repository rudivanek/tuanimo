import { supabase } from './supabaseClient';

export interface Commitment {
  id: string;
  user_id: string;
  text: string;
  status: 'pending' | 'done' | 'not_done' | 'dismissed';
  source: 'user' | 'elena';
  created_at: string;
  resolved_at: string | null;
}

/** Fetch the single active (pending) commitment for the current user, or null. */
export async function getActiveCommitment(userId: string): Promise<Commitment | null> {
  const { data, error } = await supabase
    .from('commitments')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('getActiveCommitment error:', error.message);
    return null;
  }
  return data as Commitment | null;
}

/** Create a new commitment. Silently dismisses any existing pending one. */
export async function createCommitment(
  userId: string,
  text: string,
  source: 'user' | 'elena' = 'user',
): Promise<Commitment | null> {
  // Dismiss any existing pending commitment — use 'dismissed' not 'not_done'
  // so the history only shows commitments the user actually resolved
  await supabase
    .from('commitments')
    .update({ status: 'dismissed', resolved_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('status', 'pending');

  const { data, error } = await supabase
    .from('commitments')
    .insert({ user_id: userId, text, source, status: 'pending' })
    .select()
    .single();

  if (error) {
    console.error('createCommitment error:', error.message);
    return null;
  }
  return data as Commitment;
}

/** Mark a commitment as done or not_done (user consciously resolved it). */
export async function resolveCommitment(
  commitmentId: string,
  outcome: 'done' | 'not_done',
): Promise<boolean> {
  const { error } = await supabase
    .from('commitments')
    .update({ status: outcome, resolved_at: new Date().toISOString() })
    .eq('id', commitmentId);

  if (error) {
    console.error('resolveCommitment error:', error.message);
    return false;
  }
  return true;
}

/** Silently dismiss a commitment (user tapped ✕ on the card). */
export async function dismissCommitment(commitmentId: string): Promise<boolean> {
  const { error } = await supabase
    .from('commitments')
    .update({ status: 'dismissed', resolved_at: new Date().toISOString() })
    .eq('id', commitmentId);

  if (error) {
    console.error('dismissCommitment error:', error.message);
    return false;
  }
  return true;
}
