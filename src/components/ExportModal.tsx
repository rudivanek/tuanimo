import { useState, useEffect } from 'react';
import { Download, Copy, Share2, X, FileText, Check, AlertCircle } from 'lucide-react';
import type { ExportFormat, ExportResult } from '../lib/exportUtils';
import { downloadContent, copyToClipboard, shareFile, canShare } from '../lib/exportUtils';

interface ExportModalProps {
  onClose: () => void;
  getExport: (format: ExportFormat) => ExportResult;
  title?: string;
}

type ToastState = { type: 'success' | 'error'; message: string } | null;

export function ExportModal({ onClose, getExport, title = 'Exportar' }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('md');
  const [toast, setToast] = useState<ToastState>(null);
  const [downloading, setDownloading] = useState(false);
  const showShare = canShare();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
  };

  const handleDownload = () => {
    setDownloading(true);
    try {
      const result = getExport(format);
      downloadContent(result.filename, result.mime, result.content);
      showToast('success', `Descargando ${result.filename}`);
    } catch {
      showToast('error', 'No se pudo descargar el archivo');
    } finally {
      setDownloading(false);
    }
  };

  const handleCopy = async () => {
    try {
      const result = getExport(format);
      const ok = await copyToClipboard(result.content);
      if (ok) {
        showToast('success', 'Copiado al portapapeles');
      } else {
        showToast('error', 'No se pudo copiar');
      }
    } catch {
      showToast('error', 'No se pudo copiar');
    }
  };

  const handleShare = async () => {
    try {
      const result = getExport(format);
      const ok = await shareFile(result.filename, result.mime, result.content);
      if (!ok) showToast('error', 'No se pudo compartir');
    } catch {
      showToast('error', 'No se pudo compartir');
    }
  };

  const formatLabel = format === 'md' ? 'Markdown (.md)' : 'Texto plano (.txt)';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        className="relative z-10 w-full sm:w-auto sm:min-w-[380px] sm:max-w-[440px] bg-app-surface rounded-t-[24px] sm:rounded-[20px] shadow-2xl overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-app-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sage-soft flex items-center justify-center flex-shrink-0">
              <FileText size={16} className="text-sage-strong" />
            </div>
            <h2 className="text-[15px] font-semibold text-app-text">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl hover:bg-app-surface-2 flex items-center justify-center text-app-muted hover:text-app-text transition-colors"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs font-medium text-app-muted uppercase tracking-wide mb-3">Formato</p>
          <div className="flex gap-2">
            {(['md', 'txt'] as ExportFormat[]).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`flex-1 py-2.5 px-4 rounded-12 text-sm font-medium border transition-all ${
                  format === f
                    ? 'bg-sage-strong text-white border-sage-strong shadow-sm'
                    : 'bg-app-bg text-app-text border-app-border hover:bg-app-surface-2'
                }`}
              >
                {f === 'md' ? 'Markdown' : 'Texto plano'}
              </button>
            ))}
          </div>
          <p className="text-xs text-app-muted mt-2 text-center">{formatLabel}</p>
        </div>

        <div className="px-5 pb-5 flex flex-col gap-2.5">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full flex items-center justify-center gap-2.5 bg-sage-strong hover:bg-[#4e7260] disabled:opacity-50 text-white rounded-14 py-3 px-4 text-sm font-semibold transition-colors"
          >
            <Download size={16} />
            Descargar
          </button>

          <div className="flex gap-2.5">
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-2 border border-app-border bg-app-bg hover:bg-app-surface-2 text-app-text rounded-14 py-3 px-4 text-sm font-medium transition-colors"
            >
              <Copy size={15} />
              Copiar
            </button>

            {showShare && (
              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-2 border border-app-border bg-app-bg hover:bg-app-surface-2 text-app-text rounded-14 py-3 px-4 text-sm font-medium transition-colors"
              >
                <Share2 size={15} />
                Compartir
              </button>
            )}
          </div>
        </div>

        {toast && (
          <div
            className={`mx-5 mb-5 flex items-center gap-2.5 px-4 py-3 rounded-12 text-sm font-medium transition-all ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {toast.type === 'success'
              ? <Check size={15} className="flex-shrink-0" />
              : <AlertCircle size={15} className="flex-shrink-0" />
            }
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}
