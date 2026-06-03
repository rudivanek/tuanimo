import { useEffect, useState } from 'react';
import { AlertCircle, Phone, Globe, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface CrisisResource {
  id: string;
  resource_name: string;
  description: string | null;
  phone: string | null;
  website: string | null;
}

interface CrisisResourceModalProps {
  onClose: () => void;
}

// Detect country code from browser locale (e.g. 'es-MX' → 'MX', 'es-AR' → 'AR')
function detectCountryCode(): string {
  try {
    const lang = navigator.language || navigator.languages?.[0] || '';
    const parts = lang.split('-');
    if (parts.length >= 2) return parts[parts.length - 1].toUpperCase();
  } catch {
    // ignore
  }
  return 'MX'; // fallback
}

export function CrisisResourceModal({ onClose }: CrisisResourceModalProps) {
  const [resources, setResources] = useState<CrisisResource[]>([]);
  const [countryName, setCountryName] = useState('México');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const detectedCode = detectCountryCode();

    async function load() {
      setLoading(true);
      try {
        // Try detected country first
        const { data: countryData } = await supabase
          .from('crisis_resources')
          .select('id, resource_name, description, phone, website, country_name')
          .eq('country_code', detectedCode)
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (countryData && countryData.length > 0) {
          setCountryName(countryData[0].country_name);
          setResources(countryData);
          return;
        }

        // Fallback to Mexico
        const { data: fallbackData } = await supabase
          .from('crisis_resources')
          .select('id, resource_name, description, phone, website, country_name')
          .eq('country_code', 'MX')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (fallbackData && fallbackData.length > 0) {
          setCountryName(fallbackData[0].country_name);
          setResources(fallbackData);
        }
      } catch (err) {
        console.error('[CrisisResourceModal] Failed to load resources:', err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <div className="fixed inset-0 bg-app-text/40 backdrop-blur-sm flex items-center justify-center z-50 p-5">
      <div className="bg-app-surface rounded-[18px] shadow-app max-w-sm w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-red-50 rounded-full flex items-center justify-center">
              <AlertCircle className="text-danger" size={18} />
            </div>
            <h3 className="text-[16px] font-semibold text-app-text">
              Ayuda en {countryName}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-app-surface-2 rounded-xl transition-colors text-app-muted"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-app-muted mb-4">
          Si estás pasando por una crisis o necesitas apoyo profesional inmediato:
        </p>

        {loading && (
          <div className="bg-sage-soft rounded-14 p-4 text-sm text-app-muted text-center">
            Cargando recursos...
          </div>
        )}

        {!loading && resources.length === 0 && (
          <div className="bg-sage-soft rounded-14 p-4 text-sm text-app-muted text-center">
            Por favor busca una línea de crisis local o acude a urgencias.
          </div>
        )}

        {!loading && resources.length > 0 && (
          <div className="bg-sage-soft rounded-14 p-4 space-y-4">
            {resources.map((r, i) => (
              <div key={r.id} className={i > 0 ? 'border-t border-sage-soft pt-4' : ''}>
                <div className="text-sm font-semibold text-app-text">{r.resource_name}</div>
                {r.phone && (
                  <a
                    href={`tel:${r.phone.replace(/\s/g, '')}`}
                    className="text-sage-strong hover:underline text-lg font-medium flex items-center gap-1.5 mt-0.5"
                  >
                    <Phone size={14} />
                    {r.phone}
                  </a>
                )}
                {r.website && (
                  <a
                    href={r.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sage-strong hover:underline text-sm flex items-center gap-1.5 mt-0.5"
                  >
                    <Globe size={12} />
                    {r.website.replace('https://', '').replace('http://', '')}
                  </a>
                )}
                {r.description && (
                  <p className="text-xs text-app-muted mt-0.5">{r.description}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-app-muted mt-3">
          Estos servicios son confidenciales y están atendidos por profesionales capacitados.
        </p>
        <button
          onClick={onClose}
          className="mt-4 w-full bg-sage-strong text-white rounded-12 px-4 py-2.5 hover:bg-[#4e7260] transition-colors text-sm font-medium"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
