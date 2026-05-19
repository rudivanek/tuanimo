import { BarChart2 } from 'lucide-react';

const MOOD_EMOJIS = ['😔', '😟', '😐', '🙂', '😊'] as const;
const MOOD_LABELS = ['Muy mal', 'Mal', 'Neutral', 'Bien', 'Muy bien'] as const;

interface MoodLog {
  emoji: string;
}

interface Props {
  moodLogs: MoodLog[];
}

export function MoodDistributionCard({ moodLogs }: Props) {
  if (moodLogs.length === 0) {
    return (
      <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5">
        <h2 className="text-[15px] font-semibold text-app-text mb-3 flex items-center gap-2">
          <BarChart2 size={17} className="text-sage" />
          Este mes
        </h2>
        <p className="text-sm text-app-muted leading-relaxed">
          Registra tu ánimo para ver el patrón mensual.
        </p>
      </div>
    );
  }

  const counts = MOOD_EMOJIS.reduce<Record<string, number>>((acc, e) => {
    acc[e] = 0;
    return acc;
  }, {});

  for (const log of moodLogs) {
    if (log.emoji in counts) {
      counts[log.emoji]++;
    }
  }

  const total = moodLogs.length;
  const positive = (counts['🙂'] ?? 0) + (counts['😊'] ?? 0);
  const neutral = counts['😐'] ?? 0;
  const hard = (counts['😔'] ?? 0) + (counts['😟'] ?? 0);

  return (
    <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5">
      <h2 className="text-[15px] font-semibold text-app-text mb-1 flex items-center gap-2">
        <BarChart2 size={17} className="text-sage" />
        Este mes
      </h2>
      <p className="text-xs text-app-muted mb-4">Últimos {total} registros</p>

      <div className="space-y-2.5 mb-4">
        {MOOD_EMOJIS.map((emoji, idx) => {
          const count = counts[emoji] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={emoji} className="flex items-center gap-3">
              <span className="text-xl w-7 flex-shrink-0 leading-none">{emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-app-muted">{MOOD_LABELS[idx]}</span>
                  <span className="text-[11px] font-medium text-app-text">{count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-app-surface-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-sage transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap pt-3 border-t border-app-border">
        {positive > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-medium">
            {positive} positivo{positive !== 1 ? 's' : ''}
          </span>
        )}
        {neutral > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-app-surface-2 text-app-muted rounded-full text-[11px] font-medium">
            {neutral} neutral{neutral !== 1 ? 'es' : ''}
          </span>
        )}
        {hard > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 rounded-full text-[11px] font-medium">
            {hard} difícil{hard !== 1 ? 'es' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
