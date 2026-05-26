;
          usage = retryUsage;
          aiResponse = retryParsed;
          aiResponse.reply = retryTrimmed;
          console.log("[chat-ai] Retry succeeded with non-empty reply");
        } else {
          console.warn("[chat-ai] Retry also returned empty reply — using fallback");
          EdgeRuntime.waitUntil(logTokenUsageAndIncrement(user.id, "chat", "gpt-4o-mini", retryUsage));
        }
      } else {
        console.warn("[chat-ai] Retry OpenAI call failed:", retryErr?.status);
      }
    }

    // ── Log tokens (non-blocking — failures do not crash the response) ────────
    EdgeRuntime.waitUntil(
      logTokenUsageAndIncrement(user.id, "chat", "gpt-4o-mini", usage)
    );

    if (!aiResponse.meta) {
      aiResponse.meta = {
        state: "E3_EXPAND",
        emotion: "unknown",
        intensity: 5,
        valence: "neutral",
        stuck: false,
        crisis: "NO",
      };
    }

    // ── Sanitize reply — guard against whitespace-only model output ───────────
    const trimmedReply = (aiResponse.reply ?? "").replace(/\s+/g, " ").trim();
    if (trimmedReply.length === 0) {
      console.warn("[chat-ai] Empty model output — used fallback", {
        model: "gpt-4o-mini",
        hasMessages: conversationHistory?.length ?? 0,
        rawContentLength: rawContent?.length ?? 0,
      });
      aiResponse.reply = "Estoy aquí contigo. ¿Te gustaría contarme un poco más de lo que estás sintiendo ahora mismo?";
    } else {
      aiResponse.reply = trimmedReply;
    }

    // ── Post-generation banned-label guard ────────────────────────────────────
    if (containsBannedLabel(aiResponse.reply)) {
      console.warn("[chat-ai] Banned label detected in model output — retrying once", {
        snippet: aiResponse.reply.slice(0, 120),
      });
      const guardMessages = [
        {
          role: "system",
          content:
            systemPrompt +
            "\n\nCRITICAL OVERRIDE: Your previous response contained a banned feeling label. " +
            "Rewrite the COMPLETE response — reflection sentence AND follow-up question — " +
            "using only experiential, sensory language. " +
            "Do NOT use: confusión, desorientación, ansiedad, tristeza, angustia, frustración, " +
            "agotamiento, bloqueo emocional, estado emocional. " +
            "Every sentence and every question must pass SELF-CHECK before you output.",
        },
        ...conversationHistory.slice(-4),
        { role: "user", content: message },
      ];
      const { data: guardData } = await callOpenAI(buildOpenAIBody(guardMessages));
      if (guardData) {
        const guardRaw: string = (guardData.choices as Array<{ message: { content: string } }>)[0].message.content;
        const guardParsed = parseAIResponse(guardRaw);
        if (!guardParsed.reply || typeof guardParsed.reply !== "string") {
          guardParsed.reply = guardRaw ?? "";
        }
        const guardTrimmed = (guardParsed.reply ?? "").replace(/\s+/g, " ").trim();
        if (guardTrimmed.length > 0 && !containsBannedLabel(guardTrimmed)) {
          aiResponse.reply = guardTrimmed;
          aiResponse.meta = guardParsed.meta ?? aiResponse.meta;
          EdgeRuntime.waitUntil(
            logTokenUsageAndIncrement(user.id, "chat", "gpt-4o-mini", (guardData.usage as OpenAIUsage) ?? null)
          );
          console.log("[chat-ai] Guard retry produced clean reply");
        } else {
          console.warn("[chat-ai] Guard retry still tainted — using safe fallback", {
            snippet: guardTrimmed.slice(0, 120),
          });
          aiResponse.reply = "Algo en lo que dijiste se quedó resonando. ¿Cómo lo sentiste en ese momento?";
        }
      } else {
        console.warn("[chat-ai] Guard retry API call failed — using safe fallback");
        aiResponse.reply = "Algo en lo que dijiste se quedó resonando. ¿Cómo lo sentiste en ese momento?";
      }
    }

    // ── Stamp prior-context-used flag so the throttle fires on the next turn ──
    if (priorContextBlock.length > 0) {
      aiResponse.meta.pcu = true;
    }

    // ── Stamp recognition + return trigger flags for anti-repetition ──────────
    if (useRecognition) aiResponse.meta.recognition_used = true;
    if (useReturnTrigger) aiResponse.meta.return_trigger_used = true;

    // ── Log crisis event if detected (non-blocking) ───────────────────────────
    const detectedCrisis = aiResponse.meta.crisis;
    if (detectedCrisis === "MAYBE" || detectedCrisis === "YES") {
      EdgeRuntime.waitUntil(
        logCrisisEvent({
          userId: user.id,
          severity: detectedCrisis,
          source: "chat-ai",
          threadId: threadId ?? null,
          model: "gpt-4o-mini",
          meta: { ui_shown: true },
        })
      );
    }

    const isSpanish = /[áéíóúñ¿¡]/i.test(message);

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const allMessages = messagesResult.data || [];
    const recentAssistantMessages = allMessages
      .filter(m => m.sender === "counselor")
      .slice(-10);

    const breathingOnCooldown = recentAssistantMessages.some(m => {
      if (!m.meta) return false;
      const msgMeta = typeof m.meta === "string" ? JSON.parse(m.meta) : m.meta;
      return msgMeta.breathingOffered === true && m.created_at > thirtyMinutesAgo;
    }) || recentAssistantMessages.some(m => {
      if (!m.meta) return false;
      const msgMeta = typeof m.meta === "string" ? JSON.parse(m.meta) : m.meta;
      return msgMeta.breathingOffered === true;
    });

    const userMentionedPanic = /ataque de pánico|ataque de panico|me falta el aire|me ahogo/i.test(message);
    const canOfferBreathing = (
      aiResponse.meta.crisis === "NO" &&
      !breathingOnCooldown &&
      (uxStance === 'STABILIZATION') &&
      (userMentionedPanic || uxIntensity >= 3 || aiResponse.meta.intensity >= 8)
    );

    let selectedFollowUp: FollowUp | null = null;

    if (aiResponse.meta.crisis !== "NO") {
      selectedFollowUp = {
        text: isSpanish ? "Ver recursos de ayuda" : "View help resources",
        kind: "action",
        actionType: "resource",
        payload: {},
      };
    } else if (canOfferBreathing) {
      selectedFollowUp = {
        text: isSpanish ? "Hagamos una respiración 4-7-8" : "Let's do 4-7-8 breathing",
        kind: "action",
        actionType: "breathing",
        payload: {},
      };
      aiResponse.meta.breathingOffered = true;
    }

    // ── Chips pipeline with adaptive multiplier ───────────────────────────────
    const isCrisis = aiResponse.meta.crisis !== "NO";
    const emotionalIntensity = estimateEmotionalIntensity(message);

    let chips: string[] = [];

    // Always show AI-provided chips if safe — the AI is already instructed to be sparse.
    // Block on crisis, high emotional intensity, or active chip cooldown for this user.
    if (!isCrisis && emotionalIntensity <= 0.75 && !cooldown_active && Array.isArray(aiResponse.chips) && aiResponse.chips.length > 0) {
      const sanitized = aiResponse.chips.filter((c) =>
        typeof c === "string" &&
        c.trim().length > 5 &&
        c.length <= 120 &&
        !["sí", "si", "no", "yes", "más", "mas", "more"].includes(c.trim().toLowerCase())
      );

      const maxCount = determineChipCount();
      chips = sanitized.slice(0, maxCount);

      // Soft-turn suppression: very long replies reduce chip presence by 40%
      if (aiResponse.reply.length > 800 && Math.random() < 0.4) {
        chips = [];
      }

      // Consecutive chip suppression: if previous message already had chips, 40% chance to skip
      if (chips.length > 0 && previousHadChips && Math.random() < 0.4) {
        chips = [];
      }
    }

    // ── Chip Recovery Layer — Strong Invitation Override ─────────────────────
    if (
      chips.length === 0 &&
      !isCrisis &&
      emotionalIntensity <= 0.75 &&
      isStrongInvitationQuestion(aiResponse.reply)
    ) {
      let recoveryProb = Math.max(0.20, Math.min(0.85, 0.7 * multiplier));
      if (previousHadChips) recoveryProb *= 0.4;
      if (aiResponse.reply.length > 800) recoveryProb *= 0.5;
      recoveryProb = Math.max(0.20, Math.min(0.85, recoveryProb));

      const roll = Math.random();

      if (roll < recoveryProb) {
        const fallback = generateFallbackChips(aiResponse.reply);
        const maxCount = determineChipCount();
        chips = fallback.slice(0, maxCount);
        console.log("ChipRecoveryActivated:", {
          reason: "strong_invitation_override",
          recoveryProb,
          roll,
          multiplier,
          preview: aiResponse.reply.slice(0, 120),
        });
      } else {
        console.log("ChipRecoverySkipped:", {
          reason: "strong_invitation_override_probability",
          recoveryProb,
          roll,
          multiplier,
          preview: aiResponse.reply.slice(0, 120),
        });
      }
    }

    const chipProfile: ChipProfile = { ctr, multiplier, cooldown_active };

    const chatResponse: ChatResponse = {
      reply: aiResponse.reply,
      followUp: selectedFollowUp,
      meta: aiResponse.meta,
      chips,
    };

    return new Response(
      JSON.stringify({
        reply: chatResponse.reply,
        followUp: chatResponse.followUp,
        meta: chatResponse.meta,
        chips: chatResponse.chips,
        usage,
        chip_profile: chipProfile,
        boundary_triggered: isGeneralQuery,
        boundary_type: boundaryType,
        mode_used: modeUsed,
        support_routine_id: selectedRoutine?.id ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Chat AI error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: error.message === "Unauthorized" ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
