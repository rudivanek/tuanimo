/*
  # Create token usage tracking table

  ## Summary
  Creates the token_usage table for detailed logging of OpenAI API token consumption.
  Used to enforce per-user token limits and provide usage analytics.

  ## New Tables
    - `token_usage`
      - `id` (uuid, primary key) - Unique log entry identifier
      - `user_id` (uuid, foreign key) - References auth.users(id)
      - `operation` (text) - Type of operation (chat, analyzer, title, journal_prompt, etc.)
      - `model` (text) - OpenAI model used (gpt-4o, gpt-4o-mini)
      - `prompt_tokens` (int) - Number of tokens in the prompt
      - `completion_tokens` (int) - Number of tokens in the completion
      - `total_tokens` (int) - Total tokens consumed
      - `created_at` (timestamptz) - Log entry timestamp

  ## Security
    - Enable RLS on `token_usage` table
    - Users can only read their own usage logs
    - Only server (Edge Functions) can insert usage logs

  ## Indexes
    1. (user_id, created_at DESC) for usage history queries
    2. (user_id, operation) for per-operation analytics

  ## Notes
    1. This table is insert-only from Edge Functions
    2. Token counts are aggregated in profiles.tokens_used for quick limit checks
    3. Historical data enables usage analytics and cost optimization
    4. Edge Functions use service role to insert records
*/

CREATE TABLE IF NOT EXISTS token_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation text NOT NULL,
  model text NOT NULL,
  prompt_tokens int NOT NULL DEFAULT 0,
  completion_tokens int NOT NULL DEFAULT 0,
  total_tokens int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS token_usage_user_created_idx 
  ON token_usage(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS token_usage_user_operation_idx 
  ON token_usage(user_id, operation);

ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own token usage"
  ON token_usage
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);