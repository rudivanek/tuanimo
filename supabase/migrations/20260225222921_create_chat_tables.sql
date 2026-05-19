/*
  # Create chat threads and messages tables

  ## Summary
  Creates tables for chat functionality with Elena AI counselor.
  Messages are stored with encrypted content for privacy.

  ## New Tables
    - `chat_threads`
      - `id` (uuid, primary key) - Unique thread identifier
      - `user_id` (uuid, foreign key) - References auth.users(id)
      - `title` (text) - Thread title (auto-generated or user-set)
      - `created_at` (timestamptz) - Thread creation timestamp
      - `updated_at` (timestamptz) - Last message timestamp

    - `chat_messages`
      - `id` (uuid, primary key) - Unique message identifier
      - `thread_id` (uuid, foreign key) - References chat_threads(id)
      - `user_id` (uuid, foreign key) - References auth.users(id)
      - `sender` (text) - Either 'user' or 'counselor'
      - `content_enc` (text) - Encrypted message content (AES-256-CBC)
      - `content_preview` (text) - First 50 chars for display (optional)
      - `meta` (jsonb) - Metadata (state, stuck flag, analyzer data, etc.)
      - `created_at` (timestamptz) - Message timestamp

  ## Security
    - Enable RLS on both tables
    - Users can only access their own threads and messages
    - Cascade delete: deleting thread deletes all messages
    - Cascade delete: deleting user deletes all threads and messages

  ## Indexes
    1. (user_id, updated_at DESC) on chat_threads for efficient thread listing
    2. (thread_id, created_at) on chat_messages for message ordering

  ## Notes
    1. content_enc stores encrypted message text (IV:ciphertext format)
    2. content_preview stores unencrypted preview for UI (use cautiously)
    3. meta jsonb field stores analyzer results, conversation state, etc.
    4. All encryption/decryption happens server-side in Edge Functions
*/

CREATE TABLE IF NOT EXISTS chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Nueva conversación',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_threads_user_updated_idx 
  ON chat_threads(user_id, updated_at DESC);

ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own threads"
  ON chat_threads
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own threads"
  ON chat_threads
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own threads"
  ON chat_threads
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own threads"
  ON chat_threads
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('user', 'counselor')),
  content_enc text NOT NULL,
  content_preview text NOT NULL DEFAULT '',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_thread_created_idx 
  ON chat_messages(thread_id, created_at);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own messages"
  ON chat_messages
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages"
  ON chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own messages"
  ON chat_messages
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS chat_threads_updated_at ON chat_threads;
CREATE TRIGGER chat_threads_updated_at
  BEFORE UPDATE ON chat_threads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();