// src/lib/chatSignals.ts
// Stage 3A — Chat signal extraction for Insights
// Stage 3B will connect this with InsightMemoryCard
// Stage 3H — Accent-insensitive matching + regex word boundaries
// Stage 3I — Optional recency-weighted extraction (no breaking changes)
// Stage 3M — Negation guard for positive matches (Spanish)

export type ChatMessage = { role: string; content: string };

export type ChatMessageWithTime = {
  role: string;
  content: string;
  created_at?: string | number | Date;
};

export type ChatSignals = {
  positive: number;
  stress: number;
  anxiety: number;
  gratitude: number;
};

// Normalize to lowercase + strip diacritics so "presión" == "presion"
function normalizeText(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function countOccurrencesRegex(haystack: string, pattern: RegExp): number {
  const matches = haystack.match(pattern);
  return matches ? matches.length : 0;
}

// Patterns written in normalized form (no accents).
// Word boundaries (\b) reduce false positives.
// Examples:
//   "Estoy estresada" -> stress +1
//   "Tengo presion"   -> stress +1
//   "Gracias, me siento mejor" -> gratitude +1, positive +1
const PATTERNS: Record<keyof ChatSignals, RegExp> = {
  positive:  /\b(feliz|content[oa]s?|bien|tranquil[oa]s?|mejor|orgullos[oa]s?)\b/g,
  stress:    /\b(estresad[oa]s?|presion|presionad[oa]s?|cansad[oa]s?|saturad[oa]s?|agotad[oa]s?|quemad[oa]s?|burnout)\b/g,
  anxiety:   /\b(ansios[oa]s?|ansiedad|preocupad[oa]s?|preocupacion|miedo|nervios[oa]s?|panico)\b/g,
  gratitude: /\b(gracias|agradecid[oa]s?|bendecid[oa]s?)\b/g,
};

// Negation guard for positive keywords.
// Catches: "no estoy bien", "nunca me siento mejor", "no estoy tranquilo", etc.
// The verb bridge (estoy|me siento|…) is optional so bare "no bien" also matches.
// Only guards the subset of positive keywords that are commonly negated:
//   bien, mejor, tranquilo/tranquila
// "no estoy bien"       → negated (no count)
// "me siento mejor"     → NOT negated (counts as positive)
const NEGATED_POSITIVE_RE =
  /\b(no|nunca|jamas)\s+(?:(?:estoy|me\s+siento|ando|me\s+he\s+sentido)\s+)?(bien|mejor|tranquil[oa]s?)\b/g;

// Per-category integer count helpers (reset lastIndex each call for global regexes)
function countPositive(text: string): number {
  PATTERNS.positive.lastIndex = 0;
  const base = countOccurrencesRegex(text, PATTERNS.positive);

  NEGATED_POSITIVE_RE.lastIndex = 0;
  const negated = countOccurrencesRegex(text, NEGATED_POSITIVE_RE);

  return Math.max(0, base - negated);
}

// "estoy agotado"       -> stress +1
// "me siento quemada"   -> stress +1
// "tengo burnout"       -> stress +1
function countStress(text: string): number {
  PATTERNS.stress.lastIndex = 0;
  return countOccurrencesRegex(text, PATTERNS.stress);
}

// "tengo ansiedad" -> anxiety +1
// "me dio un ataque de ansiedad" -> anxiety +1
// "siento panico" -> anxiety +1
function countAnxiety(text: string): number {
  PATTERNS.anxiety.lastIndex = 0;
  let count = countOccurrencesRegex(text, PATTERNS.anxiety);

  if (text.includes("ataque de ansiedad")) {
    count += 1;
  }

  return count;
}

// "no gracias" should NOT count as gratitude
const NEGATED_GRATITUDE_RE = /\bno[,\s]+\s*gracias\b/g;

function countGratitude(text: string): number {
  PATTERNS.gratitude.lastIndex = 0;
  const base = countOccurrencesRegex(text, PATTERNS.gratitude);

  NEGATED_GRATITUDE_RE.lastIndex = 0;
  const negated = countOccurrencesRegex(text, NEGATED_GRATITUDE_RE);

  return Math.max(0, base - negated);
}

/**
 * Counts occurrences of emotional keywords in chat messages.
 * Rules:
 * - accent-insensitive (presión == presion)
 * - case insensitive
 * - word-boundary aware via regex (reduces false positives)
 * - only user messages (role === 'user')
 */
export function extractChatSignals(messages: ChatMessage[]): ChatSignals {
  const signals: ChatSignals = {
    positive: 0,
    stress: 0,
    anxiety: 0,
    gratitude: 0,
  };

  if (!Array.isArray(messages) || messages.length === 0) return signals;

  for (const msg of messages) {
    if (!msg || msg.role !== "user") continue;

    const text = normalizeText(msg.content);
    if (!text) continue;

    signals.positive  += countPositive(text);
    signals.stress    += countStress(text) + (text.includes("demasiado trabajo") ? 1 : 0);
    signals.anxiety   += countAnxiety(text);
    signals.gratitude += countGratitude(text);
  }

  return signals;
}

// Simple 3-step recency decay (deterministic + easy to reason about):
// 0–1 days:  1.0
// 1–3 days:  0.7
// 3–7 days:  0.4
// >7 days:   0.2
function recencyWeight(createdAt: ChatMessageWithTime["created_at"], now: Date): number {
  if (!createdAt) return 1;

  const t =
    createdAt instanceof Date
      ? createdAt.getTime()
      : typeof createdAt === "number"
      ? createdAt
      : new Date(createdAt as string).getTime();

  if (!Number.isFinite(t)) return 1;

  const ageMs = now.getTime() - t;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays <= 1) return 1.0;
  if (ageDays <= 3) return 0.7;
  if (ageDays <= 7) return 0.4;
  return 0.2;
}

/**
 * Same as extractChatSignals but weights each message by how recent it is.
 * Newer messages contribute more to the signal than older ones.
 * Scores are rounded to integers to avoid fractional noise downstream.
 */
export function extractChatSignalsWeighted(
  messages: ChatMessageWithTime[],
  now: Date = new Date()
): ChatSignals {
  const signals: ChatSignals = { positive: 0, stress: 0, anxiety: 0, gratitude: 0 };

  if (!Array.isArray(messages) || messages.length === 0) return signals;

  for (const msg of messages) {
    if (!msg || msg.role !== "user") continue;

    const text = normalizeText(msg.content ?? "");
    if (!text) continue;

    const weight = recencyWeight(msg.created_at, now);

    signals.positive  += weight * countPositive(text);
    signals.stress    += weight * (countStress(text) + (text.includes("demasiado trabajo") ? 1 : 0));
    signals.anxiety   += weight * countAnxiety(text);
    signals.gratitude += weight * countGratitude(text);
  }

  // Keep integers to avoid weird decimals downstream
  return {
    positive:  Math.round(signals.positive),
    stress:    Math.round(signals.stress),
    anxiety:   Math.round(signals.anxiety),
    gratitude: Math.round(signals.gratitude),
  };
}

/**
 * Returns the dominant category if one exists.
 * Actionable signals (stress/anxiety) win close calls; soft signals need a clearer lead.
 *
 * Rules:
 * - total == 0 => null
 * - topScore < 2 => null (single soft mention is not dominant)
 * - stress/anxiety at top: require lead >= 1 over second
 *   - if stress and anxiety are tied at top (>0), pick the higher one (stress wins equality)
 * - positive/gratitude at top: require lead >= 2 over second
 */
export function summarizeChatSignals(
  signals: ChatSignals
): { dominant: keyof ChatSignals | null; score: number } {
  const entries = Object.entries(signals) as [keyof ChatSignals, number][];

  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  if (total === 0) return { dominant: null, score: 0 };

  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  const [topCat, topScore] = sorted[0];
  const secondScore = sorted[1]?.[1] ?? 0;

  if (topScore < 2) return { dominant: null, score: topScore };

  const isActionable = topCat === "stress" || topCat === "anxiety";

  if (isActionable) {
    if (topScore >= secondScore + 1) return { dominant: topCat, score: topScore };

    // stress/anxiety tied at top — pick the higher between the two
    if (signals.stress > 0 && signals.anxiety > 0 && signals.stress === signals.anxiety) {
      return { dominant: "stress", score: topScore };
    }
    if (signals.stress > 0 && signals.anxiety > 0) {
      const winner: keyof ChatSignals = signals.stress >= signals.anxiety ? "stress" : "anxiety";
      return { dominant: winner, score: topScore };
    }

    return { dominant: null, score: topScore };
  }

  // positive / gratitude need a clearer lead
  if (topScore >= secondScore + 2) return { dominant: topCat, score: topScore };

  return { dominant: null, score: topScore };
}
