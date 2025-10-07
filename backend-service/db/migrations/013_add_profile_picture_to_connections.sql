-- Add profile_picture_url column to connections table
-- This will store the LinkedIn profile picture URL of the contact

ALTER TABLE connections 
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Create index for potential filtering/queries
CREATE INDEX IF NOT EXISTS idx_connections_profile_picture ON connections(profile_picture_url) 
WHERE profile_picture_url IS NOT NULL;

-- Add comment to document the column
COMMENT ON COLUMN connections.profile_picture_url IS 'LinkedIn profile picture URL of the contact, captured when an email is sent';

