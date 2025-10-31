-- Referral system tables
-- Each user gets a unique referral code
-- When 3 people install using their code, they get upgraded to Premium Plus

-- Add referral_code column to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Create index for faster referral code lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_referral_code ON user_profiles (referral_code);

-- Create referrals tracking table
CREATE TABLE IF NOT EXISTS referrals (
  id SERIAL PRIMARY KEY,
  referrer_user_id TEXT NOT NULL,
  referred_user_id TEXT,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'cancelled'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  FOREIGN KEY (referrer_user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_user_id ON referrals (referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referral_code ON referrals (referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id ON referrals (referred_user_id);

