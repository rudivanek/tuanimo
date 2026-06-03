import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Plus, Pencil, Trash2, Globe, Phone, Check, X, AlertCircle } from 'lucide-react';
import { Link } from 'wouter';
import { supabase } from '../../lib/supabaseClient';

interface CrisisResource {
  id: string;
  country_code: string;
  country_name: string;
  resource_name: string;
  description: string | null;
  phone: string | null;
  website: string | null;
  is_active: boolean;
  sort_order: number;
}

const EMPTY_FORM: Omit<CrisisResource, 'id'> = {
  country_code: '',
  country_name: '',
  resource_name: '',
  description: '',
  phone: '',
  website: '',
  is_active: true,
  sort_order: 0,
};

function CountryBadge({ code }: { code: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-6 text-[11px] font-semibold bg-app-bg border border-app-border text-app-muted uppercase tracking-wide">
      {code}
    </span>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-6 text-[11px] font-medium ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-app-bg text-app-muted border border-app-border'}`}>
      {active ? <Check size={10} /> : <X size={10} />}
      {active ? 'Activo' : 'Inactivo'}
    </span>
  );
}

export function CrisisResourcesPage() {
  const [resources, setResources] = useState<CrisisResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<CrisisResource, 'id'>>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadResources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('crisis_resources')
        .select('*')
        .order('country_code', { ascending: true })
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setResources(data ?? []);
    } catch (err) {
      setError('No se pudieron cargar los recursos.');
      console.error('[CrisisResourcesPage] load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSaveError(null);
    setShowForm(true);
  };

  const openEdit = (r: CrisisResource) => {
    setEditingId(r.id);
    setForm({
      country_code: r.country_code,
      country_name: r.country_name,
      resource_name: r.resource_name,
      description: r.description ?? '',
      phone: r.phone ?? '',
      website: r.website ?? '',
      is_active: r.is_active,
      sort_order: r.sort_order,
    });
    setSaveError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!form.country_code.trim() || !form.country_name.trim() || !form.resource_name.trim()) {
      setSaveError('País (código), nombre de país y nombre del recurso son obligatorios.');
      return;
    }
    if (!form.phone?.trim() && !form.website?.trim()) {
      setSaveError('Agrega al menos un teléfono o un sitio web.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        country_code: form.country_code.trim().toUpperCase(),
        country_name: form.country_name.trim(),
        resource_name: form.resource_name.trim(),
        description: form.description?.trim() || null,
        phone: form.phone?.trim() || null,
        website: form.website?.trim() || null,
        is_active: form.is_active,
        sort_order: Number(form.sort_order) || 0,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase
          .from('crisis_resources')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('crisis_resources')
          .insert(payload);
        if (error) throw error;
      }

      await loadResources();
      closeForm();
    } catch (err) {
      setSaveError('Error al guardar. Inténtalo de nuevo.');
      console.error('[CrisisResourcesPage] save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este recurso?')) return;
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from('crisis_resources')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setResources(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error('[CrisisResourcesPage] delete error:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const toggleActive = async (r: CrisisResource) => {
    try {
      const { error } = await supabase
        .from('crisis_resources')
        .update({ is_active: !r.is_active, updated_at: new Date().toISOString() })
        .eq('id', r.id);
      if (error) throw error;
      setResources(prev => prev.map(x => x.id === r.id ? { ...x, is_active: !x.is_active } : x));
    } catch (err) {
      console.error('[CrisisResourcesPage] toggle error:', err);
    }
  };

  // Group by country
  const byCountry = resources.reduce<Record<string, CrisisResource[]>>((acc, r) => {
    const key = `${r.country_code}|${r.country_name}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-app-bg">
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin">
            <button className="p-1.5 rounded-xl hover:bg-app-surface-2 transition-colors text-app-muted">
              <ChevronLeft size={18} />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-[18px] font-semibold text-app-text flex items-center gap-2">
              <AlertCircle size={18} className="text-danger" />
              Recursos de crisis
            </h1>
            <p className="text-xs text-app-muted mt-0.5">
              Líneas de ayuda por país — se muestran en el modal de crisis del chat.
            </p>
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 px-3 py-2 bg-sage-strong text-white rounded-10 text-[13px] font-medium hover:bg-[#4e7260] transition-colors"
          >
            <Plus size={14} />
            Agregar
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-12 px-4 py-3 text-sm text-red-700 mb-4 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={loadResources} className="text-xs underline ml-4">Reintentar</button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16 text-app-muted text-sm">
            Cargando recursos...
          </div>
        )}

        {/* Empty */}
        {!loading && !error && resources.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-app-muted text-sm gap-2">
            <AlertCircle size={24} className="opacity-30" />
            <p>No hay recursos configurados aún.</p>
            <button onClick={openNew} className="text-sage-strong text-sm font-medium hover:underline">
              Agregar el primero
            </button>
          </div>
        )}

        {/* Resources grouped by country */}
        {!loading && Object.entries(byCountry).map(([key, items]) => {
          const [code, name] = key.split('|');
          return (
            <div key={key} className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <CountryBadge code={code} />
                <span className="text-[13px] font-semibold text-app-text">{name}</span>
                <span className="text-xs text-app-muted">({items.length} recurso{items.length !== 1 ? 's' : ''})</span>
              </div>
              <div className="bg-app-surface border border-app-border rounded-14 overflow-hidden">
                {items.map((r, i) => (
                  <div
                    key={r.id}
                    className={`px-4 py-3.5 flex items-start gap-3 ${i < items.length - 1 ? 'border-b border-app-border' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-semibold text-app-text">{r.resource_name}</span>
                        <ActiveBadge active={r.is_active} />
                        {r.sort_order > 0 && (
                          <span className="text-[10px] text-app-muted">orden {r.sort_order}</span>
                        )}
                      </div>
                      {r.description && (
                        <p className="text-xs text-app-muted mt-0.5">{r.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {r.phone && (
                          <span className="flex items-center gap-1 text-[13px] text-sage-strong font-medium">
                            <Phone size={12} />
                            {r.phone}
                          </span>
                        )}
                        {r.website && (
                          <a
                            href={r.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[12px] text-app-muted hover:text-sage-strong transition-colors"
                          >
                            <Globe size={11} />
                            {r.website.replace('https://', '').replace('http://', '')}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => toggleActive(r)}
                        title={r.is_active ? 'Desactivar' : 'Activar'}
                        className="p-1.5 rounded-lg hover:bg-app-surface-2 transition-colors text-app-muted hover:text-app-text"
                      >
                        {r.is_active ? <X size={14} /> : <Check size={14} />}
                      </button>
                      <button
                        onClick={() => openEdit(r)}
                        className="p-1.5 rounded-lg hover:bg-app-surface-2 transition-colors text-app-muted hover:text-app-text"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        disabled={deletingId === r.id}
                        className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-app-muted hover:text-danger disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {!loading && resources.length > 0 && (
          <p className="text-xs text-app-muted text-center mt-2">
            Los recursos inactivos no se muestran en el modal. El país se detecta por el idioma del navegador del usuario.
          </p>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4" onClick={closeForm}>
          <div
            className="bg-app-surface rounded-2xl shadow-xl border border-app-border w-full max-w-md p-6 flex flex-col gap-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-app-text">
                {editingId ? 'Editar recurso' : 'Nuevo recurso'}
              </h2>
              <button onClick={closeForm} className="p-1 rounded-lg text-app-muted hover:text-app-text transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-app-muted uppercase tracking-wide mb-1">
                  Código país *
                </label>
                <input
                  type="text"
                  maxLength={3}
                  placeholder="MX"
                  value={form.country_code}
                  onChange={e => setForm(f => ({ ...f, country_code: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2 rounded-10 border border-app-border bg-app-bg text-app-text text-sm focus:outline-none focus:border-sage-strong"
                />
              </div>
              <div className="flex-[2]">
                <label className="block text-[11px] font-medium text-app-muted uppercase tracking-wide mb-1">
                  Nombre del país *
                </label>
                <input
                  type="text"
                  placeholder="México"
                  value={form.country_name}
                  onChange={e => setForm(f => ({ ...f, country_name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-10 border border-app-border bg-app-bg text-app-text text-sm focus:outline-none focus:border-sage-strong"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-app-muted uppercase tracking-wide mb-1">
                Nombre del recurso *
              </label>
              <input
                type="text"
                placeholder="SAPTEL"
                value={form.resource_name}
                onChange={e => setForm(f => ({ ...f, resource_name: e.target.value }))}
                className="w-full px-3 py-2 rounded-10 border border-app-border bg-app-bg text-app-text text-sm focus:outline-none focus:border-sage-strong"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-app-muted uppercase tracking-wide mb-1">
                Descripción
              </label>
              <input
                type="text"
                placeholder="Línea de intervención en crisis 24/7"
                value={form.description ?? ''}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 rounded-10 border border-app-border bg-app-bg text-app-text text-sm focus:outline-none focus:border-sage-strong"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-app-muted uppercase tracking-wide mb-1">
                  Teléfono
                </label>
                <input
                  type="text"
                  placeholder="55 5259-8121"
                  value={form.phone ?? ''}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 rounded-10 border border-app-border bg-app-bg text-app-text text-sm focus:outline-none focus:border-sage-strong"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-app-muted uppercase tracking-wide mb-1">
                  Orden
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.sort_order}
                  onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-10 border border-app-border bg-app-bg text-app-text text-sm focus:outline-none focus:border-sage-strong"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-app-muted uppercase tracking-wide mb-1">
                Sitio web
              </label>
              <input
                type="text"
                placeholder="https://saptel.org.mx"
                value={form.website ?? ''}
                onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                className="w-full px-3 py-2 rounded-10 border border-app-border bg-app-bg text-app-text text-sm focus:outline-none focus:border-sage-strong"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="is_active" className="text-sm text-app-text">Activo (visible en el modal)</label>
            </div>

            {saveError && (
              <p className="text-xs text-danger">{saveError}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={closeForm}
                className="flex-1 px-4 py-2.5 rounded-xl border border-app-border text-[13px] font-medium text-app-text hover:bg-app-surface-2 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-xl bg-sage-strong text-white text-[13px] font-medium hover:bg-[#4e7260] transition-colors disabled:opacity-40"
              >
                {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
