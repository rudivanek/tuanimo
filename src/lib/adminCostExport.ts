// Admin → Usuarios: export the selected users' costs to Excel (.xlsx).
// Two sheets, same data as the cost popup (admin_user_cost_detail):
//   Resumen — one row per user: cost of chat / background / voice / dictation
//             and total, for Hoy, Este ciclo and Total.
//   Detalle — one row per user and model, with every metric of the popup.
// All costs are estimates.
import * as XLSX from 'xlsx';
import { fetchUserCostDetail, modelName, type CostDetailRow } from '../components/admin/UserCostModal';
import { getDisplayName, type AdminUser } from './adminUsers';

const PERIODS = [
  { key: 'today', label: 'Hoy' },
  { key: 'cycle', label: 'Ciclo' },
  { key: 'total', label: 'Total' },
] as const;

const SECTION_LABEL: Record<CostDetailRow['section'], string> = {
  chat: 'Chat',
  background: 'Tareas de fondo',
  voice: 'Voz (ElevenLabs)',
  dictation: 'Dictado (Whisper)',
};

const round = (n: number | null | undefined, d = 4) =>
  n == null ? null : Math.round(Number(n) * 10 ** d) / 10 ** d;

const date = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' }) : '';

function get(r: CostDetailRow, metric: string, period: string): number | null {
  const v = (r as unknown as Record<string, number | null>)[`${metric}_${period}`];
  return v == null ? null : Number(v);
}

export async function exportUsersCostXlsx(
  users: AdminUser[],
  lastActiveById: Record<string, string | null>,
): Promise<void> {
  if (users.length === 0) return;
  const rows = await fetchUserCostDetail(users.map(u => u.id));
  const byUser = new Map<string, CostDetailRow[]>();
  for (const r of rows) {
    const list = byUser.get(r.user_id) ?? [];
    list.push(r);
    byUser.set(r.user_id, list);
  }

  // ── Resumen ────────────────────────────────────────────────────────────
  const sumHeader = ['Nombre', 'Email', 'Plan', 'Alta', 'Último uso', 'Ciclo desde', 'Ciclo hasta'];
  for (const p of PERIODS) {
    sumHeader.push(
      `Chat $ (${p.label})`, `Tareas de fondo $ (${p.label})`, `Voz $ (${p.label})`,
      `Dictado $ (${p.label})`, `Total $ (${p.label})`,
    );
  }
  const summary: (string | number | null)[][] = [sumHeader];
  const totals = new Array(sumHeader.length).fill(0) as number[];

  for (const u of users) {
    const list = byUser.get(u.id) ?? [];
    const line: (string | number | null)[] = [
      getDisplayName(u) || '', u.email, (u.plan_key ?? 'starter').toUpperCase(),
      date(u.created_at), date(lastActiveById[u.id]),
      date(list[0]?.cycle_start), date(list[0]?.cycle_end),
    ];
    for (const p of PERIODS) {
      const cost = (section: CostDetailRow['section']) =>
        list.filter(r => r.section === section).reduce((s, r) => s + (get(r, 'cost', p.key) ?? 0), 0);
      const chat = cost('chat'), bg = cost('background'), voice = cost('voice'), dict = cost('dictation');
      line.push(round(chat), round(bg), round(voice), round(dict), round(chat + bg + voice + dict));
    }
    line.forEach((v, i) => { if (i >= 7 && typeof v === 'number') totals[i] += v; });
    summary.push(line);
  }
  summary.push(['TOTAL', `${users.length} usuarios`, '', '', '', '', '',
    ...totals.slice(7).map(v => round(v))]);

  // ── Detalle ────────────────────────────────────────────────────────────
  const detHeader = ['Nombre', 'Email', 'Sección', 'Modelo', 'Detalle'];
  const metrics: Array<{ key: string; label: string; d?: number }> = [
    { key: 'chats', label: 'Chats' },
    { key: 'replies', label: 'Respuestas / llamadas' },
    { key: 'words', label: 'Palabras (aprox.)' },
    { key: 'tokens', label: 'Tokens' },
    { key: 'credits', label: 'Créditos', d: 2 },
    { key: 'minutes', label: 'Minutos', d: 2 },
    { key: 'cost', label: 'Costo $', d: 4 },
  ];
  for (const p of PERIODS) for (const m of metrics) detHeader.push(`${m.label} (${p.label})`);
  const detail: (string | number | null)[][] = [detHeader];

  for (const u of users) {
    for (const r of byUser.get(u.id) ?? []) {
      const line: (string | number | null)[] = [
        getDisplayName(u) || '', u.email, SECTION_LABEL[r.section], modelName(r.label), r.detail ?? '',
      ];
      for (const p of PERIODS) for (const m of metrics) line.push(round(get(r, m.key, p.key), m.d ?? 0));
      detail.push(line);
    }
  }

  // ── Workbook ───────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  const wsSum = XLSX.utils.aoa_to_sheet(summary);
  wsSum['!cols'] = sumHeader.map((h, i) => ({ wch: i < 2 ? 28 : Math.max(10, h.length + 2) }));
  XLSX.utils.book_append_sheet(wb, wsSum, 'Resumen');

  const wsDet = XLSX.utils.aoa_to_sheet(detail);
  wsDet['!cols'] = detHeader.map((h, i) => ({ wch: i < 2 ? 28 : i === 4 ? 36 : Math.max(10, h.length + 2) }));
  XLSX.utils.book_append_sheet(wb, wsDet, 'Detalle');

  const note = XLSX.utils.aoa_to_sheet([
    ['Costos estimados de Con Elena'],
    [`Generado: ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}`],
    ['Hoy = día actual (hora de Ciudad de México). Ciclo = ciclo mensual de cada usuario, desde su fecha de alta.'],
    ['Palabras = palabras que escribió Elena, calculadas a partir de los tokens (los mensajes están cifrados).'],
    ['Voz y dictado se cuentan desde que se activó su registro. El cobro real está en cada proveedor.'],
  ]);
  note['!cols'] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(wb, note, 'Notas');

  const stamp = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
  XLSX.writeFile(wb, `conelena-costos_${stamp}_${users.length}-usuarios.xlsx`);
}