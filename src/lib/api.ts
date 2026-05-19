import { supabase } from './supabaseClient';
import type { ChatResponse } from '../types/chat';

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export class TokenLimitError extends Error {
  reason: 'DAILY_LIMIT_REACHED' | 'MONTHLY_LIMIT_REACHED';
  daily_used: number;
  daily_limit: number;
  monthly_used: number;
  monthly_limit: number;
  serverMessage: string;

  constructor(
    reason: 'DAILY_LIMIT_REACHED' | 'MONTHLY_LIMIT_REACHED',
    daily_used: number,
    daily_limit: number,
    monthly_used: number,
    monthly_limit: number,
    serverMessage: string,
  ) {
    super(reason);
    this.name = 'TokenLimitError';
    this.reason = reason;
    this.daily_used = daily_used;
    this.daily_limit = daily_limit;
    this.monthly_used = monthly_used;
    this.monthly_limit = monthly_limit;
    this.serverMessage = serverMessage;
  }
}

let cachedToken: string | null = null;
let cachedTokenIssuedAt = 0;
const TOKEN_CACHE_MS = 55 * 60 * 1000;
const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

export async function getFreshAccessToken(forceRefresh = false): Promise<string | null> {
  const now = Date.now();
  if (!forceRefresh && cachedToken && now - cachedTokenIssuedAt < TOKEN_CACHE_MS) {
    return cachedToken;
  }

  if (forceRefresh) {
    cachedToken = null;
    cachedTokenIssuedAt = 0;
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session) {
      cachedToken = data.session.access_token;
      cachedTokenIssuedAt = Date.now();
      return cachedToken;
    }
    return null;
  }

  const { data: { session: currentSession } } = await supabase.auth.getSession();
  if (!currentSession) return null;

  const expiresAt = (currentSession.expires_at ?? 0) * 1000;
  const needsRefresh = expiresAt - now < TOKEN_REFRESH_THRESHOLD_MS;

  if (!needsRefresh) {
    cachedToken = currentSession.access_token;
    cachedTokenIssuedAt = now;
    return cachedToken;
  }

  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session) {
    return null;
  }

  cachedToken = data.session.access_token;
  cachedTokenIssuedAt = now;
  return cachedToken;
}

function buildHeaders(accessToken: string) {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };
}

async function getAuthHeaders() {
  const accessToken = await getFreshAccessToken();
  if (!accessToken) throw new Error('No active session');
  return buildHeaders(accessToken);
}

async function handleApiResponse(response: Response) {
  const body = await response.json();

  if (!response.ok) {
    const budgetErrors = ['DAILY_LIMIT_REACHED', 'MONTHLY_LIMIT_REACHED'];
    if (budgetErrors.includes(body?.error)) {
      throw new TokenLimitError(
        body.error as 'DAILY_LIMIT_REACHED' | 'MONTHLY_LIMIT_REACHED',
        body.daily_used ?? 0,
        body.daily_limit ?? 0,
        body.monthly_used ?? 0,
        body.monthly_limit ?? 0,
        body.message ?? 'Límite alcanzado.',
      );
    }
    if (body?.error === 'OPENAI_UNAVAILABLE' || response.status === 503) {
      throw new Error('OPENAI_UNAVAILABLE');
    }
    if (response.status === 401) {
      cachedToken = null;
      cachedTokenIssuedAt = 0;
    }
    throw new Error(body?.error || body?.message || `Request failed (${response.status})`);
  }

  return body;
}

export interface DevFlags {
  forceRecognition?: boolean;
  forceReturnTrigger?: boolean;
  forceMemoryMatch?: boolean;
}

export async function sendChatMessage(
  threadId: string,
  message: string,
  userMemories?: Array<{ key: string; value: string }>,
  conversationHistory?: Array<{ role: string; content: string }>,
  previousHadChips?: boolean,
  uxStance?: string,
  uxIntensity?: number,
  boundaryAttempts?: number,
  devFlags?: DevFlags,
  chipMeta?: { id: string; label: string; intentKey: string; signal?: string; insertText?: string } | null,
): Promise<ChatResponse> {
  const reqBody = JSON.stringify({ threadId, message, userMemories, conversationHistory, previousHadChips, uxStance, uxIntensity, boundaryAttempts, devFlags, chipMeta });
  const headers = await getAuthHeaders();
  let response = await fetch(`${FUNCTIONS_URL}/chat-ai`, { method: 'POST', headers, body: reqBody });

  if (response.status === 401) {
    const freshToken = await getFreshAccessToken(true);
    if (!freshToken) {
      throw new Error('SESSION_EXPIRED');
    }
    const freshHeaders = buildHeaders(freshToken);
    response = await fetch(`${FUNCTIONS_URL}/chat-ai`, { method: 'POST', headers: freshHeaders, body: reqBody });
  }

  return handleApiResponse(response);
}

export async function getJournalPrompts(languageSignals?: string[]) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_URL}/journal-prompts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ languageSignals: languageSignals ?? [] }),
  });
  return handleApiResponse(response);
}

export async function generateMoodInsight(weekStartDate: string) {
  const headers = await getAuthHeaders();
  const reqBody = JSON.stringify({ weekStartDate });
  let response = await fetch(`${FUNCTIONS_URL}/mood-insights`, { method: 'POST', headers, body: reqBody });

  if (response.status === 401) {
    const freshToken = await getFreshAccessToken(true);
    if (freshToken) {
      const freshHeaders = buildHeaders(freshToken);
      response = await fetch(`${FUNCTIONS_URL}/mood-insights`, { method: 'POST', headers: freshHeaders, body: reqBody });
    }
  }

  return handleApiResponse(response);
}

export async function getUserMemories(limit = 5) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_URL}/user-memory?limit=${limit}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get user memories');
  }

  return response.json();
}

export async function saveUserMemory(key: string, value_enc: string) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_URL}/user-memory`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ key, value_enc }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save memory');
  }

  return response.json();
}

export async function deleteUserMemory(key: string) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_URL}/user-memory`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ key }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete memory');
  }

  return response.json();
}

export interface AIReflectionPromptRequest {
  excerpt: string;
  daysAgo: number;
  pastSignal: string;
  currentSignal?: string | null;
  deltaDirection?: string | null;
  recentSignals?: string[];
}

export interface AIReflectionPromptResponse {
  promptText: string;
  insertStarter: string;
}

export async function generateAIReflectionPrompt(
  params: AIReflectionPromptRequest,
): Promise<AIReflectionPromptResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_URL}/ai-reflection-prompt`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  return handleApiResponse(response);
}

export interface AIMiniInsightRequest {
  dominantSignal: string;
  delta: number;
  basis: string;
  sourceLabel?: string | null;
}

export interface AIMiniInsightResponse {
  text: string;
}

export async function generateAIMiniInsight(
  params: AIMiniInsightRequest,
): Promise<AIMiniInsightResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_URL}/ai-mini-insight`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  return handleApiResponse(response);
}
