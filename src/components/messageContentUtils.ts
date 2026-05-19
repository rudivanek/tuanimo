const TRAILING_PUNCT_RE = /[.,;:)\]{}!?…"]+$/;

const SUPPORT_KEYWORDS_RE =
  /respira|inhala|exhala|cierra los ojos|suaviza la mirada|visualiza|vamos a|ejercicio|meditaci[oó]n|calmar|ansiedad/i;
const SENTENCE_BOUNDARY_RE = /\.(?!\.)|\n/g;

function isSupportContext(text: string): boolean {
  if (SUPPORT_KEYWORDS_RE.test(text)) return true;
  const matches = text.match(SENTENCE_BOUNDARY_RE);
  return matches !== null && matches.length >= 2;
}

/*
 * ensureQuestionBreak — formatter safety net for SUPPORT mode responses.
 *
 * Rules:
 *   - Only applies to assistant messages (caller responsibility)
 *   - Only applies when text ends with '?'
 *   - Only applies when isSupportContext is true (keywords or >= 3 sentences)
 *   - Inserts exactly ONE blank line before the final question
 *   - Is idempotent: already-separated text is left unchanged
 *
 * Examples:
 *
 *   A) Prose + final question (should insert blank line)
 *      IN : "Si algún pensamiento aparece, simplemente obsérvalo y regresa tu atención a la respiración.\n¿Cómo te sientes después de esta práctica?"
 *      OUT: "Si algún pensamiento aparece, simplemente obsérvalo y regresa tu atención a la respiración.\n\n¿Cómo te sientes después de esta práctica?"
 *
 *   B) Short one-liner question (should NOT insert blank line)
 *      IN : "¿Cómo estás?"
 *      OUT: "¿Cómo estás?"  (unchanged — fails isSupportContext)
 *
 *   C) Already has blank line (should keep as-is)
 *      IN : "Respira lentamente.\n\n¿Cómo te sientes?"
 *      OUT: "Respira lentamente.\n\n¿Cómo te sientes?"  (unchanged)
 *
 *   D) Single-line prose + question separated by space (split at ¿)
 *      IN : "A veces, al meditar... ¿Te gustaría compartir...?"
 *      OUT: "A veces, al meditar...\n\n¿Te gustaría compartir...?"
 */
export function ensureQuestionBreak(text: string): string {
  const trimmed = text.trimEnd();
  if (!trimmed.endsWith('?')) return text;
  if (!isSupportContext(trimmed)) return text;

  const lastNewline = trimmed.lastIndexOf('\n');

  if (lastNewline !== -1) {
    const beforeQuestion = trimmed.slice(0, lastNewline);
    const question = trimmed.slice(lastNewline + 1);
    if (beforeQuestion.endsWith('\n')) return text;
    return beforeQuestion + '\n\n' + question;
  }

  const spanishQIdx = trimmed.lastIndexOf('¿');
  if (spanishQIdx > 0) {
    const charBefore = trimmed[spanishQIdx - 1];
    if (charBefore === ' ' || charBefore === '\n') {
      const before = trimmed.slice(0, spanishQIdx - 1).trimEnd();
      const question = trimmed.slice(spanishQIdx);
      return before + '\n\n' + question;
    }
  }

  return text;
}

export function trimTrailingPunct(url: string): { clean: string; suffix: string } {
  const m = TRAILING_PUNCT_RE.exec(url);
  if (!m) return { clean: url, suffix: '' };
  return { clean: url.slice(0, m.index), suffix: m[0] };
}

export function isSafeUrl(url: string): boolean {
  if (!url.startsWith('https://')) return false;
  if (/\s/.test(url)) return false;
  if (/(javascript:|data:|file:|vbscript:)/i.test(url)) return false;
  return true;
}

export function isSuspicious(url: string): boolean {
  if (url.length > 300) return true;
  try {
    const { hostname } = new URL(url);
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) return true;
    if (/^\[.*\]$/.test(hostname)) return true;
    if (hostname.includes('xn--')) return true;
  } catch {
    return true;
  }
  return false;
}

export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'link'; url: string }
  | { kind: 'suspicious'; url: string }
  | { kind: 'br' };

export function parseText(text: string): Segment[] {
  const segments: Segment[] = [];
  const lines = text.split('\n');

  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) segments.push({ kind: 'br' });

    const regex = /https:\/\/[^\s<>"']+/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ kind: 'text', text: line.slice(lastIndex, match.index) });
      }

      const { clean, suffix } = trimTrailingPunct(match[0]);

      if (isSafeUrl(clean)) {
        if (isSuspicious(clean)) {
          segments.push({ kind: 'suspicious', url: clean });
          if (suffix) segments.push({ kind: 'text', text: suffix });
        } else {
          segments.push({ kind: 'link', url: clean });
          if (suffix) segments.push({ kind: 'text', text: suffix });
        }
      } else {
        segments.push({ kind: 'text', text: match[0] });
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < line.length) {
      segments.push({ kind: 'text', text: line.slice(lastIndex) });
    }
  });

  return segments;
}
