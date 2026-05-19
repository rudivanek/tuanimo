// src/dev/chatSignalsSanity.ts
// Dev-only sanity harness for chat signal extraction.
// Usage (dev only): import "../dev/chatSignalsSanity" once from a dev-only block.

import {
  extractChatSignals,
  extractChatSignalsWeighted,
  summarizeChatSignals,
  type ChatMessage,
  type ChatMessageWithTime,
} from "../lib/chatSignals";

function run() {
  const basic: ChatMessage[] = [
    { role: "user", content: "Estoy estresada por la presión del trabajo." },
    { role: "user", content: "Gracias, hoy me siento mejor y tranquilo." },
    { role: "assistant", content: "Entiendo." },
    { role: "user", content: "Tengo ansiedad, estoy nervioso y preocupado." },
    { role: "user", content: "Me importa mi bienestar, pero no estoy bien." },
    { role: "user", content: "Este contenido es largo." },
  ];

  const now = new Date();
  const weighted: ChatMessageWithTime[] = [
    { role: "user", content: "Estoy cansado y saturado.", created_at: now },
    {
      role: "user",
      content: "Hace días estaba estresado.",
      created_at: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
    },
  ];

  const s1 = extractChatSignals(basic);
  const d1 = summarizeChatSignals(s1);

  const s2 = extractChatSignalsWeighted(weighted, now);
  const d2 = summarizeChatSignals(s2);

  // eslint-disable-next-line no-console
  console.log("[chatSignals sanity] extractChatSignals:", s1, "dominant:", d1);
  // eslint-disable-next-line no-console
  console.log("[chatSignals sanity] weighted:", s2, "dominant:", d2);
}

if (import.meta.env.DEV) {
  run();
}
