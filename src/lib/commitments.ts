import { supabase } from './supabaseClient';

export interface Commitment {
  id: string;
  user_id: string;
  text: string;
  status: 'pending' | 'done' | 'not_done';
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

/** Create a new commitment. Replaces any existing pending one for this user. */
export async function createCommitment(
  userId: string,
  text: string,
  source: 'user' | 'elena' = 'user',
): Promise<Commitment | null> {
  // Dismiss any existing pending commitment first (only one at a time)
  await supabase
    .from('commitments')
    .update({ status: 'not_done', resolved_at: new Date().toISOString() })
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

/** Mark a commitment as done or not_done. */
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

/** Dismiss (silently abandon) a commitment without reflection. */
export async function dismissCommitment(commitmentId: string): Promise<boolean> {
  const { error } = await supabase
    .from('commitments')
    .update({ status: 'not_done', resolved_at: new Date().toISOString() })
    .eq('id', commitmentId);

  if (error) {
    console.error('dismissCommitment error:', error.message);
    return false;
  }
  return true;
}
