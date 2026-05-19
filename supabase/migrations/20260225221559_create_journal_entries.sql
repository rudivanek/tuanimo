/*
  # Create journal entries table

  ## Summary
  Creates the journal_entries table for storing user journal entries with encrypted content.
  Entries can be tagged and optionally created from AI-generated prompts.

  ## New Tables
    - `journal_entries`
      - `id` (uuid, primary key) - Unique entry identifier
      - `user_id` (uuid, foreign key) - References auth.users(id)
      - `title` (text) - Entry title
      - `content_enc` (text) - Encrypted entry content (AES-256-CBC)
      - `prompt` (text, nullable) - AI-generated prompt that inspired this entry
      - `tags` (text[]) - Array of user-defined tags for categorization
      - `created_at` (timestamptz) - Entry creation timestamp
      - `updated_at` (timestamptz) - Entry last update timestamp

  ## Security
    - Enable RLS on `journal_entries` table
    - Users can only access their own journal entries
    - All CRUD operations restricted to authenticated users

  ## Indexes
    1. (user_id, created_at DESC) for efficient entry listing

  ## Notes
    1. content_enc stores encrypted entry text (IV:ciphertext format)
    2. prompt field stores the AI-generated prompt if entry was created from one
    3. tags array enables filtering and categorization
    4. All encryption/decryption happens server-side
*/

CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  content_enc text NOT NULL,
  prompt text,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS journal_entries_user_created_idx 
  ON journal_entries(user_id, created_at DESC);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own journal entries"
  ON journal_entries
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journal entries"
  ON journal_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own journal entries"
  ON journal_entries
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own journal entries"
  ON journal_entries
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS journal_entries_updated_at ON journal_entries;
CREATE TRIGGER journal_entries_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();