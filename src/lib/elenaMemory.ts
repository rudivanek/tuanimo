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
 *
 * ── Re-extraction (added alongside extract-memories v12) ────────────────────
 * Extraction used to run once per thread and never again, so a user who kept
 * returning to one long conversation stopped being remembered. The edge
 * function now re-runs every 10 new user messages.
 *
 * Two consequences handled here:
 *   1. Repeat runs can produce notes that restate what Elena already knows, so
 *      the notes she already holds are decrypted and sent along as dedup
 *      context, and a second duplicate check runs before anything is saved.
 *      (The notes are encrypted at rest and only the client can read them, so
 *      the server cannot do this part alone.)
 *   2. Notes now accumulate, so there is a ceiling on how many stay active.
 *
 * NOTE ON SIGNATURES: triggerMemoryExtraction takes exactly the same arguments
 * as before. sim-user/ compiles this module as a second caller, and a signature
 * change there has broken the runner before (buildReturnGreetingWithMemory).
 * Everything new is loaded internally rather than passed in.
 */

import { supabase } from './supabaseClient';
import { encryptForUser, decryptForUser, type ProfileForEncryption } from './encryption';

export type ElenaMemoryType = 'person' | 'event' | 'theme' | 'helps' | 'commitment' | 'crisis';

/**
 * Maximum notes kept active per user. Beyond this the least recently referenced
 * are deactivated (never deleted — `active` is a flag, so this is reversible).
 *
 * 40 is a safety net, not an active rule: the heaviest user currently holds 31,
 * so nothing changes for anyone today. WHICH notes Elena should let go of first
 * is a clinical question, not a technical one — the current rule (least recently
 * referenced) is a placeholder pending Norma's input.
 */
export const MAX_ACTIVE_NOTES = 40;

/** How many existing notes are sent to the model as dedup context. */
const DEDUP_CONTEXT_LIMIT = 30;

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
      note: await decryptForUser(row.note_enc, profile).catch(() => row.note_enc),
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
  // user_id is NOT NULL and the RLS INSERT policy is
  // WITH CHECK (auth.uid() = user_id) — omitting it rejects every insert.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const note_enc = await encryptForUser(note, profile);
  const { error } = await supabase.from('elena_memories').insert({
    user_id: user.id,
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

// ── Duplicate detection (client-side mirror of the edge function) ────────────
// The edge function runs this same check on the notes it was given. This copy
// catches the gap between the two: notes saved by another device or tab since
// this session loaded its context. Kept deliberately identical in behaviour —
// if you change one, change the other.

const STOPWORDS = new Set([
  'que', 'de', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o',
  'en', 'con', 'por', 'para', 'del', 'al', 'se', 'te', 'tu', 'tus', 'lo', 'le',
  'es', 'ser', 'estar', 'esta', 'este', 'eso', 'esa', 'ese', 'no', 'si', 'ya',
  'muy', 'mas', 'pero', 'como', 'cuando', 'porque', 'desde', 'hasta', 'sobre',
  'casi', 'todas', 'todos', 'ahora', 'mismo', 'hace', 'meses', 'anos', 'dias',
]);

const DUPLICATE_SIMILARITY_THRESHOLD = 0.30;

function normalizeForCompare(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Crude Spanish stemmer — collapses "cuadren"/"cuadran", "cargando"/"cargas". */
function stem(w: string): string {
  return w.length > 5 ? w.slice(0, 5) : w;
}

function contentWords(s: string): Set<string> {
  return new Set(
    normalizeForCompare(s)
      .split(' ')
      .filter((w) => w.length > 3 && !STOPWORDS.has(w))
      .map(stem)
  );
}

function similarity(a: string, b: string): number {
  const A = contentWords(a);
  const B = contentWords(b);
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / (A.size + B.size - shared);
}

function isDuplicate(candidate: string, priorNotes: string[]): boolean {
  const c = normalizeForCompare(candidate);
  if (!c) return true;
  for (const prior of priorNotes) {
    const p = normalizeForCompare(prior);
    if (!p) continue;
    if (c === p) return true;
    if (c.length > 12 && p.length > 12 && (c.includes(p) || p.includes(c))) return true;
    if (similarity(candidate, prior) >= DUPLICATE_SIMILARITY_THRESHOLD) return true;
  }
  return false;
}

// ── Active-note cap ──────────────────────────────────────────────────────────

/**
 * Keeps at most MAX_ACTIVE_NOTES notes active, deactivating the least recently
 * referenced beyond that. Notes are never deleted, so this is fully reversible
 * by flipping `active` back to true.
 *
 * Best-effort: a failure here must never stop a note from being saved.
 */
export async function enforceMemoryCap(): Promise<number> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { data, error } = await supabase
      .from('elena_memories')
      .select('id')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('last_referenced_at', { ascending: false });

    if (error || !data || data.length <= MAX_ACTIVE_NOTES) return 0;

    const overflow = data.slice(MAX_ACTIVE_NOTES).map((r) => r.id);
    const { error: updateError } = await supabase
      .from('elena_memories')
      .update({ active: false })
      .in('id', overflow);

    if (updateError) {
      console.warn('[elenaMemory] cap enforcement failed:', updateError);
      return 0;
    }
    return overflow.length;
  } catch (err) {
    console.warn('[elenaMemory] cap enforcement error:', err);
    return 0;
  }
}

// ── Extract from a conversation and save ─────────────────────────────────────

export async function triggerMemoryExtraction(
  threadId: string,
  conversationHistory: Array<{ role: string; content: string }>,
  profile: ProfileForEncryption
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    if (!conversationHistory.length) return;

    // Notes Elena already holds, decrypted here because only the client can
    // read them. Sent to the model so it does not restate what it already
    // knows, and reused below as the local duplicate check.
    let existingNotes: string[] = [];
    try {
      const notes = await loadElenaMemories(profile);
      existingNotes = notes
        .map((n) => n.note)
        .filter((n) => typeof n === 'string' && n.trim().length > 0)
        .slice(0, DEDUP_CONTEXT_LIMIT);
    } catch (err) {
      // Dedup context is an optimisation, not a requirement — the edge
      // function still applies its own checks without it.
      console.warn('[elenaMemory] could not load existing notes for dedup:', err);
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-memories`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          threadId,
          userId: session.user.id,
          conversationHistory,
          // The client persists the notes itself, encrypted. Without this the
          // edge function would ALSO insert them in plaintext — duplicating
          // every note, half encrypted and half not. Do not remove.
          skipInsert: true,
          // Dedup context. Optional on the server; older builds omit it.
          existingNotes,
        }),
      }
    );

    if (!response.ok) {
      console.warn('[elenaMemory] extraction failed:', response.status);
      return;
    }

    const result = await response.json() as {
      memories: Array<{ type: string; note: string; sensitive: boolean }>;
      skipped?: boolean;
      reason?: string;
      mode?: 'first' | 'reextract';
      newUserMessages?: number;
      duplicatesDropped?: number;
    };

    // The server decides whether it was time to run. Most calls land here:
    // below the re-extraction threshold, nothing to do.
    if (result.skipped) {
      if (import.meta.env.DEV && result.reason !== 'BELOW_THRESHOLD') {
        console.log(`[elenaMemory] extraction skipped: ${result.reason}`);
      }
      return;
    }

    if (!Array.isArray(result.memories) || result.memories.length === 0) return;

    // Second duplicate pass, against the notes this session actually holds.
    const accepted: string[] = [...existingNotes];
    const toSave = result.memories.filter((m) => {
      if (typeof m.note !== 'string' || !m.note.trim()) return false;
      if (isDuplicate(m.note, accepted)) return false;
      accepted.push(m.note);
      return true;
    });

    if (toSave.length === 0) {
      if (import.meta.env.DEV) {
        console.log('[elenaMemory] all proposed notes were duplicates; nothing saved');
      }
      return;
    }

    await Promise.allSettled(
      toSave.map((m) =>
        saveElenaMemory(m.note, m.type as ElenaMemoryType, m.sensitive, profile)
      )
    );

    const deactivated = await enforceMemoryCap();

    if (import.meta.env.DEV) {
      console.log(
        `[elenaMemory] ${result.mode ?? 'first'}: saved ${toSave.length}/${result.memories.length} note(s) ` +
        `from thread ${threadId}` +
        (deactivated > 0 ? ` — ${deactivated} older note(s) deactivated by the cap` : '')
      );
    }
  } catch (err) {
    // Extraction is best-effort — never block the UI
    console.warn('[elenaMemory] extraction error:', err);
  }
}