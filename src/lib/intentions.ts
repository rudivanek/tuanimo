/**
 * intentions.ts
 * Client-side library for the user's declared intentions (metas y mejoras).
 *
 * Intentions are things the PERSON chooses to declare about themselves —
 * distinct from elena_memories, which Elena infers from conversations.
 *
 * Content is encrypted at rest using the same AES-256 scheme as elena_memories
 * (encryptForUser / decryptForUser from ./encryption), via content_enc.
 *
 * Framing (from clinical input): intentions are open possibilities, never a
 * checklist or contract. Status is chosen by the PERSON, never by the system.
 */

import { supabase } from './supabaseClient';
import { encryptForUser, decryptForUser, type ProfileForEncryption } from './encryption';

export type IntentionStatus = 'activa' | 'retirada' | 'cumplida';
export type IntentionSource = 'user' | 'elena_suggested';

export interface Intention {
  id: string;
  text: string; // decrypted plaintext
  status: IntentionStatus;
  source: IntentionSource;
  created_at: string;
  updated_at: string;
}

interface IntentionRaw {
  id: string;
  content_enc: string;
  status: IntentionStatus;
  source: IntentionSource;
  created_at: string;
  updated_at: string;
}

// ── Load (active by default) ─────────────────────────────────────────────────

export async function loadIntentions(
  profile: ProfileForEncryption,
  status: IntentionStatus = 'activa'
): Promise<Intention[]> {
  const { data, error } = await supabase
    .from('intentions')
    .select('id, content_enc, status, source, created_at, updated_at')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[intentions] load error:', error);
    return [];
  }

  const rows = (data ?? []) as IntentionRaw[];

  const decrypted = await Promise.allSettled(
    rows.map(async (row) => ({
      id: row.id,
      text: await decryptForUser(row.content_enc, profile).catch(() => row.content_enc),
      status: row.status,
      source: row.source,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }))
  );

  return decrypted
    .filter((r): r is PromiseFulfilledResult<Intention> => r.status === 'fulfilled')
    .map((r) => r.value);
}

// ── Create ───────────────────────────────────────────────────────────────────

export async function createIntention(
  text: string,
  profile: ProfileForEncryption,
  source: IntentionSource = 'user'
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const content_enc = await encryptForUser(text, profile);
  const { error } = await supabase.from('intentions').insert({
    user_id: user.id,
    content_enc,
    source,
    status: 'activa',
  });
  if (error) throw error;
}

// ── Update text ──────────────────────────────────────────────────────────────

export async function updateIntentionText(
  id: string,
  text: string,
  profile: ProfileForEncryption
): Promise<void> {
  const content_enc = await encryptForUser(text, profile);
  const { error } = await supabase
    .from('intentions')
    .update({ content_enc })
    .eq('id', id);
  if (error) throw error;
}

// ── Change status (activa / retirada / cumplida) — always user-chosen ────────

export async function setIntentionStatus(
  id: string,
  status: IntentionStatus
): Promise<void> {
  const { error } = await supabase
    .from('intentions')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}

// ── Delete one ───────────────────────────────────────────────────────────────

export async function deleteIntention(id: string): Promise<void> {
  const { error } = await supabase
    .from('intentions')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── Reflect (calls the intentions-reflect edge function) ─────────────────────

export async function reflectOnIntentions(
  intentions: string[],
  recentContext?: string[]
): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/intentions-reflect`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ intentions, recentContext }),
      }
    );

    if (!response.ok) {
      console.warn('[intentions] reflect failed:', response.status);
      return null;
    }

    const result = await response.json() as { reflection?: string };
    return result.reflection ?? null;
  } catch (err) {
    console.warn('[intentions] reflect error:', err);
    return null;
  }
}