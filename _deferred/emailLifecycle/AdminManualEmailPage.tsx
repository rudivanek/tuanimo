import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, Send, Users, User, UsersRound, Search, X, AlertCircle, CheckCircle2, Loader2, Mail } from 'lucide-react';
import { Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { ManualEmailHistory } from '../../components/admin/ManualEmailHistory';

type AudienceType = 'single' | 'multiple' | 'all';

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
}

interface SendResult {
  ok: boolean;
  recipientCount: number;
  successCount: number;
  failureCount: number;
  status: string;
  error?: string;
}

const AUDIENCE_OPTIONS: { value: AudienceType; label: string; icon: React.ElementType; description: string }[] = [
  { value: 'single', label: 'Un usuario', icon: User, description: 'Selecciona exactamente un destinatario' },
  { value: 'multiple', label: 'Varios usuarios', icon: Users, description: 'Selecciona uno o más destinatarios' },
  { value: 'all', label: 'Todos los usuarios', icon: UsersRound, description: 'Envía a todos con email válido' },
];

function UserChip({ user, onRemove }: { user: UserRow; onRemove: (id: string) => void }) {
  const label = user.full_name?.trim() || user.email;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-sage-strong/10 text-sage-strong border border-sage-strong/20 font-medium max-w-[200px]">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={() => onRemove(user.id)}
        className="flex-shrink-0 hover:text-red-500 transition-colors ml-0.5"
      >
        <X size={11} />
      </button>
    </span>
  );
}

interface UserPickerProps {
  mode: 'single' | 'multiple';
  users: UserRow[];
  selected: UserRow[];
  onSelect: (user: UserRow) => void;
  onDeselect: (id: string) => void;
}

function UserPicker({ mode, users, selected, onSelect, onDeselect }: UserPickerProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedIds = new Set(selected.map((u) => u.id));

  const filtered = search.trim()
    ? users.filter((u) => {
        const q = search.toLowerCase();
        return (
          u.email.toLowerCase().includes(q) ||
          (u.full_name ?? '').toLowerCase().includes(q)
        );
      })
    : users;

  const visible = filtered.filter((u) => !selectedIds.has(u.id)).slice(0, 30);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSelect(user: UserRow) {
    onSelect(user);
    if (mode === 'single') {
      setOpen(false);
      setSearch('');
    } else {
      setSearch('');
    }
  }

  return (
    <div ref={containerRef} className="space-y-2">
      {mode === 'multiple' && selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <UserChip key={u.id} user={u} onRemove={onDeselect} />
          ))}
        </div>
      )}
      {mode === 'single' && selected.length === 1 ? (
        <div className="flex items-center gap-2">
          <UserChip user={selected[0]} onRemove={onDeselect} />
          <span className="text-xs text-app-muted">{selected[0].email}</span>
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              placeholder={mode === 'single' ? 'Buscar usuario…' : 'Buscar y agregar usuarios…'}
              className="w-full pl-8 pr-3 py-2.5 text-sm bg-app-bg border border-app-border rounded-[10px] text-app-text placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-sage-strong/30 focus:border-sage-strong transition-colors"
            />
          </div>
          {open && visible.length > 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-app-surface border border-app-border rounded-[10px] shadow-lg overflow-hidden max-h-52 overflow-y-auto">
              {visible.map((u) => {
                const label = u.full_name?.trim() || u.email;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(u); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-app-bg text-left transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-sage-strong/10 flex items-center justify-center flex-shrink-0">
                      <User size={13} className="text-sage-strong" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-app-text truncate">{label}</p>
                      {label !== u.email && (
                        <p className="text-xs text-app-muted truncate">{u.email}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {open && search.trim() && visible.length === 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-app-surface border border-app-border rounded-[10px] shadow-lg px-4 py-3 text-sm text-app-muted">
              Sin resultados para &ldquo;{search}&rdquo;
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ConfirmModalProps {
  audienceType: AudienceType;
  count: number;
  subject: string;
  onCancel: () => void;
  onConfirm: () => void;
  isSending: boolean;
}

function ConfirmModal({ audienceType, count, subject, onCancel, onConfirm, isSending }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-app-surface border border-app-border rounded-[20px] shadow-xl max-w-sm w-full p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-12 bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
            <Send size={18} className="text-amber-600" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-app-text">Confirmar envío</h3>
            <p className="text-xs text-app-muted">Esta acción no se puede deshacer</p>
          </div>
        </div>

        <div className="bg-app-bg border border-app-border rounded-[12px] p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-app-muted">Destinatarios</span>
            <span className="font-semibold text-app-text">
              {count} {audienceType === 'all' ? 'usuarios elegibles' : count === 1 ? 'usuario' : 'usuarios'}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-app-muted flex-shrink-0">Asunto</span>
            <span className="font-medium text-app-text text-right truncate max-w-[180px]">{subject}</span>
          </div>
        </div>

        {audienceType === 'all' && (
          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-[10px] px-3 py-2.5">
            <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
            <span>Se enviará a <strong>todos los usuarios con email válido</strong>. Revisa el asunto y cuerpo cuidadosamente antes de confirmar.</span>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSending}
            className="flex-1 py-2.5 rounded-[10px] text-sm font-medium border border-app-border text-app-text bg-app-bg hover:bg-app-border/50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSending}
            className="flex-1 py-2.5 rounded-[10px] text-sm font-semibold text-white bg-sage-strong hover:bg-sage-strong/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSending ? (
              <><Loader2 size={14} className="animate-spin" /> Enviando…</>
            ) : (
              <><Send size={14} /> Confirmar</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminManualEmailPage() {
  const queryClient = useQueryClient();

  const [audienceType, setAudienceType] = useState<AudienceType>('single');
  const [selectedUsers, setSelectedUsers] = useState<UserRow[]>([]);
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const { data: users = [], isLoading: usersLoading } = useQuery<UserRow[]>({
    queryKey: ['admin-manual-email-users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_users', {});
      if (error) throw error;
      return (data ?? []) as UserRow[];
    },
    staleTime: 5 * 60_000,
  });

  const eligibleCount = users.length;

  const handleAudienceChange = useCallback((type: AudienceType) => {
    setAudienceType(type);
    setSelectedUsers([]);
  }, []);

  const handleSelectUser = useCallback((user: UserRow) => {
    setSelectedUsers((prev) => {
      if (audienceType === 'single') return [user];
      if (prev.find((u) => u.id === user.id)) return prev;
      return [...prev, user];
    });
  }, [audienceType]);

  const handleDeselectUser = useCallback((id: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const recipientCount =
    audienceType === 'all' ? eligibleCount : selectedUsers.length;

  const canSend =
    subject.trim().length > 0 &&
    bodyText.trim().length > 0 &&
    (audienceType === 'all' || selectedUsers.length > 0);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-send-manual-email`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            audienceType,
            userIds: audienceType === 'all' ? [] : selectedUsers.map((u) => u.id),
            subject: subject.trim(),
            bodyText: bodyText.trim(),
          }),
        },
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al enviar');
      return json as SendResult;
    },
    onSuccess: (result) => {
      setShowConfirm(false);
      setSendResult(result);
      setSubject('');
      setBodyText('');
      setSelectedUsers([]);
      setAudienceType('single');
      setHistoryRefreshKey((k) => k + 1);
      queryClient.invalidateQueries({ queryKey: ['admin-manual-emails-history'] });
    },
    onError: (err) => {
      setShowConfirm(false);
      setSendResult({ ok: false, recipientCount: 0, successCount: 0, failureCount: 0, status: 'failed', error: String(err) });
    },
  });

  function handleSendClick() {
    if (audienceType === 'single') {
      mutation.mutate();
    } else {
      setShowConfirm(true);
    }
  }

  return (
    <div
      className="bg-app-bg p-5 space-y-5"
      style={{
        minHeight: 'calc(100dvh - var(--chrome-total))',
        paddingBottom: 'calc(var(--nav-total) + 1.5rem)',
      }}
    >
      <div className="max-w-2xl mx-auto space-y-5">

        <div className="flex items-center gap-3">
          <Link
            href="/app/admin"
            className="p-2 rounded-[10px] hover:bg-app-surface border border-transparent hover:border-app-border text-app-muted hover:text-app-text transition-all"
          >
            <ChevronLeft size={18} />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-12 bg-sage-strong/10 flex items-center justify-center">
              <Mail size={18} className="text-sage-strong" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-app-text">Envío Manual de Emails</h1>
              <p className="text-xs text-app-muted">Envía emails de texto plano a uno, varios, o todos los usuarios.</p>
            </div>
          </div>
        </div>

        {sendResult && (
          <div className={`flex items-start gap-3 px-4 py-3.5 rounded-[12px] border text-sm ${
            sendResult.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {sendResult.ok
              ? <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5 text-emerald-600" />
              : <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-red-600" />}
            <div>
              {sendResult.ok ? (
                <p>
                  <strong>Envío completado.</strong> {sendResult.successCount} de {sendResult.recipientCount} emails enviados correctamente.
                  {sendResult.failureCount > 0 && <span className="ml-1 text-amber-700">{sendResult.failureCount} fallaron.</span>}
                </p>
              ) : (
                <p><strong>Error:</strong> {sendResult.error}</p>
              )}
            </div>
            <button type="button" onClick={() => setSendResult(null)} className="ml-auto flex-shrink-0 opacity-60 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app p-5 space-y-5">

          <div>
            <label className="block text-[12px] font-semibold text-app-muted uppercase tracking-wide mb-3">
              Audiencia
            </label>
            <div className="grid grid-cols-3 gap-2">
              {AUDIENCE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = audienceType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleAudienceChange(opt.value)}
                    className={`flex flex-col items-center gap-2 px-3 py-3.5 rounded-[12px] border text-center transition-all ${
                      active
                        ? 'border-sage-strong bg-sage-strong/5 text-sage-strong'
                        : 'border-app-border bg-app-bg text-app-muted hover:border-sage-strong/40 hover:text-app-text'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="text-[12px] font-semibold leading-tight">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {audienceType !== 'all' && (
            <div>
              <label className="block text-[12px] font-semibold text-app-muted uppercase tracking-wide mb-2">
                {audienceType === 'single' ? 'Destinatario' : 'Destinatarios'}
              </label>
              {usersLoading ? (
                <div className="flex items-center gap-2 text-sm text-app-muted py-2">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Cargando usuarios…</span>
                </div>
              ) : (
                <UserPicker
                  mode={audienceType}
                  users={users}
                  selected={selectedUsers}
                  onSelect={handleSelectUser}
                  onDeselect={handleDeselectUser}
                />
              )}
            </div>
          )}

          {audienceType === 'all' && (
            <div className="flex items-center gap-3 px-4 py-3 bg-sky-50 border border-sky-200 rounded-[10px]">
              <UsersRound size={16} className="text-sky-600 flex-shrink-0" />
              <p className="text-sm text-sky-800">
                Se enviará a <strong>{usersLoading ? '…' : eligibleCount} usuarios</strong> con email válido.
              </p>
            </div>
          )}

          <div className="w-full h-px bg-app-border" />

          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-semibold text-app-muted uppercase tracking-wide mb-2">
                Asunto
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Escribe el asunto del email…"
                maxLength={200}
                className="w-full px-3 py-2.5 text-sm bg-app-bg border border-app-border rounded-[10px] text-app-text placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-sage-strong/30 focus:border-sage-strong transition-colors"
              />
              <p className="text-[11px] text-app-muted mt-1 text-right">{subject.length}/200</p>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-app-muted uppercase tracking-wide mb-2">
                Cuerpo (texto plano)
              </label>
              <textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                placeholder="Escribe el contenido del email en texto plano…"
                rows={8}
                className="w-full px-3 py-2.5 text-sm bg-app-bg border border-app-border rounded-[10px] text-app-text placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-sage-strong/30 focus:border-sage-strong transition-colors resize-y font-mono"
              />
              <p className="text-[11px] text-app-muted mt-1 text-right">{bodyText.length} caracteres</p>
            </div>
          </div>

          {(subject.trim() || bodyText.trim() || selectedUsers.length > 0) && (
            <div className="bg-app-bg border border-app-border rounded-[12px] p-4 space-y-3">
              <h3 className="text-[12px] font-semibold text-app-muted uppercase tracking-wide">Vista previa del envío</h3>
              <div className="space-y-2 text-sm">
                <div className="flex gap-3">
                  <span className="text-app-muted w-24 flex-shrink-0">Audiencia</span>
                  <span className="text-app-text font-medium">
                    {audienceType === 'all'
                      ? `Todos los usuarios (${eligibleCount})`
                      : audienceType === 'single'
                      ? selectedUsers[0]?.full_name?.trim() || selectedUsers[0]?.email || '—'
                      : `${selectedUsers.length} usuario${selectedUsers.length !== 1 ? 's' : ''} seleccionado${selectedUsers.length !== 1 ? 's' : ''}`}
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-app-muted w-24 flex-shrink-0">Asunto</span>
                  <span className="text-app-text font-medium">{subject.trim() || <span className="text-app-muted italic">Sin asunto</span>}</span>
                </div>
                {bodyText.trim() && (
                  <div className="flex gap-3">
                    <span className="text-app-muted w-24 flex-shrink-0">Cuerpo</span>
                    <span className="text-app-muted text-xs whitespace-pre-wrap line-clamp-4">{bodyText.trim()}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleSendClick}
            disabled={!canSend || mutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-[12px] text-sm font-semibold text-white bg-sage-strong hover:bg-sage-strong/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? (
              <><Loader2 size={15} className="animate-spin" /> Enviando…</>
            ) : (
              <><Send size={15} /> Enviar email{recipientCount > 1 ? `s (${recipientCount})` : ''}</>
            )}
          </button>
        </div>

        <ManualEmailHistory refreshKey={historyRefreshKey} />
      </div>

      {showConfirm && (
        <ConfirmModal
          audienceType={audienceType}
          count={recipientCount}
          subject={subject.trim()}
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => mutation.mutate()}
          isSending={mutation.isPending}
        />
      )}
    </div>
  );
}
