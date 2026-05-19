const DEFAULT_CHAT_TITLES = [
  'nueva conversación',
  'nueva conversacion',
  'new chat',
  'untitled',
  'sin título',
  'sin titulo',
];

export function isDefaultChatTitle(t?: string | null): boolean {
  const s = (t ?? '').trim().toLowerCase();
  if (!s) return true;
  return DEFAULT_CHAT_TITLES.includes(s);
}

export function formatDDMMYYYY(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('es-MX', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);

  const day = parts.find(p => p.type === 'day')?.value ?? '01';
  const month = parts.find(p => p.type === 'month')?.value ?? '01';
  const year = parts.find(p => p.type === 'year')?.value ?? '1970';
  return `${day}/${month}/${year}`;
}

export function pickJournalFallbackPrefix(): string {
  const options = [
    'Reflexión de hoy',
    'Un momento de hoy',
    'Algo que noté hoy',
    'Pensamiento del día',
    'Lo que llevo hoy',
  ];
  return options[Math.floor(Math.random() * options.length)];
}

export function computeChatConversionJournalTitle(
  chatTitle: string | null | undefined,
  timeZone: string,
): string {
  if (!isDefaultChatTitle(chatTitle)) return chatTitle!.trim();
  const dateStr = formatDDMMYYYY(new Date(), timeZone);
  return `${pickJournalFallbackPrefix()} – ${dateStr}`;
}
