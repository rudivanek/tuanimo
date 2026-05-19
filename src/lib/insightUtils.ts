const PROMPT_MARKER_RE = /\[\[\/?(COMPARISON|MICRO_STEP)\]\]/g;

export function sanitizeInsightText(text: string): string {
  return text
    .replace(PROMPT_MARKER_RE, '\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
