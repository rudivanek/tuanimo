/*
  # Extend weekly insight eligibility to include chat-only users

  ## Summary
  Updates the `get_users_needing_weekly_insight` RPC so that chat-first users —
  those who primarily use Elena via conversations rather than daily mood-log
  check-ins — are also included in the automatic weekly insight generation run.

  Previously the function only selected users with at least 1 mood_log row in the
  target week. That excluded any user who chatted regularly but never opened the
  mood-log form.

  ## Changed Objects

  ### `get_users_needing_weekly_insight(p_week_start, p_week_end)`
  Now returns the UNION of two eligible sets:

  1. **Mood users** (unchanged): users with >= 1 mood_log entry in the week who
     do not yet have an insight row for that week.

  2. **Chat-only users** (new): users who have meaningful chat_signal_daily_agg
     data for the week AND:
       - total score across all signal types >= 3  (avoids noisy, sparse signals)
       - at least 2 distinct signal_date days       (requires multi-day engagement)
       - no mood_logs for the week                  (pure chat-only path; combined
                                                     weeks are already covered by
                                                     the mood path)
       - no existing mood_weekly_insights row for that week

  ## Eligibility Threshold Rationale
  The minimum of total_score >= 3 AND active_days >= 2 mirrors the existing
  client-side `hasEnoughInsightEvidence` check already used on the Insights page
  for showing inline signal cards. Keeping the same threshold means the batch
  scheduler and the frontend evidence bar are consistent.

  ## Idempotency
  Both branches exclude users who already have an insight row for the week, so
  running the scheduler multiple times is still safe.

  ## Notes
  1. Combined users (mood + chat) are always in the first branch and never
     double-selected because UNION deduplicates by user_id.
  2. The generation function already fetches chat_signal_daily_agg when building
     the prompt, so newly-eligible chat-only users get a chat-context prompt
     automatically once this eligibility change is live.
*/

CREATE OR REPLACE FUNCTION public.get_users_needing_weekly_insight(
  p_week_start date,
  p_week_end   date
)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  -- Branch 1: users with mood logs who don't yet have a weekly insight
  SELECT DISTINCT ml.user_id
  FROM public.mood_logs ml
  WHERE ml.local_date >= p_week_start
    AND ml.local_date <  p_week_end
    AND NOT EXISTS (
      SELECT 1
      FROM public.mood_weekly_insights mwi
      WHERE mwi.user_id        = ml.user_id
        AND mwi.week_start_date = p_week_start
    )

  UNION

  -- Branch 2: chat-only users — meaningful signal data but no mood logs in the week
  --   threshold: total score >= 3  AND  >= 2 distinct active days
  --   (mirrors the client-side hasEnoughInsightEvidence chat check)
  SELECT csda.user_id
  FROM public.chat_signal_daily_agg csda
  WHERE csda.signal_date >= p_week_start
    AND csda.signal_date <  p_week_end
    AND NOT EXISTS (
      SELECT 1
      FROM public.mood_weekly_insights mwi
      WHERE mwi.user_id        = csda.user_id
        AND mwi.week_start_date = p_week_start
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.mood_logs ml2
      WHERE ml2.user_id    = csda.user_id
        AND ml2.local_date >= p_week_start
        AND ml2.local_date <  p_week_end
    )
  GROUP BY csda.user_id
  HAVING SUM(csda.score) >= 3
     AND COUNT(DISTINCT csda.signal_date) >= 2;
$$;
