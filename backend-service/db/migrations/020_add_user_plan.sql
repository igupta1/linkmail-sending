-- Add subscription plan column to user_profiles
-- Plans:
--  - "Premium Tier" (25 lookups)
--  - "Premium Plus Tier" (50 lookups)

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'Premium Tier';

-- Ensure existing rows have a value (covers older Postgres where NOT NULL + DEFAULT may not backfill)
UPDATE user_profiles
SET plan = 'Premium Tier'
WHERE plan IS NULL OR length(trim(plan)) = 0;


