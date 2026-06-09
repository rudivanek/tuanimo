import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useLocation, useSearch } from 'wouter';
import { useSoundSettings } from '../hooks/useSoundSettings';
import { audioManager } from '../lib/audio';
import { supabase } from '../lib/supabaseClient';
import { useProfile } from '../hooks/useProfile';
import { useTokenStatus } from '../hooks/useTokenStatus';
import { getJournalPrompts, TokenLimitError, generateAIReflectionPrompt, generateTitle } from '../lib/api';
import { extractLanguageSignals } from '../lib/languageSignals';
import { encryptForUser, decryptForUser } from '../lib/encryption';
import { BookOpen, Plus, Sparkles, Calendar, Tag, Trash2, GripVertical, ArrowLeft, Lock, Download, MessageCircle, X, ChevronRight, Check, Star } from 'lucide-react';
import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import { getActiveCommitment, createCommitment, type Commitment } from '../lib/commitments';
import { useLatestInsightAt } from '../hooks/useLatestInsightAt';
import { hasNewInsightsSinceLastView } from '../lib/insightVisibility';
import { ExportModal } from '../components/ExportModal';
import { CrisisAlert } from '../components/CrisisAlert';
import { JournalStorageBanner } from '../components/JournalStorageBanner';
import { LargestEntriesPanel } from '../components/LargestEntriesPanel';
import { UpgradeModal } from '../components/UpgradeModal';
import { useJournalStorage } from '../hooks/useJournalStorage';
import { formatDiaryExport, formatAllDiariesExport } from '../lib/exportUtils';
import { trackEvent } from '../lib/analytics';
import type { ExportFormat } from '../lib/exportUtils';
import { getJournalProgress } from '../lib/journalProgress';
import type { JournalProgress } from '../lib/journalProgress';
import { JournalProgressCard } from '../components/JournalProgressCard';
import { JournalChatOriginBanner } from '../components/JournalChatOriginBanner';
import { ReflectionMemoryCard } from '../components/journal/ReflectionMemoryCard';
import { ReflectionViewerModal } from '../components/journal/ReflectionViewerModal';
import { GuidedStarterPrompt } from '../components/journal/GuidedStarterPrompt';
import {
  resolvePromptGroup,
  pickPromptFromGroup,
  type PromptGroup,
} from '../lib/starterPrompt';
import { InsightActivationChip } from '../components/InsightActivationChip';
import VoiceMemo from '../components/VoiceMemo';
import { useInsightActivation } from '../hooks/useInsightActivation';
import {
  getReflectionCandidateForSession,
  markReflectionCandidateShown,
  markReflectionSeenThisSession,
} from '../lib/reflectionMemory';
import type { ReflectionCandidate } from '../lib/reflectionMemory';
import { generateReflectionPrompt, classifySignalFromMetadata } from '../lib/reflectionPrompt';
import type { ReflectionPromptResult, ReflectionPromptSignal } from '../lib/reflectionPrompt';
import { classifyDelta } from '../lib/reflectionDelta';
import { recordFlightEvent } from '../lib/elenaFlightRecorder';
import { useNavigationGuard } from '../hooks/useNavigationGuard';
import { NavigationGuardModal } from '../components/NavigationGuardModal';

interface JournalEntry {
  id: string;
  title: string;
  content: string;
  prompt?: string;
  tags: string[];
  created_at: string;
  sort_order: number;
  content_bytes: number;
  is_draft: boolean;
  origin?: string;
  source_chat_id?: string | null;
  linked_chat_id?: string | null;
  trigger_reason?: string | null;
  emotion_score_at_creation?: number | null;
  saved_at?: string | null;
}

const INSIGHT_SHORTCUT_INTERACTED_PREFIX = 'insight_shortcut_interacted_at:';

export function JournalPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const deepLinkEntryId = new URLSearchParams(search).get('entryId');
  const deepLinkSource = new URLSearchParams(search).get('source');
  const deepLinkHandled = useRef(false);
  const bridgeShownTrackedRef = useRef(false);
  const { data: profile } = useProfile();
  const { isTokenExhausted } = useTokenStatus();
  const { state: storageState } = useJournalStorage();
  const { canPlay } = useSoundSettings();
  const { data: latestInsight } = useLatestInsightAt();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showManagePanel, setShowManagePanel] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const [deletingEntry, setDeletingEntry] = useState(false);
  const [prompts, setPrompts] = useState<string[]>([]);
  const [isNewEntry, setIsNewEntry] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [tags, setTags] = useState('');
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
  const [promptsCrisis, setPromptsCrisis] = useState<'NO' | 'MAYBE' | 'YES'>('NO');
  const [showSaveCrisisBanner, setShowSaveCrisisBanner] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [showElenaChip, setShowElenaChip] = useState(false);
  const elenaChipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tokenLimitError, setTokenLimitError] = useState<string | null>(null);
  const [readOnlyWarning, setReadOnlyWarning] = useState(false);
  const [storageLimitError, setStorageLimitError] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showExport, setShowExport] = useState(false);
  const [showExportAll, setShowExportAll] = useState(false);
  const contentEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDraftEntry, setIsDraftEntry] = useState(false);
  const [tab, setTab] = useState<'entries' | 'drafts'>('entries');

  // Auto-save draft state
  const autoSaveDraftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSavedDraftIdRef = useRef<string | null>(null);  // tracks the DB id of the in-progress draft row
  const savingRef = useRef(false);  // synchronous re-entry guard for handleSave (isSaving state is async)
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [progress, setProgress] = useState<JournalProgress>({
    saved7d: 0,
    saved30d: 0,
    originChat30d: 0,
    originManual30d: 0,
    topTrigger30d: null,
    avgEmotionScore30d: null,
    topThemes30d: [],
  });
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);
  const [entriesLoaded, setEntriesLoaded] = useState(false);
  const [deepLinkError, setDeepLinkError] = useState<string | null>(null);
  const [insightsBridgeActive, setInsightsBridgeActive] = useState(false);
  const [dismissedBridgeBanner, setDismissedBridgeBanner] = useState(false);
  const [interactedForCurrentInsight, setInteractedForCurrentInsight] = useState(false);
  /*
   * Reflection Memory integration
   *
   * The reflection card surfaces a ~1-week-old journal entry above the editor.
   * It is positioned there (not in the sidebar) so the user encounters it as
   * they begin writing — the moment when past context is most useful.
   *
   * Why content is decrypted before rendering:
   * Journal entries are stored encrypted (`content_enc`). The raw candidate
   * from `getReflectionCandidateForSession` carries the encrypted blob.
   * Decryption happens here, in the page, using the user's profile key. If
   * decryption fails or yields an empty string, neither `reflectionCandidate`
   * nor `reflectionContent` is set, so the card never renders. This ensures
   * garbage or missing content cannot reach the UI.
   *
   * Why marking happens in an effect (not on fetch):
   * `markReflectionCandidateShown` and `markReflectionSeenThisSession` are
   * called only after both state values are confirmed non-empty. This prevents
   * a failed decryption from consuming the entry's 30-day suppression slot.
   * The `markedReflectionRef` guard prevents the same effect from writing
   * twice in React strict mode or during rapid re-renders.
   *
   * Local dismissal:
   * Clicking "Not now" sets `reflectionDismissed` to true, hiding the card
   * for the remainder of the session. This is intentionally local — it does
   * not reset the 30-day suppression, nor does it extend it. The same entry
   * will not re-appear in this session (via `hasSeenReflectionThisSession`),
   * but is already suppressed globally for 30 days from when it was marked.
   */
  const [reflectionCandidate, setReflectionCandidate] = useState<ReflectionCandidate | null>(null);
  const [reflectionContent, setReflectionContent] = useState<string | null>(null);
  const [reflectionDaysAgo, setReflectionDaysAgo] = useState<number | null>(null);
  const [reflectionPromptResult, setReflectionPromptResult] = useState<ReflectionPromptResult | null>(null);
  const [currentDominantSignal, setCurrentDominantSignal] = useState<ReflectionPromptSignal | null>(null);
  const [reflectionDismissed, setReflectionDismissed] = useState(false);
  const [reflectionCollapsed, setReflectionCollapsed] = useState(false);
  const [isReflectionViewerOpen, setIsReflectionViewerOpen] = useState(false);
  const [starterPromptDismissed, setStarterPromptDismissed] = useState(false);
  const [starterPromptGroup, setStarterPromptGroup] = useState<PromptGroup | null>(null);
  const [starterPrompt, setStarterPrompt] = useState<string | null>(null);
  const [aiReflectionOverride, setAiReflectionOverride] = useState<{ promptText: string; insertStarter: string } | null>(null);
  const markedReflectionRef = useRef<string | null>(null);
  const aiOverrideFetchedRef = useRef<string | null>(null);
  // Tracks current `content` value so async closures can read it without stale captures.
  const contentRef = useRef(content);
  const { showActivation, dismiss: dismissActivation, evidenceEnough } = useInsightActivation();

  // ── Commitment state ──────────────────────────────────────────────────────
  const [activeCommitment, setActiveCommitment] = useState<Commitment | null>(null);
  const [showCommitmentInput, setShowCommitmentInput] = useState(false);
  const [commitmentDraft, setCommitmentDraft] = useState('');
  const [savingCommitment, setSavingCommitment] = useState(false);
  const commitmentInputRef = useRef<HTMLInputElement>(null);

  const frPageOpenedRef = useRef(false);
  const frPrevStarterPromptRef = useRef(false);
  const frPrevReflectionRef = useRef(false);
  const frPrevNudgeRef = useRef(false);
  const frPrevActivationRef = useRef(false);

  const journalPageSource = useRef<string>('unknown');
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('journalPageSource');
      if (stored) {
        journalPageSource.current = stored;
        sessionStorage.removeItem('journalPageSource');
      } else {
        const autoOpen = sessionStorage.getItem('diaryAutoOpen');
        journalPageSource.current = autoOpen ? 'draft_resume' : 'manual_nav';
      }
    } catch {
      journalPageSource.current = 'unknown';
    }
  }, []);

  useEffect(() => {
    if (!user || frPageOpenedRef.current) return;
    frPageOpenedRef.current = true;
    const hasDrafts = entries.some(e => e.is_draft);
    recordFlightEvent(user.id, 'JOURNAL_PAGE_OPENED', { source: journalPageSource.current, hasDrafts });
  }, [user]);

  useEffect(() => {
    const ts = latestInsight?.created_at ?? null;
    if (!ts) {
      setInteractedForCurrentInsight(false);
      return;
    }
    try {
      setInteractedForCurrentInsight(!!localStorage.getItem(`${INSIGHT_SHORTCUT_INTERACTED_PREFIX}${ts}`));
    } catch {
      setInteractedForCurrentInsight(false);
    }
  }, [latestInsight?.created_at]);

  useEffect(() => {
    if (!user || !profile) return;
    let cancelled = false;
    (async () => {
      try {
        const candidate = await getReflectionCandidateForSession(user.id);
        if (cancelled || !candidate) return;
        const decrypted = await decryptForUser(candidate.content, profile);
        if (cancelled) return;
        const trimmed = decrypted?.trim();
        if (!trimmed) return;
        const daysAgo = Math.round(
          (Date.now() - new Date(candidate.created_at).getTime()) / 86_400_000
        );
        setReflectionCandidate(candidate);
        setReflectionContent(trimmed);
        setReflectionDaysAgo(daysAgo);
      } catch {
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, profile?.id]);

  useEffect(() => {
    if (!reflectionCandidate || !reflectionContent) return;
    if (markedReflectionRef.current === reflectionCandidate.id) return;
    markedReflectionRef.current = reflectionCandidate.id;
    markReflectionCandidateShown(reflectionCandidate.id);
    markReflectionSeenThisSession();
  }, [reflectionCandidate, reflectionContent]);

  useEffect(() => {
    if (!reflectionContent || reflectionDaysAgo === null) return;
    const metaSignal = reflectionCandidate
      ? classifySignalFromMetadata(reflectionCandidate) ?? undefined
      : undefined;
    const result = generateReflectionPrompt(
      reflectionContent,
      reflectionDaysAgo,
      aiReflectionOverride ?? undefined,
      currentDominantSignal ?? undefined,
      metaSignal
    );
    setReflectionPromptResult(result);
  }, [reflectionContent, reflectionDaysAgo, currentDominantSignal, reflectionCandidate, aiReflectionOverride]);

  useEffect(() => {
    setReflectionDismissed(false);
    setReflectionCollapsed(false);
    setAiReflectionOverride(null);
    aiOverrideFetchedRef.current = null;
    if (!reflectionCandidate) {
      setReflectionPromptResult(null);
      setReflectionDaysAgo(null);
    }
  }, [reflectionCandidate?.id]);

  useEffect(() => {
    if (!reflectionContent || reflectionDaysAgo === null || !reflectionCandidate) return;
    if (aiOverrideFetchedRef.current === reflectionCandidate.id) return;

    const metaSignal = classifySignalFromMetadata(reflectionCandidate);
    const isHeavyPast = metaSignal === 'stress' || metaSignal === 'anxiety';
    const hasCurrentContext = currentDominantSignal !== null;
    const hasCrossSignal = metaSignal !== null && hasCurrentContext && currentDominantSignal !== metaSignal;

    if (!isHeavyPast && !hasCrossSignal) return;
    if (reflectionContent.length < 80) return;

    aiOverrideFetchedRef.current = reflectionCandidate.id;

    const deltaDirection = (metaSignal && currentDominantSignal)
      ? (classifyDelta(metaSignal, currentDominantSignal) ?? null)
      : null;

    let cancelled = false;
    (async () => {
      try {
        const otherEntryTexts = entries
          .filter(e => e.id !== reflectionCandidate?.id)
          .slice(0, 4)
          .map(e => e.content)
          .filter(Boolean);
        const recentSignals = extractLanguageSignals(otherEntryTexts, 4);
        const result = await generateAIReflectionPrompt({
          excerpt: reflectionContent.slice(0, 200),
          daysAgo: reflectionDaysAgo,
          pastSignal: metaSignal!,
          currentSignal: currentDominantSignal ?? null,
          deltaDirection,
          recentSignals,
        });
        if (!cancelled) {
          setAiReflectionOverride({ promptText: result.promptText, insertStarter: result.insertStarter });
        }
      } catch {
        // Fail silently — rule-based prompt remains active
      }
    })();

    return () => { cancelled = true; };
  }, [reflectionContent, reflectionDaysAgo, reflectionCandidate?.id, currentDominantSignal]);

  // Sync contentRef on every render so the fetchSignals async closure below
  // can read the live value without a stale capture.
  contentRef.current = content;

  useEffect(() => {
    if (!user) {
      const group = resolvePromptGroup(null);
      setStarterPromptGroup(group);
      setStarterPrompt(pickPromptFromGroup(group));
      return;
    }
    let cancelled = false;
    async function fetchSignals() {
      try {
        const since = new Date();
        since.setDate(since.getDate() - 7);
        const sinceDate = since.toISOString().split('T')[0];
        const { data } = await supabase
          .from('chat_signal_daily_agg')
          .select('signal_type, score')
          .gte('signal_date', sinceDate);
        if (cancelled) return;
        let stress = 0;
        let positive = 0;
        const signalTotals: Record<string, number> = {};
        for (const row of data ?? []) {
          const s = Number(row.score) || 0;
          if (row.signal_type === 'stress' || row.signal_type === 'anxiety') stress += s;
          else if (row.signal_type === 'positive' || row.signal_type === 'gratitude') positive += s;
          signalTotals[row.signal_type] = (signalTotals[row.signal_type] ?? 0) + s;
        }
        const MIN_SIGNAL_SCORE = 3;
        const topSignal = Object.entries(signalTotals).sort(([, a], [, b]) => b - a)[0];
        const dominant: ReflectionPromptSignal | null =
          topSignal && topSignal[1] >= MIN_SIGNAL_SCORE
            ? (topSignal[0] as ReflectionPromptSignal)
            : null;
        if (!cancelled) setCurrentDominantSignal(dominant);
        const group = resolvePromptGroup({ stress, positive });
        if (!cancelled && contentRef.current === '') {
          setStarterPromptGroup(group);
          setStarterPrompt(pickPromptFromGroup(group));
        }
      } catch {
        if (!cancelled && contentRef.current === '') {
          const group = resolvePromptGroup(null);
          setStarterPromptGroup(group);
          setStarterPrompt(pickPromptFromGroup(group));
        }
      }
    }
    fetchSignals();
    return () => { cancelled = true; };
  }, [user]);

  const showJournalNewInsightMessage =
    justSaved &&
    !!latestInsight?.created_at &&
    hasNewInsightsSinceLastView(latestInsight.created_at) &&
    !interactedForCurrentInsight;

  const triggerJustSaved = (showChip = false) => {
    if (justSavedTimerRef.current) clearTimeout(justSavedTimerRef.current);
    setJustSaved(true);
    justSavedTimerRef.current = setTimeout(() => {
      setJustSaved(false);
      justSavedTimerRef.current = null;
    }, 8000);
    // Show Elena reflection chip only when requested (new entries ≥ 200 chars)
    if (showChip) {
      if (elenaChipTimerRef.current) clearTimeout(elenaChipTimerRef.current);
      setShowElenaChip(true);
      elenaChipTimerRef.current = setTimeout(() => {
        setShowElenaChip(false);
        elenaChipTimerRef.current = null;
      }, 12000);
    }
  };

  // Dirty when the user has typed content in a new entry or a draft, and hasn't
  // just finished saving.  Saved entries being re-edited are handled by auto-save
  // drafts, but we don't block navigation on those since every keystroke there
  // is already persisted as a draft or the original saved entry is still intact.
  const isDirty =
    (isNewEntry || isDraftEntry) &&
    content.trim().length > 0 &&
    !justSaved;

  const { pendingPath, confirmNavigation, cancelNavigation } = useNavigationGuard(isDirty);

  useEffect(() => {
    return () => {
      if (justSavedTimerRef.current) clearTimeout(justSavedTimerRef.current);
    };
  }, []);

  const loadProgress = async () => {
    if (!user) return;
    setIsLoadingProgress(true);
    try {
      const result = await getJournalProgress(supabase, user.id);
      setProgress(result);
    } catch {
    } finally {
      setIsLoadingProgress(false);
    }
  };

  useEffect(() => {
    if (user && profile) loadEntries();
  }, [user, profile?.id]);

  useEffect(() => {
    if (user) getActiveCommitment(user.id).then(setActiveCommitment);
  }, [user?.id]);

  const handleSaveJournalCommitment = async () => {
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

  useEffect(() => {
    if (user) loadProgress();
  }, [user?.id]);

  useEffect(() => {
    if (entries.length === 0) return;
    const draftId = sessionStorage.getItem('diaryAutoOpen');
    if (draftId) {
      const entry = entries.find(e => e.id === draftId);
      if (entry) {
        if (entry.is_draft) setTab('drafts');
        handleSelectEntry(entry);
        sessionStorage.removeItem('diaryAutoOpen');
        return;
      }
    }
    if (!selectedEntry && !isNewEntry) {
      handleSelectEntry(entries[0]);
    }
  }, [entries]);

  // Prácticas journal bridge — open new entry with reflection prompt pre-filled
  useEffect(() => {
    try {
      const prefill = sessionStorage.getItem('diaryNewPrefill');
      if (!prefill) return;
      sessionStorage.removeItem('diaryNewPrefill');
      handleNewEntry();
      setTimeout(() => setContent(prefill + '\n\n'), 0);
    } catch {}
  }, []);

  useEffect(() => {
    if (storageState === 'warning' || storageState === 'critical') {
      setShowManagePanel(true);
    }
  }, [storageState]);

  useEffect(() => {
    if (deepLinkHandled.current || !deepLinkEntryId || !profile || !entriesLoaded) return;
    deepLinkHandled.current = true;
    const capturedSource = deepLinkSource;
    (async () => {
      const ok = await selectEntryById(deepLinkEntryId);
      if (!ok) {
        setDeepLinkError('No pudimos abrir esa entrada, pero tu diario está disponible aquí.');
      }
      if (capturedSource === 'insights') {
        setInsightsBridgeActive(true);
      }
      setLocation('/app/journal', { replace: true } as Parameters<typeof setLocation>[1]);
    })();
  }, [entriesLoaded, deepLinkEntryId, profile]);

  useEffect(() => {
    if (!insightsBridgeActive || dismissedBridgeBanner || bridgeShownTrackedRef.current) return;
    bridgeShownTrackedRef.current = true;
    trackEvent('insights_bridge_shown', {
      entry_id: selectedEntry?.id ?? null,
      source: 'insights',
      ui: 'JournalPageBridge',
      had_open_error: !!deepLinkError,
    });
  }, [insightsBridgeActive, dismissedBridgeBanner, selectedEntry?.id, deepLinkError]);

  const loadEntries = async () => {
    if (!user || !profile) return;
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (!error && data) {
      const decryptedEntries = await Promise.all(
        data.map(async (entry, i) => {
          let content = '';
          try {
            content = await decryptForUser(entry.content_enc, profile);
          } catch {
            content = '[Contenido no disponible]';
          }
          return {
            id: entry.id,
            title: entry.title,
            content,
            prompt: entry.prompt ?? undefined,
            tags: entry.tags || [],
            created_at: entry.created_at,
            sort_order: i,
            content_bytes: entry.content_bytes ?? 0,
            is_draft: (entry as { is_draft?: boolean }).is_draft ?? false,
            origin: (entry as { origin?: string }).origin ?? 'manual',
            source_chat_id: (entry as { source_chat_id?: string | null }).source_chat_id ?? null,
            linked_chat_id: (entry as { linked_chat_id?: string | null }).linked_chat_id ?? null,
            saved_at: (entry as { saved_at?: string | null }).saved_at ?? null,
          };
        })
      );
      setEntries(decryptedEntries);

      const needsUpdate = decryptedEntries.some((_e, i) => data[i].sort_order !== i);
      if (needsUpdate) {
        await Promise.all(
          decryptedEntries.map(e =>
            supabase.from('journal_entries').update({ sort_order: e.sort_order }).eq('id', e.id)
          )
        );
      }
    }
    setEntriesLoaded(true);
  };

  const loadPrompts = async () => {
    setIsLoadingPrompts(true);
    setTokenLimitError(null);
    try {
      const recentTexts = entries
        .slice(0, 5)
        .map(e => e.content)
        .filter(Boolean);
      const languageSignals = extractLanguageSignals(recentTexts);
      const data = await getJournalPrompts(languageSignals);
      const received = data.prompts || data.suggestions || data.items || [];
      setPrompts(Array.isArray(received) ? received : []);
      if (data.crisis && data.crisis !== 'NO') {
        setPromptsCrisis(data.crisis as 'MAYBE' | 'YES');
      }
      queryClient.invalidateQueries({ queryKey: ['token-budget', user?.id] });
    } catch (error) {
      if (error instanceof TokenLimitError) {
        setTokenLimitError(error.serverMessage);
      } else {
        console.error('Error loading prompts:', error);
        setTokenLimitError('No se pudieron cargar las sugerencias. Intenta de nuevo.');
      }
    } finally {
      setIsLoadingPrompts(false);
    }
  };

  const handleNewEntry = () => {
    if (isTokenExhausted) {
      setReadOnlyWarning(true);
      return;
    }
    // Reset auto-save tracking for the new entry
    autoSavedDraftIdRef.current = null;
    setAutoSaveStatus('idle');
    if (autoSaveDraftTimerRef.current) clearTimeout(autoSaveDraftTimerRef.current);
    setIsNewEntry(true);
    setSelectedEntry(null);
    setTitle('');
    setContent('');
    setSelectedPrompt('');
    setTags('');
    setShowSidebar(false);
    setPrompts([]);
    setTokenLimitError(null); // clear any previous prompt error
    setShowSaveCrisisBanner(false);
  };

  const handleSelectEntry = (entry: JournalEntry) => {
    // Cancel any pending auto-save for the previous new entry
    autoSavedDraftIdRef.current = null;
    setAutoSaveStatus('idle');
    if (autoSaveDraftTimerRef.current) clearTimeout(autoSaveDraftTimerRef.current);
    setIsNewEntry(false);
    setSelectedEntry(entry);
    setTitle(entry.title);
    setContent(entry.content);
    setSelectedPrompt(entry.prompt || '');
    setTags(entry.tags.join(', '));
    setShowSidebar(false);
    setIsDraftEntry(entry.is_draft);
    setShowSaveCrisisBanner(false);
  };

  const selectEntryById = async (id: string): Promise<boolean> => {
    const found = entries.find(e => e.id === id);
    if (found) {
      handleSelectEntry(found);
      return true;
    }
    if (!profile) return false;
    const { data } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (data) {
      let content = '';
      try {
        content = await decryptForUser(data.content_enc, profile);
      } catch {
        content = '[Contenido no disponible]';
      }
      const entry: JournalEntry = {
        id: data.id,
        title: data.title,
        content,
        prompt: data.prompt ?? undefined,
        tags: data.tags || [],
        created_at: data.created_at,
        sort_order: data.sort_order ?? 0,
        content_bytes: data.content_bytes ?? 0,
        is_draft: (data as { is_draft?: boolean }).is_draft ?? false,
        origin: (data as { origin?: string }).origin ?? 'manual',
        source_chat_id: (data as { source_chat_id?: string | null }).source_chat_id ?? null,
        linked_chat_id: (data as { linked_chat_id?: string | null }).linked_chat_id ?? null,
        saved_at: (data as { saved_at?: string | null }).saved_at ?? null,
      };
      handleSelectEntry(entry);
      return true;
    }
    return false;
  };

  const deleteEntry = (entryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEntryToDelete(entryId);
  };

  const confirmDeleteEntry = async () => {
    const entryId = entryToDelete;
    if (!entryId) return;
    setDeletingEntry(true);

    await supabase.from('journal_entries').delete().eq('id', entryId);

    const remaining = entries.filter(e => e.id !== entryId).map((e, i) => ({ ...e, sort_order: i }));
    setEntries(remaining);

    if (selectedEntry?.id === entryId) {
      setSelectedEntry(null);
      setIsNewEntry(false);
      setTitle('');
      setContent('');
      setTags('');
      if (!remaining.length) setShowSidebar(true);
    }

    await Promise.all(
      remaining.map(e =>
        supabase.from('journal_entries').update({ sort_order: e.sort_order }).eq('id', e.id)
      )
    );

    queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });

    setDeletingEntry(false);
    setEntryToDelete(null);
  };

  const handleDragStart = (e: React.DragEvent, entryId: string) => {
    setDraggedId(entryId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, entryId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (entryId !== draggedId) setDragOverId(entryId);
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    const fromIdx = entries.findIndex(e => e.id === draggedId);
    const toIdx = entries.findIndex(e => e.id === targetId);
    const newEntries = [...entries];
    const [moved] = newEntries.splice(fromIdx, 1);
    newEntries.splice(toIdx, 0, moved);
    const reordered = newEntries.map((e, i) => ({ ...e, sort_order: i }));
    setEntries(reordered);
    setDraggedId(null);
    setDragOverId(null);
    await Promise.all(
      reordered.map(e =>
        supabase.from('journal_entries').update({ sort_order: e.sort_order }).eq('id', e.id)
      )
    );
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const getReflectionTitle = (createdAt: string): string => {
    try {
      const then = new Date(createdAt);
      if (isNaN(then.getTime())) return 'Hace aproximadamente una semana';
      const nowMidnight = new Date();
      nowMidnight.setHours(0, 0, 0, 0);
      const thenMidnight = new Date(then);
      thenMidnight.setHours(0, 0, 0, 0);
      const days = Math.round((nowMidnight.getTime() - thenMidnight.getTime()) / 86_400_000);
      if (days >= 6 && days <= 8) return `Hace ${days} días`;
      return 'Hace aproximadamente una semana';
    } catch {
      return 'Hace aproximadamente una semana';
    }
  };

  const buildReflectionStarter = (src: string, insertStarter?: string): string => {
    const MAX_EXCERPT = 120;
    const raw = src.trim();
    const excerpt = raw.length > MAX_EXCERPT ? raw.slice(0, MAX_EXCERPT).trimEnd() + '\u2026' : raw;
    const header = insertStarter ?? 'Hace unos días escribí:\n';
    return `${header}\u201c${excerpt}\u201d\n\n`;
  };

  const handleDismissReflection = () => {
    setReflectionDismissed(true);
  };

  const reflectionVisible = !!(reflectionCandidate && reflectionContent && !reflectionDismissed && !reflectionCollapsed);
  const showStarterPrompt = isNewEntry && content === '' && !starterPromptDismissed && !reflectionVisible && starterPrompt !== null;

  useEffect(() => {
    if (showStarterPrompt && !frPrevStarterPromptRef.current) {
      recordFlightEvent(user?.id, 'GUIDED_STARTER_PROMPT_SHOWN', { promptGroup: starterPromptGroup ?? 'unknown' });
    }
    frPrevStarterPromptRef.current = showStarterPrompt;
  }, [showStarterPrompt, user?.id, starterPromptGroup]);

  useEffect(() => {
    if (reflectionVisible && !frPrevReflectionRef.current) {
      recordFlightEvent(user?.id, 'REFLECTION_MEMORY_CARD_SHOWN', {
        daysAgo: reflectionCandidate?.created_at
          ? Math.round((Date.now() - new Date(reflectionCandidate.created_at).getTime()) / 86_400_000)
          : undefined,
      });
    }
    frPrevReflectionRef.current = reflectionVisible;
  }, [reflectionVisible, user?.id, reflectionCandidate?.created_at]);

  useEffect(() => {
    if (showJournalNewInsightMessage && !frPrevNudgeRef.current) {
      recordFlightEvent(user?.id, 'JOURNAL_POST_SAVE_INSIGHT_NUDGE_SHOWN');
    }
    frPrevNudgeRef.current = showJournalNewInsightMessage;
  }, [showJournalNewInsightMessage, user?.id]);

  useEffect(() => {
    if (showActivation && !frPrevActivationRef.current) {
      recordFlightEvent(user?.id, 'INSIGHT_ACTIVATION_CHIP_SHOWN');
    }
    frPrevActivationRef.current = showActivation;
  }, [showActivation, user?.id]);

  const handleStarterInsert = (text: string) => {
    if (content !== '') return;
    recordFlightEvent(user?.id, 'STARTER_PROMPT_INSERTED');
    setContent(text + '\n\n');
    setJustSaved(false);
    setStarterPromptDismissed(true);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const len = (text + '\n\n').length;
        textareaRef.current.setSelectionRange(len, len);
      }
    }, 0);
  };

  const handleStarterDismiss = () => {
    setStarterPromptDismissed(true);
  };

  const handleTryAnotherPrompt = () => {
    if (!starterPromptGroup || !starterPrompt) return;
    recordFlightEvent(user?.id, 'TRY_ANOTHER_PROMPT_CLICKED');
    setStarterPrompt(pickPromptFromGroup(starterPromptGroup, starterPrompt));
  };

  const handleViewOriginal = () => {
    if (!reflectionContent) return;
    recordFlightEvent(user?.id, 'REFLECTION_MEMORY_VIEW_ORIGINAL_CLICKED');
    setIsReflectionViewerOpen(true);
  };

  const handleCloseViewer = () => {
    setIsReflectionViewerOpen(false);
    setReflectionCollapsed(true);
  };

  const handleReflect = () => {
    if (!reflectionContent) return;
    recordFlightEvent(user?.id, 'REFLECTION_MEMORY_INSERTED');
    const starter = buildReflectionStarter(reflectionContent, reflectionPromptResult?.insertStarter);
    setContent(prev => {
      const existing = prev.trim();
      if (existing === '') return starter;
      if (existing.includes(starter.trim())) return prev;
      return prev + '\n\n' + starter;
    });
    setJustSaved(false);
    setReflectionCollapsed(true);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const len = textareaRef.current.value.length;
        textareaRef.current.setSelectionRange(len, len);
      }
    }, 0);
  };

  const handleUseReflectionFromModal = () => {
    setIsReflectionViewerOpen(false);
    handleReflect();
  };

  const isStorageLimitError = (err: unknown): boolean => {
    if (!err) return false;
    const msg = (err as { message?: string })?.message ?? '';
    return msg.includes('JOURNAL_STORAGE_LIMIT');
  };

  // ─── Auto-save draft ────────────────────────────────────────────────────────
  // Runs ~3 s after the user stops typing. Skips when:
  //   • content is empty
  //   • the open entry is an already-saved (non-draft) existing entry
  //   • token limit is exhausted
  // For new entries it inserts a draft row once, then updates it on subsequent
  // calls via autoSavedDraftIdRef.  For existing draft entries it updates in place.
  const autoSaveDraft = useCallback(async () => {
    if (!user || !profile) return;
    if (!content.trim()) return;
    if (isTokenExhausted) return;
    // Don't auto-save over a fully-saved existing entry — the user must
    // explicitly click Guardar to promote edits of existing saved entries.
    if (selectedEntry && !selectedEntry.is_draft) return;

    setIsAutoSaving(true);
    setAutoSaveStatus('saving');
    try {
      const encryptedContent = await encryptForUser(content, profile);
      const tagsArray = tags.split(',').map(t => t.trim()).filter(t => t);
      const draftTitle = title.trim() || 'Sin título';

      // Case 1: editing an existing draft entry — update it
      if (selectedEntry && selectedEntry.is_draft) {
        await supabase
          .from('journal_entries')
          .update({
            title: draftTitle,
            content_enc: encryptedContent,
            enc_version: 2,
            tags: tagsArray,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedEntry.id);
        setAutoSaveStatus('saved');
        return;
      }

      // Case 2: new entry — insert once, then update via autoSavedDraftIdRef
      if (autoSavedDraftIdRef.current) {
        await supabase
          .from('journal_entries')
          .update({
            title: draftTitle,
            content_enc: encryptedContent,
            enc_version: 2,
            tags: tagsArray,
            updated_at: new Date().toISOString(),
          })
          .eq('id', autoSavedDraftIdRef.current);
      } else {
        const { data: newDraft, error } = await supabase
          .from('journal_entries')
          .insert({
            user_id: user.id,
            title: draftTitle,
            content_enc: encryptedContent,
            enc_version: 2,
            tags: tagsArray,
            sort_order: 0,
            is_draft: true,
          })
          .select()
          .single();
        if (!error && newDraft) {
          autoSavedDraftIdRef.current = newDraft.id;
          // Reload sidebar so the draft appears there immediately
          await loadEntries();
        }
      }
      setAutoSaveStatus('saved');
    } catch (err) {
      console.error('[auto-save] Draft save failed:', err);
      setAutoSaveStatus('idle');
    } finally {
      setIsAutoSaving(false);
    }
  }, [user, profile, content, title, tags, selectedEntry, isTokenExhausted]);

  // Debounce: fire autoSaveDraft 3 s after the last content/title change
  useEffect(() => {
    // Don't schedule if nothing to save
    if (!content.trim()) return;
    // Don't auto-save over a fully-saved existing entry
    if (selectedEntry && !selectedEntry.is_draft) return;

    setAutoSaveStatus('idle');
    if (autoSaveDraftTimerRef.current) clearTimeout(autoSaveDraftTimerRef.current);
    autoSaveDraftTimerRef.current = setTimeout(() => {
      autoSaveDraft();
    }, 3000);

    return () => {
      if (autoSaveDraftTimerRef.current) clearTimeout(autoSaveDraftTimerRef.current);
    };
  }, [content, title]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveDraftTimerRef.current) clearTimeout(autoSaveDraftTimerRef.current);
    };
  }, []);
  // ────────────────────────────────────────────────────────────────────────────

  // Lightweight client-side crisis signal detection — no API call
  // Returns true if the plaintext text (content + title) contains crisis-level language
  // Covers Spanish and English — the two languages TuAnimo users write in
  const detectCrisisInContent = (text: string): boolean => {
    const lower = text.toLowerCase();
    const crisisSignals = [
      // ── Spanish ──────────────────────────────────────────────────────────
      'suicid',                         // suicidio, suicida, suicidal, suicidarse
      'pensamiento suicida',
      'pensamientos suicidas',
      'quitarme la vida',
      'acabar con mi vida',
      'terminar con mi vida',
      'no quiero vivir',
      'no quiero seguir viviendo',
      'no quiero seguir aquí',
      'quiero morir',
      'deseo morir',
      'mejor estaría muerto',
      'mejor estaría muerta',
      'mejor muerto',
      'mejor muerta',
      'me quiero matar',
      'quiero matarme',
      'hacerme daño',
      'hacerme daño',
      'lastimarme',
      'cortarme',
      'autolesion',                     // autolesión, autolesionarme
      'no vale la pena vivir',
      'no tiene sentido seguir',
      'no tiene sentido vivir',
      'desaparecer para siempre',
      'no puedo más con mi vida',
      'nadie me extrañaría',
      'sin mí estarían mejor',
      'sin mi estarían mejor',
      'todos estarían mejor sin mí',
      'todos estarian mejor sin mi',
      // ── English ──────────────────────────────────────────────────────────
      'suicidal',
      'suicide',
      'kill myself',
      'killing myself',
      'end my life',
      'ending my life',
      'take my life',
      'taking my life',
      'want to die',
      'wanting to die',
      'wish i was dead',
      'wish i were dead',
      'better off dead',
      'better off without me',
      'no reason to live',
      'not worth living',
      'can\'t go on',
      'cannot go on',
      'can\'t take it anymore',
      'cannot take it anymore',
      'don\'t want to live',
      'do not want to live',
      'hurt myself',
      'hurting myself',
      'self-harm',
      'self harm',
      'cut myself',
      'cutting myself',
      'nobody would miss me',
      'everyone would be better',
    ];
    return crisisSignals.some(signal => lower.includes(signal));
  };

  const handleSave = async () => {
    if (!user || !content.trim() || !profile) return;
    if (isTokenExhausted) {
      setReadOnlyWarning(true);
      return;
    }
    // Synchronous re-entry guard: isSaving is React state (async), so a fast
    // second click — or one during the awaited auto-title generation — could
    // slip through and INSERT a duplicate new entry. The ref blocks that.
    if (savingRef.current) return;
    savingRef.current = true;

    setIsSaving(true);
    setStorageLimitError(null);
    try {
      // ── Auto-title when field is empty ────────────────────────────────────
      // Generate a title from the first 300 chars of content before saving.
      // Best-effort: if it fails the existing 'Sin título' fallback is used.
      let resolvedTitle = title.trim();
      if (!resolvedTitle && content.trim()) {
        const generated = await generateTitle({
          context: 'journal',
          firstUserMessage: content.trim().slice(0, 300),
        });
        if (generated) {
          resolvedTitle = generated;
          setTitle(generated); // update the visible input too
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      const encryptedContent = await encryptForUser(content, profile);
      const tagsArray = tags.split(',').map(t => t.trim()).filter(t => t);

      if (selectedEntry) {
        const finalizingDraft = selectedEntry.is_draft;
        const { error } = await supabase
          .from('journal_entries')
          .update({
            title: resolvedTitle || 'Sin título',
            content_enc: encryptedContent,
            enc_version: 2,
            prompt: selectedPrompt || null,
            tags: tagsArray,
            updated_at: new Date().toISOString(),
            is_draft: false,
            ...(finalizingDraft ? { saved_at: new Date().toISOString() } : {}),
          })
          .eq('id', selectedEntry.id);

        if (error) {
          if (isStorageLimitError(error)) {
            setStorageLimitError('Límite de almacenamiento del diario alcanzado. Elimina entradas antiguas para liberar espacio.');
          }
        } else {
          const updated: JournalEntry = {
            ...selectedEntry,
            title: resolvedTitle || 'Sin título',
            content,
            prompt: selectedPrompt || undefined,
            tags: tagsArray,
            is_draft: false,
            ...(finalizingDraft ? { saved_at: new Date().toISOString() } : {}),
          };
          setIsDraftEntry(false);
          setSelectedEntry(updated);
          if (finalizingDraft) setTab('entries');
          await loadEntries();
          queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
          if (canPlay('journal-saved')) audioManager.play('journal-saved');
          // QA_TEMP: fullText included for temporary QA observability — remove before GA
          const saveSourceUpdate = selectedEntry.origin === 'chat' ? 'converted_from_chat' : selectedPrompt ? 'prompted' : 'manual';
          recordFlightEvent(user?.id, 'JOURNAL_ENTRY_SAVED', { fullText: content, entryLength: content.length, isDraft: false, isUpdate: true, source: saveSourceUpdate });
          triggerJustSaved(false);
          if (detectCrisisInContent(content + " " + resolvedTitle)) setShowSaveCrisisBanner(true);
        }
      } else {
        const shiftedEntries = entries.map((e, i) => ({ ...e, sort_order: i + 1 }));
        await Promise.all(
          shiftedEntries.map(e =>
            supabase.from('journal_entries').update({ sort_order: e.sort_order }).eq('id', e.id)
          )
        );

        // If auto-save already created a draft row, promote it instead of inserting a duplicate
        const existingDraftId = autoSavedDraftIdRef.current;
        let savedEntryData: { id: string; created_at: string } | null = null;
        let saveError: unknown = null;

        if (existingDraftId) {
          const { data, error } = await supabase
            .from('journal_entries')
            .update({
              title: resolvedTitle || 'Sin título',
              content_enc: encryptedContent,
              enc_version: 2,
              prompt: selectedPrompt || null,
              tags: tagsArray,
              sort_order: 0,
              is_draft: false,
              saved_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingDraftId)
            .select()
            .single();
          savedEntryData = data;
          saveError = error;
        } else {
          const { data, error } = await supabase
            .from('journal_entries')
            .insert({
              user_id: user.id,
              title: resolvedTitle || 'Sin título',
              content_enc: encryptedContent,
              enc_version: 2,
              prompt: selectedPrompt || null,
              tags: tagsArray,
              sort_order: 0,
            })
            .select()
            .single();
          savedEntryData = data;
          saveError = error;
        }

        if (saveError) {
          if (isStorageLimitError(saveError)) {
            setStorageLimitError('Límite de almacenamiento del diario alcanzado. Elimina entradas antiguas para liberar espacio.');
          }
        } else if (savedEntryData) {
          autoSavedDraftIdRef.current = null; // clear the draft tracking ref
          const created: JournalEntry = {
            id: savedEntryData.id,
            title: resolvedTitle || 'Sin título',
            content,
            prompt: selectedPrompt || undefined,
            tags: tagsArray,
            created_at: savedEntryData.created_at,
            sort_order: 0,
            content_bytes: 0,
            is_draft: false,
          };
          setIsNewEntry(false);
          setSelectedEntry(created);
          await loadEntries();
          queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
          if (canPlay('journal-saved')) audioManager.play('journal-saved');
          // QA_TEMP: fullText included for temporary QA observability — remove before GA
          const saveSourceNew = selectedPrompt ? 'prompted' : 'manual';
          recordFlightEvent(user?.id, 'JOURNAL_ENTRY_SAVED', { fullText: content, entryLength: content.length, isDraft: false, isUpdate: false, source: saveSourceNew });
          triggerJustSaved(content.trim().length >= 200);
          if (detectCrisisInContent(content + " " + resolvedTitle)) setShowSaveCrisisBanner(true);
        }
      }
    } catch (error) {
      console.error('Error saving entry:', error);
    } finally {
      setIsSaving(false);
      savingRef.current = false;
    }
  };

  const savedEntries = entries.filter(e => !e.is_draft);
  const draftEntries = entries.filter(e => e.is_draft);
  const visibleEntries = tab === 'drafts' ? draftEntries : savedEntries;

  const activeDate = selectedEntry
    ? new Date(selectedEntry.created_at).toLocaleDateString()
    : new Date().toLocaleDateString();

  const getDiaryExport = (format: ExportFormat) =>
    formatDiaryExport(
      {
        id: selectedEntry?.id ?? '',
        title: title || selectedEntry?.title || 'Untitled Entry',
        content,
        prompt: selectedPrompt || selectedEntry?.prompt,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean).length
          ? tags.split(',').map(t => t.trim()).filter(Boolean)
          : (selectedEntry?.tags ?? []),
        created_at: selectedEntry?.created_at ?? new Date().toISOString(),
      },
      format,
    );

  const getAllDiariesExport = (format: ExportFormat) =>
    formatAllDiariesExport(
      savedEntries.map(e => ({
        id: e.id,
        title: e.title,
        content: e.content,
        prompt: e.prompt,
        tags: e.tags,
        created_at: e.created_at,
      })),
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
          context="journal"
          onConfirm={confirmNavigation}
          onCancel={cancelNavigation}
        />
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
          <h2 className="flex-1 text-[15px] font-semibold text-app-text truncate">Diario</h2>
          {savedEntries.length > 0 && (
            <button
              onClick={() => setShowExportAll(true)}
              title="Descargar todas las entradas"
              className="flex-shrink-0 p-2 rounded-12 hover:bg-app-surface-2 text-app-muted hover:text-app-text transition-colors"
            >
              <Download size={17} />
            </button>
          )}
          <button
            onClick={handleNewEntry}
            disabled={isTokenExhausted}
            title={isTokenExhausted ? 'Límite de tokens alcanzado — puedes ver tu diario, pero no crear nuevas entradas.' : 'Nueva entrada'}
            className="flex-shrink-0 bg-sage-strong text-white rounded-12 p-2 hover:bg-[#4e7260] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={17} />
          </button>
        </div>

        <div className="flex border-b border-app-border flex-shrink-0">
          <button
            onClick={() => setTab('entries')}
            className={`flex-1 py-2.5 text-[13px] font-medium transition-colors relative ${
              tab === 'entries'
                ? 'text-sage-strong'
                : 'text-app-muted hover:text-app-text'
            }`}
          >
            Entradas
            {tab === 'entries' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sage-strong rounded-t" />
            )}
          </button>
          <button
            onClick={() => setTab('drafts')}
            className={`flex-1 py-2.5 text-[13px] font-medium transition-colors relative ${
              tab === 'drafts'
                ? 'text-sage-strong'
                : 'text-app-muted hover:text-app-text'
            }`}
          >
            Borradores
            {draftEntries.length > 0 && (
              <span className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-semibold ${
                tab === 'drafts' ? 'bg-sage-strong text-white' : 'bg-app-surface-2 text-app-muted'
              }`}>
                {draftEntries.length}
              </span>
            )}
            {tab === 'drafts' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sage-strong rounded-t" />
            )}
          </button>
        </div>

        {isTokenExhausted && (
          <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-50 border-b border-amber-200 flex-shrink-0">
            <Lock size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-800">Modo solo lectura</p>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                Puedes ver tus entradas existentes, pero no crear o editar hasta que se restablezca tu ciclo o aumentes tu plan.
              </p>
            </div>
          </div>
        )}

        <JournalStorageBanner
          onUpgradeClick={() => setShowUpgrade(true)}
          onManageClick={() => { setShowSidebar(true); setShowManagePanel(p => !p); }}
        />

        {showManagePanel && (
          <LargestEntriesPanel
            entries={entries}
            onOpenEntry={(id) => {
              const entry = entries.find(e => e.id === id);
              if (entry) handleSelectEntry(entry);
            }}
            onDeleteEntry={deleteEntry}
            onClose={() => setShowManagePanel(false)}
          />
        )}

        <div className="flex-1 overflow-y-auto">
          {tab === 'entries' && (
            <JournalProgressCard
              progress={progress}
              isLoading={isLoadingProgress}
              onSelectEntryId={selectEntryById}
            />
          )}
          {tab === 'entries' && showActivation && (
            <InsightActivationChip
              onView={() => { recordFlightEvent(user?.id, 'INSIGHT_ACTIVATION_CHIP_CLICKED'); dismissActivation(); setLocation('/app/insights'); }}
              onDismiss={dismissActivation}
            />
          )}
          {visibleEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-8 text-center gap-6">
              {tab === 'drafts' ? (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-[14px] text-app-muted leading-relaxed">
                    Aún no hay borradores.
                  </p>
                  <p className="text-[12.5px] text-app-muted/60 leading-relaxed max-w-[220px]">
                    Puedes crear uno desde un chat con "Convertir a diario".
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-[14px] text-app-muted leading-relaxed">
                    Puedes empezar con algo simple.
                  </p>
                  <div className="flex flex-col gap-2 w-full max-w-[260px]">
                    {[
                      'Hoy me siento…',
                      'Algo que no dejo de pensar…',
                      'Una cosa que agradezco hoy…',
                    ].map(prompt => (
                      <button
                        key={prompt}
                        onClick={() => {
                          handleNewEntry();
                          setTimeout(() => setContent(prompt), 0);
                        }}
                        className="px-4 py-2.5 text-[13px] text-app-muted border border-app-border rounded-12 bg-app-surface hover:border-sage-strong/30 hover:text-app-text transition-colors text-left"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            visibleEntries.map((entry) => (
              <div
                key={entry.id}
                draggable
                onDragStart={(e) => handleDragStart(e, entry.id)}
                onDragOver={(e) => handleDragOver(e, entry.id)}
                onDrop={(e) => handleDrop(e, entry.id)}
                onDragEnd={handleDragEnd}
                onClick={() => handleSelectEntry(entry)}
                className={`group relative cursor-pointer px-4 py-3 transition-colors border-b border-app-border select-none min-h-[52px]
                  ${selectedEntry?.id === entry.id
                    ? 'bg-sage-soft border-l-[3px] border-l-sage-strong'
                    : 'hover:bg-app-surface-2'
                  }
                  ${draggedId === entry.id ? 'opacity-40' : ''}
                  ${dragOverId === entry.id && draggedId !== entry.id ? 'border-t-2 border-t-sage bg-sage-soft' : ''}
                `}
              >
                <div className="flex items-center gap-2 pr-8">
                  <div className="flex-shrink-0 text-sage-soft group-hover:text-sage transition-colors cursor-grab active:cursor-grabbing">
                    <GripVertical size={13} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <div className="font-medium text-sm text-app-text truncate">{entry.title}</div>
                      {entry.is_draft && (
                        <span className="flex-shrink-0 text-[10px] font-medium text-sage-strong bg-sage-soft px-1.5 py-0.5 rounded-full">
                          Borrador
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-app-muted mt-0.5 flex items-center gap-1">
                      <Calendar size={11} />
                      {new Date(entry.created_at).toLocaleDateString()}
                    </div>
                    {entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {entry.tags.slice(0, 2).map((tag, i) => (
                          <span key={i} className="text-xs bg-sage-soft text-sage-strong px-1.5 py-0.5 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => deleteEntry(entry.id, e)}
                  title="Eliminar entrada"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-app-muted hover:text-danger transition-all"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ── Main panel ── */}
      <div
        className={`
          flex-1 flex flex-col min-w-0
          ${showSidebar ? 'hidden' : 'flex'}
          lg:flex
        `}
      >
        {isNewEntry || selectedEntry ? (
          <>
            {/* Header */}
            <div className="bg-app-surface border-b border-app-border px-4 flex items-center gap-3 flex-shrink-0" style={{ height: '52px' }}>
              <button
                onClick={() => setShowSidebar(true)}
                className="lg:hidden flex-shrink-0 p-1.5 rounded-xl hover:bg-app-surface-2 transition-colors text-app-text"
                aria-label="Volver a entradas"
              >
                <ArrowLeft size={19} />
              </button>
              <div className="min-w-0 flex-1 flex items-center gap-2">
                <input
                  type="text"
                  value={title}
                  onChange={isTokenExhausted ? undefined : (e) => { setTitle(e.target.value); setJustSaved(false); }}
                  readOnly={isTokenExhausted}
                  placeholder="Título de la entrada..."
                  onClick={(e) => e.currentTarget.select()}
                  className={`text-[15px] font-semibold flex-1 min-w-0 focus:outline-none text-app-text placeholder:text-app-muted bg-transparent ${isTokenExhausted ? 'cursor-default select-text' : ''}`}
                />
                <span className="text-xs text-app-muted flex items-center gap-1 flex-shrink-0">
                  <Calendar size={11} />
                  {activeDate}
                </span>
                <VoiceMemo
                  context="journal"
                  supabaseClient={supabase}
                  onTranscript={(text: string) => {
                    setContent(prev => prev ? prev + '\n\n' + text : text);
                  }}
                />
              </div>
              {selectedEntry && (
                <button
                  onClick={() => setShowExport(true)}
                  title="Exportar entrada"
                  className="flex-shrink-0 p-1.5 rounded-xl hover:bg-app-surface-2 text-app-muted hover:text-app-text transition-colors"
                >
                  <Download size={16} />
                </button>
              )}
              {!isTokenExhausted && !activeCommitment && (
                <div className="flex-shrink-0">
                  {showCommitmentInput ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        ref={commitmentInputRef}
                        value={commitmentDraft}
                        onChange={e => setCommitmentDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveJournalCommitment();
                          if (e.key === 'Escape') { setShowCommitmentInput(false); setCommitmentDraft(''); }
                        }}
                        placeholder="¿Qué quieres intentar?"
                        maxLength={200}
                        className="w-44 sm:w-56 rounded-10 border border-app-border px-2.5 py-1.5 text-[12.5px] text-app-text placeholder:text-app-muted bg-app-surface focus:outline-none focus:ring-2 focus:ring-sage-strong/25"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveJournalCommitment}
                        disabled={!commitmentDraft.trim() || savingCommitment}
                        className="rounded-10 px-2.5 py-1.5 bg-sage-strong text-white text-[12.5px] font-medium hover:bg-[#4e7260] transition-colors disabled:opacity-40"
                      >
                        {savingCommitment ? '...' : 'Guardar'}
                      </button>
                      <button
                        onClick={() => { setShowCommitmentInput(false); setCommitmentDraft(''); }}
                        className="p-1.5 text-app-muted hover:text-app-text transition-colors"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setShowCommitmentInput(true); setTimeout(() => commitmentInputRef.current?.focus(), 0); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-10 border border-[#AFA9EC]/50 text-[#534AB7] bg-[#EEEDFE] hover:bg-[#CECBF6]/50 transition-colors text-[12px]"
                      title="Agregar compromiso"
                    >
                      <Star size={12} />
                      <span className="hidden sm:inline">Compromiso</span>
                    </button>
                  )}
                </div>
              )}
              {!isTokenExhausted ? (
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Auto-save status indicator */}
                  {(isAutoSaving || autoSaveStatus === 'saved') && !justSaved && (
                    <span className="text-[11px] text-app-muted flex items-center gap-1">
                      {isAutoSaving ? (
                        <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      ) : (
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                      )}
                      {isAutoSaving ? 'Guardando borrador…' : 'Borrador guardado'}
                    </span>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={isSaving || !content.trim() || justSaved}
                    className={`rounded-10 px-3 py-1.5 transition-colors flex items-center gap-1.5 text-[13px] font-medium ${justSaved ? 'bg-emerald-600 text-white' : 'bg-sage-strong text-white hover:bg-[#4e7260] disabled:opacity-40 disabled:cursor-not-allowed'}`}
                  >
                    {justSaved ? <Check size={13} /> : <BookOpen size={13} />}
                    <span>{isSaving ? '...' : justSaved ? '¡Guardado!' : 'Guardar'}</span>
                  </button>
                </div>
              ) : (
                <div className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-10 border border-app-border text-app-muted text-[13px] bg-app-surface-2 cursor-not-allowed select-none">
                  <Lock size={12} />
                  <span>Solo lectura</span>
                </div>
              )}
            </div>

            {/* Elena reflection chip — appears after saving a new entry, and
                stays available whenever you're reading a substantial saved entry.
                Chat-born entries are excluded: they already have exactly one chat
                (source_chat_id) and return to it via the chat-origin banner, so
                they must never offer the "create a chat" path (1:1 diary↔chat). */}
            {!(selectedEntry?.origin === 'chat' && !!selectedEntry?.source_chat_id) &&
              (showElenaChip ||
              (!!selectedEntry &&
                !selectedEntry.is_draft &&
                !isNewEntry &&
                (!!selectedEntry.linked_chat_id || content.trim().length >= 200))) && (
              <div className="px-4 py-2 flex-shrink-0">
                {selectedEntry?.linked_chat_id ? (
                  <button
                    onClick={() => {
                      try {
                        sessionStorage.setItem('openChatThread', selectedEntry.linked_chat_id!);
                      } catch {}
                      setLocation('/chat');
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-[12px] bg-[#FAEEDA] border border-[#EF9F27]/40 text-[#854F0B] text-[13px] font-medium hover:bg-[#EF9F27]/20 transition-colors w-full"
                  >
                    <MessageCircle size={14} className="flex-shrink-0" />
                    <span>Continuar con Elena →</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      try {
                        sessionStorage.setItem(
                          'journalReflectionEntry',
                          JSON.stringify({ id: selectedEntry?.id || null, title: title.trim() || null, content }),
                        );
                      } catch {}
                      setLocation('/chat');
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-[12px] bg-[#FAEEDA] border border-[#EF9F27]/40 text-[#854F0B] text-[13px] font-medium hover:bg-[#EF9F27]/20 transition-colors w-full"
                  >
                    <MessageCircle size={14} className="flex-shrink-0" />
                    <span>Elena puede reflexionar sobre esto →</span>
                  </button>
                )}
              </div>
            )}

            {/* Read-only persistent banner */}
            {isTokenExhausted && (
              <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-50 border-b border-amber-200 flex-shrink-0">
                <Lock size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Modo solo lectura</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Puedes ver tus entradas existentes, pero no crear o editar hasta que se restablezca tu ciclo o aumentes tu plan.
                  </p>
                </div>
              </div>
            )}

            {/* Write-attempt warning toast */}
            {readOnlyWarning && (
              <div className="flex items-center justify-between gap-2 px-4 py-3 bg-amber-50 border-b border-amber-200 text-sm text-amber-800 flex-shrink-0">
                <span>No puedes guardar cambios porque alcanzaste tu límite de tokens. Aún puedes leer tus entradas.</span>
                <button onClick={() => setReadOnlyWarning(false)} className="flex-shrink-0 text-amber-600 hover:text-amber-900 font-bold text-base leading-none">×</button>
              </div>
            )}

            {/* AI prompt error */}
            {tokenLimitError && (
              <div className="bg-red-50 border-b border-red-200 px-4 py-3 text-sm text-red-800 flex-shrink-0">
                <span>{tokenLimitError}</span>
              </div>
            )}

            {/* Draft indicator */}
            {isDraftEntry && (
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-sage-soft/60 border-b border-sage-soft flex-shrink-0">
                <div className="flex items-center gap-2 text-sage-strong text-xs font-medium">
                  <BookOpen size={13} />
                  Borrador creado desde la conversación — edita todo antes de guardarlo.
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setIsDraftEntry(false)}
                    className="text-sage-strong/70 hover:text-sage-strong transition-colors"
                    aria-label="Descartar aviso"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            )}

            {/* Chat-origin back-navigation banner */}
            {!isNewEntry && selectedEntry?.origin === 'chat' && selectedEntry?.source_chat_id && (
              <JournalChatOriginBanner
                key={selectedEntry.id}
                sourceChatId={selectedEntry.source_chat_id}
                isDraft={selectedEntry.is_draft}
                onNavigate={() => {
                  sessionStorage.setItem('openChatThread', selectedEntry.source_chat_id!);
                  setLocation('/chat');
                }}
              />
            )}

            {/* Insights bridge banner */}
            {insightsBridgeActive && !dismissedBridgeBanner && !isNewEntry && (
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-sage-soft border-b border-sage flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles size={13} className="text-sage-strong flex-shrink-0" />
                  <span className="text-[12.5px] text-sage-strong font-medium truncate">
                    Abriste esta entrada desde Insight semanal.
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      trackEvent('insights_bridge_back_to_insights_clicked', {
                        entry_id: selectedEntry?.id ?? null,
                        source: 'insights',
                        ui: 'JournalPageBridge',
                      });
                      setLocation('/app/insights');
                    }}
                    className="text-[12px] font-semibold text-sage-strong hover:text-[#4e7260] transition-colors px-2 py-1 rounded-8 hover:bg-app-surface"
                  >
                    Volver a Insights
                  </button>
                  <button
                    onClick={() => {
                      trackEvent('insights_bridge_dismissed', {
                        entry_id: selectedEntry?.id ?? null,
                        source: 'insights',
                        ui: 'JournalPageBridge',
                      });
                      setDismissedBridgeBanner(true);
                    }}
                    className="text-sage-strong/60 hover:text-sage-strong transition-colors"
                    aria-label="Cerrar"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            )}

            {/* Repeated-topic chat suggestion — retired in favor of the
                entry-anchored "Elena puede reflexionar sobre esto" chip. */}

            {/* Storage limit error */}
            {storageLimitError && (
              <div className="flex items-center justify-between gap-2 px-4 py-3 bg-red-50 border-b border-red-200 text-sm text-red-800 flex-shrink-0">
                <span>{storageLimitError}</span>
                <button
                  onClick={() => setStorageLimitError(null)}
                  className="flex-shrink-0 text-red-600 hover:text-red-900 font-bold text-base leading-none"
                >
                  ×
                </button>
              </div>
            )}

            {/* Crisis alert — from prompts */}
            {promptsCrisis !== 'NO' && (
              <div className="px-4 py-3 border-b border-red-200 flex-shrink-0">
                <CrisisAlert />
              </div>
            )}

            {/* Crisis banner — shown after saving an entry with crisis signals */}
            {showSaveCrisisBanner && promptsCrisis === 'NO' && (
              <div className="px-4 py-3 border-b border-red-100 flex-shrink-0 relative">
                <CrisisAlert />
                <button
                  onClick={() => setShowSaveCrisisBanner(false)}
                  className="absolute top-4 right-4 p-1 text-red-300 hover:text-red-500 transition-colors text-xs"
                  aria-label="Cerrar"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Prompts bar */}
            {isNewEntry && isLoadingPrompts && (
              <div className="bg-sage-soft/40 border-b border-sage-soft px-4 py-3 flex-shrink-0">
                <div className="flex items-center gap-2 text-sage-strong text-sm">
                  <Sparkles size={15} className="animate-pulse" />
                  Generando sugerencias...
                </div>
              </div>
            )}
            {isNewEntry && !isLoadingPrompts && prompts.length > 0 && (
              <div className="bg-sage-soft/40 border-b border-sage-soft px-4 py-3 flex-shrink-0">
                <div className="flex items-center gap-2 mb-2 text-sage-strong text-sm font-medium">
                  <Sparkles size={15} />
                  Sugerencias de escritura
                </div>
                <div className="flex flex-wrap gap-2">
                  {prompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedPrompt(selectedPrompt === prompt ? '' : prompt)}
                      className={`text-left px-3 py-1.5 rounded-12 text-xs transition-colors ${
                        selectedPrompt === prompt
                          ? 'bg-sage-strong text-white'
                          : 'bg-app-surface text-app-text hover:bg-sage-soft border border-app-border'
                      }`}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Content area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 bg-app-bg">
              {reflectionVisible && (
                <ReflectionMemoryCard
                  title={getReflectionTitle(reflectionCandidate!.created_at)}
                  content={reflectionContent!}
                  prompt={reflectionPromptResult?.promptText ?? '¿Cómo te sientes hoy comparado con entonces?'}
                  onReflect={handleReflect}
                  onDismiss={handleDismissReflection}
                  onViewOriginal={handleViewOriginal}
                />
              )}
              {showStarterPrompt && (
                <GuidedStarterPrompt
                  prompt={starterPrompt!}
                  onInsert={handleStarterInsert}
                  onDismiss={handleStarterDismiss}
                  onTryAnother={handleTryAnotherPrompt}
                />
              )}
              {selectedPrompt && (
                <div className="mb-4 p-4 bg-sage-soft rounded-14 text-sm text-sage-strong border border-sage-soft">
                  <strong>Guía:</strong> {selectedPrompt}
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={content}
                onChange={isTokenExhausted ? undefined : (e) => { setContent(e.target.value); setJustSaved(false); }}
                readOnly={isTokenExhausted}
                placeholder="Escribe aquí tus pensamientos..."
                className={`w-full h-full min-h-[300px] focus:outline-none resize-none text-[15px] text-app-text placeholder:text-app-muted leading-relaxed bg-transparent ${isTokenExhausted ? 'cursor-default select-text' : ''}`}
              />
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-app-border/50">
                <Tag size={13} className="text-app-muted/60 flex-shrink-0" />
                <input
                  type="text"
                  value={tags}
                  onChange={isTokenExhausted ? undefined : (e) => setTags(e.target.value)}
                  readOnly={isTokenExhausted}
                  placeholder="Etiquetas (separadas por comas)"
                  className={`flex-1 min-w-0 text-[13px] text-app-muted placeholder:text-app-muted/50 focus:outline-none bg-transparent ${isTokenExhausted ? 'cursor-default select-text' : ''}`}
                />
                {isNewEntry && prompts.length === 0 && !isTokenExhausted && (
                  <button
                    onClick={loadPrompts}
                    disabled={isLoadingPrompts || !!tokenLimitError}
                    title={tokenLimitError ? 'Límite de tokens alcanzado' : 'Obtener ideas'}
                    className="flex-shrink-0 p-1.5 rounded-lg text-app-muted/60 hover:text-app-muted hover:bg-app-surface-2 transition-colors disabled:opacity-40"
                  >
                    <Sparkles size={13} />
                  </button>
                )}
              </div>
              {!evidenceEnough && (
                <p className="mt-3 text-[11px] text-app-muted/50 text-center leading-relaxed">
                  Cada entrada ayuda a Elena a reconocer patrones con el tiempo.
                </p>
              )}
              <div ref={contentEndRef} />
            </div>

            {/* Post-save insight nudge */}
            {showJournalNewInsightMessage && (
              <div className="bg-app-surface border-t border-app-border px-4 py-2 flex-shrink-0">
                <button
                  onClick={() => {
                    recordFlightEvent(user?.id, 'JOURNAL_POST_SAVE_INSIGHT_NUDGE_CLICKED');
                    const ts = latestInsight?.created_at;
                    if (ts) {
                      try {
                        localStorage.setItem(`${INSIGHT_SHORTCUT_INTERACTED_PREFIX}${ts}`, '1');
                      } catch {
                        // localStorage may be unavailable in private browsing or restricted contexts
                      }
                      setInteractedForCurrentInsight(true);
                    }
                    try { sessionStorage.setItem('insightsPageSource', 'journal_post_save_nudge'); } catch {}
                    setLocation('/app/insights');
                  }}
                  aria-label="Tu entrada reciente puede haber contribuido a un nuevo insight."
                  className="
                    inline-flex items-center gap-1.5
                    px-3 py-1 rounded-full
                    bg-sage-soft text-sage-strong
                    border border-sage/30
                    text-[12px] font-semibold
                    hover:bg-sage/20 hover:border-sage-strong/40
                    active:scale-95
                    transition-all duration-150
                  "
                >
                  <Sparkles size={11} />
                  Tu entrada reciente puede haber contribuido a un nuevo insight.
                  <ChevronRight size={11} className="opacity-60" />
                </button>
              </div>
            )}

          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            {insightsBridgeActive && !dismissedBridgeBanner && !isNewEntry && (
              <div className="w-full max-w-md mx-4 mb-4 flex items-center justify-between gap-3 px-4 py-3 bg-sage-soft border border-sage rounded-14">
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles size={13} className="text-sage-strong flex-shrink-0" />
                  <span className="text-[13px] text-sage-strong font-medium">
                    Abriste esta entrada desde Insight semanal.
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      trackEvent('insights_bridge_back_to_insights_clicked', {
                        entry_id: null,
                        source: 'insights',
                        ui: 'JournalPageBridge',
                      });
                      setLocation('/app/insights');
                    }}
                    className="text-[12px] font-semibold text-sage-strong hover:text-[#4e7260] transition-colors"
                  >
                    Volver a Insights
                  </button>
                  <button
                    onClick={() => {
                      trackEvent('insights_bridge_dismissed', {
                        entry_id: null,
                        source: 'insights',
                        ui: 'JournalPageBridge',
                      });
                      setDismissedBridgeBanner(true);
                    }}
                    className="text-sage-strong/60 hover:text-sage-strong transition-colors"
                    aria-label="Cerrar"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            )}
            {deepLinkError && (
              <div className="w-full max-w-md mx-4 mb-6 flex items-start justify-between gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-14 text-sm text-amber-800">
                <span>{deepLinkError}</span>
                <button
                  onClick={() => setDeepLinkError(null)}
                  className="flex-shrink-0 text-amber-600 hover:text-amber-900 font-bold text-base leading-none"
                >
                  ×
                </button>
              </div>
            )}
            <div className="text-center py-12">
              <BookOpen size={44} className="mx-auto mb-4 text-sage-soft" />
              <p className="text-app-text font-medium">Tu diario personal</p>
              <p className="text-sm text-app-muted mt-1.5">Selecciona una entrada o crea una nueva</p>
            </div>
          </div>
        )}
      </div>

      {showExportAll && (
        <ExportModal
          title="Descargar todo el diario"
          warning={`Se descargarán tus ${savedEntries.length} entradas en un solo archivo sin cifrar. Guárdalo en un lugar seguro y evita compartirlo.`}
          onClose={() => setShowExportAll(false)}
          getExport={getAllDiariesExport}
        />
      )}

      {showExport && (
        <ExportModal
          title="Exportar entrada"
          onClose={() => setShowExport(false)}
          getExport={getDiaryExport}
        />
      )}

      {showUpgrade && (
        <UpgradeModal onClose={() => setShowUpgrade(false)} />
      )}

      {isReflectionViewerOpen && reflectionCandidate && reflectionContent && (
        <ReflectionViewerModal
          title={getReflectionTitle(reflectionCandidate.created_at)}
          content={reflectionContent}
          onClose={handleCloseViewer}
          onUseReflection={handleUseReflectionFromModal}
        />
      )}

      {entryToDelete && (
        <ConfirmDeleteDialog
          title="Eliminar entrada"
          message="Se eliminará permanentemente esta entrada del diario. Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          loading={deletingEntry}
          onCancel={() => { if (!deletingEntry) setEntryToDelete(null); }}
          onConfirm={confirmDeleteEntry}
        />
      )}
    </div>
  );
}