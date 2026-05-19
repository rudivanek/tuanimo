/*
  # Add sound preference columns to profiles

  Adds four boolean columns to the profiles table so users can control
  Elena's audio cues per-device and per-account.

  ## New Columns (profiles)
  - `sound_enabled` — master toggle; when false, no sound plays anywhere. Default true.
  - `sound_response_enabled` — play a single chime when Elena finishes a reply. Default true.
  - `sound_journal_suggestion_enabled` — play a double chime when the diary suggestion card appears. Default true.
  - `sound_journal_saved_enabled` — play a soft completion arpeggio when a journal entry is saved. Default false (opt-in).

  ## Notes
  - All columns are NOT NULL with safe defaults so existing rows are updated transparently.
  - No RLS changes needed — the existing profiles row-level policies already cover this.
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS sound_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sound_response_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sound_journal_suggestion_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sound_journal_saved_enabled boolean NOT NULL DEFAULT false;
