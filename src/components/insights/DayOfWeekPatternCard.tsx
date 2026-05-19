import { CalendarDays } from 'lucide-react';

interface MoodLog {
  local_date: string;
  emoji: string;
}

interface Props {
  moodLogs: MoodLog[];
}

const EMOJI_SCORE: Record<string, number> = {
  '😔': 1,
  '😟': 2,
  '😐': 3,
  '🙂': 4,
  '😊': 5,
};

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const WEEKDAY_LABELS: Record<number, string> = {
  0: 'Dom',
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
};

const WEEKDAY_FULL: Record<number, string> = {
  0: 'los domingos',
  1: 'los lunes',
  2: 'los martes',
  3: 'los miércoles',
  4: 'los jueves',
  5: 'los viernes',
  6: 'los sábados',
};

interface DayStats {
  dayIndex: number;
  count: number;
  sum: number;
  avg: number;
}

export function DayOfWeekPatternCard({ moodLogs: rawLogs }: Props) {
  const moodLogs = rawLogs.filter(l => l.emoji in EMOJI_SCORE);

  const statsMap: Record<number, { count: number; sum: number }> = {};
  for (const log of moodLogs) {
    const [y, m, d] = log.local_date.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const dow = dt.getDay();
    if (!statsMap[dow]) statsMap[dow] = { count: 0, sum: 0 };
    statsMap[dow].count++;
    statsMap[dow].sum += EMOJI_SCORE[log.emoji];
  }

  const days: DayStats[] = WEEKDAY_ORDER.map(idx => {
    const s = statsMap[idx];
    return {
      dayIndex: idx,
      count: s?.count ?? 0,
      sum: s?.sum ?? 0,
      avg: s ? s.sum / s.count : 0,
    };
  });

  const daysWithData = days.filter(d => d.count > 0);
  const totalLogs = moodLogs.length;
  const isInsufficient = totalLogs < 7 || daysWithData.length < 4;

  const maxAvg = days.reduce((m, d) => (d.count > 0 && d.avg > m ? d.avg : m), 0);

  let takeaway: string | null = null;
  if (!isInsufficient) {
    const qualified = daysWithData.filter(d => d.count >= 2);
    if (qualified.length >= 2) {
      const highest = qualified.reduce((a, b) => (b.avg > a.avg ? b : a));
      const lowest = qualified.reduce((a, b) => (b.avg < a.avg ? b : a));
      if (highest.avg - lowest.avg >= 0.8) {
        takeaway =
          `Tus días más difíciles suelen ser ${WEEKDAY_FULL[lowest.dayIndex]}. ` +
          `Tus días más estables suelen ser ${WEEKDAY_FULL[highest.dayIndex]}.`;
      } else {
        takeaway = 'Tu ánimo se ve bastante estable entre días — sigue registrando para afinar el patrón.';
      }
    } else {
      takeaway = 'Tu ánimo se ve bastante estable entre días — sigue registrando para afinar el patrón.';
    }
  }

  return (
    <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5">
      <h2 className="text-[15px] font-semibold text-app-text mb-1 flex items-center gap-2">
        <CalendarDays size={17} className="text-sage" />
        Patrones por día
      </h2>
      <p className="text-xs text-app-muted mb-4">Basado en tus últimos {rawLogs.length} check-ins.</p>

      {isInsufficient ? (
        <p className="text-sm text-app-muted leading-relaxed">
          Registra algunos días más para ver patrones por día de la semana.
        </p>
      ) : (
        <>
          <div className="space-y-2.5 mb-4">
            {days.map(({ dayIndex, count, avg }) => {
              const fillPct = maxAvg > 0 && count > 0 ? (avg / 5) * 100 : 0;
              const dots = count > 0 ? Math.round(avg) : 0;

              return (
                <div key={dayIndex} className="flex items-center gap-3">
                  <span className="text-[12px] font-medium text-app-muted w-7 flex-shrink-0">
                    {WEEKDAY_LABELS[dayIndex]}
                  </span>

                  <div className="flex-1 min-w-0">
                    {count > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-app-surface-2 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-sage transition-all duration-500"
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                        <div className="flex gap-0.5 flex-shrink-0">
                          {[1, 2, 3, 4, 5].map(n => (
                            <span
                              key={n}
                              className={`inline-block w-2 h-2 rounded-full ${
                                n <= dots ? 'bg-sage-strong' : 'bg-app-border'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="h-2 rounded-full bg-app-border/40" />
                    )}
                  </div>

                  <span className="text-[11px] text-app-muted w-10 text-right flex-shrink-0">
                    {count > 0 ? `n=${count}` : '—'}
                  </span>
                </div>
              );
            })}
          </div>

          {takeaway && (
            <p className="text-xs text-app-muted leading-relaxed pt-3 border-t border-app-border">
              {takeaway}
            </p>
          )}
        </>
      )}
    </div>
  );
}
