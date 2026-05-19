import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'wouter';
import { ArrowLeft, Download, Trash2, Radio, RefreshCw, Eye, ChevronUp, AlertCircle } from 'lucide-react';
import {
  fetchAllRecordedFlightUsers,
  setFlightRecorderForUser,
  fetchFlightEventsForUser,
  clearFlightEventsForUser,
  clearAllFlightEvents,
  exportFlightEventsAsText,
  FlightRecorderUserRow,
  FlightEvent,
} from '../../lib/elenaFlightRecorder';

function downloadText(text: string, filename: string) {
  try {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {}
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function shortId(id: string): string {
  return id.slice(0, 8) + '…';
}

export function FlightRecorderPage() {
  const { user } = useAuth();

  const [users, setUsers] = useState<FlightRecorderUserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<FlightEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventsExpanded, setEventsExpanded] = useState(true);

  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState<{ kind: 'user' | 'all'; userId?: string } | null>(null);
  const [clearingUserId, setClearingUserId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    setLoadError(null);
    try {
      const rows = await fetchAllRecordedFlightUsers();
      setUsers(rows);
    } catch (err) {
      setLoadError((err as Error).message ?? 'Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const loadEventsForUser = useCallback(async (userId: string) => {
    setLoadingEvents(true);
    setSelectedEvents([]);
    try {
      const events = await fetchFlightEventsForUser(userId, 200);
      setSelectedEvents(events);
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  const handleSelectUser = (userId: string) => {
    if (selectedUserId === userId) {
      setEventsExpanded(v => !v);
      return;
    }
    setSelectedUserId(userId);
    setEventsExpanded(true);
    loadEventsForUser(userId);
  };

  const handleToggleRecording = async (row: FlightRecorderUserRow) => {
    setTogglingUserId(row.user_id);
    try {
      await setFlightRecorderForUser(row.user_id, !row.flight_recorder_enabled);
      await loadUsers();
      showToast(
        !row.flight_recorder_enabled
          ? `Recording enabled for ${row.email || shortId(row.user_id)}`
          : `Recording disabled for ${row.email || shortId(row.user_id)}`
      );
    } catch {
      showToast('Failed to update recording status.');
    } finally {
      setTogglingUserId(null);
    }
  };

  const handleExportUser = async (userId: string, email: string) => {
    const text = await exportFlightEventsAsText(userId);
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const uid = (email || userId).slice(0, 12).replace(/[@.]/g, '_');
    downloadText(text, `elena-flight-${uid}-${ts}.txt`);
  };

  const handleClearUser = async (userId: string) => {
    if (!confirmClear || confirmClear.kind !== 'user' || confirmClear.userId !== userId) {
      setConfirmClear({ kind: 'user', userId });
      return;
    }
    setClearingUserId(userId);
    try {
      await clearFlightEventsForUser(userId);
      setConfirmClear(null);
      if (selectedUserId === userId) setSelectedEvents([]);
      await loadUsers();
      showToast('User log cleared.');
    } catch {
      showToast('Failed to clear log.');
    } finally {
      setClearingUserId(null);
    }
  };

  const handleClearAll = async () => {
    if (!confirmClear || confirmClear.kind !== 'all') {
      setConfirmClear({ kind: 'all' });
      return;
    }
    setClearingUserId('all');
    try {
      await clearAllFlightEvents();
      setConfirmClear(null);
      setSelectedEvents([]);
      await loadUsers();
      showToast('All flight logs cleared.');
    } catch {
      showToast('Failed to clear all logs.');
    } finally {
      setClearingUserId(null);
    }
  };

  const selectedUserRow = users.find(u => u.user_id === selectedUserId);
  const recordedCount = users.filter(u => u.flight_recorder_enabled).length;
  const totalEvents = users.reduce((sum, u) => sum + Number(u.event_count ?? 0), 0);

  return (
    <div
      className="bg-app-bg p-5 space-y-5"
      style={{
        minHeight: 'calc(100dvh - var(--chrome-total))',
        paddingBottom: 'calc(var(--nav-total) + 1.5rem)',
      }}
    >
      <div className="max-w-3xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/app/admin"
            className="p-2 rounded-12 hover:bg-app-surface transition-colors text-app-muted hover:text-app-text"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-12 bg-sage-strong/10 flex items-center justify-center">
              <Radio size={18} className="text-sage-strong" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-app-text">Flight Recorder</h1>
              <p className="text-xs text-app-muted">QA observability — Supabase-backed — admin only — temporary</p>
            </div>
          </div>
          <button
            onClick={loadUsers}
            disabled={loadingUsers}
            className="p-2 rounded-12 hover:bg-app-surface transition-colors text-app-muted hover:text-app-text disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw size={15} className={loadingUsers ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div className="px-4 py-2.5 rounded-12 bg-emerald-50 border border-emerald-200 text-[12.5px] text-emerald-700 font-medium">
            {toast}
          </div>
        )}

        {/* Load error */}
        {loadError && (
          <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-[14px] text-sm text-red-700">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[12.5px]">Failed to load users</p>
              <p className="text-[11.5px] text-red-500 mt-0.5 font-mono">{loadError}</p>
            </div>
            <button
              onClick={loadUsers}
              className="text-[11.5px] font-medium underline text-red-600 flex-shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Info banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-[14px] px-4 py-3">
          <p className="text-[12px] text-amber-800 leading-relaxed">
            Temporarily records Elena UX events for selected users for QA testing only.
            Events are metadata-only — no message content, no journal text is stored.
            Toggle recording per user below. Logs persist in Supabase until cleared.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-12 bg-app-surface border border-app-border px-3 py-2.5 text-center">
            <p className="text-[11px] text-app-muted uppercase tracking-wide mb-0.5">Total Users</p>
            <p className="text-[14px] font-semibold text-app-text">{users.length}</p>
          </div>
          <div className="rounded-12 bg-app-surface border border-app-border px-3 py-2.5 text-center">
            <p className="text-[11px] text-app-muted uppercase tracking-wide mb-0.5">Recording</p>
            <p className={`text-[14px] font-semibold ${recordedCount > 0 ? 'text-emerald-600' : 'text-app-muted'}`}>
              {recordedCount}
            </p>
          </div>
          <div className="rounded-12 bg-app-surface border border-app-border px-3 py-2.5 text-center">
            <p className="text-[11px] text-app-muted uppercase tracking-wide mb-0.5">Total Events</p>
            <p className="text-[14px] font-semibold text-app-text">{totalEvents.toLocaleString()}</p>
          </div>
        </div>

        {/* User list */}
        <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-app-border">
            <h2 className="text-[12px] font-semibold text-app-text uppercase tracking-widest">Users</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearAll}
                disabled={totalEvents === 0 || clearingUserId === 'all'}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-10 border text-[11.5px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  confirmClear?.kind === 'all'
                    ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100'
                    : 'bg-app-bg border-app-border text-app-muted hover:text-red-600 hover:border-red-300'
                }`}
              >
                <Trash2 size={11} />
                {confirmClear?.kind === 'all' ? 'Confirm Clear All' : 'Clear All Logs'}
              </button>
              {confirmClear?.kind === 'all' && (
                <button
                  onClick={() => setConfirmClear(null)}
                  className="px-3 py-1.5 rounded-10 bg-app-bg border border-app-border text-[11.5px] text-app-muted hover:text-app-text transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {loadingUsers && users.length === 0 ? (
            <div className="px-5 py-8 text-center text-[12px] text-app-muted">Loading users…</div>
          ) : users.length === 0 ? (
            <div className="px-5 py-8 text-center text-[12px] text-app-muted italic">No users found.</div>
          ) : (
            <div className="divide-y divide-app-border/50">
              {users.map(row => {
                const isCurrentAdmin = row.user_id === user?.id;
                const isSelected = selectedUserId === row.user_id;
                const isToggling = togglingUserId === row.user_id;
                const isClearing = clearingUserId === row.user_id;
                const isConfirmingClear = confirmClear?.kind === 'user' && confirmClear.userId === row.user_id;
                const eventCount = Number(row.event_count ?? 0);

                return (
                  <div
                    key={row.user_id}
                    className={`px-5 py-3 transition-colors ${isSelected ? 'bg-sage-soft/40' : 'hover:bg-app-bg/60'}`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Recording toggle */}
                      <button
                        onClick={() => handleToggleRecording(row)}
                        disabled={isToggling}
                        title={row.flight_recorder_enabled ? 'Disable recording' : 'Enable recording'}
                        className={`relative flex-shrink-0 w-9 h-5 rounded-full transition-colors duration-200 disabled:opacity-50 focus:outline-none ${
                          row.flight_recorder_enabled ? 'bg-emerald-500' : 'bg-app-border'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                            row.flight_recorder_enabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>

                      {/* User info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[13px] font-medium text-app-text truncate">
                            {row.email || shortId(row.user_id)}
                          </span>
                          {isCurrentAdmin && (
                            <span className="text-[10px] font-semibold text-sage-strong bg-sage-soft px-1.5 py-0.5 rounded-4 flex-shrink-0">you</span>
                          )}
                          {row.flight_recorder_enabled && (
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-4 flex-shrink-0">
                              Recording
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <code className="text-[10px] text-app-muted">{shortId(row.user_id)}</code>
                          <span className="text-[10.5px] text-app-muted">
                            {eventCount} event{eventCount !== 1 ? 's' : ''}
                          </span>
                          {row.latest_event_at && (
                            <span className="text-[10.5px] text-app-muted">
                              last: {formatTime(row.latest_event_at)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleSelectUser(row.user_id)}
                          disabled={eventCount === 0}
                          title="View events"
                          className="p-1.5 rounded-8 text-app-muted hover:text-app-text hover:bg-app-bg border border-transparent hover:border-app-border transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          {isSelected && eventsExpanded ? <ChevronUp size={13} /> : <Eye size={13} />}
                        </button>
                        <button
                          onClick={() => handleExportUser(row.user_id, row.email)}
                          disabled={eventCount === 0}
                          title="Export log"
                          className="p-1.5 rounded-8 text-app-muted hover:text-sage-strong hover:bg-sage-soft border border-transparent hover:border-sage/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Download size={13} />
                        </button>
                        <button
                          onClick={() => handleClearUser(row.user_id)}
                          disabled={eventCount === 0 || isClearing}
                          title={isConfirmingClear ? 'Confirm clear' : 'Clear log'}
                          className={`p-1.5 rounded-8 border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                            isConfirmingClear
                              ? 'text-red-600 bg-red-50 border-red-300 hover:bg-red-100'
                              : 'text-app-muted hover:text-red-600 hover:bg-red-50 border-transparent hover:border-red-200'
                          }`}
                        >
                          <Trash2 size={13} />
                        </button>
                        {isConfirmingClear && (
                          <button
                            onClick={() => setConfirmClear(null)}
                            className="text-[11px] text-app-muted hover:text-app-text px-1.5 py-1 rounded-6 transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline event preview */}
                    {isSelected && eventsExpanded && (
                      <div className="mt-3 ml-12">
                        {loadingEvents ? (
                          <p className="text-[11.5px] text-app-muted">Loading events…</p>
                        ) : selectedEvents.length === 0 ? (
                          <p className="text-[11.5px] text-app-muted italic">No events recorded yet.</p>
                        ) : (
                          <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1">
                            <p className="text-[10.5px] text-app-muted mb-1.5">
                              Showing latest {Math.min(selectedEvents.length, 200)} of {eventCount} events
                            </p>
                            {selectedEvents.map((e) => (
                              <div
                                key={e.id}
                                className="rounded-8 bg-app-surface border border-app-border px-3 py-2"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-[11.5px] font-semibold text-sage-strong font-mono">{e.event_name}</span>
                                  <span className="text-[10px] text-app-muted flex-shrink-0 mt-0.5">
                                    {e.created_at.slice(11, 19)}
                                  </span>
                                </div>
                                {e.session_id && (
                                  <p className="text-[10px] text-app-muted/70 mt-0.5 font-mono">sid: {e.session_id}</p>
                                )}
                                {e.payload && (
                                  <pre className="text-[10px] text-app-muted mt-1 whitespace-pre-wrap leading-relaxed overflow-x-auto">
                                    {JSON.stringify(e.payload, null, 2)}
                                  </pre>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex gap-2 mt-2.5">
                          <button
                            onClick={() => loadEventsForUser(row.user_id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-8 bg-app-bg border border-app-border text-[11px] text-app-muted hover:text-app-text transition-colors"
                          >
                            <RefreshCw size={10} />
                            Refresh
                          </button>
                          <button
                            onClick={() => handleExportUser(row.user_id, row.email)}
                            disabled={selectedEvents.length === 0}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-8 bg-sage-soft border border-sage/30 text-sage-strong text-[11px] font-semibold hover:bg-sage/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Download size={10} />
                            Export {selectedUserRow?.email ? selectedUserRow.email.split('@')[0] : 'user'} log
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Admin note */}
        <p className="text-[11px] text-app-muted text-center leading-relaxed">
          Signed in as:{' '}
          <code className="text-[10.5px] bg-app-surface px-1.5 py-0.5 rounded-6 border border-app-border">
            {user?.id ?? 'not signed in'}
          </code>
        </p>

      </div>
    </div>
  );
}
