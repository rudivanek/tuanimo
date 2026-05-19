export type InsightSourceLabel = "Chats" | "Diario" | "Mixto";

export function getInsightSourceLabel(input: {
  hasChatData?: boolean;
  hasJournalData?: boolean;
}): InsightSourceLabel {
  const hasChat = !!input.hasChatData;
  const hasJournal = !!input.hasJournalData;

  if (hasChat && hasJournal) return "Mixto";
  if (hasJournal) return "Diario";
  return "Chats";
}
