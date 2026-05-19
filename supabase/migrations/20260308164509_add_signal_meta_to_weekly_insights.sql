/*
  # Add signal_meta column to mood_weekly_insights

  ## Summary
  Adds a nullable JSONB metadata column to mood_weekly_insights so the weekly
  insight generation step can record which data sources were consulted and what
  chat-signal context was incorporated when writing each AI insight.

  ## Modified Tables
    - `mood_weekly_insights`
      - `signal_meta` (jsonb, nullable) — structured record of sources and signal
        totals used during generation. Schema:
          {
            "sources": ["mood"] | ["mood", "chat"],
            "mood_days": <int>,            // mood log entries for the week
            "chat": {                      // present only when chat data was used
              "positive": <int>,
              "stress": <int>,
              "anxiety": <int>,
              "gratitude": <int>,
              "total": <int>,
              "dominant": "<string> | null"
            }
          }

  ## Notes
  1. Column is nullable — existing rows and future mood-only rows simply get NULL.
  2. No RLS change required; the column is part of INSERT rows already covered by
     the "Users can insert own weekly insights" policy.
  3. The generate-weekly-insights batch function and the interactive mood-insights
     function both populate this field when chat_signal_daily_agg data is present.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mood_weekly_insights' AND column_name = 'signal_meta'
  ) THEN
    ALTER TABLE mood_weekly_insights ADD COLUMN signal_meta jsonb;
  END IF;
END $$;
