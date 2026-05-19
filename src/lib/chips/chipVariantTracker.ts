const lastUsedIndex = new Map<string, number>();

export function pickVariant(intentKey: string, variants: string[]): string {
  if (!variants.length) return '';
  if (variants.length === 1) return variants[0];
  const last = lastUsedIndex.get(intentKey) ?? -1;
  const next = (last + 1 + Math.floor(Math.random() * (variants.length - 1))) % variants.length;
  const safe = next === last ? (next + 1) % variants.length : next;
  lastUsedIndex.set(intentKey, safe);
  return variants[safe];
}

