import type { MoodState } from '../../types/mood';
import { supabase } from '../supabaseClient';

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function getAuthHeader(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token
    ? `Bearer ${session.access_token}`
    : `Bearer ${SUPABASE_ANON_KEY}`;
}

export async function llmDetect(
  message: string,
  context: string[] = [],
): Promise<MoodState> {
  const authHeader = await getAuthHeader();
  const response = await fetch(`${FUNCTIONS_URL}/mood-classify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
      'Apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ message, context }),
  });

  if (!response.ok) {
    throw new Error(`mood-classify failed: ${response.status}`);
  }

  const data = await response.json();

  const mood = data.mood ?? 'neutral';
  const valence = Math.max(-1, Math.min(1, Number(data.valence) || 0));
  const arousal = Math.max(0, Math.min(1, Number(data.arousal) || 0.5));
  const confidence = Math.max(0, Math.min(1, Number(data.confidence) || 0.5));
  const reasons: string[] = Array.isArray(data.reasons) ? data.reasons.slice(0, 3) : [];

  return { mood, valence, arousal, confidence, reasons, updatedAt: new Date().toISOString() };
}
