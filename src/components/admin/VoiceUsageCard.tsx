// Voice beta — estimated ElevenLabs cost per user, from tts_usage via admin_tts_usage().
// An estimate (characters x model rate x price per credit); the ElevenLabs usage page is the real bill.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Volume2, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

type Row = {
  user_id: string;
  email: string | null;
  name: string | null;
  replies: number;
  previews: number;
  characters: number;
  credits: number;
  est_cost_usd: number;
  last_at: string | null;
};

type Range = 'month' | '30d' | 'all';

function sinceFor(range: Range): string | null {
  const now = new Date();
  if (range === 'all') return null;
  if (range === '30d') return new Date(now.getTime() - 30 * 86_400_000).toISOString();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

const usd = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: n < 1 ? 4 : 2, maximumFractionDigits: n < 1 ? 4 : 2 })}`;
const num = (n: number) => Number(n).toLocaleString('es-MX');

export function VoiceUsageCard() {
  const [range, setRange] = useState<Range>('month');

  const { data: rows = [], isLoading, error, refetch, isFetching } = useQuery<Row[]>({
    queryKey: ['admin', 'tts-usage', range],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_tts_usage', { p_since: sinceFor(range) });
      if (error) throw error;
      return (data as Row[]) ?? [];
    },
    staleTime: 30_000,
  });

  const total = rows.reduce(
    (t, r) => ({
      replies: t.replies + Number(r.replies) + Number(r.previews),
      characters: t.characters + Number(r.characters),
      credits: t.credits + Number(r.credits),
      cost: t.cost + Number(r.est_cost_usd),
    }),
    { replies: 0, characters: 0, credits: 0, cost: 0 },
  );

  return (
    <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app overflow-hidden">
      <div className="px-5 py-4 border-b border-app-border flex flex-wrap items-center gap-3">
        <Volume2 size={16} className="text-sage-strong" />
        <div className="flex-1 min-w-[200px]">
          <h2 className="text-[13px] font-semibold text-app-text uppercase tracking-wider">Voz de Elena · costo por usuario</h2>
          <p className="text-xs text-app-muted">
            Estimado de ElevenLabs (caracteres × tarifa del modelo × precio por crédito). El cobro real está en tu cuenta de ElevenLabs.
          </p>
        </div>
        <select
          value={range}
          onChange={e => setRange(e.target.value as Range)}
          className="rounded-[10px] border border-app-border bg-app-bg px-2 py-1.5 text-xs text-app-text"
        >
          <option value="month">Este mes</option>
          <option value="30d">Últimos 30 días</option>
          <option value="all">Todo</option>
        </select>
        <button
          onClick={() => refetch()}
          className="p-1.5 rounded-[8px] border border-app-border text-app-muted hover:text-sage-strong"
          title="Actualizar"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><RefreshCw size={16} className="animate-spin text-app-muted" /></div>
      ) : error ? (
        <div className="flex items-center gap-2 px-5 py-4 text-sm text-red-700">
          <AlertCircle size={14} /> {(error as Error).message}
        </div>
      ) : rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-app-muted">Elena no ha hablado en este periodo.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-app-muted uppercase tracking-wider">
                <th className="text-left px-5 py-2.5 font-semibold">Usuario</th>
                <th className="text-right px-3 py-2.5 font-semibold">Respuestas</th>
                <th className="text-right px-3 py-2.5 font-semibold">Caracteres</th>
                <th className="text-right px-3 py-2.5 font-semibold">Créditos</th>
                <th className="text-right px-5 py-2.5 font-semibold">Costo est.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.user_id} className="border-t border-app-border">
                  <td className="px-5 py-2.5">
                    <div className="text-app-text font-medium truncate max-w-[240px]">{r.name || r.email || r.user_id}</div>
                    {r.name && r.email && <div className="text-[11px] text-app-muted truncate max-w-[240px]">{r.email}</div>}
                    {Number(r.previews) > 0 && (
                      <div className="text-[11px] text-app-muted">incluye {num(r.previews)} pruebas en el admin</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-app-text">{num(r.replies)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-app-text">{num(r.characters)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-app-text">{num(Math.round(Number(r.credits)))}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-sage-strong">{usd(Number(r.est_cost_usd))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-app-border text-app-text">
                <td className="px-5 py-2.5 font-semibold">Total</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{num(total.replies)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{num(total.characters)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{num(Math.round(total.credits))}</td>
                <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-sage-strong">{usd(total.cost)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
