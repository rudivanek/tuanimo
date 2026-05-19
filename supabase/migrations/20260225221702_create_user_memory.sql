/*
  # Create user memory table

  ## Summary
  Creates the user_memory table for storing important user facts across sessions.
  Elena can save and recall key information (name, preferences, relationships, etc.)
  to maintain continuity and personalization across conversations.

  ## New Tables
    - `user_memory`
      - `id` (uuid, primary key) - Unique memory identifier
      - `user_id` (uuid, foreign key) - References auth.users(id)
      - `key` (text) - Memory key (e.g., 'preferred_name', 'job_title', 'relationship_status')
      - `value_enc` (text) - Encrypted memory value (AES-256-CBC)
      - `source` (text) - How this memory was created (default: 'user_confirmed')
      - `last_confirmed_at` (timestamptz) - Last time user confirmed this fact
      - `created_at` (timestamptz) - Memory creation timestamp

  ## Security
    - Enable RLS on `user_memory` table
    - Users can access and modify their own memories
    - All CRUD operations restricted to authenticated users

  ## Indexes
    1. UNIQUE constraint on (user_id, key) to prevent duplicate keys
    2. (user_id, last_confirmed_at DESC) for retrieving recent memories

  ## Notes
    1. value_enc stores encrypted memory value (IV:ciphertext format)
    2. Elena loads top 5 most recently confirmed memories into each conversation
    3. Memories are marked as "may be outdated" in system prompt
    4. Users can confirm/update memories to refresh last_confirmed_at
    5. Example keys: preferred_name, job_title, significant_other, children, etc.
    6. Helps maintain personalization and continuity across sessions
*/

CREATE TABLE IF NOT EXISTS user_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  value_enc text NOT NULL,
  source text NOT NULL DEFAULT 'user_confirmed',
  last_confirmed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, key)
);

CREATE INDEX IF NOT EXISTS user_memory_user_confirmed_idx 
  ON user_memory(user_id, last_confirmed_at DESC);

ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own memories"
  ON user_memory
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memories"
  ON user_memory
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own memories"
  ON user_memory
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own memories"
  ON user_memory
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);