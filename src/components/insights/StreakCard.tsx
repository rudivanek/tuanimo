import { Flame } from 'lucide-react';

interface MoodLog {
  local_date: string;
}

interface Props {
  moodLogs: MoodLog[];
  timezone?: string;
}

function getTodayLocalDate(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
}

function subtractOneDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  const y2 = dt.getFullYear();
  const m2 = String(dt.getMonth() + 1).padStart(2, '0');
  const d2 = String(dt.getDate()).padStart(2, '0');
  return `${y2}-${m2}-${d2}`;
}

export function computeStreak(logs: MoodLog[], timezone: string): { streak: number; lastCheckIn: string | null } {
  if (logs.length === 0) return { streak: 0, lastCheckIn: null };

  const dateSet = new Set(logs.map(l => l.local_date));
  const sortedDates = [...logs].sort((a, b) => b.local_date.localeCompare(a.local_date));
  const lastCheckIn = sortedDates[0].local_date;

  const todayStr = getTodayLocalDate(timezone);
  let streak = 0;
  let cursor = todayStr;

  while (dateSet.has(cursor)) {
    streak++;
    cursor = subtractOneDay(cursor);
  }

  return { streak, lastCheckIn };
}

function formatLocalDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('es', { weekday: 'long', month: 'long', day: 'numeric' });
}

function getMicroCopy(streak: number, lastCheckIn: string | null, todayStr: string): string {
  if (!lastCheckIn) return 'Tu primer registro tarda 10 segundos.';
  if (streak >= 3) return 'Los pequeños pasos suman.';
  if (streak === 0 && lastCheckIn !== todayStr) return '¿Quieres registrar hoy?';
  return '';
}

export function StreakCard({ moodLogs, timezone }: Props) {
  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const todayStr = getTodayLocalDate(tz);
  const { streak, lastCheckIn } = computeStreak(moodLogs, tz);
  const microCopy = getMicroCopy(streak, lastCheckIn, todayStr);

  return (
    <div className="bg-app-surface rounded-[16px] shadow-app border border-app-border p-5">
      <h2 className="text-[15px] font-semibold text-app-text mb-4 flex items-center gap-2">
        <Flame size={17} className="text-sage" />
        Consistencia
      </h2>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-app-bg rounded-14 border border-app-border px-4 py-3">
          <p className="text-[10px] font-semibold text-sage-strong uppercase tracking-wider mb-1">
            Racha actual
          </p>
          <p className="text-2xl font-bold text-app-text leading-none">
            {streak}
            <span className="text-sm font-medium text-app-muted ml-1">
              {streak === 1 ? 'día' : 'días'}
            </span>
          </p>
        </div>

        <div className="bg-app-bg rounded-14 border border-app-border px-4 py-3">
          <p className="text-[10px] font-semibold text-sage-strong uppercase tracking-wider mb-1">
            Último registro
          </p>
          {lastCheckIn ? (
            <p className="text-[12px] font-medium text-app-text leading-snug capitalize">
              {formatLocalDate(lastCheckIn)}
            </p>
          ) : (
            <p className="text-[12px] text-app-muted leading-snug">Sin registros aún</p>
          )}
        </div>
      </div>

      {microCopy && (
        <p className="text-[12px] text-app-muted mt-3 leading-relaxed">{microCopy}</p>
      )}
    </div>
  );
}
