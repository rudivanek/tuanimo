import { supabase } from './supabaseClient';

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  plan_key: string;
  is_disabled: boolean;
  is_admin_user: boolean;
  deleted_at: string | null;
  created_at: string;
  flight_recorder_enabled: boolean;
}

export function getDisplayName(user: AdminUser): string {
  if (user.first_name) {
    return [user.first_name, user.last_name].filter(Boolean).join(' ');
  }
  return user.full_name || '';
}

export async function listUsers(search = '', includeDeleted = false): Promise<AdminUser[]> {
  const { data, error } = await supabase.rpc('admin_list_users', {
    p_search: search.trim() || null,
    p_include_deleted: includeDeleted,
  });
  if (error) throw error;
  return (data ?? []) as AdminUser[];
}

export async function upsertUserProfile(params: {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  plan_key: string;
  is_disabled: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc('admin_upsert_user_profile', {
    p_user_id: params.user_id,
    p_first_name: params.first_name,
    p_last_name: params.last_name,
    p_plan_key: params.plan_key,
    p_is_disabled: params.is_disabled,
  });
  if (error) throw error;
}

export async function softDeleteUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_soft_delete_user', {
    p_user_id: userId,
  });
  if (error) throw error;
}

export async function purgeUserData(userId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_purge_user_data', {
    p_user_id: userId,
  });
  if (error) throw error;
}

export interface ResetUserResult {
  success: boolean;
  deleted_chat_threads: number;
  deleted_journal_entries: number;
  deleted_token_rows: number;
  deleted_mood_rows: number;
  deleted_memory_rows: number;
  deleted_signal_rows: number;
  profile_reset: boolean;
}

export async function resetUserData(userId: string): Promise<ResetUserResult> {
  const { data, error } = await supabase.rpc('admin_reset_user_data', {
    p_user_id: userId,
  });
  if (error) throw error;
  return data as ResetUserResult;
}

export async function createUser(params: {
  email: string;
  first_name: string;
  last_name: string;
  plan_key: string;
  password?: string;
}): Promise<{ user_id: string; email: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('No hay sesión activa. Por favor recarga la página.');
  const token = session.access_token;

  const res = await fetch(`${FUNCTIONS_URL}/admin-create-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify(params),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Error al crear usuario');
  return json as { user_id: string; email: string };
}

export interface ReconcileResult {
  users_updated: number;
  entries_fixed: number;
}

export async function reconcileJournalStorage(userId?: string): Promise<ReconcileResult> {
  const { data, error } = await supabase.rpc('admin_reconcile_journal_storage', {
    p_user_id: userId ?? null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as unknown as ReconcileResult;
}

export async function updateUserPassword(userId: string, password: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('No hay sesión activa. Por favor recarga la página.');
  const token = session.access_token;

  const res = await fetch(`${FUNCTIONS_URL}/admin-update-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({ user_id: userId, password }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Error al actualizar contraseña');
}
