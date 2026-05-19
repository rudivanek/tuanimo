export interface MessageChipMeta {
  id: string;
  label: string;
  intentKey: string;
  signal?: string;
  insertText?: string;
}

export interface FollowUp {
  text: string;
  kind: 'action';
  actionType: 'breathing' | 'resource' | 'save_memory' | 'journal';
  payload?: Record<string, any>;
}

export interface ChatMeta {
  state: 'E0_VALIDATE' | 'E3_EXPAND' | 'E6_CLOSE' | 'CRISIS_INTERRUPT';
  emotion: 'happy' | 'sad' | 'anxious' | 'angry' | 'numb' | 'mixed' | 'unknown';
  intensity: number;
  valence: 'positive' | 'negative' | 'mixed' | 'neutral';
  stuck: boolean;
  crisis: 'NO' | 'MAYBE' | 'YES';
  breathingOffered?: boolean;
}

export interface ChatResponse {
  reply: string;
  followUp: FollowUp | null;
  meta: ChatMeta;
  chips?: string[];
  boundary_triggered?: boolean;
  boundary_type?: string;
  mode_used?: 'REFLECTION' | 'SUPPORT' | 'BOUNDARY' | 'CRISIS';
  support_routine_id?: string | null;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
