-- Add templates column to user_profiles to store an array of templates
-- Each template: { "title": string, "body": string }

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS templates JSONB NOT NULL DEFAULT '[]'::jsonb;


