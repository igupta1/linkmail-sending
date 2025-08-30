-- User profiles table to store extension user bio data
-- Columns:
-- - user_id: backend auth user id (from Google profile id)
-- - first_name, last_name: split name parts
-- - linkedin_url: canonical linkedin profile URL
-- - experiences: JSONB array of experiences [{company, job_title, description}]
-- - skills: TEXT[] list of skills
-- - contacted_linkedins: TEXT[] list of linkedin profile URLs user already contacted
-- - created_at, updated_at: timestamps

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  linkedin_url TEXT,
  experiences JSONB NOT NULL DEFAULT '[]'::jsonb,
  skills TEXT[] NOT NULL DEFAULT '{}',
  contacted_linkedins TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS set_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER set_user_profiles_updated_at
BEFORE UPDATE ON user_profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Helpful index for lookups by linkedin_url
CREATE INDEX IF NOT EXISTS idx_user_profiles_linkedin_url ON user_profiles (lower(linkedin_url));


