/**
 * elenaMemory.ts
 * Client-side library for Elena's cross-session memory notebook.
 *
 * Notes are encrypted at rest using the same AES-256 scheme as user_memory
 * (encryptForUser / decryptForUser from ./encryption).
 *
 * Types:
 *   person     — important people (family, friends, pets)
 *   event      — significant life events
 *   theme      — recurring emotional themes
 *   helps      — things that help this person
 *   commitment — stated intentions or promises
 *   crisis     — sensitive; Elena holds quietly, never surfaces unprompted
 */

import { supabase } from './supabaseClient';
import { encryptForUser, decryptForUser, type ProfileForEncryption } from './encryption';

export type ElenaMemoryType = 'person' | 'event' | 'theme' | 'helps' | 'commitment' | 'crisis';

export interface ElenaMemoryNote {
  id: string;
  type: ElenaMemoryType;
  note: string; // decrypted plaintext
  sensitive: boolean;
  active: boolean;
  last_referenced_at: string;
  created_at: string;
}

interface ElenaMemoryRaw {
  id: string;
  note_enc: string;
  type: string;
  sensitive: boolean;
  active: boolean;
  last_referenced_at: string;
  created_at: string;
}

// ── Load ──────────────────────────────────────────────────────────────────────

export async function loadElenaMemories(
  profile: ProfileForEncryption
): Promise<ElenaMemoryNote[]> {
  const { data, error } = await supabase
    .from('elena_memories')
    .select('id, note_enc, type, sensitive, active, last_referenced_at, created_at')
    .eq('active', true)
    .order('last_referenced_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('[elenaMemory] load error:', error);
    return [];
  }

  const rows = (data ?? []) as ElenaMemoryRaw[];

  const decrypted = await Promise.allSettled(
    rows.map(async (row) => ({
      id: row.id,
      type: row.type as ElenaMemoryType,
      note: await decryptForUser(row.note_enc, profile),
      sensitive: row.sensitive,
      active: row.active,
      last_referenced_at: row.last_referenced_at,
      created_at: row.created_at,
    }))
  );

  return decrypted
    .filter((r): r is PromiseFulfilledResult<ElenaMemoryNote> => r.status === 'fulfilled')
    .map((r) => r.value);
}

// ── Save ──────────────────────────────────────────────────────────────────────

export async function saveElenaMemory(
  note: string,
  type: ElenaMemoryType,
  sensitive: boolean,
  profile: ProfileForEncryption
): Promise<void> {
  const note_enc = await encryptForUser(note, profile);
  const { error } = await supabase.from('elena_memories').insert({
    note_enc,
    type,
    sensitive: sensitive || type === 'crisis',
    active: true,
  });
  if (error) throw error;
}

// ── Delete one ────────────────────────────────────────────────────────────────

export async function deleteElenaMemory(id: string): Promise<void> {
  const { error } = await supabase
    .from('elena_memories')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── Delete all ────────────────────────────────────────────────────────────────

export async function deleteAllElenaMemories(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('elena_memories')
    .delete()
    .eq('user_id', user.id);
  if (error) throw error;
}

// ── Extract from a conversation and save ─────────────────────────────────────

export async function triggerMemoryExtraction(
  threadId: string,
  existingNotes: ElenaMemoryNote[],
  profile: ProfileForEncryption
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const existingPlaintext = existingNotes.map((n) => n.note);

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-memories`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ threadId, existingNotes: existingPlaintext }),
      }
    );

    if (!response.ok) {
      console.warn('[elenaMemory] extraction failed:', response.status);
      return;
    }

    const result = await response.json() as {
      memories: Array<{ type: string; note: string; sensitive: boolean }>;
    };

    if (!Array.isArray(result.memories) || result.memories.length === 0) return;

    // Encrypt and save each proposed note
    await Promise.allSettled(
      result.memories.map((m) =>
        saveElenaMemory(m.note, m.type as ElenaMemoryType, m.sensitive, profile)
      )
    );

    console.log(`[elenaMemory] saved ${result.memories.length} new note(s) from thread ${threadId}`);
  } catch (err) {
    // Extraction is best-effort — never block the UI
    console.warn('[elenaMemory] extraction error:', err);
  }
}
