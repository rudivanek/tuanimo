/*
  # Create profiles table

  ## Summary
  Creates the profiles table to store user preferences, token limits, and admin status.
  Implements 1:1 relationship with auth.users for application-specific user data.

  ## New Tables
    - `profiles`
      - `id` (uuid, primary key) - References auth.users(id)
      - `language` (text) - User's preferred language (default: 'en')
      - `timezone` (text) - User's timezone (default: 'America/Mexico_City')
      - `tokens_allowed` (int) - Monthly token limit (default: 100000)
      - `tokens_used` (int) - Tokens consumed in current cycle (default: 0)
      - `cycle_start` (timestamptz) - Start of current billing cycle
      - `cycle_end` (timestamptz) - End of current billing cycle (nullable)
      - `is_admin` (boolean) - Admin access flag (default: false)
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record last update timestamp

  ## Security
    - Enable RLS on `profiles` table
    - Add policy for users to read their own profile
    - Add policy for users to update their own profile
    - Add trigger to auto-create profile on user signup

  ## Notes
    1. The trigger ensures every new auth.users record gets a corresponding profile
    2. Token limits are enforced server-side in Edge Functions
    3. Admin users can access /admin route for system management
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  language text NOT NULL DEFAULT 'en',
  timezone text NOT NULL DEFAULT 'America/Mexico_City',
  tokens_allowed int NOT NULL DEFAULT 100000,
  tokens_used int NOT NULL DEFAULT 0,
  cycle_start timestamptz NOT NULL DEFAULT now(),
  cycle_end timestamptz,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, language, timezone)
  VALUES (new.id, 'en', 'America/Mexico_City')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();