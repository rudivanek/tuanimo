import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useLocation, useSearch } from 'wouter';
import { useSoundSettings } from '../hooks/useSoundSettings';
import { audioManager } from '../lib/audio';
import { supabase } from '../lib/supabaseClient';
import { useProfile } from '../hooks/useProfile';
import { sendChatMessage, getUserMemories, saveUserMemory, TokenLimitError, generateTitle, type DevFlags } from '../lib/api';
import { loadElenaMemories, type ElenaMemoryNote } from '../lib/elenaMemory';
import { loadIntentions } from '../lib/intentions';
import { DevPanel } from '../components/DevPanel';
import { encryptForUser, decryptForUser } from '../lib/encryption';
import { Send, MessageCircle, Trash2, GripVertical, ArrowLeft, Plus, Lock, Pencil, Check, X, Download, BookOpen } from 'lucide-react';
import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import { getPreferredGreetingName } from '../lib/welcomeMessages';
import { getLastUserChatTimestamp, buildContextualGreeting, getInsightSnippetForReturn, buildReturnGreetingWithInsight, getChatSignalForReturn, buildReturnGreetingWithSignal, getFirstSessionTopicEnc, buildReturnGreetingWithMemory, buildDynamicMemoryGreeting } from '../lib/contextualGreeting';
import { FollowUpBox } from '../components/FollowUpBox';
import { PracticasConfirmModal } from '../components/PracticasConfirmModal';
import { DiaryDraftSuggestion } from '../components/DiaryDraftSuggestion';
import { ChatLinkedJournalBanner } from '../components/ChatLinkedJournalBanner';
import { SuggestionChips } from '../components/SuggestionChips';
import { ExportModal } from '../components/ExportModal';
import { MessageContent } from '../components/MessageContent';
import { ensureQuestionBreak } from '../components/messageContentUtils';
import { getHumanizedInsertText } from '../lib/chipIntentMap';
import { runMoodDetect, isCrisisMessage } from '../lib/moodDetect/index';
import { selectEmotionChips, getFollowUpChips, resolveChipMode, buildChipFreshnessContext, applyChipFreshness } from '../lib/chips/chipEngine';
import { getUXContextState, type StanceLock, type SupportStance } from '../lib/uxRouter/getUXContextState';
import { generateDiaryDraft } from '../lib/diaryDraft';
import { evaluateDiarySuggestion, sessionCrisisLevel as computeSessionCrisisLevel } from '../lib/emotionHeuristics';
import type { MoodState } from '../types/mood';
import { formatChatExport } from '../lib/exportUtils';
import { useAdmin } from '../hooks/useAdmin';
import { useTokenStatus } from '../hooks/useTokenStatus';
import { useChipCooldown } from '../hooks/useChipCooldown';
import { convertChatToJournal } from '../lib/chatToJournal';
import { ConvertToJournalModal } from '../components/ConvertToJournalModal';
import { extractChatSignals, summarizeChatSignals } from '../lib/chatSignals';
// chatSignalWriter removed — signals now written by chat-ai edge function
import { buildInsightSignal } from '../lib/insightSignals';
import { useLatestInsightAt } from '../hooks/useLatestInsightAt';
import { hasNewInsightsSinceLastView } from '../lib/insightVisibility';
import type { FollowUp, ChatMeta, MessageChipMeta } from '../types/chat';
import type { ExportFormat } from '../lib/exportUtils';
import { InsightActivationChip } from '../components/InsightActivationChip';
import { useInsightActivation } from '../hooks/useInsightActivation';
import { recordFlightEvent, getSessionId } from '../lib/elenaFlightRecorder';
import VoiceMemo from '../components/VoiceMemo';
import { useNavigationGuard } from '../hooks/useNavigationGuard';
import { NavigationGuardModal } from '../components/NavigationGuardModal';
import { CrisisResourceModal } from '../components/CrisisResourceModal';
import { CommitmentCard } from '../components/CommitmentCard';
import { CommitmentSuggestion } from '../components/CommitmentSuggestion';
import { getActiveCommitment, createCommitment, type Commitment } from '../lib/commitments';

const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const LS_DISMISS_KEY = (k: string) => `diary_hint_dismissed_${k}`;
const LS_CREATED_KEY = (k: string) => `diary_hint_created_${k}`;

function withinCooldown(raw: string | null): boolean {
  const ts = raw ? Number(raw) : NaN;
  return Number.isFinite(ts) && ts > 0 && Date.now() - ts < COOLDOWN_MS;
}

interface Message {
  id: string;
  sender: 'user' | 'counselor';
  content: string;
  created_at: string;
  followUp?: FollowUp;
  followUpUsed?: boolean;
  meta?: ChatMeta;
  chips?: string[];
  isAdaptiveChips?: boolean;
  chipInsertMap?: Record<string, string>;
  chipMetaLookup?: Record<string, MessageChipMeta>;
  chipMeta?: MessageChipMeta;
  chipTooltip?: string;
  uxStance?: SupportStance;
  uxIntensity?: number;
}

interface Thread {
  id: string;
  title: string;
  created_at: string;
  sort_order: number;
  welcome_inserted: boolean;
  linked_journal_entry_id?: string | null;
  memory_extracted_at?: string | null;
}

const CHAT_CHIP_DISMISS_PREFIX = 'chat_insight_chip_dismissed_at:';
const INSIGHT_SHORTCUT_INTERACTED_PREFIX = 'insight_shortcut_interacted_at:';

export function ChatPage() {
  const { user } = useAuth();
  const chipCooldownActive = useChipCooldown(user?.id);
  const qc = useQueryClient();
  const { data: _isAdmin } = useAdmin();
  const { data: profile } = useProfile();
  const { isTokenExhausted, reason: tokenExhaustReason } = useTokenStatus();
  const { canPlay } = useSoundSettings();
  const { data: latestInsight } = useLatestInsightAt();
  const { showActivation, dismiss: dismissActivation, evidenceEnough } = useInsightActivation();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const [threads, setThreads] = useState<Thread[]>([]);
  const threadsRef = useRef<Thread[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const currentThreadIdRef = useRef<string | null>(null);
  const isSendingRef = useRef(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [elenaNotebook, setElenaNotebook] = useState<ElenaMemoryNote[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showPracticasConfirm, setShowPracticasConfirm] = useState(false);
  const [practicasLoading, setPracticasLoading] = useState(false);
  const [showCrisisModal, setShowCrisisModal] = useState(false);
  const [activeCommitment, setActiveCommitment] = useState<Commitment | null>(null);
  const [pendingCommitment, setPendingCommitment] = useState<{ text: string; outcome: 'done' | 'not_done' } | null>(null);
  // Journal → Elena handoff: full entry passed as hidden context for the first turn
  // of a freshly-created reflection thread. Keyed by threadId so it can never
  // attach to a different conversation if the user switches threads first.
  const [pendingReflection, setPendingReflection] = useState<{ threadId: string; title: string | null; content: string } | null>(null);
  // Tracks the source diary entry for a reflection thread so that if the user
  // converts this chat to a diary, they're redirected to the original entry.
  const [reflectionSourceEntryId, setReflectionSourceEntryId] = useState<{ threadId: string; entryId: string } | null>(null);
  const [showCommitmentInput, setShowCommitmentInput] = useState(false);
  const [commitmentDraft, setCommitmentDraft] = useState('');
  const [savingCommitment, setSavingCommitment] = useState(false);
  const commitmentInputRef = useRef<HTMLInputElement>(null);
  const [pendingElenaCommitment, setPendingElenaCommitment] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null);
  const [deletingThread, setDeletingThread] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [securityError, setSecurityError] = useState(false);
  const [tokenLimitError, setTokenLimitError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingInHeader, setEditingInHeader] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [pendingChip, setPendingChip] = useState<MessageChipMeta | null>(null);
  const [_currentMood, setCurrentMood] = useState<MoodState>({
    mood: 'neutral',
    valence: 0,
    arousal: 0.5,
    confidence: 0,
    reasons: [],
    updatedAt: new Date().toISOString(),
  });
  const editInputRef = useRef<HTMLInputElement>(null);
  const headerEditInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const lastMoodUpdateAtRef = useRef<number>(0);
  const impressionTrackedRef = useRef<Record<string, true>>({});
  const welcomeInsertingRef = useRef<Set<string>>(new Set());
  const suppressLoadRef = useRef(false);

  const stanceLockRef = useRef<StanceLock | null>(null);
  const boundaryAttemptsByThreadRef = useRef<Record<string, number>>({});
  const [alreadyDismissed, setAlreadyDismissed] = useState(false);
  const [inlineToast, setInlineToast] = useState<string | null>(null);
  const [isFirstTimeUser, setIsFirstTimeUser] = useState<boolean | null>(null);
  const [firstSessionTopicJustSaved, setFirstSessionTopicJustSaved] = useState(false);
  const inlineToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Navigation guard: warn when the user has typed a message but hasn't sent it
  const isDirty = inputMessage.trim().length > 0;
  const { pendingPath, confirmNavigation, cancelNavigation } = useNavigationGuard(isDirty);

  interface LinkedEntry { id: string; title: string | null; is_draft: boolean; saved_at: string | null; }
  const [linkedEntry, setLinkedEntry] = useState<LinkedEntry | null>(null);
  const [isLinkedEntryLoading, setIsLinkedEntryLoading] = useState(false);

  const frPrevShowDiaryHintRef = useRef(false);
  const frPrevShowActivationRef = useRef(false);
  const frPageOpenedRef = useRef(false);
  // Guards the journal→Elena reflection handoff against a re-entrant loadThreads
  // (React StrictMode invokes mount effects twice). Resets naturally on remount.
  const reflectionInProgressRef = useRef(false);

  const continuationHintFiredRef = useRef(false);
  const [showContinuationHint, setShowContinuationHint] = useState(false);

  const chatPageSource = useMemo((): string => {
    try {
      const stored = sessionStorage.getItem('chatPageSource');
      if (stored) {
        sessionStorage.removeItem('chatPageSource');
        return stored;
      }
    } catch {}
    const params = new URLSearchParams(search);
    if (params.has('prefill')) return 'manual_nav';
    if (document.referrer) {
      const ref = document.referrer;
      if (ref.includes('/journal')) return 'return_from_journal';
      if (ref.includes('/insights')) return 'return_from_insights';
    }
    return 'app_start';
  }, []);

  useEffect(() => {
    if (!user || frPageOpenedRef.current) return;
    frPageOpenedRef.current = true;
    const frKey = `fr_chat_opened_${getSessionId()}_${user.id}`;
    try {
      if (sessionStorage.getItem(frKey)) return;
      sessionStorage.setItem(frKey, '1');
    } catch {}
    const hasExistingMessages = messages.length > 0;
    recordFlightEvent(user.id, 'CHAT_PAGE_OPENED', { source: chatPageSource, hasExistingMessages });
  }, [user]);

  const showInlineToast = (msg: string, durationMs = 3000) => {
    if (inlineToastTimerRef.current) clearTimeout(inlineToastTimerRef.current);
    setInlineToast(msg);
    inlineToastTimerRef.current = setTimeout(() => setInlineToast(null), durationMs);
  };

  useEffect(() => {
    const prefill = new URLSearchParams(search).get('prefill');
    if (prefill) setInputMessage(prefill);
  }, [search]);

  useEffect(() => {
    setAlreadyDismissed(false);
    setLinkedEntry(null);
    setIsLinkedEntryLoading(!!currentThreadId);
  }, [currentThreadId]);

  useEffect(() => {
    if (!currentThreadId) return;
    let cancelled = false;

    const thread = threadsRef.current.find(t => t.id === currentThreadId);
    const dbLinkedId = thread?.linked_journal_entry_id;

    if (dbLinkedId) {
      supabase
        .from('journal_entries')
        .select('id, title, is_draft, saved_at, created_at')
        .eq('id', dbLinkedId)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled) {
            setLinkedEntry(data ?? null);
            setIsLinkedEntryLoading(false);
          }
        });
    } else {
      supabase
        .from('journal_entries')
        .select('id, title, is_draft, saved_at, created_at')
        .eq('origin', 'chat')
        .eq('source_chat_id', currentThreadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled) {
            setLinkedEntry(data ?? null);
            setIsLinkedEntryLoading(false);
            if (data?.id) {
              supabase
                .from('chat_threads')
                .update({ linked_journal_entry_id: data.id })
                .eq('id', currentThreadId)
                .then(() => {
                  setThreads(prev =>
                    prev.map(t =>
                      t.id === currentThreadId
                        ? { ...t, linked_journal_entry_id: data.id }
                        : t
                    )
                  );
                });
            }
          }
        });
    }

    return () => { cancelled = true; };
  }, [currentThreadId]);

  const blockedByCooldown = useMemo(() => {
    if (typeof window === 'undefined') return false;
    if (!currentThreadId) {
      if (import.meta.env.DEV) {
        const currentThread = threads.find(t => t.id === currentThreadId);
        console.warn('[DiaryHint] threadKey missing — blocking hint', {
          currentThreadId,
          currentThread: currentThread ?? null,
          threadsCount: threads.length,
          location: window.location.pathname,
        });
      }
      return true;
    }
    return (
      withinCooldown(localStorage.getItem(LS_DISMISS_KEY(currentThreadId))) ||
      withinCooldown(localStorage.getItem(LS_CREATED_KEY(currentThreadId)))
    );
  }, [currentThreadId, alreadyDismissed, threads]);

  function isEmotionalMessage(text: string): boolean {
    const emotionalPatterns = [
      /\bi feel\b/i,
      /\bi'm (anxious|excited|nervous|scared|overwhelmed|sad|lonely|afraid|worried|angry|upset|lost|confused|depressed|hopeless|happy|grateful)\b/i,
      /\bme siento\b/i,
      /\bsiento (que|mucho|muy|bastante)\b/i,
      /\btengo (miedo|ansiedad|ganas de llorar)\b/i,
      /\bestoy (triste|ansios|asustado|asustada|abrumado|abrumada|solo|sola|perdido|perdida)\b/i,
      /\bmy (heart|anxiety|depression|feelings?|emotions?|mood)\b/i,
      /\bi (feel|felt|am feeling)\b/i,
    ];
    return emotionalPatterns.some(p => p.test(text));
  }

  useEffect(() => {
    if (user) loadThreads();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    getActiveCommitment(user.id).then(setActiveCommitment);
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('sender', 'user')
      .limit(1)
      .then(({ count }) => {
        setIsFirstTimeUser((count ?? 0) === 0);
      });
  }, [user?.id]);

  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  useEffect(() => {
    currentThreadIdRef.current = currentThreadId;
  }, [currentThreadId]);

  // On leaving the chat page, discard the current thread if it was never used.
  useEffect(() => {
    return () => {
      const id = currentThreadIdRef.current;
      if (id && !isSendingRef.current) void discardThreadIfEmpty(id);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (suppressLoadRef.current) { suppressLoadRef.current = false; return; }
    if (currentThreadId && profile) loadMessages(currentThreadId);
  }, [currentThreadId, profile?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  useEffect(() => {
    if (!isSending && !isTokenExhausted) {
      chatInputRef.current?.focus();
    }
  }, [isSending]);

  useEffect(() => {
    if (currentThreadId && !isTokenExhausted) {
      setTimeout(() => chatInputRef.current?.focus(), 80);
    }
  }, [currentThreadId]);

  useEffect(() => {
    if (isSending || chipCooldownActive) return;
    const latest = [...messages].reverse().find(m => m.sender === 'counselor');
    if (!latest || impressionTrackedRef.current[latest.id]) return;
    const hasCrisis = latest.meta?.crisis === 'YES';
    const hasHighIntensity = (latest.meta?.intensity ?? 0) > 0.75;
    if (hasCrisis || hasHighIntensity) return;
    const hasChips = (latest.chips?.length ?? 0) > 0;
    if (!hasChips) return;
    impressionTrackedRef.current[latest.id] = true;
    supabase.functions.invoke('chip-event', { body: { type: 'impression' } }).catch(() => {});
  }, [messages, isSending, chipCooldownActive]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadThreads = async () => {
    // ── Journal → Elena reflection handoff: claim synchronously ─────────────
    // Read + claim the pending reflection BEFORE any await, so a re-entrant
    // loadThreads (React StrictMode double-invokes mount effects) cannot also
    // pass this check. Exactly one invocation handles it; the other bails out
    // instead of falling through and selecting an existing thread.
    const reflectionRaw = sessionStorage.getItem('journalReflectionEntry');
    const handlingReflection = !!reflectionRaw && !!user && !reflectionInProgressRef.current;
    if (handlingReflection) {
      reflectionInProgressRef.current = true;
      sessionStorage.removeItem('journalReflectionEntry');
    } else if (reflectionInProgressRef.current) {
      // Another invocation this mount is already creating the reflection thread.
      return;
    }

    const { data, error } = await supabase
      .from('chat_threads')
      .select('id, title, created_at, sort_order, welcome_inserted, linked_journal_entry_id')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (!error && data) {
      const normalized = data.map((t, i) => ({
        ...t,
        sort_order: i,
        welcome_inserted: t.welcome_inserted ?? false,
        linked_journal_entry_id: (t as { linked_journal_entry_id?: string | null }).linked_journal_entry_id ?? null,
      }));
      setThreads(normalized);

      // Always open a FRESH thread for a reflection, hand Elena the entry as
      // hidden context (pendingReflection), and prefill an editable opener the
      // user sends themselves — they stay in control, no tokens until they engage.
      if (handlingReflection && reflectionRaw && user) {
        try {
          const parsed = JSON.parse(reflectionRaw) as { id?: string | null; title?: string | null; content?: string };
         if (parsed?.content?.trim()) {
            const entryId = parsed.id || null;
            // 1:1 guard: if a thread is already linked to this diary entry, open
            // that one instead of creating a second (covers a stale diary banner,
            // double-clicks, or a backlink that didn't round-trip). One diary ->
            // one chat, always.
            const existingForEntry = entryId
              ? normalized.find(t => t.linked_journal_entry_id === entryId)
              : null;
            if (existingForEntry) {
              setCurrentThreadId(existingForEntry.id);
              setReflectionSourceEntryId({ threadId: existingForEntry.id, entryId: entryId! });
              return; // handled — reuse the existing thread
            }
            const shifted = normalized.map((t, i) => ({ ...t, sort_order: i + 1 }));
            await Promise.all(
              shifted.map(t =>
                supabase.from('chat_threads').update({ sort_order: t.sort_order }).eq('id', t.id)
              )
            );
            const { data: reflectionThread } = await supabase
              .from('chat_threads')
              .insert({ user_id: user.id, title: parsed.title?.trim() || 'Reflexión de diario', sort_order: 0, welcome_inserted: true, linked_journal_entry_id: entryId })
              .select('id, title, created_at, sort_order, welcome_inserted, linked_journal_entry_id')
              .single();
            if (reflectionThread) {
              setThreads([
                { ...reflectionThread, sort_order: 0, welcome_inserted: true },
                ...shifted,
              ]);
              setCurrentThreadId(reflectionThread.id);
              setMessages([]);
              setPendingReflection({
                threadId: reflectionThread.id,
                title: parsed.title?.trim() || null,
                content: parsed.content,
              });
              if (entryId) {
                setReflectionSourceEntryId({ threadId: reflectionThread.id, entryId });
                // Backlink the diary entry to this thread so the entry remembers
                // its chat: next visit shows "Continuar con Elena" instead of
                // spawning a second thread. ON DELETE SET NULL keeps this clean
                // if the thread is later deleted.
                supabase
                  .from('journal_entries')
                  .update({ linked_chat_id: reflectionThread.id })
                  .eq('id', entryId)
                  .then(({ error: linkErr }) => {
                    if (linkErr) console.error('journal_linked_chat_update_failed', linkErr);
                  });
              }
              setInputMessage('Quiero hablar contigo sobre lo que acabo de escribir.');
              return; // handled — skip the default thread auto-select below
            }
          }
          reflectionInProgressRef.current = false; // creation failed/empty — allow normal flow
        } catch {
          reflectionInProgressRef.current = false;
          // Malformed payload — fall through to normal thread selection.
        }
      }

      // Read from URL param first (survives mobile full-page reloads), fall back to sessionStorage
      const urlParams = new URLSearchParams(window.location.search);
      const pendingOpen = urlParams.get('openThread') || sessionStorage.getItem('openChatThread');
      if (pendingOpen) {
        sessionStorage.removeItem('openChatThread');
        if (urlParams.has('openThread')) {
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('openThread');
          window.history.replaceState({}, '', cleanUrl.toString());
        }
        const target = normalized.find(t => t.id === pendingOpen);
        if (target) {
          setCurrentThreadId(target.id);
        } else if (normalized.length > 0 && !currentThreadId) {
          setCurrentThreadId(normalized[0].id);
        }
      } else if (normalized.length > 0 && !currentThreadId) {
        setCurrentThreadId(normalized[0].id);
      }
      const needsUpdate = normalized.some((_t, i) => data[i].sort_order !== i);
      if (needsUpdate) {
        await Promise.all(
          normalized.map(t =>
            supabase.from('chat_threads').update({ sort_order: t.sort_order }).eq('id', t.id)
          )
        );
      }
    }
  };

  const insertWelcomeMessage = async (threadId: string) => {
    if (!user || !profile) return;
    if (welcomeInsertingRef.current.has(threadId)) return;
    welcomeInsertingRef.current.add(threadId);
    try {
      const lastChatAt = await getLastUserChatTimestamp(user.id);
      const name = getPreferredGreetingName(profile);

      const hoursAbsent = lastChatAt
        ? (Date.now() - lastChatAt.getTime()) / (1000 * 60 * 60)
        : null;

      const forceInsightGreeting = import.meta.env.DEV && !!localStorage.getItem('elena_dev_force_insight_greeting');

      let text: string = '';
      if (hoursAbsent === null) {
        // First-time user — use new calibrating greetings
        text = buildContextualGreeting(lastChatAt, name);
      } else {
        // Returning user — recency-aware priority:
        //   1. recent chat signal (7-day)
        //   2. recent weekly insight (14-day)
        //   3. dynamic elena_memories theme/event (rotated, 7-day reuse floor)
        //   4. frozen first_session_topic — last resort, new users w/ no extracted memories
        //   5. time-based generic fallback
        let resolved = false;

        // 1. Signal (only meaningful within the past week)
        if (forceInsightGreeting || hoursAbsent <= 168) {
          const signalData = await getChatSignalForReturn();
          if (signalData) {
            text = buildReturnGreetingWithSignal(name, signalData.type);
            resolved = true;
          }
        }

        // 2. Insight
        if (!resolved && (forceInsightGreeting || hoursAbsent >= 48)) {
          const insightSnippet = await getInsightSnippetForReturn();
          if (insightSnippet) {
            text = buildReturnGreetingWithInsight(name, insightSnippet);
            resolved = true;
          }
        }

        // 3. Dynamic memory theme/event
        if (!resolved) {
          const memoryGreeting = await buildDynamicMemoryGreeting(name, profile);
          if (memoryGreeting) {
            text = memoryGreeting;
            resolved = true;
          }
        }

        // 4. Frozen first-session topic — last resort (typically new users)
        if (!resolved) {
          try {
            const topicEnc = await getFirstSessionTopicEnc(user.id);
            if (topicEnc) {
              const topic = await decryptForUser(topicEnc, profile);
              if (topic && topic.length > 5) {
                text = buildReturnGreetingWithMemory(name, topic);
                resolved = true;
              }
            }
          } catch (memErr) {
            console.log('[greeting] Could not load first session topic:', memErr);
          }
        }

        // 5. Time-based generic fallback
        if (!resolved) {
          text = buildContextualGreeting(lastChatAt, name);
        }
      }
      const encryptedText = await encryptForUser(text, profile);

      const { data: welcomeMsg } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: threadId,
          user_id: user.id,
          sender: 'counselor',
          content_enc: encryptedText,
          enc_version: 2,
          meta: { kind: 'welcome' },
        })
        .select()
        .single();

      await supabase
        .from('chat_threads')
        .update({ welcome_inserted: true })
        .eq('id', threadId);

      setThreads(prev =>
        prev.map(t => t.id === threadId ? { ...t, welcome_inserted: true } : t)
      );

      if (welcomeMsg) {
        const currentMessages = [{ id: welcomeMsg.id, sender: 'counselor' as const, content: text, created_at: welcomeMsg.created_at }];
        setMessages(currentMessages);
        const hasUserMsg = messages.some(m => m.sender === 'user');
        const hasAssistantMsg = messages.some(m => m.sender === 'counselor');
        const messageCountAtRender = messages.length;
        if (!hasUserMsg && !hasAssistantMsg) {
          const isFirstThread = threads.length <= 1;
          const greetingType = isFirstThread ? 'first_time' : 'follow_up';
          recordFlightEvent(user?.id, 'CHAT_GREETING_VISIBLE', { greetingType, messageCountAtRender });
        }
      }
    } catch (err) {
      console.error('Failed to insert welcome message:', err);
      welcomeInsertingRef.current.delete(threadId);
    }
  };

  const loadMessages = async (threadId: string) => {
    if (!profile) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, sender, content_enc, created_at, chip_meta')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        if (data.length === 0) {
          const thread = threads.find(t => t.id === threadId);
          if (!thread?.welcome_inserted && !welcomeInsertingRef.current.has(threadId)) {
            await insertWelcomeMessage(threadId);
          } else {
            setMessages([]);
          }
        } else {
          const decryptedMessages = await Promise.all(
            data.map(async (msg) => ({
              id: msg.id,
              sender: msg.sender as 'user' | 'counselor',
              content: await decryptForUser(msg.content_enc, profile),
              created_at: msg.created_at,
              chipMeta: msg.chip_meta as unknown as MessageChipMeta | undefined,
            }))
          );
          setMessages(decryptedMessages);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'MISSING_ENCRYPTION_SECRET') {
        setSecurityError(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const selectThread = (threadId: string) => {
    const leaving = currentThreadId;
    if (leaving && leaving !== threadId) void discardThreadIfEmpty(leaving);
    setCurrentThreadId(threadId);
    setPendingChip(null);
    setShowSidebar(false);
    stanceLockRef.current = null;
  };

  const createNewThread = async (options?: { skipWelcome?: boolean }): Promise<string | null> => {
    if (!user) return null;

    // If the user is leaving an unused thread, discard it instead of stacking empties.
    const leaving = currentThreadId;
    let discardedId: string | null = null;
    if (leaving) discardedId = await discardThreadIfEmpty(leaving, false);

    const shiftedThreads = threads
      .filter(t => t.id !== discardedId)
      .map((t, i) => ({ ...t, sort_order: i + 1 }));
    await Promise.all(
      shiftedThreads.map(t =>
        supabase.from('chat_threads').update({ sort_order: t.sort_order }).eq('id', t.id)
      )
    );

    const insertPayload: Record<string, unknown> = {
      user_id: user.id,
      title: 'Nueva conversación',
      sort_order: 0,
    };
    if (options?.skipWelcome) {
      insertPayload.welcome_inserted = true;
    }

    const { data, error } = await supabase
      .from('chat_threads')
      .insert(insertPayload)
      .select()
      .single();

    if (!error && data) {
      const welcome_inserted = options?.skipWelcome ? true : (data.welcome_inserted ?? false);
      setThreads([{ ...data, sort_order: 0, welcome_inserted }, ...shiftedThreads]);
      setCurrentThreadId(data.id);
      setMessages([]);
      setShowSidebar(false);
      return data.id;
    }
    return null;
  };

  // Delete a thread the user is leaving if it never received a user message.
  // Welcome-only ("Nueva conversación") threads are treated as empty/discardable.
  // Returns the discarded thread id (or null). When pruneState is true, also
  // removes it from local thread state; callers that rebuild thread state
  // themselves pass false to avoid a redundant/racy update.
  const discardThreadIfEmpty = async (
    threadId: string | null,
    pruneState = true,
  ): Promise<string | null> => {
    if (!threadId) return null;
    if (isSendingRef.current) return null; // a message is in flight — keep the thread

    const { count, error } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('thread_id', threadId)
      .eq('sender', 'user');

    if (error || (count ?? 0) > 0) return null; // has a real message, or check failed — keep it

    await supabase.from('chat_messages').delete().eq('thread_id', threadId);
    await supabase.from('chat_threads').delete().eq('id', threadId);

    if (pruneState) {
      setThreads(prev =>
        prev.filter(t => t.id !== threadId).map((t, i) => ({ ...t, sort_order: i }))
      );
    }
    return threadId;
  };

  const requestDeleteThread = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setThreadToDelete(threadId);
  };

  const confirmDeleteThread = async () => {
    const threadId = threadToDelete;
    if (!threadId) return;
    setDeletingThread(true);

    await supabase.from('chat_threads').delete().eq('id', threadId);

    const remaining = threads.filter(t => t.id !== threadId).map((t, i) => ({ ...t, sort_order: i }));
    setThreads(remaining);

    if (currentThreadId === threadId) {
      const nextId = remaining.length > 0 ? remaining[0].id : null;
      setCurrentThreadId(nextId);
      setMessages([]);
      if (!nextId) setShowSidebar(true);
    }

    await Promise.all(
      remaining.map(t =>
        supabase.from('chat_threads').update({ sort_order: t.sort_order }).eq('id', t.id)
      )
    );

    setDeletingThread(false);
    setThreadToDelete(null);
  };

  const handleDragStart = (e: React.DragEvent, threadId: string) => {
    setDraggedId(threadId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, threadId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (threadId !== draggedId) setDragOverId(threadId);
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    const fromIdx = threads.findIndex(t => t.id === draggedId);
    const toIdx = threads.findIndex(t => t.id === targetId);
    const newThreads = [...threads];
    const [moved] = newThreads.splice(fromIdx, 1);
    newThreads.splice(toIdx, 0, moved);
    const reordered = newThreads.map((t, i) => ({ ...t, sort_order: i }));
    setThreads(reordered);
    setDraggedId(null);
    setDragOverId(null);
    await Promise.all(
      reordered.map(t =>
        supabase.from('chat_threads').update({ sort_order: t.sort_order }).eq('id', t.id)
      )
    );
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const startEditTitle = (thread: Thread, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingInHeader(false);
    setEditingThreadId(thread.id);
    setEditingTitle(thread.title);
    setTimeout(() => editInputRef.current?.select(), 0);
  };

  const startEditTitleFromHeader = () => {
    if (!currentThread) return;
    setEditingInHeader(true);
    setEditingThreadId(currentThread.id);
    setEditingTitle(currentThread.title);
    setTimeout(() => headerEditInputRef.current?.select(), 0);
  };

  const commitRename = async () => {
    if (!editingThreadId) return;
    const trimmed = editingTitle.trim();
    if (!trimmed) {
      cancelRename();
      return;
    }
    setThreads(prev => prev.map(t => t.id === editingThreadId ? { ...t, title: trimmed } : t));
    await supabase.from('chat_threads').update({ title: trimmed }).eq('id', editingThreadId);
    setEditingThreadId(null);
    setEditingInHeader(false);
  };

  const cancelRename = () => {
    setEditingThreadId(null);
    setEditingTitle('');
    setEditingInHeader(false);
  };

  const handleFollowUpClick = async (followUp: FollowUp) => {
    if (!user || !currentThreadId || isSending || !profile) return;

    // Don't mark as used for resource — modal opens from ChatPage instead
    if (followUp.actionType !== 'resource') {
      setMessages(prev => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].sender === 'counselor' && updated[i].followUp) {
            updated[i] = { ...updated[i], followUpUsed: true };
            break;
          }
        }
        return updated;
      });
    }

    if (followUp.actionType === 'journal') {
      setLocation('/journal');
    } else if (followUp.actionType === 'practicas') {
      setShowPracticasConfirm(true);
      return; // don't mark followUp as used yet — modal handles navigation
    } else if (followUp.actionType === 'resource') {
      setShowCrisisModal(true);
      return;
    } else if (followUp.actionType === 'save_memory' && followUp.payload) {
      try {
        const { key, value } = followUp.payload;
        if (key && value) {
          const encryptedValue = await encryptForUser(value, profile);
          await saveUserMemory(key, encryptedValue);
        }
      } catch (error) {
        console.error('Error saving memory:', error);
      }
    }
  };

  const handlePracticasConfirm = async () => {
    setPracticasLoading(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const token = currentSession?.access_token;
      if (token) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        await fetch(`${supabaseUrl}/functions/v1/assign-daily-tasks`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_tasks', force: true }),
        });
      }
    } catch (err) {
      console.error('Practicas force-assign error:', err);
    } finally {
      setPracticasLoading(false);
      setShowPracticasConfirm(false);
      setLocation('/practicas');
    }
  };

  const handlePracticasCancel = () => {
    setShowPracticasConfirm(false);
  };

  const handleDismissDiarySuggestion = () => {
    if (!currentThreadId) return;
    localStorage.setItem(LS_DISMISS_KEY(currentThreadId), String(Date.now()));
    setAlreadyDismissed(true);
    recordFlightEvent(user?.id, 'DIARY_SUGGESTION_CHIP_DISMISSED', { reason: diarySuggEval.reason });
    if (import.meta.env.DEV) console.log('[DiaryHint] dismissed for thread', currentThreadId);
  };

  const handleCreateDiaryDraft = async () => {
    recordFlightEvent(user?.id, 'DIARY_SUGGESTION_CHIP_CLICKED');
    if (!currentThreadId) {
      console.warn('[DiaryHint] createDraft blocked: threadKey missing', {
        currentThreadId,
        threadsCount: threads.length,
        location: window.location.pathname,
      });
      showInlineToast('Espera un momento… preparando la conversación.');
      return;
    }
    if (!user || !profile) {
      if (import.meta.env.DEV) console.log('[DiaryHint] handleCreateDiaryDraft aborted — missing user/profile');
      return;
    }

    const threadKey = currentThreadId;

    const { data: existing, error: lookupError } = await supabase
      .from('journal_entries')
      .select('id, is_draft, created_at')
      .eq('origin', 'chat')
      .eq('source_chat_id', threadKey)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (import.meta.env.DEV) console.log('[DiaryHint] dedup lookup', { threadKey, existing, lookupError });

    if (existing?.id) {
      if (import.meta.env.DEV) console.log('[DiaryHint] opening existing entry', existing.id);
      const existingThread = threadsRef.current.find(t => t.id === threadKey);
      if (!existingThread?.linked_journal_entry_id || existingThread.linked_journal_entry_id !== existing.id) {
        await supabase.from('chat_threads').update({ linked_journal_entry_id: existing.id }).eq('id', threadKey);
        setThreads(prev => prev.map(t => t.id === threadKey ? { ...t, linked_journal_entry_id: existing.id } : t));
      }
      sessionStorage.setItem('diaryAutoOpen', existing.id);
      setLinkedEntry({ id: existing.id, title: null, is_draft: existing.is_draft, saved_at: null });
    } else {
      const userMessages = messages.filter(m => m.sender === 'user').map(m => m.content);
      const latestCounselorMsg = [...messages].reverse().find(m => m.sender === 'counselor');
      const suggEval = evaluateDiarySuggestion(userMessages);
      const draft = generateDiaryDraft({
        userMessages,
        uxStance: latestCounselorMsg?.uxStance,
        uxIntensity: latestCounselorMsg?.uxIntensity,
      });
      const encryptedContent = await encryptForUser(draft.content, profile);
      const { data: newEntry } = await supabase
        .from('journal_entries')
        .insert({
          user_id: user.id,
          title: draft.title,
          content_enc: encryptedContent,
          enc_version: 2,
          tags: draft.tags,
          sort_order: 0,
          is_draft: true,
          origin: 'chat',
          source_chat_id: threadKey,
          trigger_reason: suggEval.reason ?? null,
          emotion_score_at_creation: Number.isFinite(suggEval.heaviness) ? suggEval.heaviness : null,
          saved_at: null,
        })
        .select('id')
        .single();
      if (import.meta.env.DEV) console.log('[DiaryHint] created new entry', { id: newEntry?.id, threadKey });
      if (newEntry) {
        await supabase.from('chat_threads').update({ linked_journal_entry_id: newEntry.id }).eq('id', threadKey);
        setThreads(prev => prev.map(t => t.id === threadKey ? { ...t, linked_journal_entry_id: newEntry.id } : t));
        sessionStorage.setItem('diaryAutoOpen', newEntry.id);
        setLinkedEntry({ id: newEntry.id, title: draft.title, is_draft: true, saved_at: null });
      }
    }

    localStorage.setItem(LS_CREATED_KEY(threadKey), String(Date.now()));
    setAlreadyDismissed(true);
    try { sessionStorage.setItem('journalPageSource', 'chat_suggestion'); } catch {}
    setLocation('/journal');
  };

  const handleChipSelect = async (chip: string, messageId: string) => {
    const sourceMsg = messages.find(m => m.id === messageId);
    const humanized = sourceMsg?.chipInsertMap?.[chip] ?? getHumanizedInsertText(chip);
    const meta = sourceMsg?.chipMetaLookup?.[chip];
    const chipMeta = meta
      ? { ...meta, insertText: humanized }
      : { id: `chip-${Date.now()}`, label: chip, intentKey: 'unknown', insertText: humanized };

    supabase.functions.invoke('chip-event', { body: { type: 'click' } }).catch(() => {});

    if (!currentThreadId) {
      const newThreadId = await createNewThread({ skipWelcome: true });
      if (!newThreadId) return;
    }

    setMessages(prev =>
      prev.map(msg => msg.id === messageId ? { ...msg, chips: [] } : msg)
    );
    setInputMessage(humanized);
    setPendingChip(chipMeta);

    setTimeout(() => {
      const el = chatInputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }, 0);
  };

  const handleSendMessage = async (overrideMessage?: string, threadIdOverride?: string, chipMetaOverride?: MessageChipMeta | null) => {
    const messageToSend = overrideMessage || inputMessage.trim();
    const threadId = threadIdOverride ?? currentThreadId;
    if (!messageToSend || !threadId || !user || isSending) return;
    if (!profile) {
      showInlineToast('Un momento, cargando tu sesión...');
      return;
    }
    setChatError(null);
    if (isTokenExhausted) {
      return;
    }

    const chipMetaForMessage = chipMetaOverride !== undefined ? chipMetaOverride : pendingChip;
    setPendingChip(null);

    const recentUserContext = messages
      .filter(m => m.sender === 'user')
      .slice(-2)
      .map(m => m.content);
    const moodPromise = runMoodDetect(
      messageToSend,
      recentUserContext,
      lastMoodUpdateAtRef.current,
    );

    recordFlightEvent(user?.id, 'USER_SENT_MESSAGE', { length: messageToSend.length });
    const isFirstEverMessage = isFirstTimeUser === true;
    if (isFirstTimeUser) setIsFirstTimeUser(false);
    setIsSending(true);
    isSendingRef.current = true;
    if (!overrideMessage) {
      setInputMessage('');
      if (chatInputRef.current) {
        chatInputRef.current.style.height = '40px';
        chatInputRef.current.style.overflowY = 'hidden';
      }
    }

    setMessages(prev => {
      const updated = [...prev];
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].sender === 'counselor') {
          if (updated[i].followUp && !updated[i].followUpUsed) {
            updated[i] = { ...updated[i], followUpUsed: true, chips: [] };
          } else if (updated[i].chips?.length) {
            updated[i] = { ...updated[i], chips: [] };
          }
          break;
        }
      }
      return updated;
    });

    try {
      const optimisticId = `optimistic-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: optimisticId,
        sender: 'user',
        content: messageToSend,
        created_at: new Date().toISOString(),
        chipMeta: chipMetaForMessage ?? undefined,
      }]);

      const encryptedMessage = await encryptForUser(messageToSend, profile);

      const { data: userMessage, error: userInsertError } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: threadId,
          user_id: user.id,
          sender: 'user',
          content_enc: encryptedMessage,
          enc_version: 2,
          chip_meta: (chipMetaForMessage ?? null) as Record<string, unknown> | null,
        })
        .select()
        .single();

      if (userInsertError) {
        console.error('[chat] User message insert failed:', userInsertError);
      }

      if (userMessage) {
        setMessages(prev => prev.map(m =>
          m.id === optimisticId
            ? { ...m, id: userMessage.id, created_at: userMessage.created_at }
            : m
        ));
      }

      let decryptedMemories: Array<{ key: string; value: string }> = [];
      try {
        const memoriesData = await getUserMemories(5);
        if (memoriesData?.memories && Array.isArray(memoriesData.memories)) {
          decryptedMemories = await Promise.all(
            memoriesData.memories.map(async (mem: any) => ({
              key: mem.key,
              value: await decryptForUser(mem.value_enc, profile),
            }))
          );
        }
      } catch (memError) {
        console.log('Could not load memories, continuing without them:', memError);
      }

      // Load Elena's biographical notebook
      let currentNotebook = elenaNotebook;
      try {
        currentNotebook = await loadElenaMemories(profile);
        setElenaNotebook(currentNotebook);
      } catch (notebookError) {
        console.log('Could not load elena notebook:', notebookError);
      }
 
      // Load the user's active declared intentions (plaintext, for context only)
      let currentIntentions: string[] = [];
      try {
        const activeIntentions = await loadIntentions(profile);
        currentIntentions = activeIntentions.map(i => i.text);
      } catch (intentionsError) {
        console.log('Could not load intentions:', intentionsError);
      }

      const conversationHistory = messages
        .filter(m => m.content?.trim())
        .slice(-20)
        .map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.content }));

      const lastCounselorMsg = [...messages].reverse().find(m => m.sender === 'counselor');
      const previousHadChips = (lastCounselorMsg?.chips?.length ?? 0) > 0;

      const recentUserTextForUX = messages
        .filter(m => m.sender === 'user')
        .slice(-3)
        .map(m => m.content)
        .join(' ');
      const { state: preUXState, nextLock: preNextLock } = getUXContextState({
        lastUserMessage: messageToSend,
        recentUserMessages: recentUserTextForUX,
        stanceLock: stanceLockRef.current ?? undefined,
        selectedChipType: chipMetaForMessage?.intentKey,
      });
      stanceLockRef.current = preNextLock;

      const threadBoundaryAttempts = boundaryAttemptsByThreadRef.current[threadId] ?? 0;
      if (isEmotionalMessage(messageToSend)) {
        boundaryAttemptsByThreadRef.current[threadId] = 0;
      }

      const devFlags: DevFlags | undefined = import.meta.env.DEV ? {
        forceRecognition: !!localStorage.getItem('elena_dev_force_recognition'),
        forceReturnTrigger: !!localStorage.getItem('elena_dev_force_return_trigger'),
        forceMemoryMatch: !!localStorage.getItem('elena_dev_force_memory_match'),
      } : undefined;

      const commitmentForThisMessage = pendingCommitment;
      if (pendingCommitment) setPendingCommitment(null);

      // Only attach the journal entry context if this is the reflection thread it
      // was created for — guards against the user switching threads before sending.
      const reflectionForThisMessage =
        pendingReflection && pendingReflection.threadId === threadId
          ? { title: pendingReflection.title, content: pendingReflection.content }
          : null;
      if (reflectionForThisMessage) setPendingReflection(null);

      const aiResponse = await sendChatMessage(
        threadId,
        messageToSend,
        decryptedMemories,
        conversationHistory,
        previousHadChips,
        preUXState.stance,
        preUXState.intensity,
        threadBoundaryAttempts,
        devFlags,
        chipMetaForMessage,
        isFirstEverMessage,
        commitmentForThisMessage,
        currentNotebook,
        reflectionForThisMessage,
        currentIntentions,
      );

      // ── Elena commitment suggestion ──────────────────────────────────────
      if (aiResponse.commitment_suggestion && !activeCommitment) {
        setPendingElenaCommitment(aiResponse.commitment_suggestion);
      }

      if (aiResponse.boundary_triggered) {
        boundaryAttemptsByThreadRef.current[threadId] = threadBoundaryAttempts + 1;
      } else if (isEmotionalMessage(messageToSend)) {
        boundaryAttemptsByThreadRef.current[threadId] = 0;
      }
      let replyText = (aiResponse.reply ?? '').replace(/\s+/g, ' ').trim();
      if (!replyText) {
        console.warn('[chat-ai] Empty reply received from edge function', {
          hasReply: !!aiResponse.reply,
          metaState: aiResponse.meta?.state,
        });
        showInlineToast('Tuve un problema al responder. Inténtalo otra vez.');
        return;
      }
      const encryptedReply = await encryptForUser(replyText, profile);

      const { data: aiMessage, error: aiInsertError } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: threadId,
          user_id: user.id,
          sender: 'counselor',
          content_enc: encryptedReply,
          enc_version: 2,
          meta: (aiResponse.meta ?? {}) as unknown as Record<string, unknown>,
        })
        .select()
        .single();

      if (aiInsertError) {
        console.error('[chat] AI message insert failed:', aiInsertError);
      }

      const detectedMood = await moodPromise;
      setCurrentMood(detectedMood);
      lastMoodUpdateAtRef.current = Date.now();

      // ── Auto-save first session topic for return greeting ─────────────────
      // After 3+ user messages in the first session, extract a short topic
      // summary from the conversation and save it as encrypted user memory.
      // This runs once — the 'first_session_topic' key is checked before saving.
      const userMsgCount = messages.filter(m => m.sender === 'user').length + 1; // +1 for current
      console.log('[chat] Topic save check:', { userMsgCount, isFirstEverMessage });
      if (userMsgCount >= 3) {
        // Check if we already saved a topic (avoid duplicate saves)
        try {
          const existingTopic = await supabase
            .from('user_memory')
            .select('key')
            .eq('user_id', user.id)
            .eq('key', 'first_session_topic')
            .maybeSingle();

          if (!existingTopic.data) {
            // Build a short, natural topic from the user's messages.
            // Strategy: the 1st message is usually vague ("algo pesado"),
            // the 2nd names the situation ("es mi jefe"), the 3rd adds weight.
            // Pick the most specific one (prefer 2nd, then 3rd, then 1st).
            const userMessages = messages
              .filter(m => m.sender === 'user' && m.content?.trim())
              .map(m => m.content.trim());
            userMessages.push(messageToSend);

            // Pick the best message for the topic (2nd > 3rd > 1st)
            const best = userMessages[1] ?? userMessages[2] ?? userMessages[0] ?? '';
            // Clean: lowercase first char, remove trailing punctuation, trim to 80 chars
            let topicSummary = best
              .replace(/^[¿¡]+/, '')     // remove leading ¿¡
              .replace(/[.!?,;…]+$/, '') // remove trailing punctuation
              .trim();
            // Lowercase the first letter for natural flow in greeting ("me contaste sobre X")
            if (topicSummary.length > 0) {
              topicSummary = topicSummary[0].toLowerCase() + topicSummary.slice(1);
            }
            // Truncate cleanly at word boundary
            if (topicSummary.length > 80) {
              topicSummary = topicSummary.slice(0, 77).replace(/\s+\S*$/, '') + '…';
            }

            if (topicSummary.length > 5) {
              const encryptedTopic = await encryptForUser(topicSummary, profile);
              await saveUserMemory('first_session_topic', encryptedTopic);
              setFirstSessionTopicJustSaved(true);
              console.log('[chat] First session topic saved:', topicSummary);
            }
          }
        } catch (topicError) {
          console.log('[chat] Could not save first session topic:', topicError);
        }
      }

      const effectiveAiMessage = aiMessage ?? {
        id: `local-${Date.now()}`,
        created_at: new Date().toISOString(),
      };

      const msgCrisis = (aiResponse.meta?.crisis === 'YES') || isCrisisMessage(messageToSend);
      const isHighArousal = (aiResponse.meta?.intensity ?? 0) > 0.5;
      const isLowMood = aiResponse.meta?.valence === 'negative';
      const isPositive = aiResponse.meta?.valence === 'positive';

      const prevUserMsg = messages.filter(m => m.sender === 'user').slice(-1)[0];
      const followUpSignal =
        !msgCrisis && !chipMetaForMessage && prevUserMsg?.chipMeta?.signal
          ? prevUserMsg.chipMeta.signal
          : undefined;

      const chipMode = resolveChipMode({ messages, isCrisis: msgCrisis, followUpSignal });

      let finalChips: string[] = [];
      let chipInsertMap: Record<string, string> = {};
      let chipMetaLookup: Record<string, MessageChipMeta> = {};
      let chipTooltip = '';
      let isAdaptiveChips = false;

      if (chipMode !== 'none') {
        const followUpChipPool = chipMode === 'followup' && followUpSignal ? getFollowUpChips(followUpSignal, 5) : null;
        const candidatePool =
          followUpChipPool ?? selectEmotionChips({ isCrisis: msgCrisis, isHighArousal, isLowMood, isPositive });

        const freshnessCtx = buildChipFreshnessContext(messages);
        const freshChips = applyChipFreshness(candidatePool, freshnessCtx, 3);

        finalChips = freshChips.map(c => c.label);
        chipInsertMap = Object.fromEntries(freshChips.map(c => [c.label, c.insertText]));
        chipMetaLookup = Object.fromEntries(
          freshChips.map(c => [c.label, { id: c.id, label: c.label, intentKey: c.id, signal: c.signal }]),
        );
        chipTooltip = msgCrisis
          ? 'Opciones para acompañarte ahora.'
          : followUpChipPool
            ? 'Sugerencias para seguir explorando esto.'
            : 'Sugerencias para explorar lo que sientes.';
        isAdaptiveChips = true;
      }

      const uxStance: SupportStance | undefined = preUXState.stance;
      const uxIntensity: number | undefined = preUXState.intensity;

      setMessages(prev => [...prev, {
        id: effectiveAiMessage.id,
        sender: 'counselor',
        content: replyText,
        created_at: effectiveAiMessage.created_at,
        followUp: aiResponse.followUp ??
          (aiResponse.suggested_practicas
            ? { text: 'Ver mis prácticas de hoy', kind: 'action' as const, actionType: 'practicas' as const, payload: {} }
            : undefined),
        followUpUsed: false,
        meta: aiResponse.meta,
        chips: finalChips,
        isAdaptiveChips,
        chipInsertMap,
        chipMetaLookup,
        chipTooltip,
        uxStance,
        uxIntensity,
      }]);
      recordFlightEvent(user?.id, 'ELENA_RESPONSE_RENDERED', { length: replyText.length });

      if (canPlay('response')) {
        audioManager.play('response');
      }

      await supabase
        .from('chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', threadId);

      // ── Auto-title after first exchange ──────────────────────────────────
      // Fire once when this is the first user message (userMsgCount === 1).
      // Runs fire-and-forget so it never delays the UI.
      const userMsgCountNow = messages.filter(m => m.sender === 'user').length + 1;
      const currentTitle = threads.find(t => t.id === threadId)?.title ?? '';
      if (userMsgCountNow === 1 && currentTitle === 'Nueva conversación') {
        (async () => {
          try {
            const generatedTitle = await generateTitle({
              context: 'chat',
              firstUserMessage: messageToSend,
              firstReply: replyText,
            });
            if (generatedTitle) {
              setThreads(prev =>
                prev.map(t => t.id === threadId ? { ...t, title: generatedTitle } : t)
              );
              await supabase
                .from('chat_threads')
                .update({ title: generatedTitle })
                .eq('id', threadId);
            }
          } catch {
            // best-effort — silently ignore
          }
        })();
      }
      // ─────────────────────────────────────────────────────────────────────

      qc.invalidateQueries({ queryKey: ['token-budget', user?.id] });

    } catch (error) {
      console.error('Error sending message:', error);
      if (error instanceof TokenLimitError) {
        setTokenLimitError(error.serverMessage);
      } else if (error instanceof Error && error.message === 'MISSING_ENCRYPTION_SECRET') {
        setSecurityError(true);
      } else if (error instanceof Error && error.message === 'No active session') {
        setChatError('Sesión no disponible. Por favor recarga la página e intenta de nuevo.');
      } else if (error instanceof Error && (error.message === 'SESSION_EXPIRED' || error.message.startsWith('Unauthorized'))) {
        // Try silent refresh before signing out
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshData.session) {
          // Session refreshed — just show a retry message, don't sign out
          setChatError('Hubo un problema de conexión. Por favor intenta de nuevo.');
        } else {
          await supabase.auth.signOut();
          setChatError('Tu sesión ha expirado. Por favor inicia sesión de nuevo.');
        }
      } else {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg === 'OPENAI_UNAVAILABLE') {
          setChatError('El servicio está temporalmente no disponible. Por favor intenta de nuevo en unos momentos.');
        } else {
          setChatError('No se pudo enviar el mensaje. Por favor intenta de nuevo.');
        }
      }
    } finally {
      setIsSending(false);
      isSendingRef.current = false;
    }
  };

  const currentThread = threads.find(t => t.id === currentThreadId);
  // Reliable, synchronous "this chat already has a diary entry" check. Reads the
  // thread's linked_journal_entry_id directly (set when the chat is born from a
  // diary, or after a convert) and falls back to the async-resolved linkedEntry.
  // Gating the convert button on this — not on linkedEntry alone — is what stops
  // a diary-born chat from offering "Convertir a diario" and spawning a duplicate.
  const linkedJournalId = currentThread?.linked_journal_entry_id ?? linkedEntry?.id ?? null;
  const hasLinkedEntry = !!linkedJournalId;

  const latestCounselorMsg =
    messages.findLast?.(m => m.sender === 'counselor') ??
    [...messages].reverse().find(m => m.sender === 'counselor');

  const latestCounselorId = latestCounselorMsg?.id;

  const userMsgContents = messages.filter(m => m.sender === 'user').map(m => m.content);
  const userMsgCount = userMsgContents.length;

  const crisisLvl = computeSessionCrisisLevel(userMsgContents);
  const diarySuggEval = evaluateDiarySuggestion(userMsgContents);

  // Stage 3B — Chat signal extraction for Insights
  // These signals will be used by Insights later (InsightMemoryCard integration)
  const chatSignals = useMemo(() => {
    const adaptedMessages = messages.map((m) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));
    return extractChatSignals(adaptedMessages);
  }, [messages]);

  const dominantChatSignal = useMemo(() => {
    return summarizeChatSignals(chatSignals);
  }, [chatSignals]);

  // Stage 3D — Convert dominantChatSignal into an InsightSignal for Insights system
  const chatInsightSignal = useMemo(() => {
    return buildInsightSignal(dominantChatSignal);
  }, [dominantChatSignal]);

  // TODO Stage 3E — Pass chatInsightSignal to InsightMemoryCard or an Insights bridge.
  // No InsightsContext exists yet; integration point will be determined in Stage 3E.
  void chatInsightSignal;

  // Chat signals now written server-side by chat-ai edge function (per turn, correct date).

  const showFirstTimeWelcome =
    isFirstTimeUser === true &&
    userMsgCount === 0 &&
    !isLoading;

  const showDiaryHint =
    !isSending &&
    !!latestCounselorMsg &&
    userMsgCount >= 3 &&
    crisisLvl < 2 &&
    (diarySuggEval.shouldSuggest || firstSessionTopicJustSaved) &&
    !blockedByCooldown &&
    !isLinkedEntryLoading &&
    !linkedEntry;

  const latestCounselorStance = latestCounselorMsg?.uxStance;
  const latestCounselorIntensity = latestCounselorMsg?.uxIntensity ?? 0;

  useEffect(() => {
    if (continuationHintFiredRef.current) return;
    if (
      !isSending &&
      !!latestCounselorId &&
      userMsgCount >= 2 &&
      crisisLvl < 2 &&
      !showDiaryHint &&
      !linkedEntry &&
      (latestCounselorStance === 'PROCESSING' || latestCounselorStance === 'CONNECTION') &&
      latestCounselorIntensity >= 1
    ) {
      continuationHintFiredRef.current = true;
      setShowContinuationHint(true);
    }
  }, [isSending, latestCounselorId, latestCounselorStance, latestCounselorIntensity, userMsgCount, crisisLvl, showDiaryHint, linkedEntry]);

  useEffect(() => {
    if (isSending || showDiaryHint) setShowContinuationHint(false);
  }, [isSending, showDiaryHint]);

  const [dismissedForCurrentInsight, setDismissedForCurrentInsight] = useState(false);

  useEffect(() => {
    const ts = latestInsight?.created_at ?? null;
    if (!ts) {
      setDismissedForCurrentInsight(false);
      return;
    }
    setDismissedForCurrentInsight(!!localStorage.getItem(`${CHAT_CHIP_DISMISS_PREFIX}${ts}`));
  }, [latestInsight?.created_at]);

  useEffect(() => {
    const ts = latestInsight?.created_at ?? null;
    const isStillNew = ts ? hasNewInsightsSinceLastView(ts) : false;

    if (ts && !isStillNew) {
      const key = `${CHAT_CHIP_DISMISS_PREFIX}${ts}`;
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        setDismissedForCurrentInsight(false);
      }
    }
  }, [latestInsight?.created_at, dismissedForCurrentInsight]);

  const [interactedForCurrentInsight, setInteractedForCurrentInsight] = useState(false);

  useEffect(() => {
    const ts = latestInsight?.created_at ?? null;
    if (!ts) {
      setInteractedForCurrentInsight(false);
      return;
    }
    setInteractedForCurrentInsight(!!localStorage.getItem(`${INSIGHT_SHORTCUT_INTERACTED_PREFIX}${ts}`));
  }, [latestInsight?.created_at]);

  const showNewInsightChip =
    !!latestInsight?.created_at &&
    hasNewInsightsSinceLastView(latestInsight.created_at) &&
    !dismissedForCurrentInsight &&
    !interactedForCurrentInsight;

  const handleChipDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const ts = latestInsight?.created_at;
    if (ts) {
      localStorage.setItem(`${CHAT_CHIP_DISMISS_PREFIX}${ts}`, '1');
    }
    setDismissedForCurrentInsight(true);
  };

  const handleChipNavigate = () => {
    const ts = latestInsight?.created_at;
    if (ts) {
      localStorage.setItem(`${INSIGHT_SHORTCUT_INTERACTED_PREFIX}${ts}`, '1');
      setInteractedForCurrentInsight(true);
    }
    try { sessionStorage.setItem('insightsPageSource', 'chat_cta'); } catch {}
    setLocation('/insights');
  };

  const handleDiarySuggestionMounted = useCallback(() => {
    if (canPlay('journal-suggestion')) audioManager.play('journal-suggestion');
  }, [canPlay]);

  useEffect(() => {
    if (showDiaryHint && !frPrevShowDiaryHintRef.current) {
      recordFlightEvent(user?.id, 'DIARY_SUGGESTION_CHIP_SHOWN', { reason: diarySuggEval.reason });
    }
    frPrevShowDiaryHintRef.current = showDiaryHint;
  }, [showDiaryHint, user?.id, diarySuggEval.reason]);

  useEffect(() => {
    if (showActivation && !frPrevShowActivationRef.current) {
      recordFlightEvent(user?.id, 'INSIGHT_ACTIVATION_CHIP_SHOWN');
    }
    frPrevShowActivationRef.current = showActivation;
  }, [showActivation, user?.id]);

  if (import.meta.env.DEV) {
    const reason = showDiaryHint
      ? `SHOW (${diarySuggEval.reason})`
      : blockedByCooldown
      ? 'HIDDEN (cooldown_active)'
      : crisisLvl >= 2
      ? 'HIDDEN (crisis_level=2)'
      : userMsgCount < 3
      ? 'HIDDEN (insufficient_messages)'
      : `HIDDEN (${diarySuggEval.reason})`;
    console.log('[DiaryHint]', {
      threadKey: currentThreadId,
      blockedByCooldown,
      alreadyDismissed,
      shouldSuggest: diarySuggEval.shouldSuggest,
      reason,
      userMsgCount,
      crisisLvl,
    });
  }

  const handleConvertToJournal = async () => {
    if (!user || !profile || !currentThreadId) return;
    // 1:1 guard: if this thread is ALREADY linked to a diary entry — e.g. a
    // reflection chat born from the diary (thread.linked_journal_entry_id), or
    // a previous conversion — open that entry instead of minting a second one.
    const alreadyLinkedId =
      threadsRef.current.find(t => t.id === currentThreadId)?.linked_journal_entry_id
      ?? linkedEntry?.id
      ?? null;
    if (alreadyLinkedId) {
      sessionStorage.setItem('diaryAutoOpen', alreadyLinkedId);
      setShowConvertModal(false);
      setLocation('/journal');
      return;
    }
    const msgList = messages
      .filter(m => m.content?.trim())
      .map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.content }));
    const chatTitle = threads.find(t => t.id === currentThreadId)?.title ?? null;
    const timezone = profile.timezone ?? 'America/Mexico_City';
    try {
      const entryId = await convertChatToJournal(currentThreadId, msgList, user.id, profile, chatTitle, timezone);
      if (!entryId) throw new Error('No se recibió el ID de la entrada');
      // If this is a reflection chat (started from a diary entry), bring the user
      // back to the original entry to keep writing — not to the newly created one.
      const redirectId = reflectionSourceEntryId?.threadId === currentThreadId
        ? reflectionSourceEntryId.entryId
        : entryId;
      sessionStorage.setItem('diaryAutoOpen', redirectId);
      setShowConvertModal(false);
      setLocation('/journal');
    } catch (err) {
      console.error('chat_to_journal_failed', err);
      throw err;
    }
  };

  const handleSaveCommitment = async () => {
    const text = commitmentDraft.trim();
    if (!text || !user) return;
    setSavingCommitment(true);
    const saved = await createCommitment(user.id, text, 'user');
    setSavingCommitment(false);
    if (saved) {
      setActiveCommitment(saved);
      setCommitmentDraft('');
      setShowCommitmentInput(false);
    }
  };

  const getChatExport = (format: ExportFormat) =>
    formatChatExport(
      { id: currentThread?.id ?? '', title: currentThread?.title ?? 'Untitled Chat', created_at: currentThread?.created_at ?? new Date().toISOString() },
      messages.map(m => ({ sender: m.sender, content: m.content, created_at: m.created_at, chipMeta: m.chipMeta })),
      format,
    );

  return (
    <div
      className="flex overflow-hidden bg-app-bg"
      style={{ height: 'calc(100dvh - var(--chrome-total))' }}
    >
      {/* Navigation guard modal */}
      {pendingPath && (
        <NavigationGuardModal
          context="chat"
          onConfirm={confirmNavigation}
          onCancel={cancelNavigation}
        />
      )}
      {showCrisisModal && (
        <CrisisResourceModal onClose={() => setShowCrisisModal(false)} />
      )}
      {/* ── Sidebar ── */}
      <aside
        className={`
          flex-col bg-app-surface border-r border-app-border
          w-full lg:w-72 lg:flex-shrink-0
          ${showSidebar ? 'flex' : 'hidden'}
          lg:flex
        `}
      >
        <div className="px-4 border-b border-app-border flex items-center gap-2 flex-shrink-0" style={{ height: '52px' }}>
          <h2 className="flex-1 text-[15px] font-semibold text-app-text truncate">Chat con Elena</h2>
          <button
            onClick={isTokenExhausted ? undefined : createNewThread}
            disabled={isTokenExhausted}
            title={isTokenExhausted ? (tokenExhaustReason === 'MONTHLY_LIMIT_REACHED' ? 'El espacio de este mes se ha llenado — puedes leer tus conversaciones.' : 'El espacio de hoy se ha llenado — Elena volverá mañana.') : 'Nueva conversación'}
            className="flex-shrink-0 bg-sage-strong text-white rounded-12 p-2 hover:bg-[#4e7260] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={17} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {threads.length === 0 ? (
            <div className="p-6 text-center text-app-muted text-sm">
              <MessageCircle size={32} className="mx-auto mb-2 text-sage-soft" />
              Aún no hay conversaciones
            </div>
          ) : (
            threads.map((thread) => (
              <div
                key={thread.id}
                draggable={editingThreadId !== thread.id}
                onDragStart={(e) => editingThreadId !== thread.id && handleDragStart(e, thread.id)}
                onDragOver={(e) => handleDragOver(e, thread.id)}
                onDrop={(e) => handleDrop(e, thread.id)}
                onDragEnd={handleDragEnd}
                onClick={() => editingThreadId !== thread.id && selectThread(thread.id)}
                className={`group relative px-4 py-3 transition-colors border-b border-app-border select-none min-h-[52px]
                  ${editingThreadId === thread.id ? 'cursor-default' : 'cursor-pointer'}
                  ${currentThreadId === thread.id
                    ? 'bg-sage-soft border-l-[3px] border-l-sage-strong'
                    : 'hover:bg-app-surface-2'
                  }
                  ${draggedId === thread.id ? 'opacity-40' : ''}
                  ${dragOverId === thread.id && draggedId !== thread.id ? 'border-t-2 border-t-sage bg-sage-soft' : ''}
                `}
              >
                {editingThreadId === thread.id && !editingInHeader ? (
                  <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    <input
                      ref={editInputRef}
                      value={editingTitle}
                      onChange={e => setEditingTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') cancelRename();
                      }}
                      onBlur={commitRename}
                      className="flex-1 min-w-0 text-sm font-medium text-app-text bg-app-bg border border-sage rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-sage-strong/30"
                      maxLength={80}
                    />
                    <button
                      onMouseDown={e => { e.preventDefault(); commitRename(); }}
                      className="flex-shrink-0 p-1.5 rounded-lg hover:bg-sage-soft text-sage-strong transition-colors"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      onMouseDown={e => { e.preventDefault(); cancelRename(); }}
                      className="flex-shrink-0 p-1.5 rounded-lg hover:bg-red-50 text-app-muted hover:text-danger transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 pr-16">
                      <div className="flex-shrink-0 text-sage-soft group-hover:text-sage transition-colors cursor-grab active:cursor-grabbing">
                        <GripVertical size={13} />
                      </div>
                      <div className="min-w-0">
                        <div
                          className="font-medium text-sm text-app-text truncate"
                        >
                          {thread.title}
                        </div>
                        <div className="text-xs text-app-muted mt-0.5">
                          {new Date(thread.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={(e) => startEditTitle(thread, e)}
                        title="Renombrar conversación"
                        className="p-1.5 rounded-lg hover:bg-sage-soft text-app-muted hover:text-sage-strong transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={(e) => requestDeleteThread(thread.id, e)}
                        title="Eliminar conversación"
                        className="p-1.5 rounded-lg hover:bg-red-50 text-app-muted hover:text-danger transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ── Chat thread ── */}
      <div
        className={`
          flex-1 flex flex-col min-w-0
          ${showSidebar ? 'hidden' : 'flex'}
          lg:flex
        `}
      >
        <div className="bg-app-surface border-b border-app-border px-4 flex items-center gap-3 flex-shrink-0" style={{ height: '52px' }}>
          <button
            onClick={() => setShowSidebar(true)}
            className="lg:hidden flex-shrink-0 p-1.5 rounded-xl hover:bg-app-surface-2 transition-colors text-app-text"
            aria-label="Volver a conversaciones"
          >
            <ArrowLeft size={19} />
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            {editingInHeader && editingThreadId === currentThreadId ? (
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <input
                  ref={headerEditInputRef}
                  value={editingTitle}
                  onChange={e => setEditingTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') cancelRename();
                  }}
                  onBlur={commitRename}
                  className="flex-1 min-w-0 text-[15px] font-semibold text-app-text bg-app-bg border border-sage rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-sage-strong/30"
                  maxLength={80}
                />
                <button
                  onMouseDown={e => { e.preventDefault(); commitRename(); }}
                  className="flex-shrink-0 p-1.5 rounded-lg hover:bg-sage-soft text-sage-strong transition-colors"
                >
                  <Check size={14} />
                </button>
                <button
                  onMouseDown={e => { e.preventDefault(); cancelRename(); }}
                  className="flex-shrink-0 p-1.5 rounded-lg hover:bg-red-50 text-app-muted hover:text-danger transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="min-w-0">
                {currentThread ? (
                  <h1
                    className="text-[15px] font-semibold text-app-text truncate"
                  >
                    {currentThread.title}
                  </h1>
                ) : (
                  <h1 className="text-[15px] font-semibold text-app-text truncate">
                    Chat con Elena
                  </h1>
                )}
              </div>
            )}
          </div>
          {messages.length > 0 && currentThread && !editingInHeader && (
            <>
              {hasLinkedEntry ? (
                <button
                  type="button"
                  onClick={() => {
                    if (linkedJournalId) sessionStorage.setItem('diaryAutoOpen', linkedJournalId);
                    setLocation('/journal');
                  }}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FAEEDA] text-[#854F0B] text-[12px] font-medium rounded-xl border border-[#EF9F27]/40 hover:bg-[#EF9F27]/20 hover:text-[#633806] transition-colors whitespace-nowrap"
                >
                  <BookOpen size={11} />
                  Volver al diario
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowConvertModal(true)}
                  title="Convertir a entrada de diario"
                  className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-app-border text-app-muted hover:text-sage-strong hover:border-sage-strong hover:bg-sage-soft transition-colors text-[12px] font-medium"
                >
                  <BookOpen size={13} />
                  <span className="hidden sm:inline">Convertir a diario</span>
                </button>
              )}
              <button
                onClick={() => setShowExport(true)}
                title="Exportar conversación"
                className="flex-shrink-0 p-1.5 rounded-xl hover:bg-app-surface-2 text-app-muted hover:text-app-text transition-colors"
              >
                <Download size={16} />
              </button>
            </>
          )}
        </div>

        {isTokenExhausted && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-start gap-2.5 text-sm text-amber-800 flex-shrink-0">
            <Lock size={15} className="flex-shrink-0 mt-0.5 text-amber-600" />
            <div>
              <span className="font-semibold">
                {tokenExhaustReason === 'MONTHLY_LIMIT_REACHED'
                  ? 'El espacio de este mes se ha llenado.'
                  : 'El espacio de hoy se ha llenado.'}
              </span>
              <span className="ml-1 font-normal">
                {tokenExhaustReason === 'MONTHLY_LIMIT_REACHED'
                  ? 'Puedes seguir leyendo tus conversaciones — Elena volverá el próximo mes.'
                  : 'Puedes seguir leyendo tus conversaciones — Elena volverá mañana.'}
              </span>
            </div>
          </div>
        )}

        {tokenLimitError && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-3 text-sm text-red-800 flex-shrink-0">
            <span className="font-semibold">Límite de tokens alcanzado</span>
            <span className="ml-1">— {tokenLimitError}</span>
          </div>
        )}

        {securityError && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center gap-2 text-sm text-amber-800 flex-shrink-0">
            <span className="font-semibold">Actualización de seguridad requerida</span>
            <span>— Por favor cierra sesión e inicia de nuevo para continuar.</span>
          </div>
        )}

        {chatError && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 flex items-center justify-between gap-3 text-sm text-red-700 flex-shrink-0">
            <span>{chatError}</span>
            <button
              onClick={() => setChatError(null)}
              className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0 text-lg leading-none"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        )}

        {showActivation && (
          <InsightActivationChip
            onView={() => { recordFlightEvent(user?.id, 'INSIGHT_ACTIVATION_CHIP_CLICKED'); dismissActivation(); setLocation('/insights'); }}
            onDismiss={dismissActivation}
          />
        )}

        {pendingElenaCommitment && !activeCommitment && (
          <CommitmentSuggestion
            text={pendingElenaCommitment}
            onAccept={async () => {
              if (!user) return;
              const saved = await createCommitment(user.id, pendingElenaCommitment, 'elena');
              if (saved) setActiveCommitment(saved);
              setPendingElenaCommitment(null);
            }}
            onIgnore={() => setPendingElenaCommitment(null)}
          />
        )}
        {activeCommitment && (
          <CommitmentCard
            commitment={activeCommitment}
            onReflect={(outcome, text) => {
              // Build the opening message and set it as pending commitment context
              const opener = outcome === 'done'
                ? `Lo hice: ${text}`
                : `No pude hacerlo: ${text}`;
              setPendingCommitment({ text, outcome });
              setInputMessage(opener);
              setTimeout(() => {
                const el = chatInputRef.current;
                if (!el) return;
                el.focus();
                el.setSelectionRange(el.value.length, el.value.length);
                el.style.height = '40px';
                const sh = el.scrollHeight;
                el.style.height = Math.min(sh, 120) + 'px';
              }, 0);
            }}
            onDismissed={() => setActiveCommitment(null)}
          />
        )}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-app-bg overscroll-y-contain">
          {isLoading ? (
            <div className="text-center text-app-muted py-8 text-sm">Cargando mensajes...</div>
          ) : messages.length === 0 && !showFirstTimeWelcome ? (
            <div className="text-center py-12">
              <MessageCircle size={44} className="mx-auto mb-4 text-sage-soft" />
              <p className="text-app-text font-medium">Comienza una conversación con Elena</p>
              <p className="text-sm text-app-muted mt-1.5">Comparte lo que está en tu mente</p>
            </div>
          ) : (
            messages.filter(m => m.content?.trim()).map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] sm:max-w-[78%] ${message.sender === 'counselor' ? 'w-full' : ''}`}>
                  <div
                    className={`px-4 py-3 ${
                      message.sender === 'user'
                        ? 'bg-sage-strong text-white rounded-[18px] rounded-br-[6px]'
                        : 'bg-app-surface border border-app-border text-app-text rounded-[18px] rounded-bl-[6px]'
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed text-[15px]">
                      <MessageContent
                        text={message.sender === 'counselor' ? ensureQuestionBreak(message.content) : message.content}
                        linkClassName={
                          message.sender === 'user'
                            ? 'text-white underline underline-offset-2 break-all hover:opacity-75 transition-opacity'
                            : 'text-sage-strong underline underline-offset-2 break-all hover:opacity-75 transition-opacity'
                        }
                      />
                    </p>
                    <p
                      className={`text-[11px] mt-1.5 ${
                        message.sender === 'user' ? 'text-white/60' : 'text-app-muted'
                      }`}
                    >
                      {new Date(message.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  {message.sender === 'user' && message.chipMeta?.label && (
                    <div className="flex justify-end mt-1.5">
                      <span
                        className="
                          inline-flex items-center gap-1
                          text-[11px] text-app-muted
                          px-2.5 py-0.5 rounded-full
                          border border-app-border
                          bg-app-bg/60
                          max-w-[220px] truncate
                          opacity-80 select-none
                        "
                        title={message.chipMeta.label}
                      >
                        {message.chipMeta.label}
                      </span>
                    </div>
                  )}
                  {(() => {
                    if (!message.followUp || message.followUp.kind !== 'action' || message.followUpUsed) return null;
                    if (message.sender !== 'counselor') return null;
                    if (message.followUp.actionType === 'breathing') {
                      const show = message.uxStance !== undefined
                        ? message.uxStance === 'STABILIZATION' && (message.uxIntensity ?? 0) >= 2
                        : message.meta?.valence === 'negative';
                      if (!show) return null;
                    }
                    return (
                      <FollowUpBox
                        followUp={message.followUp}
                        onFollowUpClick={handleFollowUpClick}
                      />
                    );
                  })()}
                  {(() => {
                    const isLatest = message.sender === 'counselor' && message.id === latestCounselorId;
                    if (!isLatest || isSending || chipCooldownActive) return null;
                    const chips = message.chips ?? [];
                    return chips.length > 0 ? (
                      <SuggestionChips
                        chips={chips.slice(0, 3)}
                        onSelect={(chip) => handleChipSelect(chip, message.id)}
                        source="emotion_allowlist"
                        isAdaptive={message.isAdaptiveChips ?? false}
                        tooltipCopy={message.chipTooltip}
                      />
                    ) : null;
                  })()}
                </div>
              </div>
            ))
          )}
          {isSending && (
            <div className="flex justify-start">
              <div className="bg-app-surface border border-app-border rounded-[18px] rounded-bl-[6px] px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sage-strong/60 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 rounded-full bg-sage-strong/60 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 rounded-full bg-sage-strong/60 animate-bounce" />
                </div>
              </div>
            </div>
          )}

          {showContinuationHint && (
            <p className="text-center text-[12.5px] text-app-muted py-3 px-4 animate-in fade-in duration-500">
              {latestCounselorStance === 'CONNECTION'
                ? 'Estoy aquí, sin prisa.'
                : 'Puedes quedarte un poco más con esto.'}
            </p>
          )}
          {showDiaryHint && (
            <DiaryDraftSuggestion
              onCreateDraft={handleCreateDiaryDraft}
              onDismiss={handleDismissDiarySuggestion}
              reason={firstSessionTopicJustSaved ? 'first_session' : diarySuggEval.reason}
              disabled={!currentThreadId}
              onMounted={handleDiarySuggestionMounted}
            />
          )}
          {showFirstTimeWelcome && (
            <div className="py-6 px-2">
              <p className="text-sm text-app-muted text-center leading-relaxed mb-5">
                No necesitas explicarlo perfecto. Elige lo que más se acerque, o escribe directamente.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  'Estoy pasando por algo difícil',
                  'Hay algo que no he hablado con nadie',
                  'No sé bien qué me pasa',
                  'Quiero entenderme mejor',
                  'Hay una decisión que no puedo tomar',
                ].map(s => (
                  <button
                    key={s}
                    onClick={async () => {
                      if (!currentThreadId) {
                        suppressLoadRef.current = true;
                        const newThreadId = await createNewThread({ skipWelcome: true });
                        if (!newThreadId) { suppressLoadRef.current = false; return; }
                        await handleSendMessage(s, newThreadId, null);
                      } else {
                        await handleSendMessage(s);
                      }
                    }}
                    className="px-3.5 py-2.5 text-sm text-app-text border border-app-border rounded-12 bg-app-surface hover:border-sage-strong/40 hover:bg-sage-soft/30 transition-colors min-h-[44px]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {inlineToast && (
            <div className="flex justify-center mt-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-app-surface border border-app-border shadow-sm text-[12.5px] text-app-muted animate-in fade-in slide-in-from-bottom-1 duration-200">
                {inlineToast}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {showNewInsightChip && (
          <div className="bg-app-surface border-t border-app-border px-4 py-2.5 flex-shrink-0">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12.5px] text-app-muted leading-snug">
                Hay algo que podrías querer ver sobre ti.
              </p>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={handleChipNavigate}
                  className="text-[12px] font-medium text-sage-strong hover:text-[#4e7260] transition-colors"
                >
                  Ver insights
                </button>
                <button
                  onClick={handleChipDismiss}
                  aria-label="Cerrar"
                  className="p-1 rounded-full text-app-muted hover:text-app-text transition-colors"
                >
                  <X size={11} />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-app-surface border-t border-app-border px-4 pt-2.5 pb-3 flex-shrink-0">
          {!evidenceEnough && (
            <p className="mb-2 text-[10.5px] text-app-muted/45 text-center leading-relaxed">
              Tus conversaciones ayudan a Elena a detectar patrones con el tiempo.
            </p>
          )}
          {/* ── Commitment creator ── */}
          {showCommitmentInput ? (
            <div className="flex gap-2 items-center mb-2">
              <input
                ref={commitmentInputRef}
                value={commitmentDraft}
                onChange={e => setCommitmentDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveCommitment();
                  if (e.key === 'Escape') { setShowCommitmentInput(false); setCommitmentDraft(''); }
                }}
                placeholder="¿Qué quieres intentar antes de la próxima sesión?"
                maxLength={200}
                className="flex-1 min-w-0 rounded-12 border border-app-border px-3.5 py-2 text-sm text-app-text placeholder:text-app-muted bg-app-surface focus:outline-none focus:ring-2 focus:ring-sage-strong/25"
                autoFocus
              />
              <button
                onClick={handleSaveCommitment}
                disabled={!commitmentDraft.trim() || savingCommitment}
                className="flex-shrink-0 bg-sage-strong text-white rounded-12 px-3.5 py-2 text-sm font-medium hover:bg-[#4e7260] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {savingCommitment ? '...' : 'Guardar'}
              </button>
              <button
                onClick={() => { setShowCommitmentInput(false); setCommitmentDraft(''); }}
                className="flex-shrink-0 p-2 rounded-xl text-app-muted hover:text-app-text transition-colors"
                aria-label="Cancelar"
              >
                <X size={15} />
              </button>
            </div>
          ) : !activeCommitment && currentThreadId && (
            <div className="mb-2 flex items-center justify-between">
              <button
                onClick={() => {
                  setShowCommitmentInput(true);
                  setTimeout(() => commitmentInputRef.current?.focus(), 0);
                }}
                className="text-[11.5px] text-app-muted hover:text-sage-strong transition-colors flex items-center gap-1"
              >
                <Plus size={11} />
                Agregar compromiso
              </button>

            </div>
          )}
          <div className="flex gap-2 items-end">
            <textarea
              ref={chatInputRef}
              rows={1}
              value={inputMessage}
              onChange={(e) => {
                setInputMessage(e.target.value);
                if (!e.target.value) setPendingChip(null);
                e.target.style.height = '40px';
                const sh = e.target.scrollHeight;
                const h = Math.min(sh, 120);
                e.target.style.height = h + 'px';
                e.target.style.overflowY = sh > 120 ? 'auto' : 'hidden';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={isTokenExhausted ? (tokenExhaustReason === 'MONTHLY_LIMIT_REACHED' ? 'Elena volverá el próximo mes…' : 'Elena volverá mañana…') : 'Cuéntame lo que sientes o lo que tienes en mente…'}
              disabled={isSending || !currentThreadId || !!tokenLimitError || isTokenExhausted || !profile}
              className={`flex-1 min-w-0 rounded-12 border border-app-border px-4 py-2.5 text-sm text-app-text placeholder:text-app-muted bg-app-surface focus:outline-none disabled:bg-app-surface-2 disabled:text-app-muted transition resize-none overflow-hidden${isTokenExhausted ? ' opacity-70 cursor-not-allowed' : ''}`}
              style={{ boxShadow: 'none', height: '40px' }}
              onFocus={(e) => { if (!isTokenExhausted) e.currentTarget.style.boxShadow = '0 0 0 3px var(--focus)'; }}
              onBlur={(e) => e.currentTarget.style.boxShadow = 'none'}
            />
            <VoiceMemo
              context="chat"
              supabaseClient={supabase}
              onTranscript={(text: string) => {
                handleSendMessage(text);
              }}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={isSending || !inputMessage.trim() || !currentThreadId || !!tokenLimitError || isTokenExhausted || !profile}
              title={isTokenExhausted ? 'Límite de tokens alcanzado — puedes leer tus conversaciones, pero no enviar nuevos mensajes.' : undefined}
              className="flex-shrink-0 bg-sage-strong text-white rounded-12 px-4 py-2.5 hover:bg-[#4e7260] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm font-medium"
            >
              <Send size={15} />
              <span className="hidden sm:inline">{isSending ? 'Enviando...' : 'Enviar'}</span>
            </button>
          </div>
        </div>
      </div>

      {showExport && (
        <ExportModal
          title="Exportar conversación"
          onClose={() => setShowExport(false)}
          getExport={getChatExport}
        />
      )}

      <ConvertToJournalModal
        open={showConvertModal}
        onClose={() => setShowConvertModal(false)}
        onConfirm={handleConvertToJournal}
      />

      {threadToDelete && (
        <ConfirmDeleteDialog
          title="Eliminar conversación"
          message="Se eliminarán permanentemente esta conversación y todos sus mensajes. Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          loading={deletingThread}
          onCancel={() => { if (!deletingThread) setThreadToDelete(null); }}
          onConfirm={confirmDeleteThread}
        />
      )}

      {import.meta.env.DEV && <DevPanel />}
    </div>
  );
}

// Last updated: 2026-06-23