import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronDown, ChevronRight, Send, RefreshCw, Search,
  AlertCircle, CheckCircle, X, History,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAdmin } from '../../hooks/useAdmin';
import { listUsers, fetchUsersLastActivity, getDisplayName, type AdminUser } from '../../lib/adminUsers';

/**
 * /admin/send-email — the admin picks users and sends them an email written by hand.
 *
 * Sending happens in the edge function admin-send-manual-email, which is the
 * real gate: it skips anyone whose main email switch (email_opt_in) or
 * "Noticias de Con Elena" switch (email_news_opt_in) is off, and deleted
 * accounts, whatever this page sends. This page only greys those people out so
 * the admin sees who will not receive it.
 *
 * The footer below must match FOOTER_TEXT in the edge function.
 */

const FOOTER_PREVIEW =
  '—\nRecibes este correo porque tienes una cuenta en Con Elena.\n' +
  'Si no quieres recibir más noticias, puedes ajustar tus preferencias aquí: https://app.conelena.app/settings';

const SUBJECT_MAX = 200;
const BODY_MAX = 10000;
const RECIPIENTS_MAX = 200; // same limit as the edge function

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailPrefsRow {
  id: string;
  email_opt_in: boolean | null;
  email_news_opt_in: boolean | null;
}

interface Candidate {
  user: AdminUser;
  name: string;
  lastActive: string | null;
  /** Why this person will not receive the email, or null if they will. */
  blockedReason: string | null;
}

interface ManualEmailRow {
  id: string;
  created_at: string;
  audience_type: string;
  subject: string;
  body_text: string;
  status: string;
  recipient_count: number;
  success_count: number;
  failure_count: number;
  skipped_count: number;
}

interface RecipientRow {
  id: string;
  email: string;
  send_status: string;
  error_message: string | null;
  sent_at: string | null;
}

interface SendResult {
  recipientCount: number;
  skippedCount: number;
  successCount: number;
  failureCount: number;
  status: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function fetchCandidates(): Promise<Candidate[]> {
  const [users, lastActivity, prefsRes] = await Promise.all([
    listUsers('', false),
    fetchUsersLastActivity(),
    supabase.from('profiles').select('id, email_opt_in, email_news_opt_in'),
  ]);
  if (prefsRes.error) throw prefsRes.error;
  const prefs = new Map<string, EmailPrefsRow>();
  for (const p of (prefsRes.data ?? []) as EmailPrefsRow[]) prefs.set(p.id, p);

  return users
    .filter((u) => !!u.email)
    .map((u) => {
      const p = prefs.get(u.id);
      let blockedReason: string | null = null;
      if (!p) blockedReason = 'Sin perfil';
      else if (p.email_opt_in === false) blockedReason = 'Correos desactivados';
      else if (p.email_news_opt_in === false) blockedReason = 'No recibe noticias';
      return {
        user: u,
        name: getDisplayName(u) || u.email,
        lastActive: lastActivity[u.id] ?? null,
        blockedReason,
      };
    })
    .sort((a, b) => (b.lastActive ?? '').localeCompare(a.lastActive ?? ''));
}

async function fetchHistory(): Promise<ManualEmailRow[]> {
  const { data, error } = await supabase
    .from('admin_manual_emails')
    .select('id, created_at, audience_type, subject, body_text, status, recipient_count, success_count, failure_count, skipped_count')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []) as ManualEmailRow[];
}

async function fetchRecipients(manualEmailId: string): Promise<RecipientRow[]> {
  const { data, error } = await supabase
    .from('admin_manual_email_recipients')
    .select('id, email, send_status, error_message, sent_at')
    .eq('manual_email_id', manualEmailId)
    .order('email');
  if (error) throw error;
  return (data ?? []) as RecipientRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const dateFmt = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Mexico_City',
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return dateFmt.format(new Date(iso));
}

function formatLastActive(iso: string | null): string {
  if (!iso) return 'Nunca';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 30) return `Hace ${days} días`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'Hace 1 mes' : `Hace ${months} meses`;
}

const STATUS_LABEL: Record<string, string> = {
  sending: 'Enviando',
  sent: 'Enviado',
  partial_failed: 'Con fallos',
  failed: 'Falló',
  draft: 'Borrador',
};

// ─── History row ──────────────────────────────────────────────────────────────

function HistoryRow({ row }: { row: ManualEmailRow }) {
  const [open, setOpen] = useState(false);
  const { data: recipients, isLoading } = useQuery({
    queryKey: ['manualEmailRecipients', row.id],
    queryFn: () => fetchRecipients(row.id),
    enabled: open,
  });

  const statusColor =
    row.status === 'sent' ? 'text-sage-strong'
    : row.status === 'sending' ? 'text-app-muted'
    : 'text-red-600';

  return (
    <div className="py-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-2 text-left"
      >
        {open ? <ChevronDown size={15} className="text-app-muted mt-0.5 flex-shrink-0" />
              : <ChevronRight size={15} className="text-app-muted mt-0.5 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-app-text truncate">{row.subject}</span>
            <span className={`text-xs font-medium flex-shrink-0 ${statusColor}`}>
              {STATUS_LABEL[row.status] ?? row.status}
            </span>
          </div>
          <div className="text-xs text-app-muted mt-0.5">
            {formatDate(row.created_at)} · {row.success_count} enviados
            {row.failure_count > 0 && <> · <span className="text-red-600">{row.failure_count} fallidos</span></>}
            {row.skipped_count > 0 && <> · {row.skipped_count} omitidos</>}
          </div>
        </div>
      </button>

      {open && (
        <div className="mt-3 ml-6 space-y-3">
          <pre className="whitespace-pre-wrap font-sans text-[13px] text-app-text bg-app-bg border border-app-border rounded-10 p-3 max-h-48 overflow-y-auto">
            {row.body_text}
          </pre>
          {isLoading ? (
            <div className="text-xs text-app-muted flex items-center gap-1.5">
              <RefreshCw size={12} className="animate-spin" /> Cargando destinatarios…
            </div>
          ) : (recipients ?? []).length === 0 ? (
            <p className="text-xs text-app-muted">Sin destinatarios registrados.</p>
          ) : (
            <ul className="text-xs space-y-1">
              {(recipients ?? []).map((r) => (
                <li key={r.id} className="flex items-start gap-2">
                  {r.send_status === 'sent'
                    ? <CheckCircle size={12} className="text-sage-strong mt-0.5 flex-shrink-0" />
                    : <AlertCircle size={12} className="text-red-600 mt-0.5 flex-shrink-0" />}
                  <span className="text-app-text">{r.email}</span>
                  {r.send_status !== 'sent' && r.error_message && (
                    <span className="text-red-600 truncate" title={r.error_message}>{r.error_message}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AdminSendEmailPage() {
  const { data: isAdmin } = useAdmin();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SendResult | null>(null);

  const candidatesQuery = useQuery({
    queryKey: ['adminSendEmailCandidates'],
    queryFn: fetchCandidates,
    enabled: !!isAdmin,
  });
  const historyQuery = useQuery({
    queryKey: ['adminManualEmails'],
    queryFn: fetchHistory,
    enabled: !!isAdmin,
  });

  const candidates = candidatesQuery.data ?? [];

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (c) => c.name.toLowerCase().includes(q) || c.user.email.toLowerCase().includes(q),
    );
  }, [candidates, search]);

  const visibleEligible = visible.filter((c) => !c.blockedReason);
  const blockedCount = candidates.filter((c) => c.blockedReason).length;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of visibleEligible) next.add(c.user.id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const subjectTrim = subject.trim();
  const bodyTrim = body.trim();
  const canSend =
    selected.size > 0 &&
    selected.size <= RECIPIENTS_MAX &&
    subjectTrim.length > 0 && subjectTrim.length <= SUBJECT_MAX &&
    bodyTrim.length > 0 && bodyTrim.length <= BODY_MAX &&
    !sending;

  async function handleSend() {
    setSending(true);
    setSendError(null);
    try {
      const ids = Array.from(selected);
      const { data, error } = await supabase.functions.invoke('admin-send-manual-email', {
        body: {
          audienceType: ids.length === 1 ? 'single' : 'multiple',
          userIds: ids,
          subject: subjectTrim,
          bodyText: bodyTrim,
        },
      });
      if (error) {
        // The function's own message (e.g. a limit) is in the response body.
        let message = error.message;
        try {
          const ctx = (error as { context?: Response }).context;
          if (ctx) {
            const errBody = await ctx.json();
            if (errBody?.error) message = errBody.error;
          }
        } catch { /* keep error.message */ }
        throw new Error(message);
      }
      setLastResult(data as SendResult);
      setConfirmOpen(false);
      setSelected(new Set());
      setSubject('');
      setBody('');
      queryClient.invalidateQueries({ queryKey: ['adminManualEmails'] });
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="bg-app-bg p-5 flex items-center justify-center" style={{ minHeight: 'calc(100dvh - var(--chrome-total))' }}>
        <p className="text-sm text-app-muted">No tienes permisos para ver esta sección.</p>
      </div>
    );
  }

  return (
    <div
      className="bg-app-bg p-5 space-y-6"
      style={{
        minHeight: 'calc(100dvh - var(--chrome-total))',
        paddingBottom: 'calc(var(--nav-total) + 1.5rem)',
      }}
    >
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-1 text-sm text-app-muted hover:text-app-text transition-colors">
            <ChevronLeft size={16} /> Admin
          </Link>
          <button
            onClick={() => { candidatesQuery.refetch(); historyQuery.refetch(); }}
            disabled={candidatesQuery.isFetching || historyQuery.isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-10 text-xs font-medium text-app-muted hover:text-app-text border border-app-border hover:border-sage-strong transition-all"
          >
            <RefreshCw size={13} className={candidatesQuery.isFetching || historyQuery.isFetching ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-12 bg-sage-strong/10 flex items-center justify-center">
            <Send size={18} className="text-sage-strong" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-app-text">Enviar correo</h1>
            <p className="text-sm text-app-muted">
              Se envía desde Elena &lt;hola@conelena.app&gt;. Quien apagó sus correos o "Noticias de Con Elena" no lo recibe.
            </p>
          </div>
        </div>

        {/* Result of the last send */}
        {lastResult && (
          <div className="flex items-start gap-2 bg-app-surface border border-sage-strong rounded-[16px] p-4">
            <CheckCircle size={16} className="text-sage-strong mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-sm text-app-text">
              Enviado a {lastResult.successCount} de {lastResult.recipientCount}.
              {lastResult.failureCount > 0 && <> {lastResult.failureCount} fallaron.</>}
              {lastResult.skippedCount > 0 && <> {lastResult.skippedCount} omitidos por sus preferencias.</>}
            </div>
            <button onClick={() => setLastResult(null)} className="text-app-muted hover:text-app-text">
              <X size={14} />
            </button>
          </div>
        )}

        {/* 1. Recipients */}
        <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-app-text">1. Destinatarios</h2>
            <span className="text-xs text-app-muted">
              {selected.size} seleccionados{blockedCount > 0 && ` · ${blockedCount} no reciben noticias`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o correo"
                className="w-full pl-8 pr-3 py-2 text-sm rounded-10 border border-app-border bg-app-bg text-app-text focus:outline-none focus:border-sage-strong"
              />
            </div>
            <button
              onClick={selectAllVisible}
              disabled={visibleEligible.length === 0}
              className="px-3 py-2 rounded-10 text-xs font-medium border border-app-border text-app-text hover:border-sage-strong disabled:opacity-40"
            >
              Seleccionar {search.trim() ? 'resultados' : 'todos'} ({visibleEligible.length})
            </button>
            <button
              onClick={clearSelection}
              disabled={selected.size === 0}
              className="px-3 py-2 rounded-10 text-xs font-medium border border-app-border text-app-muted hover:text-app-text disabled:opacity-40"
            >
              Ninguno
            </button>
          </div>

          {candidatesQuery.isLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-app-muted">
              <RefreshCw size={13} className="animate-spin" /> Cargando usuarios…
            </div>
          ) : candidatesQuery.error ? (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle size={14} /> No se pudieron cargar los usuarios.
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto divide-y divide-app-border border border-app-border rounded-10">
              {visible.length === 0 && (
                <p className="p-4 text-sm text-app-muted">Nadie coincide con la búsqueda.</p>
              )}
              {visible.map((c) => {
                const blocked = !!c.blockedReason;
                const checked = selected.has(c.user.id);
                return (
                  <label
                    key={c.user.id}
                    className={`flex items-center gap-3 px-3 py-2.5 ${blocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-app-bg'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={blocked}
                      onChange={() => toggle(c.user.id)}
                      className="w-4 h-4 accent-sage-strong flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-app-text truncate">
                        {c.name}
                        {c.user.is_disabled && <span className="ml-2 text-[11px] text-app-muted">(desactivada)</span>}
                      </div>
                      <div className="text-xs text-app-muted truncate">{c.user.email}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {blocked
                        ? <span className="text-[11px] text-app-muted">{c.blockedReason}</span>
                        : <span className="text-[11px] text-app-muted">{formatLastActive(c.lastActive)}</span>}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
          {selected.size > RECIPIENTS_MAX && (
            <p className="text-xs text-red-600">Máximo {RECIPIENTS_MAX} personas por envío.</p>
          )}
        </div>

        {/* 2. Compose */}
        <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5 space-y-4">
          <h2 className="text-[15px] font-semibold text-app-text">2. Mensaje</h2>
          <div className="space-y-1">
            <label className="text-[12px] font-semibold text-app-muted uppercase tracking-wider">Asunto</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={SUBJECT_MAX}
              className="w-full px-3 py-2 text-sm rounded-10 border border-app-border bg-app-bg text-app-text focus:outline-none focus:border-sage-strong"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <label className="text-[12px] font-semibold text-app-muted uppercase tracking-wider">Texto</label>
              <span className="text-[11px] text-app-muted">{body.length} / {BODY_MAX}</span>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={BODY_MAX}
              rows={10}
              placeholder="Una línea en blanco separa los párrafos."
              className="w-full px-3 py-2 text-sm rounded-10 border border-app-border bg-app-bg text-app-text focus:outline-none focus:border-sage-strong resize-y"
            />
          </div>

          <div className="space-y-1">
            <span className="text-[12px] font-semibold text-app-muted uppercase tracking-wider">Así llega</span>
            <div className="border border-app-border rounded-10 p-4 bg-app-bg text-[13px] text-app-text">
              <div className="text-app-muted text-xs mb-2">
                De: Elena &lt;hola@conelena.app&gt; · Asunto: {subjectTrim || '—'}
              </div>
              <div className="whitespace-pre-wrap">{bodyTrim || <span className="text-app-muted">(sin texto)</span>}</div>
              <div className="whitespace-pre-wrap text-xs text-app-muted mt-4">{FOOTER_PREVIEW}</div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => { setSendError(null); setConfirmOpen(true); }}
              disabled={!canSend}
              className="flex items-center gap-2 px-4 py-2 rounded-10 text-sm font-medium bg-sage-strong text-white disabled:opacity-40"
            >
              <Send size={14} />
              Enviar a {selected.size} {selected.size === 1 ? 'persona' : 'personas'}
            </button>
          </div>
        </div>

        {/* 3. History */}
        <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5">
          <div className="flex items-center gap-2 mb-1">
            <History size={16} className="text-sage-strong" />
            <h2 className="text-[15px] font-semibold text-app-text">Historial</h2>
          </div>
          {historyQuery.isLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-app-muted">
              <RefreshCw size={13} className="animate-spin" /> Cargando historial…
            </div>
          ) : (historyQuery.data ?? []).length === 0 ? (
            <p className="py-3 text-sm text-app-muted">Todavía no se ha enviado ningún correo.</p>
          ) : (
            <div className="divide-y divide-app-border">
              {(historyQuery.data ?? []).map((row) => <HistoryRow key={row.id} row={row} />)}
            </div>
          )}
        </div>
      </div>

      {/* Confirm dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-5">
          <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5 w-full max-w-md space-y-4">
            <h3 className="text-[15px] font-semibold text-app-text">
              ¿Enviar a {selected.size} {selected.size === 1 ? 'persona' : 'personas'}?
            </h3>
            <p className="text-sm text-app-muted">
              Asunto: <span className="text-app-text">{subjectTrim}</span>
            </p>
            <p className="text-xs text-app-muted">
              No se puede deshacer. Si alguien cambió sus preferencias hace un momento, el envío lo omite igual.
            </p>
            {sendError && (
              <div className="flex items-start gap-2 text-sm text-red-600">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" /> {sendError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={sending}
                className="px-4 py-2 rounded-10 text-sm font-medium border border-app-border text-app-text"
              >
                Cancelar
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex items-center gap-2 px-4 py-2 rounded-10 text-sm font-medium bg-sage-strong text-white disabled:opacity-60"
              >
                {sending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                {sending ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
