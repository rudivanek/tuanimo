// Per-user cost detail popup (admin → Usuarios, click on "Consumo").
// Data: admin_user_cost_detail(). Every figure by Hoy / Este ciclo / Total:
//   chat per model:  chats, palabras (aprox.), tokens, costo
//   background:      llamadas, tokens, costo (memories, titles, insights…)
//   voz (ElevenLabs): créditos, costo
//   dictado (Whisper): minutos, costo
// plus a grand total. All costs are estimates.
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, MessageSquare, Cpu, Volume2, Mic, Sigma, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

export type CostDetailRow = {
  user_id: string;
  cycle_start: string | null;
  cycle_end: string | null;
  section: 'chat' | 'background' | 'voice' | 'dictation';
  label: string;
  detail: string | null;
  replies_today: number; replies_cycle: number; replies_total: number;
  chats_today: number | null; chats_cycle: number | null; chats_total: number | null;
  tokens_today: number | null; tokens_cycle: number | null; tokens_total: number | null;
  words_today: number | null; words_cycle: number | null; words_total: number | null;
  credits_today: number | null; credits_cycle: number | null; credits_total: number | null;
  minutes_today: number | null; minutes_cycle: number | null; minutes_total: number | null;
  cost_today: number; cost_cycle: number; cost_total: number;
};

type Period = 'today' | 'cycle' | 'total';
const PERIODS: Period[] = ['today', 'cycle', 'total'];

export async function fetchUserCostDetail(userIds: string[]): Promise<CostDetailRow[]> {
  const { data, error } = await supabase.rpc('admin_user_cost_detail', { p_user_ids: userIds });
  if (error) throw error;
  return ((data ?? []) as CostDetailRow[]).map(r => {
    const out: Record<string, unknown> = { ...r };
    for (const [k, v] of Object.entries(r)) {
      if (/_(today|cycle|total)$/.test(k)) out[k] = v == null ? null : Number(v);
    }
    return out as CostDetailRow;
  });
}

const MODEL_NAMES: Record<string, string> = {
  'claude-sonnet-5': 'Claude Sonnet 5',
  'claude-sonnet-4-6': 'Claude Sonnet 4.6',
  'claude-haiku-4-5': 'Claude Haiku 4.5',
  'claude-haiku-4-5-20251001': 'Claude Haiku 4.5',
  'claude-opus-4-6': 'Claude Opus 4.6',
  'gpt-4o-mini': 'GPT-4o mini',
  'eleven_multilingual_v2': 'Multilingual v2',
  'eleven_flash_v2_5': 'Flash v2.5',
  'eleven_v3': 'Eleven v3',
  'whisper-1': 'Whisper',
};
export const modelName = (m: string) => MODEL_NAMES[m] ?? m;

const num = (n: number | null | undefined, d = 0) =>
  n == null ? '—' : Number(n).toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });
const short = (n: number | null | undefined) => {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}k`;
  return num(n);
};
export const usd = (n: number | null | undefined) => {
  const v = Number(n ?? 0);
  return v > 0 && v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`;
};
const pick = (r: CostDetailRow, metric: string, p: Period) =>
  (r as unknown as Record<string, number | null>)[`${metric}_${p}`];

export function sumCost(rows: CostDetailRow[], p: Period) {
  return rows.reduce((s, r) => s + Number(pick(r, 'cost', p) ?? 0), 0);
}

function MetricTable({ rows }: { rows: Array<{ label: string; values: string[]; strong?: boolean }> }) {
  return (
    <table className="w-full text-[12px] tabular-nums table-fixed">
      <thead>
        <tr className="text-app-muted">
          <th className="text-left font-normal py-1 w-[38%]" />
          <th className="text-right font-normal py-1">Hoy</th>
          <th className="text-right font-normal py-1">Este ciclo</th>
          <th className="text-right font-normal py-1">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.label} className="border-t border-app-border">
            <td className={`py-1.5 ${r.strong ? 'text-app-text font-semibold' : 'text-app-muted'}`}>{r.label}</td>
            {r.values.map((v, i) => (
              <td key={i} className={`py-1.5 text-right ${r.strong ? 'text-app-text font-semibold' : 'text-app-text'}`}>{v}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Section({ icon, title, tag, children }: { icon: React.ReactNode; title: string; tag?: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-1 text-[13px] font-semibold text-app-text">
        {icon}
        <span>{title}</span>
        {tag && <span className="text-[10px] font-normal text-app-muted bg-app-surface-2 rounded-full px-2 py-0.5 truncate max-w-[260px]">{tag}</span>}
      </div>
      {children}
    </div>
  );
}

export function UserCostModal({ userId, name, email, plan, onClose }: {
  userId: string;
  name: string;
  email: string;
  plan?: string;
  onClose: () => void;
}) {
  const { data: rows = [], isLoading, error } = useQuery<CostDetailRow[]>({
    queryKey: ['admin', 'user-cost-detail', userId],
    queryFn: () => fetchUserCostDetail([userId]),
    staleTime: 30_000,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const chat = rows.filter(r => r.section === 'chat');
  const bg = rows.filter(r => r.section === 'background');
  const voice = rows.filter(r => r.section === 'voice');
  const dict = rows.filter(r => r.section === 'dictation');
  const cs = rows[0]?.cycle_start, ce = rows[0]?.cycle_end;
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'America/Mexico_City' });

  const totalLine = (label: string, group: CostDetailRow[], strong = false) =>
    ({ label, values: PERIODS.map(p => usd(sumCost(group, p))), strong });

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 p-4 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Costos de ${name || email}`}
    >
      <div
        className="w-full max-w-[640px] bg-app-surface border border-app-border rounded-[16px] shadow-app p-5 my-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-sage-strong/10 text-sage-strong flex items-center justify-center font-semibold">
            {(name || email || '?').trim().charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-app-text truncate">{name || email}</p>
            <p className="text-[12px] text-app-muted truncate">
              {email}{plan ? ` · ${plan.toUpperCase()}` : ''}{cs && ce ? ` · ciclo ${fmtDate(cs)} → ${fmtDate(ce)}` : ''}
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-[8px] text-app-muted hover:text-app-text hover:bg-app-surface-2">
            <X size={16} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10"><RefreshCw size={18} className="animate-spin text-app-muted" /></div>
        ) : error ? (
          <div className="flex items-center gap-2 mt-4 text-sm text-red-700"><AlertCircle size={14} /> {(error as Error).message}</div>
        ) : rows.length === 0 ? (
          <p className="mt-6 text-sm text-app-muted">Este usuario todavía no tiene consumo registrado.</p>
        ) : (
          <>
            {chat.map(r => (
              <Section key={`chat-${r.label}`} icon={<MessageSquare size={14} className="text-sage-strong" />} title={`Chat · ${modelName(r.label)}`} tag="modelo de chat">
                <MetricTable rows={[
                  { label: 'Chats', values: PERIODS.map(p => num(pick(r, 'chats', p))) },
                  { label: 'Palabras (aprox.)', values: PERIODS.map(p => num(pick(r, 'words', p))) },
                  { label: 'Tokens', values: PERIODS.map(p => short(pick(r, 'tokens', p))) },
                  { label: 'Costo', values: PERIODS.map(p => usd(pick(r, 'cost', p))), strong: true },
                ]} />
              </Section>
            ))}

            {bg.map(r => (
              <Section key={`bg-${r.label}`} icon={<Cpu size={14} className="text-app-muted" />} title={`Tareas de fondo · ${modelName(r.label)}`} tag={r.detail ?? undefined}>
                <MetricTable rows={[
                  { label: 'Llamadas', values: PERIODS.map(p => num(pick(r, 'replies', p))) },
                  { label: 'Tokens', values: PERIODS.map(p => short(pick(r, 'tokens', p))) },
                  { label: 'Costo', values: PERIODS.map(p => usd(pick(r, 'cost', p))), strong: true },
                ]} />
              </Section>
            ))}

            {voice.map(r => (
              <Section key={`voice-${r.label}`} icon={<Volume2 size={14} className="text-sage-strong" />} title="Voz · ElevenLabs" tag={modelName(r.label)}>
                <MetricTable rows={[
                  { label: 'Créditos', values: PERIODS.map(p => num(pick(r, 'credits', p))) },
                  { label: 'Costo', values: PERIODS.map(p => usd(pick(r, 'cost', p))), strong: true },
                ]} />
              </Section>
            ))}

            <Section icon={<Mic size={14} className="text-sage-strong" />} title="Dictado · OpenAI Whisper">
              {dict.length === 0 ? (
                <p className="text-[12px] text-app-muted py-1">Sin dictados registrados.</p>
              ) : dict.map(r => (
                <MetricTable key={`dict-${r.label}`} rows={[
                  { label: 'Minutos', values: PERIODS.map(p => num(pick(r, 'minutes', p), 1)) },
                  { label: 'Costo', values: PERIODS.map(p => usd(pick(r, 'cost', p))), strong: true },
                ]} />
              ))}
            </Section>

            <Section icon={<Sigma size={14} className="text-app-text" />} title="Gran total">
              <MetricTable rows={[
                totalLine('Chat (todos los modelos)', chat),
                ...(bg.length ? [totalLine('Tareas de fondo', bg)] : []),
                totalLine('Voz', voice),
                totalLine('Dictado', dict),
                totalLine('Costo total', rows, true),
              ]} />
            </Section>

            <p className="mt-4 text-[11px] text-app-muted">
              Costos estimados. Palabras = palabras que escribió Elena, calculadas a partir de los tokens (los mensajes están cifrados).
              Voz y dictado se cuentan desde que se activó su registro.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
