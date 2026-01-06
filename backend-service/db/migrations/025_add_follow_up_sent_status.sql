-- Migration 025: Add 'follow_up_sent' to connections status constraint
-- This migration updates the CHECK constraint to include the new status

-- Drop the existing constraint and add a new one with the additional status
ALTER TABLE connections DROP CONSTRAINT IF EXISTS connections_status_check;

ALTER TABLE connections ADD CONSTRAINT connections_status_check
  CHECK (status IN ('active', 'closed', 'follow_up_needed', 'follow_up_sent', 'responded', 'meeting_scheduled', 'converted'));
