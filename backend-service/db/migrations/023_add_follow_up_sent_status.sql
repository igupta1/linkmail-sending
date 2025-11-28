-- Add 'follow_up_sent' to the connections status CHECK constraint
-- This enables the Follow Ups CRM feature

-- Drop the existing constraint and add a new one with the additional status
ALTER TABLE connections DROP CONSTRAINT IF EXISTS connections_status_check;

ALTER TABLE connections ADD CONSTRAINT connections_status_check 
  CHECK (status IN ('active', 'closed', 'follow_up_needed', 'follow_up_sent', 'responded', 'meeting_scheduled', 'converted'));

