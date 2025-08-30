-- Add user_email column and index to user_profiles

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS user_email TEXT;

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_email ON user_profiles (lower(user_email));


