export type ExportFormat = 'md' | 'txt';

export interface ExportResult {
  filename: string;
  mime: string;
  content: string;
}

export interface ChatExportMessage {
  sender: 'user' | 'counselor';
  content: string;
  created_at: string;
  chipMeta?: { label: string };
}

export interface ChatExportThread {
  id: string;
  title: string;
  created_at: string;
}

export interface DiaryExportEntry {
  id: string;
  title: string;
  content: string;
  prompt?: string;
  tags: string[];
  created_at: string;
}

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'untitled';
}

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-MX', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function formatChatExport(
  thread: ChatExportThread,
  messages: ChatExportMessage[],
  format: ExportFormat,
): ExportResult {
  const exportedAt = new Date().toISOString();
  const title = thread.title?.trim() || 'Untitled Chat';
  const dateStr = formatDate(thread.created_at);
  const slug = toSlug(title);
  const filename = `chat__${dateStr}__${slug}.${format}`;
  const mime = format === 'md' ? 'text/markdown' : 'text/plain';

  let content: string;

  if (format === 'md') {
    const lines: string[] = [
      `# Chat Export`,
      ``,
      `- **App:** Tu-Animo.app`,
      `- **Exported:** ${exportedAt}`,
      `- **Chat Title:** ${title}`,
      `- **Chat ID:** ${thread.id}`,
      ``,
      `## Conversation`,
      ``,
    ];

    for (const msg of messages) {
      if (!msg.content?.trim()) continue;
      const role = msg.sender === 'user' ? 'User' : 'Elena';
      const ts = formatTimestamp(msg.created_at);
      const body = normalizeNewlines(msg.content.trim());
      lines.push(`### ${role} — ${ts}`, ``, body, ``);
      if (msg.sender === 'user' && msg.chipMeta?.label) {
        lines.push(`*[Chip: ${msg.chipMeta.label}]*`, ``);
      }
    }

    content = lines.join('\n');
  } else {
    const lines: string[] = [
      `CHAT EXPORT`,
      `==========================================`,
      `App:        Tu-Animo.app`,
      `Exported:   ${exportedAt}`,
      `Chat Title: ${title}`,
      `Chat ID:    ${thread.id}`,
      `==========================================`,
      ``,
    ];

    for (const msg of messages) {
      if (!msg.content?.trim()) continue;
      const role = msg.sender === 'user' ? 'User' : 'Elena';
      const ts = formatTimestamp(msg.created_at);
      const body = normalizeNewlines(msg.content.trim());
      lines.push(`[${role}  ${ts}]`, body, ``);
      if (msg.sender === 'user' && msg.chipMeta?.label) {
        lines.push(`[Chip: ${msg.chipMeta.label}]`, ``);
      }
    }

    content = lines.join('\n');
  }

  return { filename, mime, content };
}

export function formatDiaryExport(
  entry: DiaryExportEntry,
  format: ExportFormat,
): ExportResult {
  const exportedAt = new Date().toISOString();
  const title = entry.title?.trim() || 'Untitled Entry';
  const dateStr = formatDate(entry.created_at);
  const slug = toSlug(title);
  const filename = `diary__${dateStr}__${slug}.${format}`;
  const mime = format === 'md' ? 'text/markdown' : 'text/plain';
  const tagsStr = entry.tags?.length ? entry.tags.join(', ') : '—';
  const body = normalizeNewlines(entry.content?.trim() || '(empty)');

  let content: string;

  if (format === 'md') {
    const lines: string[] = [
      `# Diary Export`,
      ``,
      `- **App:** Tu-Animo.app`,
      `- **Exported:** ${exportedAt}`,
      `- **Entry Title:** ${title}`,
      `- **Entry ID:** ${entry.id}`,
      `- **Created:** ${formatTimestamp(entry.created_at)}`,
      `- **Tags:** ${tagsStr}`,
      ``,
      `## Entry`,
      ``,
      body,
    ];

    if (entry.prompt) {
      lines.push(``, `## Writing Suggestion`, ``, `- ${entry.prompt}`);
    }

    content = lines.join('\n');
  } else {
    const lines: string[] = [
      `DIARY EXPORT`,
      `==========================================`,
      `App:     Tu-Animo.app`,
      `Exported: ${exportedAt}`,
      `Title:   ${title}`,
      `ID:      ${entry.id}`,
      `Created: ${formatTimestamp(entry.created_at)}`,
      `Tags:    ${tagsStr}`,
      `==========================================`,
      ``,
      body,
    ];

    if (entry.prompt) {
      lines.push(``, `------------------------------------------`, `Writing Suggestion:`, entry.prompt);
    }

    content = lines.join('\n');
  }

  return { filename, mime, content };
}

export function downloadContent(filename: string, mime: string, content: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function copyToClipboard(content: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(content);
      return true;
    }
    const ta = document.createElement('textarea');
    ta.value = content;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export async function shareFile(filename: string, mime: string, content: string): Promise<boolean> {
  try {
    if (!navigator.share) return false;
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const file = new File([blob], filename, { type: mime });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return true;
    }
    await navigator.share({ title: filename, text: content });
    return true;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') return false;
    return false;
  }
}

export function canShare(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.share;
}
