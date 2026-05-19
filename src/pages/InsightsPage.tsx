import { useState, useEffect, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { useProfile } from '../hooks/useProfile';
import { generateMoodInsight, TokenLimitError } from '../lib/api';
import { trackEvent } from '../lib/analytics';
import { encryptForUser, decryptForUser } from '../lib/encryption';
import { getJournalProgress, fetchSavedEntries30d } from '../lib/journalProgress';
import type { JournalEntryLite } from '../lib/journalProgress';
import { sanitizeInsightText } from '../lib/insightUtils';
import { extractChatSignalsWeighted, summarizeChatSignals } from '../lib/chatSignals';
import type { ChatMessageWithTime } from '../lib/chatSignals';
import { buildInsightSignal } from '../lib/insightSignals';
import { buildWeeklyInsightSummary } from '../lib/insightWeekly';
import { hasNewInsightsSinceLastView } from '../lib/insightVisibility';
import { buildJournalWeeklyInsightSummary } from '../lib/insightWeeklyJournal';
import { combineWeeklyInsightSummaries } from '../lib/insightWeeklyCombined';
import { buildWeekSlices, detectMultiWeekTrends, buildMultiSourceAggRows } from '../lib/insightTrends';
import type { MultiWeekTrend } from '../lib/insightTrends';
import { createJournalEntryFromInsight } from '../lib/journalEntries';
import type { JournalProgress } from '../lib/journalProgress';
import { useLocation } from 'wouter';
import { TrendingUp, Calendar, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { CrisisAlert } from '../components/CrisisAlert';
import { MoodDistributionCard } from '../components/insights/MoodDistributionCard';
import { DayOfWeekPatternCard } from '../components/insights/DayOfWeekPatternCard';
import { StreakCard } from '../components/insights/StreakCard';
import { JournalProgressSection } from '../components/insights/JournalProgressSection';
import { WeeklyInsightPanel } from '../components/insights/WeeklyInsightPanel';
import { InsightMemoryCard } from '../components/insights/InsightMemoryCard';
import WeeklyInsightCard from '../components/insights/WeeklyInsightCard';
import { writeChatSignalAgg, alreadyWroteToday, markWroteToday, CHAT_AGG_WRITE_KEY } from '../lib/chatSignalWriter';
import { detectInsightPatterns, type InsightPattern } from '../lib/insightPatterns';
import InsightPatternCard from '../components/insights/InsightPatternCard';
import { getInsightSourceLabel } from '../lib/insightSource';
import { markActivationSeenInInsights } from '../hooks/useInsightActivation';
import { recordFlightEvent } from '../lib/elenaFlightRecorder';

type InsightProgressLevel = 'low' | 'some' | 'strong';

function getInsightProgressMessage(
  hasAnyData: boolean,
  hasEnoughEvidence: boolean,
  hasEvidenceGrace: boolean
): { text: string; level: InsightProgressLevel } | null {
  if (hasEnoughEvidence) {
    return {
      text: 'Tus reflexiones están ayudando a Elena a construir una imagen más clara con el tiempo.',
      level: 'strong',
    };
  }
  if (hasAnyData || hasEvidenceGrace) {
    return {
      text: 'Elena está empezando a detectar patrones en lo que escribes.',
      level: 'some',
    };
  }
  return {
    text: 'Los patrones emergen con unas pocas reflexiones más.',
    level: 'low',
  };
}

function countActiveSignalDays(rows: Array<{ signal_date: string; score: number }>): number {
  const days = new Set<string>();
  for (const row of rows) {
    if ((Number(row.score) || 0) > 0 && row.signal_date) {
      days.add(row.signal_date);
    }
  }
  return days.size;
}

const MOOD_EMOJIS = ['😔', '😟', '😐', '🙂', '😊'];
const MOOD_LABELS = ['Muy mal', 'Mal', 'Neutral', 'Bien', 'Muy bien'];

interface MoodLog {
  id: string;
  local_date: string;
  emoji: string;
  note?: string;
}

interface WeeklyInsight {
  week_start_date: string;
  insight_text: string;
  created_at: string;
}

type ChatSignalAggRow = {
  signal_date: string;
  signal_type: 'positive' | 'stress' | 'anxiety' | 'gratitude';
  score: number;
  message_count: number;
};

export function InsightsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const weeklyPanelRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);
  const hasMarkedViewedRef = useRef(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const frPageOpenedRef = useRef(false);
  const frPrevThresholdRef = useRef(false);
  const frPrevProgressLevelRef = useRef<string | null>(null);
  const frPrevFirstInsightRef = useRef(false);

  const dismissKey = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `insights:weeklyDismiss:${yyyy}-${mm}-${dd}`;
  }, []);

  const [weeklyDismissed, setWeeklyDismissed] = useState(false);

  useEffect(() => {
    try {
      setWeeklyDismissed(window.localStorage.getItem(dismissKey) === '1');
    } catch {
      setWeeklyDismissed(false);
    }
  }, [dismissKey]);

  function dismissWeeklyForToday() {
    try {
      window.localStorage.setItem(dismissKey, '1');
    } catch {}
    setWeeklyDismissed(true);
  }

  const [moodLogs, setMoodLogs] = useState<MoodLog[]>([]);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [moodNote, setMoodNote] = useState('');
  const [weeklyInsights, setWeeklyInsights] = useState<WeeklyInsight[]>([]);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [weeklyGenError, setWeeklyGenError] = useState<string | null>(null);
  const [justGenerated, setJustGenerated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tokenLimitError, setTokenLimitError] = useState<string | null>(null);
  const [insightCrisis, setInsightCrisis] = useState<'NO' | 'MAYBE' | 'YES'>('NO');
  const [journalProgress, setJournalProgress] = useState<JournalProgress | null>(null);
  const [isLoadingJournal, setIsLoadingJournal] = useState(false);
  const [historyFlash, setHistoryFlash] = useState(false);
  const [recentChatMessages, setRecentChatMessages] = useState<{ sender: string; content: string; created_at?: string }[]>([]);
  const [chatAggRows, setChatAggRows] = useState<ChatSignalAggRow[]>([]);
  const [isChatAggLoaded, setIsChatAggLoaded] = useState(false);
  const [isInsightsLoaded, setIsInsightsLoaded] = useState(false);
  const [savedEntries30d, setSavedEntries30d] = useState<JournalEntryLite[]>([]);
  const autoGenAttemptedRef = useRef(false);
  const AUTO_GEN_WEEK_KEY = 'insights:autoGenWeek';

  useEffect(() => {
    if (user && profile) {
      loadMoodLogs();
      loadWeeklyInsights();
      loadJournalProgress();
      loadRecentChatMessages();
      loadChatAggRows();
    }
  }, [user, profile?.id]);

  const loadMoodLogs = async () => {
    if (!user || !profile) return;

    const { data, error } = await supabase
      .from('mood_logs')
      .select('*')
      .order('local_date', { ascending: false })
      .limit(30);

    if (!error && data) {
      const decryptedLogs = await Promise.all(
        data.map(async (log) => ({
          id: log.id,
          local_date: log.local_date,
          emoji: log.emoji,
          note: log.note_enc ? await decryptForUser(log.note_enc, profile) : undefined,
        }))
      );
      setMoodLogs(decryptedLogs);
    }
  };

  const loadWeeklyInsights = async () => {
    const { data, error } = await supabase
      .from('mood_weekly_insights')
      .select('*')
      .order('week_start_date', { ascending: false })
      .limit(4);

    if (!error && data) {
      setWeeklyInsights(data);
    }
    setIsInsightsLoaded(true);
  };

  const loadJournalProgress = async () => {
    if (!user) return;
    setIsLoadingJournal(true);
    try {
      const [progress, entries] = await Promise.all([
        getJournalProgress(supabase, user.id),
        fetchSavedEntries30d(supabase, user.id),
      ]);
      setJournalProgress(progress);
      setSavedEntries30d(entries);
    } catch {
      setJournalProgress(null);
      setSavedEntries30d([]);
    } finally {
      setIsLoadingJournal(false);
    }
  };

  const loadRecentChatMessages = async () => {
    if (!user || !profile) return;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data, error } = await supabase
      .from('chat_messages')
      .select('sender, content_enc, enc_version, created_at')
      .eq('sender', 'user')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);
    if (error || !data) return;
    try {
      const decrypted = await Promise.all(
        data.map(async (msg) => ({
          sender: msg.sender as string,
          content: await decryptForUser(msg.content_enc, profile),
          created_at: msg.created_at as string,
        }))
      );
      setRecentChatMessages(decrypted);
    } catch {
    }
  };

  const loadChatAggRows = async () => {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const yyyy = since.getFullYear();
    const mm = String(since.getMonth() + 1).padStart(2, '0');
    const dd = String(since.getDate()).padStart(2, '0');
    const sinceStr = `${yyyy}-${mm}-${dd}`;

    const { data, error } = await supabase
      .from('chat_signal_daily_agg')
      .select('signal_date, signal_type, score, message_count')
      .gte('signal_date', sinceStr)
      .order('signal_date', { ascending: false });

    if (!error) {
      setChatAggRows((data ?? []) as ChatSignalAggRow[]);
    }
    setIsChatAggLoaded(true);
  };

  const handleSaveMood = async () => {
    if (!user || !selectedMood || !profile) return;

    setIsSaving(true);
    try {
      const localDate = selectedDate.toISOString().split('T')[0];

      const encryptedNote = moodNote.trim()
        ? await encryptForUser(moodNote, profile)
        : null;

      const existingLog = moodLogs.find(log => log.local_date === localDate);

      if (existingLog) {
        await supabase
          .from('mood_logs')
          .update({ emoji: selectedMood, note_enc: encryptedNote, enc_version: 2 })
          .eq('id', existingLog.id);
      } else {
        await supabase
          .from('mood_logs')
          .insert({
            user_id: user.id,
            local_date: localDate,
            emoji: selectedMood,
            note_enc: encryptedNote,
            enc_version: 2,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          });
      }

      await loadMoodLogs();
      setSelectedMood(null);
      setMoodNote('');
      alert('Estado de ánimo guardado');
    } catch (error) {
      console.error('Error saving mood:', error);
      alert('Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateInsight = async (silent = false) => {
    if (!user) return;

    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const toLocalDateStr = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const weekStartDate = toLocalDateStr(weekStart);
    const weekEndDate = toLocalDateStr(weekEnd);
    const baseProps = {
      week_start_local: weekStartDate,
      week_end_local: weekEndDate,
      week_log_count: weekLogCount,
      source: silent ? 'auto' : 'insights',
      ui: 'InsightsPage',
    };

    trackEvent(silent ? 'insights_generate_weekly_auto' : 'insights_generate_weekly_clicked', baseProps);

    setWeeklyGenError(null);
    setJustGenerated(false);
    setIsGeneratingInsight(true);
    setTokenLimitError(null);
    if (!silent) weeklyPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
      const data = await generateMoodInsight(weekStartDate);

      if (data.insight) {
        await loadWeeklyInsights();
      }

      if (data.crisis && data.crisis !== 'NO') {
        setInsightCrisis(data.crisis as 'MAYBE' | 'YES');
      }

      trackEvent('insights_generate_weekly_success', baseProps);
      qc.invalidateQueries({ queryKey: ['token-budget', user?.id] });
      setJustGenerated(true);
      if (!silent) weeklyPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => setJustGenerated(false), 1100);
    } catch (error) {
      if (error instanceof TokenLimitError) {
        trackEvent('insights_generate_weekly_failed', { ...baseProps, error_code: 'TOKEN_LIMIT' });
        setTokenLimitError(error.serverMessage);
      } else {
        const errMsg = error instanceof Error ? error.message : String(error);
        trackEvent('insights_generate_weekly_failed', { ...baseProps, error_code: 'UNKNOWN', error_msg: errMsg });
        console.error('Error generating insight:', errMsg, error);
        const isOpenAIErr = errMsg.startsWith('OPENAI_ERROR');
        setWeeklyGenError(
          isOpenAIErr
            ? 'El servicio de IA no está disponible en este momento. Inténtalo de nuevo más tarde.'
            : 'No se pudo generar el insight. Inténtalo de nuevo.'
        );
      }
    } finally {
      setIsGeneratingInsight(false);
    }
  };

  const goToPreviousWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 7);
    setSelectedDate(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 7);
    setSelectedDate(newDate);
  };

  const getWeekDates = () => {
    const dates = [];
    const weekStart = new Date(selectedDate);
    weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const getMoodForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return moodLogs.find(log => log.local_date === dateStr);
  };

  const handleScrollToHistory = () => {
    historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setHistoryFlash(true);
    setTimeout(() => setHistoryFlash(false), 1200);
  };

  const weekDates = getWeekDates();
  const today = new Date();
  const _ws = new Date(today);
  _ws.setDate(today.getDate() - today.getDay());
  const currentWeekStart = `${_ws.getFullYear()}-${String(_ws.getMonth() + 1).padStart(2, '0')}-${String(_ws.getDate()).padStart(2, '0')}`;

  const latestInsight = weeklyInsights.length > 0
    ? [...weeklyInsights].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    : null;

  const arrivedWithNewInsight =
    !!latestInsight &&
    hasNewInsightsSinceLastView(latestInsight.created_at);

  const weekLogCount = weekDates.filter(date => {
    const dateStr = date.toISOString().split('T')[0];
    return moodLogs.some(log => log.local_date === dateStr);
  }).length;

  const weekLabel = `${weekDates[0].toLocaleDateString('es', { month: 'long', day: 'numeric' })} – ${weekDates[6].toLocaleDateString('es', { month: 'long', day: 'numeric', year: 'numeric' })}`;

  const adaptedChatMessages = useMemo((): ChatMessageWithTime[] => {
    return recentChatMessages.map((m) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.content ?? '',
      created_at: m.created_at,
    }));
  }, [recentChatMessages]);

  const chatSignals = useMemo(() => extractChatSignalsWeighted(adaptedChatMessages), [adaptedChatMessages]);

  const chatSignalsFromAgg = useMemo(() => {
    const out = { positive: 0, stress: 0, anxiety: 0, gratitude: 0 };
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 6);
    cutoff.setHours(0, 0, 0, 0);

    for (const r of chatAggRows) {
      const d = new Date(r.signal_date + 'T00:00:00');
      if (d < cutoff) continue;
      out[r.signal_type] += Number(r.score) || 0;
    }

    return out;
  }, [chatAggRows]);

  const weeklyInsightSummary = useMemo(() => {
    if (!chatAggRows.length) return null;
    return buildWeeklyInsightSummary(chatAggRows);
  }, [chatAggRows]);

  const journalWeeklyInsightSummary = useMemo(() => {
    if (!savedEntries30d.length) return null;
    return buildJournalWeeklyInsightSummary(savedEntries30d);
  }, [savedEntries30d]);

  const combinedWeeklyInsightSummary = useMemo(() => {
    return combineWeeklyInsightSummaries(weeklyInsightSummary, journalWeeklyInsightSummary);
  }, [weeklyInsightSummary, journalWeeklyInsightSummary]);

  const effectiveWeeklyInsightSummary = useMemo(() => {
    return combinedWeeklyInsightSummary ?? weeklyInsightSummary;
  }, [combinedWeeklyInsightSummary, weeklyInsightSummary]);

  const multiWeekTrend = useMemo((): MultiWeekTrend | null => {
    const merged = buildMultiSourceAggRows(chatAggRows, savedEntries30d, moodLogs);
    if (!merged.length) return null;
    const slices = buildWeekSlices(merged, 4);
    return detectMultiWeekTrends(slices);
  }, [chatAggRows, savedEntries30d, moodLogs]);

  const effectivePatternSummary = useMemo(() => {
    return combinedWeeklyInsightSummary ?? weeklyInsightSummary;
  }, [combinedWeeklyInsightSummary, weeklyInsightSummary]);

  const weeklyChatEvidence = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 6);

    const rows = chatAggRows.filter((r) => {
      const d = new Date(r.signal_date + 'T00:00:00');
      return d >= cutoff && (Number(r.score) || 0) > 0;
    });

    const totalScore = rows.reduce((sum, r) => sum + (Number(r.score) || 0), 0);
    const activeDays = countActiveSignalDays(rows);

    return { totalScore, activeDays };
  }, [chatAggRows]);

  const weeklyJournalEvidence = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 6);

    const entries = savedEntries30d.filter((e) => {
      const d = new Date(e.saved_at);
      return d >= cutoff;
    });

    const activeDays = new Set(
      entries.map((e) => {
        const d = new Date(e.saved_at);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      })
    ).size;

    return {
      totalEntries: entries.length,
      activeDays,
    };
  }, [savedEntries30d]);

  /*
   * Insight Evidence, Progress Messaging, and Activation Cycle
   *
   * The "insight gap" concept:
   * Users may arrive at the Insights page before they have generated enough
   * signal for meaningful patterns to appear. Rather than showing an empty
   * state or error, the page shows calm progress messaging that explains
   * what is building and why — without fabricating insights that don't exist.
   *
   * Why early progress messaging matters:
   * Showing nothing would make the page feel broken. Showing placeholder
   * insights would be dishonest. The messaging acknowledges the user's
   * effort ("Elena is starting to notice themes") while being accurate about
   * the current evidence level. This preserves trust and reduces churn from
   * users who arrive early and find the page underwhelming.
   *
   * hasEnoughInsightEvidence — the evidence gate:
   * Controls whether full insight content is shown or only progress messaging.
   * Also gates the `insights_last_viewed_at` mark (so a low-evidence visit
   * doesn't incorrectly clear the "new insight" dot on other pages).
   *
   * 24-hour evidence grace window (hasEvidenceWithGrace):
   * If a user briefly drops below the evidence threshold (e.g., after midnight
   * when the 6-day window shifts), the grace window prevents the page from
   * flickering back to the placeholder state for up to 24 hours. This avoids
   * confusing transitions for active users.
   *
   * How visiting Insights ends the activation cycle:
   * When the user arrives on this page with enough evidence, `markActivationSeenInInsights`
   * sets `LS_SEEN_KEY` in localStorage. The `useInsightActivation` hook on
   * Journal and Chat pages reads this key on next mount and hides the chip.
   * This ensures the nudge chip stops appearing once the user has reached its
   * destination, completing the activation cycle.
   *
   * The `hasMarkedViewedRef` guard on the "last viewed" effect:
   * Prevents `insights_last_viewed_at` from being written multiple times if
   * data loads cause `canMarkInsightsViewed` to flip mid-session.
   */
  const hasEnoughInsightEvidence = useMemo(() => {
    const chatOk =
      weeklyChatEvidence.totalScore >= 3 &&
      weeklyChatEvidence.activeDays >= 2;

    const journalOk =
      weeklyJournalEvidence.totalEntries >= 2 &&
      weeklyJournalEvidence.activeDays >= 2;

    return chatOk || journalOk;
  }, [weeklyChatEvidence, weeklyJournalEvidence]);

  const insightEvidenceGraceKey = "insights:lastEvidenceOk";

  const hasEvidenceWithGrace = useMemo(() => {
    try {
      const now = Date.now();
      const graceMs = 24 * 60 * 60 * 1000;

      if (hasEnoughInsightEvidence) {
        window.localStorage.setItem(
          insightEvidenceGraceKey,
          JSON.stringify({ ts: now })
        );
        return true;
      }

      const raw = window.localStorage.getItem(insightEvidenceGraceKey);
      const prev = raw ? JSON.parse(raw) as { ts?: number } : null;

      if (prev?.ts && now - prev.ts < graceMs) {
        return true;
      }

      return false;
    } catch {
      return hasEnoughInsightEvidence;
    }
  }, [hasEnoughInsightEvidence]);

  const showLowEvidencePlaceholder = useMemo(() => {
    return !hasEnoughInsightEvidence && !hasEvidenceWithGrace;
  }, [hasEnoughInsightEvidence, hasEvidenceWithGrace]);

  const canMarkInsightsViewed = !!latestInsight && hasEvidenceWithGrace;

  useEffect(() => {
    if (!canMarkInsightsViewed || hasMarkedViewedRef.current) return;
    hasMarkedViewedRef.current = true;
    try {
      localStorage.setItem("insights_last_viewed_at", new Date().toISOString());
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("insights-view-state-changed"));
      }
    } catch {}
  }, [canMarkInsightsViewed, latestInsight?.created_at]);

  useEffect(() => {
    if (hasEnoughInsightEvidence) {
      markActivationSeenInInsights();
    }
  }, [hasEnoughInsightEvidence]);

  const insightsPageSource = useRef<string>('unknown');
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('insightsPageSource');
      if (stored) {
        insightsPageSource.current = stored;
        sessionStorage.removeItem('insightsPageSource');
      } else {
        insightsPageSource.current = 'manual_nav';
      }
    } catch {
      insightsPageSource.current = 'unknown';
    }
  }, []);

  useEffect(() => {
    if (!user || frPageOpenedRef.current) return;
    frPageOpenedRef.current = true;
    recordFlightEvent(user.id, 'INSIGHTS_PAGE_OPENED', { source: insightsPageSource.current, arrivedWithNewInsight });
  }, [user, arrivedWithNewInsight]);

  useEffect(() => {
    if (hasEnoughInsightEvidence && !frPrevThresholdRef.current) {
      recordFlightEvent(user?.id, 'INSIGHT_THRESHOLD_CROSSED');
    }
    frPrevThresholdRef.current = hasEnoughInsightEvidence;
  }, [hasEnoughInsightEvidence, user?.id]);

  useEffect(() => {
    const level = (() => {
      if (hasEnoughInsightEvidence) return 'strong';
      if (hasEvidenceWithGrace) return 'some';
      return 'low';
    })();
    if (level !== frPrevProgressLevelRef.current) {
      frPrevProgressLevelRef.current = level;
      if (level !== null) {
        recordFlightEvent(user?.id, 'INSIGHTS_PROGRESS_MESSAGE_VISIBLE', { level });
      }
    }
  }, [hasEnoughInsightEvidence, hasEvidenceWithGrace, user?.id]);

  useEffect(() => {
    const hasFirstInsight = !!latestInsight && hasEvidenceWithGrace;
    if (hasFirstInsight && !frPrevFirstInsightRef.current) {
      recordFlightEvent(user?.id, 'FIRST_REAL_INSIGHT_VISIBLE', {
        latestInsightAt: latestInsight?.created_at ?? null,
        arrivedWithNewInsight,
      });
    }
    frPrevFirstInsightRef.current = hasFirstInsight;
  }, [latestInsight, hasEvidenceWithGrace, arrivedWithNewInsight, user?.id]);

  useEffect(() => {
    if (!user || !frPageOpenedRef.current) return;
    recordFlightEvent(user.id, 'INSIGHT_STATE_SNAPSHOT', {
      hasEnoughInsightEvidence,
      hasEvidenceWithGrace,
      showLowEvidencePlaceholder,
      arrivedWithNewInsight,
      latestInsightAt: latestInsight?.created_at ?? null,
    });
  }, [user, hasEnoughInsightEvidence, hasEvidenceWithGrace, showLowEvidencePlaceholder, arrivedWithNewInsight, latestInsight?.created_at]);

  useEffect(() => {
    if (!isInsightsLoaded || !isChatAggLoaded) return;
    if (!user || !currentWeekStart) return;
    if (isGeneratingInsight || !!tokenLimitError) return;
    if (!hasEvidenceWithGrace) return;
    if (autoGenAttemptedRef.current) return;

    const isStaleWeek = !!latestInsight && latestInsight.week_start_date !== currentWeekStart;
    if (!isStaleWeek) return;

    try {
      if (localStorage.getItem(AUTO_GEN_WEEK_KEY) === currentWeekStart) return;
    } catch {}

    autoGenAttemptedRef.current = true;
    try {
      localStorage.setItem(AUTO_GEN_WEEK_KEY, currentWeekStart);
    } catch {}

    handleGenerateInsight(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInsightsLoaded, isChatAggLoaded, latestInsight, currentWeekStart, hasEvidenceWithGrace, isGeneratingInsight, tokenLimitError, user]);

  const insightPatterns = useMemo(() => {
    if (!effectivePatternSummary) return [];
    return detectInsightPatterns(effectivePatternSummary);
  }, [effectivePatternSummary]);

  const PATTERN_DRAFT_CONTENT: Record<string, { title: string; content: string }> = {
    stress_rising: {
      title: 'Estrés en aumento',
      content: 'Esta semana noté más estrés.\n\n¿Qué lo detonó?\n- \n\n¿Qué puedo soltar o reducir?\n- \n\nUna acción pequeña para hoy:\n- ',
    },
    anxiety_rising: {
      title: 'Ansiedad en aumento',
      content: 'Esta semana sentí más ansiedad o preocupación.\n\n¿Qué pensamientos se repiten?\n- \n\n¿Qué sí controlo ahora?\n- \n\nUn paso pequeño para hoy:\n- ',
    },
    recovery: {
      title: 'Señales de recuperación',
      content: 'Esta semana hubo señales de alivio o recuperación.\n\n¿Qué ayudó?\n- \n\n¿Qué quiero seguir haciendo?\n- \n\nUna intención para mañana:\n- ',
    },
    gratitude_streak: {
      title: 'Racha de gratitud',
      content: 'Esta semana hubo varios momentos de gratitud.\n\n3 cosas que agradezco:\n1)\n2)\n3)\n\n¿Cómo puedo repetir esto?\n- ',
    },
    positive_momentum: {
      title: 'Ánimo en mejora',
      content: 'Esta semana se notó un mejor ánimo.\n\n¿Qué me ayudó?\n- \n\n¿Cómo lo repito?\n- \n\nUna intención para mañana:\n- ',
    },
  };

  const PATTERN_CHAT_PREFILL: Record<string, string> = {
    stress_rising: '¿Qué me está cargando más esta semana y qué puedo reducir hoy?',
    anxiety_rising: 'Quiero escribir qué me preocupa y qué sí puedo controlar ahora.',
    positive_momentum: 'Quiero identificar qué me ayudó esta semana para repetirlo.',
  };

  const [patternRevision, setPatternRevision] = useState(0);
  const [patternJustChanged, setPatternJustChanged] = useState(false);

  const visiblePatternSeenKey = "insights:lastVisiblePattern";
  const weeklyInsightSeenKey = "insights:lastWeeklyInsight";

  const [weeklyInsightJustChanged, setWeeklyInsightJustChanged] = useState(false);

  useEffect(() => {
    try {
      const current = effectiveWeeklyInsightSummary?.dominantThisWeek;
      if (!current) {
        setWeeklyInsightJustChanged(false);
        return;
      }

      const raw = window.localStorage.getItem(weeklyInsightSeenKey);
      const prev = raw ? JSON.parse(raw) as { signal?: string } : null;

      const changed = !!prev?.signal && prev.signal !== current;
      setWeeklyInsightJustChanged(changed);

      window.localStorage.setItem(
        weeklyInsightSeenKey,
        JSON.stringify({ signal: current })
      );
    } catch {
      setWeeklyInsightJustChanged(false);
    }
  }, [effectiveWeeklyInsightSummary]);

  function patternReasonText(
    pattern: InsightPattern | null,
    sourceLabel?: 'Chats' | 'Diario' | 'Mixto'
  ): string | null {
    if (!pattern) return null;
    const prefix = sourceLabel ? `${sourceLabel}: ` : '';
    switch (pattern.type) {
      case 'stress_rising':
        return `${prefix}Detectado por cambio semanal: +${pattern.strength}`;
      case 'anxiety_rising':
        return `${prefix}Detectado por cambio semanal: +${pattern.strength}`;
      case 'recovery':
        return `${prefix}Detectado por señales combinadas de alivio`;
      case 'gratitude_streak':
        return `${prefix}Detectado por racha: ${pattern.strength} señales`;
      case 'positive_momentum':
        return `${prefix}Detectado por mejora sostenida: +${pattern.strength}`;
      default:
        return null;
    }
  }

  function passesPatternThreshold(pattern: InsightPattern): boolean {
    switch (pattern.type) {
      case 'stress_rising':
      case 'anxiety_rising':
        return pattern.strength >= 3;
      case 'recovery':
        return pattern.strength >= 2;
      case 'gratitude_streak':
        return pattern.strength >= 4;
      case 'positive_momentum':
        return pattern.strength >= 2;
      default:
        return false;
    }
  }

  const visiblePattern = useMemo(() => {
    if (!insightPatterns.length) return null;
    const d = new Date();
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    for (const p of insightPatterns) {
      if (!passesPatternThreshold(p)) continue;
      try {
        const raw = window.localStorage.getItem(`insights:pattern:${p.type}`);
        if (raw !== dateKey) return p;
      } catch {
        return p;
      }
    }
    return null;
  }, [insightPatterns, patternRevision]);

  const patternDuplicatesWeekly = useMemo(() => {
    const weeklySignal = effectiveWeeklyInsightSummary?.dominantThisWeek;
    const patternSignal = visiblePattern?.type;
    if (!weeklySignal || !patternSignal) return false;
    return (weeklySignal as string) === (patternSignal as string);
  }, [effectiveWeeklyInsightSummary, visiblePattern]);

  const recentPatternLabels = useMemo(() => {
    const labels: string[] = [];
    for (const p of insightPatterns) {
      if (!passesPatternThreshold(p)) continue;
      labels.push(p.label);
      if (labels.length >= 3) break;
    }
    return labels;
  }, [insightPatterns]);

  useEffect(() => {
    try {
      if (!visiblePattern?.type) {
        setPatternJustChanged(false);
        return;
      }

      const raw = window.localStorage.getItem(visiblePatternSeenKey);
      const prev = raw ? JSON.parse(raw) as { type?: string; seen?: boolean } : null;

      if (!prev?.type) {
        window.localStorage.setItem(
          visiblePatternSeenKey,
          JSON.stringify({ type: visiblePattern.type, seen: true })
        );
        setPatternJustChanged(false);
      } else if (prev.type !== visiblePattern.type) {
        window.localStorage.setItem(
          visiblePatternSeenKey,
          JSON.stringify({ type: visiblePattern.type, seen: false })
        );
        setPatternJustChanged(true);
      } else {
        setPatternJustChanged(prev.seen === false);
      }
    } catch {
      setPatternJustChanged(false);
    }
  }, [visiblePattern]);

  useEffect(() => {
    if (!patternJustChanged || !visiblePattern?.type) return;
    try {
      window.localStorage.setItem(
        visiblePatternSeenKey,
        JSON.stringify({ type: visiblePattern.type, seen: true })
      );
    } catch {}
  }, [patternJustChanged, visiblePattern?.type]);

  function dismissPatternForToday() {
    if (!visiblePattern) return;
    const d = new Date();
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    try {
      window.localStorage.setItem(`insights:pattern:${visiblePattern.type}`, dateKey);
    } catch {}
    setPatternRevision(r => r + 1);
  }


  const chatAggHealth = useMemo(() => {
    if (!chatAggRows.length) {
      return { status: 'empty' as const, last: null as string | null, ageDays: null as number | null };
    }
    const last = chatAggRows.map(r => r.signal_date).sort().at(-1) ?? null;
    if (!last) return { status: 'empty' as const, last: null, ageDays: null };
    const lastDate = new Date(last + 'T00:00:00');
    const now = new Date();
    const ageDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    const status = ageDays >= 3 ? 'stale' : 'fresh';
    return { status, last, ageDays };
  }, [chatAggRows]);

  const hasAggData = useMemo(() => {
    return (
      chatSignalsFromAgg.positive +
        chatSignalsFromAgg.stress +
        chatSignalsFromAgg.anxiety +
        chatSignalsFromAgg.gratitude >
      0
    );
  }, [chatSignalsFromAgg]);

  const hasJournalData = (journalProgress?.saved30d ?? 0) > 0;

  const isVeryEarlyState = useMemo(() => {
    return isChatAggLoaded && !isLoadingJournal && !hasAggData && !hasJournalData;
  }, [isChatAggLoaded, isLoadingJournal, hasAggData, hasJournalData]);

  const insightSourceLabel = useMemo(() => {
    return getInsightSourceLabel({
      hasChatData: hasAggData || recentChatMessages.length > 0,
      hasJournalData,
    });
  }, [hasAggData, recentChatMessages.length, hasJournalData]);

  const weeklyInsightSourceLabel = useMemo((): string | undefined => {
    if (!effectiveWeeklyInsightSummary?.dominantThisWeek) return undefined;
    const hasChat = !!weeklyInsightSummary?.dominantThisWeek;
    const hasJournal = !!journalWeeklyInsightSummary?.dominantThisWeek;
    if (hasChat && hasJournal) return 'Mixto';
    if (hasJournal) return 'Diario';
    return 'Chats';
  }, [effectiveWeeklyInsightSummary, weeklyInsightSummary, journalWeeklyInsightSummary]);

  const patternInsightSourceLabel = useMemo((): string | undefined => {
    if (!visiblePattern) return undefined;
    const hasChat = !!weeklyInsightSummary?.dominantThisWeek;
    const hasJournal = !!journalWeeklyInsightSummary?.dominantThisWeek;
    if (hasChat && hasJournal) return 'Mixto';
    if (hasJournal) return 'Diario';
    return 'Chats';
  }, [visiblePattern, weeklyInsightSummary, journalWeeklyInsightSummary]);

  const visiblePatternReason = useMemo(() => {
    return patternReasonText(
      visiblePattern,
      patternInsightSourceLabel as 'Chats' | 'Diario' | 'Mixto' | undefined
    );
  }, [visiblePattern, patternInsightSourceLabel]);

  const topPatternActionLabel = useMemo((): string | undefined => {
    if (!visiblePattern) return undefined;
    const src = patternInsightSourceLabel;
    switch (visiblePattern.type) {
      case 'stress_rising':
        return src === 'Diario' ? 'Crear borrador' : 'Ordenar en chat';
      case 'anxiety_rising':
        return src === 'Diario' ? 'Crear borrador' : 'Escribir en chat';
      case 'recovery':
      case 'gratitude_streak':
        return 'Crear borrador';
      case 'positive_momentum':
        return src === 'Chats' ? 'Abrir en chat' : 'Crear borrador';
      default:
        return 'Crear borrador';
    }
  }, [visiblePattern, patternInsightSourceLabel]);

  const topPatternAction = useMemo(() => {
    if (!visiblePattern) return undefined;
    const src = patternInsightSourceLabel;

    const useDraft = (() => {
      switch (visiblePattern.type) {
        case 'stress_rising':
        case 'anxiety_rising':
          return src === 'Diario';
        case 'recovery':
        case 'gratitude_streak':
          return true;
        case 'positive_momentum':
          return src !== 'Chats';
        default:
          return true;
      }
    })();

    return async () => {
      if (useDraft) {
        const draftSpec = PATTERN_DRAFT_CONTENT[visiblePattern.type];
        if (!draftSpec || !user || !profile) return;
        try {
          const entryId = await createJournalEntryFromInsight({
            userId: user.id,
            profile,
            title: draftSpec.title,
            content: draftSpec.content,
          });
          sessionStorage.setItem('diaryAutoOpen', entryId);
          navigate('/app/journal');
        } catch (err) {
          console.error('[InsightPatternCard] Draft creation error', err);
        }
      } else {
        const prefill = PATTERN_CHAT_PREFILL[visiblePattern.type];
        if (prefill) navigate(`/app/chat?prefill=${encodeURIComponent(prefill)}`);
      }
    };
  }, [visiblePattern, patternInsightSourceLabel, user, profile, navigate]);

  const effectiveChatSignals = useMemo(() => {
    return hasAggData ? chatSignalsFromAgg : chatSignals;
  }, [hasAggData, chatSignalsFromAgg, chatSignals]);

  const dominantChatSignal = useMemo(() => summarizeChatSignals(effectiveChatSignals), [effectiveChatSignals]);

  const chatInsightSignal = useMemo(() => buildInsightSignal(dominantChatSignal), [dominantChatSignal]);

  // Stage 3Q: cooldown prevents the same chat signal from repeatedly dominating Insights
  const cooledChatInsightSignal = useMemo(() => {
    try {
      if (!chatInsightSignal?.type) return chatInsightSignal;

      const key = "insights:lastChatSignal";
      const raw = window.localStorage.getItem(key);
      const now = Date.now();

      const cooldownMs = 6 * 60 * 60 * 1000;

      if (raw) {
        const prev = JSON.parse(raw) as { type: string; ts: number };
        if (prev?.type === chatInsightSignal.type && typeof prev.ts === "number") {
          if (now - prev.ts < cooldownMs) {
            return null;
          }
        }
      }

      window.localStorage.setItem(
        key,
        JSON.stringify({ type: chatInsightSignal.type, ts: now })
      );

      return chatInsightSignal;
    } catch {
      return chatInsightSignal;
    }
  }, [chatInsightSignal]);

  const signalDate = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const shouldWriteAgg = useMemo(() => {
    const totalScore =
      chatSignals.positive + chatSignals.stress + chatSignals.anxiety + chatSignals.gratitude;
    return recentChatMessages.length >= 3 && totalScore >= 2;
  }, [recentChatMessages.length, chatSignals]);

  useEffect(() => {
    if (!shouldWriteAgg) return;
    if (alreadyWroteToday(CHAT_AGG_WRITE_KEY, signalDate)) return;

    let cancelled = false;

    async function run() {
      try {
        await writeChatSignalAgg({
          chatSignals,
          messageCount: recentChatMessages.length,
          signalDate,
          supabase,
        });

        if (!cancelled) {
          markWroteToday(CHAT_AGG_WRITE_KEY, signalDate);
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[Insights] upsert_chat_signal_daily_agg failed', err);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [shouldWriteAgg, signalDate, chatSignals, recentChatMessages.length]);

  const debugInsights =
    (import.meta as any)?.env?.DEV &&
    new URLSearchParams(window.location.search).get('debugInsights') === '1';

  const handleSaveInsightToJournal = async (title: string, content: string): Promise<string> => {
    if (!user || !profile) throw new Error('No autenticado');
    return createJournalEntryFromInsight({ userId: user.id, profile, title, content });
  };

  return (
    <div
      className="bg-app-bg overflow-y-auto"
      style={{ minHeight: 'calc(100dvh - var(--chrome-total))', paddingBottom: 'calc(var(--nav-total) + 1rem)' }}
    >
      <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">
        {tokenLimitError && (
          <div className="bg-red-50 border border-red-200 rounded-14 px-4 py-3 text-sm text-red-800">
            <span className="font-semibold">Límite de tokens alcanzado</span>
            <span className="ml-1">— {tokenLimitError}</span>
          </div>
        )}

        {insightCrisis !== 'NO' && <CrisisAlert />}

        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-app-text">Insights de Ánimo</h1>
            <p className="text-app-muted text-sm mt-0.5">Lo que Elena va construyendo con tus reflexiones</p>
          </div>
          <div className="flex flex-col items-end flex-shrink-0">
            <button
              onClick={handleGenerateInsight}
              disabled={isGeneratingInsight || !!tokenLimitError}
              className="bg-sage-strong text-white rounded-12 px-4 py-2.5 hover:bg-[#4e7260] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
            >
              <Sparkles size={16} />
              <span className="hidden sm:inline">{isGeneratingInsight ? 'Generando...' : 'Insight Semanal'}</span>
              <span className="sm:hidden">{isGeneratingInsight ? '...' : 'Insight'}</span>
            </button>
            {weekLogCount < 2 && !isGeneratingInsight && !tokenLimitError && (
              <p className="text-xs text-app-muted mt-1 text-right max-w-[160px]">
                Tip: con 2–3 días registrados, el insight suele ser más útil.
              </p>
            )}
          </div>
        </div>

        {arrivedWithNewInsight && hasEvidenceWithGrace && (
          <div className="flex items-center gap-1.5 px-1 text-xs text-sage-strong">
            <Sparkles size={12} className="flex-shrink-0" />
            Nuevo insight de tus últimas reflexiones.
          </div>
        )}

        {/* Weekly Insight Panel — appears immediately under header */}
        <div ref={weeklyPanelRef}>
          <WeeklyInsightPanel
            latestInsight={latestInsight}
            isGenerating={isGeneratingInsight}
            error={weeklyGenError}
            highlight={justGenerated}
            weekLogCount={weekLogCount}
            weekLabel={weekLabel}
            hasHistory={weeklyInsights.length > 0}
            onJumpToHistory={handleScrollToHistory}
            onSaveToJournal={handleSaveInsightToJournal}
            chatWeekly={weeklyInsightSummary}
            sourceLabel={weeklyInsightSourceLabel}
            currentWeekStart={currentWeekStart}
            onGenerate={!tokenLimitError ? handleGenerateInsight : undefined}
            multiWeekTrend={multiWeekTrend}
          />
        </div>

        {/* Insight Memory — cross-week pattern summary */}
        {/* Stage 3F: incorporate chatInsightSignal into Insight Memory scoring/summary logic */}
        {/* Debug: open /insights?debugInsights=1 (dev only) */}
        {debugInsights && (
          <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.6 }}>
            <div>
              source: {hasAggData ? 'agg' : 'raw'} | effective: pos={effectiveChatSignals.positive} str={effectiveChatSignals.stress} anx={effectiveChatSignals.anxiety} grat={effectiveChatSignals.gratitude}
            </div>
            <div>
              debug raw:{' '}
              {chatInsightSignal
                ? `${chatInsightSignal.type} (${chatInsightSignal.score})`
                : 'null'}{' '}
              | cooled:{' '}
              {cooledChatInsightSignal
                ? `${cooledChatInsightSignal.type} (${cooledChatInsightSignal.score})`
                : 'null'}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {chatAggHealth.status === 'empty'
                ? 'debug agg health: empty'
                : chatAggHealth.status === 'stale'
                ? `⚠️ debug agg health: stale (last ${chatAggHealth.last}, ${chatAggHealth.ageDays}d)`
                : `✅ debug agg health: fresh (last ${chatAggHealth.last}, ${chatAggHealth.ageDays}d)`}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              debug source inputs: chat={(hasAggData || recentChatMessages.length > 0) ? '1' : '0'} journal={hasJournalData ? '1' : '0'}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              debug source label: {insightSourceLabel}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              debug weekly source label: {weeklyInsightSourceLabel ?? 'none'}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              debug pattern source label: {patternInsightSourceLabel ?? 'none'}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              debug effective pattern source: {patternInsightSourceLabel ?? 'none'}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              debug effective pattern summary: {effectivePatternSummary?.dominantThisWeek ?? 'none'}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              debug combined weekly: {combinedWeeklyInsightSummary?.dominantThisWeek ?? 'none'}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              debug effective weekly: {effectiveWeeklyInsightSummary?.dominantThisWeek ?? 'none'}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              debug weekly changed: {weeklyInsightJustChanged ? "1" : "0"}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              debug pattern duplicates weekly: {patternDuplicatesWeekly ? "1" : "0"}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              debug evidence: weekly={hasEnoughInsightEvidence ? "1" : "0"} chatScore={weeklyChatEvidence.totalScore} chatDays={weeklyChatEvidence.activeDays} journalEntries={weeklyJournalEvidence.totalEntries} journalDays={weeklyJournalEvidence.activeDays}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              debug evidence grace: {hasEvidenceWithGrace ? "1" : "0"}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              debug low evidence placeholder: {showLowEvidencePlaceholder ? "1" : "0"}
            </div>
          </div>
        )}
        {!weeklyDismissed && effectiveWeeklyInsightSummary?.dominantThisWeek && hasEvidenceWithGrace && (
          <WeeklyInsightCard summary={effectiveWeeklyInsightSummary} onDismiss={dismissWeeklyForToday} sourceLabel={weeklyInsightSourceLabel} isNew={weeklyInsightJustChanged} />
        )}
        {visiblePattern && !patternDuplicatesWeekly && hasEvidenceWithGrace && (
          <InsightPatternCard
            pattern={visiblePattern}
            actionLabel={topPatternActionLabel}
            onAction={topPatternAction}
            onDismiss={dismissPatternForToday}
            isNew={patternJustChanged}
            sourceLabel={patternInsightSourceLabel}
          />
        )}
        {visiblePattern && !patternDuplicatesWeekly && visiblePatternReason && hasEvidenceWithGrace && (
          <div className="px-1 pt-2 text-[11px] text-app-muted">
            {visiblePatternReason}
          </div>
        )}
        {visiblePattern && recentPatternLabels.length > 1 && hasEvidenceWithGrace && (
          <div className="px-1 pt-2 text-[11px] text-app-muted">
            Reciente: {recentPatternLabels.join(' → ')}
          </div>
        )}
        {!isVeryEarlyState && (() => {
          const msg = getInsightProgressMessage(
            hasAggData || hasJournalData,
            hasEnoughInsightEvidence,
            hasEvidenceWithGrace
          );
          if (!msg) return null;
          if (msg.level === 'strong') {
            return (
              <p className="px-1 text-[11px] text-app-muted/70 text-center leading-relaxed">
                {msg.text}
              </p>
            );
          }
          return (
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-12 bg-sage-soft border border-sage/20">
              <TrendingUp size={13} className="text-sage flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-sage-strong leading-snug">{msg.text}</p>
            </div>
          );
        })()}

        {isVeryEarlyState && (
          <div className="flex flex-col items-center justify-center py-10 px-8 text-center gap-4">
            <p className="text-[14px] text-app-text font-medium leading-relaxed">
              Elena todavía te está conociendo.
            </p>
            <p className="text-[13px] text-app-muted leading-relaxed max-w-[280px]">
              Con unas cuantas conversaciones o entradas más, empezarán a aparecer aquí los primeros patrones en lo que sientes. No tienes que hacer nada distinto.
            </p>
            <div className="flex flex-col items-center gap-2 mt-1">
              <p className="text-[12px] text-app-muted/60 leading-relaxed">
                Si quieres seguir, puedes:
              </p>
              <div className="flex items-center gap-3 flex-wrap justify-center">
                <button
                  onClick={() => navigate('/app/chat')}
                  className="text-[12.5px] text-sage-strong hover:underline underline-offset-2 transition-colors"
                >
                  Hablar con Elena
                </button>
                <span className="text-app-muted/30 text-[11px]">o</span>
                <button
                  onClick={() => navigate('/app/journal')}
                  className="text-[12.5px] text-sage-strong hover:underline underline-offset-2 transition-colors"
                >
                  Escribir en el diario
                </button>
              </div>
            </div>
          </div>
        )}

        {!hasEnoughInsightEvidence && !isVeryEarlyState && (
          <p className="px-1 text-[12px] text-app-muted/55 text-center leading-relaxed">
            Con unos días más, Elena podrá mostrarte los primeros patrones claros.
          </p>
        )}
        <InsightMemoryCard
          insights={weeklyInsights}
          selectedWeekStart={currentWeekStart}
          onScrollToHistory={handleScrollToHistory}
          chatInsightSignal={cooledChatInsightSignal?.type != null ? { type: cooledChatInsightSignal.type, score: cooledChatInsightSignal.score } : null}
        />

        {/* Mood Calendar */}
        <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5">
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={goToPreviousWeek}
              className="p-2 hover:bg-app-surface-2 rounded-xl transition-colors text-app-muted hover:text-app-text"
            >
              <ChevronLeft size={22} />
            </button>
            <div className="text-sm font-medium text-app-text">
              {weekDates[0].toLocaleDateString('es', { month: 'long', day: 'numeric' })} — {weekDates[6].toLocaleDateString('es', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            <button
              onClick={goToNextWeek}
              className="p-2 hover:bg-app-surface-2 rounded-xl transition-colors text-app-muted hover:text-app-text"
            >
              <ChevronRight size={22} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {weekDates.map((date, idx) => {
              const mood = getMoodForDate(date);
              const isToday = date.toDateString() === new Date().toDateString();

              return (
                <div
                  key={idx}
                  className={`text-center p-2.5 rounded-14 border transition-all ${
                    isToday
                      ? 'border-sage bg-sage-soft'
                      : 'border-app-border bg-app-bg'
                  }`}
                >
                  <div className="text-[10px] font-medium text-app-muted mb-1.5 uppercase tracking-wide">
                    {date.toLocaleDateString('es', { weekday: 'short' }).replace('.', '')}
                  </div>
                  <div className="text-sm font-semibold text-app-text mb-2">
                    {date.getDate()}
                  </div>
                  {mood ? (
                    <div className="text-2xl leading-none">{mood.emoji}</div>
                  ) : (
                    <div className="text-lg text-app-border leading-none">—</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Mood Log Form */}
        <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5">
          <h2 className="text-[15px] font-semibold text-app-text mb-4 flex items-center gap-2">
            <Calendar size={17} className="text-sage" />
            Registrar Estado de Ánimo de Hoy
          </h2>

          <div className="grid grid-cols-5 gap-2.5 mb-5">
            {MOOD_EMOJIS.map((emoji, idx) => (
              <button
                key={emoji}
                onClick={() => setSelectedMood(emoji)}
                className={`py-4 px-2 rounded-14 border-2 transition-all hover:scale-105 active:scale-95 ${
                  selectedMood === emoji
                    ? 'border-sage-strong bg-sage-soft'
                    : 'border-app-border bg-app-bg hover:border-sage'
                }`}
              >
                <div className="text-3xl mb-1.5 leading-none">{emoji}</div>
                <div className="text-[10px] font-medium text-app-muted leading-tight">{MOOD_LABELS[idx]}</div>
              </button>
            ))}
          </div>

          {selectedMood && (
            <div className="space-y-3">
              <textarea
                value={moodNote}
                onChange={(e) => setMoodNote(e.target.value)}
                placeholder="¿Qué está pasando hoy? (opcional)"
                className="w-full border border-app-border rounded-14 px-4 py-3 text-sm text-app-text placeholder:text-app-muted focus:outline-none bg-app-surface resize-none transition"
                style={{ boxShadow: 'none' }}
                onFocus={(e) => e.currentTarget.style.boxShadow = '0 0 0 3px var(--focus)'}
                onBlur={(e) => e.currentTarget.style.boxShadow = 'none'}
                rows={3}
              />
              <button
                onClick={handleSaveMood}
                disabled={isSaving}
                className="w-full bg-sage-strong text-white rounded-12 px-6 py-2.5 hover:bg-[#4e7260] transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isSaving ? 'Guardando...' : 'Guardar Estado de Ánimo'}
              </button>
            </div>
          )}
        </div>

        {/* 30-day Mood Distribution */}
        <MoodDistributionCard moodLogs={moodLogs} />

        {/* Day-of-week patterns */}
        <DayOfWeekPatternCard moodLogs={moodLogs} />

        {/* Streak & Consistency */}
        <StreakCard
          moodLogs={moodLogs}
          timezone={profile?.timezone}
        />

        {/* Journal Progress */}
        <JournalProgressSection
          progress={journalProgress}
          isLoading={isLoadingJournal}
        />

        {/* Weekly AI Insights — history */}
        {weeklyInsights.length > 0 && (
          <div
            ref={historyRef}
            className={`bg-app-surface rounded-[16px] shadow-app border p-5 transition-all duration-300 ${historyFlash ? 'border-sage ring-2 ring-sage/30' : 'border-app-border'}`}
          >
            <h2 className="text-[15px] font-semibold text-app-text mb-4 flex items-center gap-2">
              <TrendingUp size={17} className="text-sage" />
              Semanas anteriores
            </h2>
            <div className="space-y-3">
              {weeklyInsights.map((insight, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-sage-soft rounded-14 border border-sage-soft"
                >
                  <div className="text-xs text-sage-strong font-medium mb-1.5">
                    Semana del {new Date(insight.week_start_date).toLocaleDateString('es', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                  <p className="text-sm text-app-text leading-relaxed">{sanitizeInsightText(insight.insight_text)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
