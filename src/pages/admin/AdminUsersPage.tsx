import { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, Users, Search, UserPlus, RefreshCw,
  AlertCircle, Inbox, Pencil, Trash2, CheckCircle, Ban, Wrench, X, CheckCheck,
  RotateCcw, AlertTriangle,
} from 'lucide-react';
import { AdminUser, ReconcileResult, ResetUserResult, getDisplayName, listUsers, purgeUserData, reconcileJournalStorage, resetUserData, upsertUserProfile } from '../../lib/adminUsers';
import { setFlightRecorderForUser } from '../../lib/elenaFlightRecorder';
import { UserModal } from '../../components/admin/UserModal';

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; user: AdminUser };

function statusBadge(user: AdminUser) {
  if (user.deleted_at) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-600">
        Eliminado
      </span>
    );
  }
  if (user.is_disabled) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-600">
        Deshabilitado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sage/20 text-sage-strong">
      Activo
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

const PLAN_BADGE: Record<string, { label: string; cls: string }> = {
  starter: { label: 'Starter', cls: 'bg-app-bg text-app-muted border border-app-border' },
  pro:     { label: 'Pro',     cls: 'bg-sage-strong/10 text-sage-strong border border-sage-strong/20' },
  power:   { label: 'Power',   cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
};

function PlanBadge({ planKey }: { planKey: string }) {
  const { label, cls } = PLAN_BADGE[planKey] ?? PLAN_BADGE['starter'];
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${cls}`}>
      {label}
    </span>
  );
}

export function AdminUsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reconcileLoading, setReconcileLoading] = useState<string | null>(null);
  const [reconcileResult, setReconcileResult] = useState<(ReconcileResult & { targetLabel: string }) | null>(null);
  const [reconcileError, setReconcileError] = useState<string | null>(null);
  const [resetConfirmUser, setResetConfirmUser] = useState<AdminUser | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResult, setResetResult] = useState<(ResetUserResult & { targetLabel: string }) | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const { data: users = [], isFetching, isError, error, refetch } = useQuery<AdminUser[]>({
    queryKey: ['admin-users', includeDeleted],
    queryFn: () => listUsers('', includeDeleted),
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.first_name ?? '').toLowerCase().includes(q) ||
        (u.last_name ?? '').toLowerCase().includes(q) ||
        u.full_name.toLowerCase().includes(q),
    );
  }, [users, search]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-users'] });

  const handleToggleDisable = async (user: AdminUser) => {
    setActionLoading(user.id + '-disable');
    try {
      await upsertUserProfile({
        user_id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        plan_key: user.plan_key ?? 'starter',
        is_disabled: !user.is_disabled,
      });
      invalidate();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (user: AdminUser) => {
    if (!confirm(`¿Eliminar todos los datos de ${user.email}?\n\nEsto borrará permanentemente todos sus chats, entradas del diario, insights, historial de tokens y demás datos. El perfil se conservará como registro. Esta acción no se puede deshacer.`)) return;
    setActionLoading(user.id + '-delete');
    try {
      await purgeUserData(user.id);
      invalidate();
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleFlightRecorder = async (user: AdminUser) => {
    setActionLoading(user.id + '-flight');
    try {
      await setFlightRecorderForUser(user.id, !user.flight_recorder_enabled);
      invalidate();
    } finally {
      setActionLoading(null);
    }
  };

  const handleReset = async () => {
    if (!resetConfirmUser) return;
    const user = resetConfirmUser;
    setResetLoading(true);
    setResetResult(null);
    setResetError(null);
    try {
      const result = await resetUserData(user.id);
      setResetResult({ ...result, targetLabel: user.email });
      setResetConfirmUser(null);
      invalidate();
    } catch (err) {
      setResetError((err as Error).message ?? 'Error al resetear usuario');
      setResetConfirmUser(null);
    } finally {
      setResetLoading(false);
    }
  };

  const handleReconcile = async (user?: AdminUser) => {
    const key = user ? user.id + '-reconcile' : 'all-reconcile';
    const label = user ? user.email : 'todos los usuarios';
    setReconcileLoading(key);
    setReconcileResult(null);
    setReconcileError(null);
    try {
      const result = await reconcileJournalStorage(user?.id);
      setReconcileResult({ ...result, targetLabel: label });
      invalidate();
    } catch (err) {
      setReconcileError((err as Error).message ?? 'Error al reconciliar');
    } finally {
      setReconcileLoading(null);
    }
  };

  return (
    <div
      className="bg-app-bg p-5 space-y-5"
      style={{
        minHeight: 'calc(100dvh - var(--chrome-total))',
        paddingBottom: 'calc(var(--nav-total) + 1.5rem)',
      }}
    >
      <div className="max-w-6xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-start gap-4">
          <Link
            href="/app/admin"
            className="mt-0.5 p-2 rounded-10 bg-app-surface border border-app-border hover:border-sage-strong transition-colors text-app-muted hover:text-sage-strong"
          >
            <ChevronLeft size={16} />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Users size={20} className="text-sage-strong" />
              <h1 className="text-2xl font-semibold text-app-text">Usuarios</h1>
            </div>
            <p className="text-sm text-app-muted mt-0.5">
              {isFetching ? 'Actualizando...' : `${filtered.length} usuario${filtered.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por email o nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-8 pr-3 rounded-10 bg-app-surface border border-app-border text-sm text-app-text placeholder:text-app-muted/50 focus:outline-none focus:border-sage-strong transition-colors"
            />
          </div>

          <label className="flex items-center gap-2 px-3.5 py-2 rounded-10 bg-app-surface border border-app-border cursor-pointer select-none text-sm text-app-muted hover:border-sage-strong/50 transition-colors">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
              className="w-3.5 h-3.5 accent-sage-strong"
            />
            Mostrar eliminados
          </label>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-10 w-10 flex items-center justify-center rounded-10 bg-app-surface border border-app-border text-app-muted hover:text-sage-strong hover:border-sage-strong transition-colors disabled:opacity-50"
            title="Actualizar lista"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => handleReconcile()}
            disabled={reconcileLoading === 'all-reconcile'}
            className="h-10 px-3.5 flex items-center gap-2 rounded-10 bg-app-surface border border-app-border text-app-muted text-sm hover:text-sage-strong hover:border-sage-strong transition-colors disabled:opacity-50"
            title="Reconciliar almacenamiento de diario para todos los usuarios"
          >
            {reconcileLoading === 'all-reconcile' ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Wrench size={14} />
            )}
            <span className="hidden sm:inline">Reconciliar almacenamiento</span>
          </button>

          <button
            onClick={() => setModal({ open: true, mode: 'create' })}
            className="h-10 px-4 flex items-center gap-2 rounded-10 bg-sage-strong text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <UserPlus size={14} />
            Añadir usuario
          </button>
        </div>

        {/* Error */}
        {isError && (
          <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-[12px] text-sm text-red-700">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">No se pudo cargar la lista de usuarios</p>
              <p className="text-xs text-red-500 mt-0.5">{(error as Error)?.message}</p>
              <button onClick={() => refetch()} className="mt-1.5 text-xs font-medium underline">
                Reintentar
              </button>
            </div>
          </div>
        )}

        {/* Reconcile success */}
        {reconcileResult && (
          <div className="flex items-start gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-[12px] text-sm text-emerald-800">
            <CheckCheck size={16} className="flex-shrink-0 mt-0.5 text-emerald-600" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">Reconciliación completada</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                Objetivo: <span className="font-medium">{reconcileResult.targetLabel}</span>
                {' · '}
                {reconcileResult.users_updated} perfil{reconcileResult.users_updated !== 1 ? 'es' : ''} actualizado{reconcileResult.users_updated !== 1 ? 's' : ''}
                {' · '}
                {reconcileResult.entries_fixed} entrada{reconcileResult.entries_fixed !== 1 ? 's' : ''} corregida{reconcileResult.entries_fixed !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => setReconcileResult(null)}
              className="flex-shrink-0 p-0.5 rounded text-emerald-600 hover:text-emerald-800 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Reconcile error */}
        {reconcileError && (
          <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-[12px] text-sm text-red-700">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">Error al reconciliar</p>
              <p className="text-xs text-red-500 mt-0.5">{reconcileError}</p>
            </div>
            <button
              onClick={() => setReconcileError(null)}
              className="flex-shrink-0 p-0.5 rounded text-red-600 hover:text-red-800 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Reset success */}
        {resetResult && (
          <div className="flex items-start gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-[12px] text-sm text-emerald-800">
            <CheckCheck size={16} className="flex-shrink-0 mt-0.5 text-emerald-600" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">Usuario reseteado correctamente</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                <span className="font-medium">{resetResult.targetLabel}</span>
                {' — '}
                {resetResult.deleted_chat_threads} chat{resetResult.deleted_chat_threads !== 1 ? 's' : ''},
                {' '}{resetResult.deleted_journal_entries} entr{resetResult.deleted_journal_entries !== 1 ? 'adas' : 'ada'} de diario,
                {' '}{resetResult.deleted_token_rows} registros de tokens eliminados.
                {' '}Perfil resetado a estado inicial.
              </p>
            </div>
            <button
              onClick={() => setResetResult(null)}
              className="flex-shrink-0 p-0.5 rounded text-emerald-600 hover:text-emerald-800 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Reset error */}
        {resetError && (
          <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-[12px] text-sm text-red-700">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">Error al resetear usuario</p>
              <p className="text-xs text-red-500 mt-0.5">{resetError}</p>
            </div>
            <button
              onClick={() => setResetError(null)}
              className="flex-shrink-0 p-0.5 rounded text-red-600 hover:text-red-800 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Table */}
        <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app overflow-hidden">
          {isFetching && users.length === 0 ? (
            <div className="flex items-center justify-center h-48 gap-2 text-sm text-app-muted">
              <RefreshCw size={16} className="animate-spin" />
              Cargando usuarios...
            </div>
          ) : !isError && filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2.5 text-app-muted">
              <Inbox size={28} strokeWidth={1.5} />
              <p className="text-sm">
                {search ? 'Sin resultados para esta búsqueda' : 'No hay usuarios registrados'}
              </p>
            </div>
          ) : !isError ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-app-border">
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider whitespace-nowrap">
                      Nombre / Email
                    </th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider whitespace-nowrap">
                      Estado
                    </th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider whitespace-nowrap">
                      Plan
                    </th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider whitespace-nowrap">
                      Registrado
                    </th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-app-muted uppercase tracking-wider whitespace-nowrap">
                      Flight Rec.
                    </th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => (
                    <tr
                      key={user.id}
                      className={`border-b border-app-border last:border-0 transition-colors hover:bg-app-bg/60 ${
                        user.deleted_at ? 'opacity-50' : ''
                      } ${isFetching ? 'opacity-70' : ''}`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-app-text truncate max-w-[200px]">
                          {getDisplayName(user) || <span className="text-app-muted italic">Sin nombre</span>}
                        </div>
                        <div className="text-[12px] text-app-muted truncate max-w-[200px] mt-0.5">
                          {user.email}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {statusBadge(user)}
                      </td>
                      <td className="px-5 py-3.5">
                        <PlanBadge planKey={user.plan_key ?? 'starter'} />
                      </td>
                      <td className="px-5 py-3.5 text-[12px] text-app-muted whitespace-nowrap tabular-nums">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        {!user.deleted_at && (
                          <button
                            onClick={() => handleToggleFlightRecorder(user)}
                            disabled={actionLoading === user.id + '-flight'}
                            title={user.flight_recorder_enabled ? 'Desactivar grabación' : 'Activar grabación'}
                            className={`relative inline-flex flex-shrink-0 w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                              user.flight_recorder_enabled ? 'bg-emerald-500' : 'bg-app-border'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                                user.flight_recorder_enabled ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 justify-end">
                          {!user.deleted_at && (
                            <>
                              <button
                                onClick={() => setModal({ open: true, mode: 'edit', user })}
                                className="w-8 h-8 flex items-center justify-center rounded-9 text-app-muted hover:text-sage-strong hover:bg-sage-strong/10 transition-colors"
                                title="Editar"
                              >
                                <Pencil size={14} />
                              </button>

                              <button
                                onClick={() => handleToggleDisable(user)}
                                disabled={actionLoading === user.id + '-disable'}
                                className={`w-8 h-8 flex items-center justify-center rounded-9 transition-colors ${
                                  user.is_disabled
                                    ? 'text-app-muted hover:text-sage-strong hover:bg-sage-strong/10'
                                    : 'text-app-muted hover:text-amber-500 hover:bg-amber-50'
                                }`}
                                title={user.is_disabled ? 'Habilitar cuenta' : 'Deshabilitar cuenta'}
                              >
                                {actionLoading === user.id + '-disable' ? (
                                  <RefreshCw size={14} className="animate-spin" />
                                ) : user.is_disabled ? (
                                  <CheckCircle size={14} />
                                ) : (
                                  <Ban size={14} />
                                )}
                              </button>

                              <button
                                onClick={() => handleDelete(user)}
                                disabled={actionLoading === user.id + '-delete'}
                                className="w-8 h-8 flex items-center justify-center rounded-9 text-app-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                                title="Eliminar datos del usuario"
                              >
                                {actionLoading === user.id + '-delete' ? (
                                  <RefreshCw size={14} className="animate-spin" />
                                ) : (
                                  <Trash2 size={14} />
                                )}
                              </button>

                              <button
                                onClick={() => handleReconcile(user)}
                                disabled={reconcileLoading === user.id + '-reconcile'}
                                className="w-8 h-8 flex items-center justify-center rounded-9 text-app-muted hover:text-sage-strong hover:bg-sage-strong/10 transition-colors"
                                title="Reconciliar almacenamiento del diario"
                              >
                                {reconcileLoading === user.id + '-reconcile' ? (
                                  <RefreshCw size={14} className="animate-spin" />
                                ) : (
                                  <Wrench size={14} />
                                )}
                              </button>

                              <button
                                onClick={() => { setResetConfirmUser(user); setResetResult(null); setResetError(null); }}
                                title="Resetear datos del usuario"
                                className="w-8 h-8 flex items-center justify-center rounded-9 text-app-muted hover:text-amber-600 hover:bg-amber-50 transition-colors"
                              >
                                <RotateCcw size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      {modal.open && modal.mode === 'create' && (
        <UserModal
          mode="create"
          onClose={() => setModal({ open: false })}
          onSaved={() => { setModal({ open: false }); invalidate(); }}
        />
      )}

      {modal.open && modal.mode === 'edit' && (
        <UserModal
          mode="edit"
          user={modal.user}
          onClose={() => setModal({ open: false })}
          onSaved={() => { setModal({ open: false }); invalidate(); }}
        />
      )}

      {resetConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-app-surface border border-app-border rounded-[20px] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 pt-6 pb-5">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertTriangle size={18} className="text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-[15px] font-semibold text-app-text">
                    Reset user data?
                  </h2>
                  <p className="text-[13px] text-app-muted mt-1 leading-relaxed">
                    This will permanently delete all chats, journal entries, insights,
                    emails, token history, billing/usage history, and activity data for:
                  </p>
                  <p className="text-[13px] font-semibold text-app-text mt-2 truncate">
                    {resetConfirmUser.email}
                  </p>
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-[10px]">
                    <p className="text-[12px] text-amber-800 leading-relaxed">
                      The user account (email, password, profile) will remain intact.
                      Their experience will reset to a true blank first-time state.
                      <strong className="block mt-1">This action cannot be undone.</strong>
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-2.5 justify-end">
              <button
                onClick={() => setResetConfirmUser(null)}
                disabled={resetLoading}
                className="px-4 py-2 rounded-10 text-sm font-medium text-app-muted bg-app-bg border border-app-border hover:border-app-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={resetLoading}
                className="px-4 py-2 rounded-10 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {resetLoading ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <RotateCcw size={13} />
                )}
                {resetLoading ? 'Resetting...' : 'Yes, reset user'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
