import { useState } from 'react';
import { Link } from 'wouter';
import { ChevronLeft, DatabaseZap } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { useProfile } from '../../hooks/useProfile';
import { supabase } from '../../lib/supabaseClient';
import { decryptForUser } from '../../lib/encryption';
import { extractChatSignalsWeighted } from '../../lib/chatSignals';
import type { ChatMessageWithTime } from '../../lib/chatSignals';

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
}

function daysInRange(from: string, to: string): string[] {
  const days: string[] = [];
  let cur = from;
  while (cur <= to) {
    days.push(cur);
    cur = addDays(cur, 1);
  }
  return days;
}

const today = toIsoDate(new Date());
const defaultFrom = toIsoDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

type RunStatus = 'idle' | 'running' | 'done' | 'error';

export function ChatSignalBackfillPage() {
  const { data: isAdmin } = useAdmin();
  const { data: profile } = useProfile();

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(today);
  const [status, setStatus] = useState<RunStatus>('idle');
  const [log, setLog] = useState<string[]>([]);

  function appendLog(line: string) {
    setLog((prev) => [...prev, line]);
  }

  async function runBackfill() {
    if (!profile) {
      setLog(['Error: no profile available.']);
      setStatus('error');
      return;
    }

    const days = daysInRange(from, to);
    if (days.length === 0) {
      setLog(['No days in range.']);
      setStatus('error');
      return;
    }

    setLog([]);
    setStatus('running');
    appendLog(`Starting backfill for ${days.length} day(s): ${from} → ${to}`);

    let upserted = 0;
    let skipped = 0;
    let warnings = 0;

    try {
      for (let i = 0; i < days.length; i++) {
        const day = days[i];

        const dayStart = day + 'T00:00:00.000Z';
        const dayEnd = day + 'T23:59:59.999Z';

        const { data, error } = await supabase
          .from('chat_messages')
          .select('sender, content_enc, enc_version, created_at')
          .eq('sender', 'user')
          .gte('created_at', dayStart)
          .lte('created_at', dayEnd)
          .order('created_at', { ascending: true })
          .limit(500);

        if (error) {
          appendLog(`  [${day}] query error: ${error.message}`);
          warnings++;
          await new Promise((r) => setTimeout(r, 150));
          continue;
        }

        const rows = data ?? [];

        if (rows.length === 500) {
          appendLog(`  [${day}] WARNING: hit 500-row limit — scores may be partial`);
          warnings++;
        }

        if (rows.length === 0) {
          skipped++;
          await new Promise((r) => setTimeout(r, 150));
          continue;
        }

        let messages: ChatMessageWithTime[] = [];
        try {
          messages = await Promise.all(
            rows.map(async (msg) => ({
              role: 'user' as const,
              content: await decryptForUser(msg.content_enc, profile),
              created_at: msg.created_at as string,
            }))
          );
        } catch {
          appendLog(`  [${day}] decrypt error — skipping day`);
          warnings++;
          await new Promise((r) => setTimeout(r, 150));
          continue;
        }

        const endOfDay = new Date(day + 'T23:59:59');
        const signals = extractChatSignalsWeighted(messages, endOfDay);

        const entries = [
          { signal_type: 'positive', score: signals.positive },
          { signal_type: 'stress', score: signals.stress },
          { signal_type: 'anxiety', score: signals.anxiety },
          { signal_type: 'gratitude', score: signals.gratitude },
        ] as const;

        const nonZero = entries.filter((e) => e.score > 0);

        if (nonZero.length === 0) {
          skipped++;
          await new Promise((r) => setTimeout(r, 150));
          continue;
        }

        for (const e of nonZero) {
          const { error: rpcErr } = await supabase.rpc('upsert_chat_signal_daily_agg', {
            p_signal_date: day,
            p_signal_type: e.signal_type,
            p_score: e.score,
            p_message_count: messages.length,
          });
          if (rpcErr) {
            appendLog(`  [${day}] upsert error (${e.signal_type}): ${rpcErr.message}`);
            warnings++;
          } else {
            upserted++;
          }
        }

        appendLog(
          `  [${day}] msgs=${messages.length} → pos=${signals.positive} str=${signals.stress} anx=${signals.anxiety} grat=${signals.gratitude}`
        );

        if ((i + 1) % 7 === 0) {
          appendLog(`  --- chunk complete (${i + 1}/${days.length}) ---`);
        }

        await new Promise((r) => setTimeout(r, 150));
      }

      appendLog(
        `Done. Upserted=${upserted} rows, skipped=${skipped} empty days, warnings=${warnings}.`
      );
      setStatus('done');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      appendLog(`Fatal error: ${msg}`);
      setStatus('error');
    }
  }

  if (!isAdmin) {
    return (
      <div
        className="bg-app-bg p-5 flex items-center justify-center"
        style={{ minHeight: 'calc(100dvh - var(--chrome-total))' }}
      >
        <p className="text-sm text-app-muted">Acceso restringido.</p>
      </div>
    );
  }

  return (
    <div
      className="bg-app-bg p-5 space-y-5"
      style={{
        minHeight: 'calc(100dvh - var(--chrome-total))',
        paddingBottom: 'calc(var(--nav-total) + 1.5rem)',
      }}
    >
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Link
            href="/app/admin"
            className="p-2 hover:bg-app-surface-2 rounded-xl transition-colors text-app-muted hover:text-app-text"
          >
            <ChevronLeft size={20} />
          </Link>
          <div className="w-9 h-9 rounded-12 bg-sage-strong/10 flex items-center justify-center">
            <DatabaseZap size={17} className="text-sage-strong" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-app-text">Backfill Chat Signal Aggregates</h1>
            <p className="text-sm text-app-muted">
              Recalculate <code className="text-xs">chat_signal_daily_agg</code> from historical messages
            </p>
          </div>
        </div>

        <div className="bg-app-surface border border-app-border rounded-[16px] shadow-app p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-app-muted mb-1.5">Date From</label>
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                disabled={status === 'running'}
                className="w-full border border-app-border rounded-12 px-3 py-2 text-sm text-app-text bg-app-bg focus:outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-muted mb-1.5">Date To</label>
              <input
                type="date"
                value={to}
                min={from}
                max={today}
                onChange={(e) => setTo(e.target.value)}
                disabled={status === 'running'}
                className="w-full border border-app-border rounded-12 px-3 py-2 text-sm text-app-text bg-app-bg focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={runBackfill}
              disabled={status === 'running' || !profile}
              className="bg-sage-strong text-white rounded-12 px-5 py-2.5 text-sm font-medium hover:bg-[#4e7260] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <DatabaseZap size={15} />
              {status === 'running' ? 'Running...' : 'Backfill chat aggregates'}
            </button>

            {status !== 'idle' && (
              <span
                className={`text-xs font-medium px-2 py-1 rounded-8 ${
                  status === 'running'
                    ? 'bg-blue-50 text-blue-700'
                    : status === 'done'
                    ? 'bg-sage-soft text-sage-strong'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {status}
              </span>
            )}
          </div>

          <div className="bg-app-bg border border-app-border rounded-12 text-xs font-mono text-app-muted p-3 min-h-[80px] max-h-64 overflow-y-auto whitespace-pre-wrap">
            {log.length === 0 ? (
              <span className="opacity-50">No output yet. Select a date range and run.</span>
            ) : (
              log.join('\n')
            )}
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-[16px] p-4 text-sm text-amber-800 space-y-1">
          <p className="font-semibold">Notes</p>
          <ul className="space-y-0.5 text-xs list-disc list-inside">
            <li>Processes up to 500 messages per day (warns if limit hit)</li>
            <li>150 ms delay between days to avoid rate limits</li>
            <li>Safe to re-run: uses upsert, existing rows are overwritten</li>
            <li>Only non-zero signals are written to the aggregate table</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
