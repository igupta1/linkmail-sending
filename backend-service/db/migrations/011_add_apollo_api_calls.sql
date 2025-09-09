-- Add apollo_api_calls column to user_profiles table
-- This tracks the number of successful Apollo API calls made by each user

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS apollo_api_calls INTEGER NOT NULL DEFAULT 0;

-- Add a comment to document the column
COMMENT ON COLUMN user_profiles.apollo_api_calls IS 'Number of successful Apollo API email searches performed by the user';
