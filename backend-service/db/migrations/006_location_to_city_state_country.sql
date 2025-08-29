-- Replace location with city/state/country and update view

-- Drop dependent view first
DROP VIEW IF EXISTS contacts_with_emails;

-- Add new columns
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT;

-- Backfill city from existing location if present
UPDATE contacts SET city = COALESCE(city, location) WHERE location IS NOT NULL AND (city IS NULL OR city = '');

-- Remove old column
ALTER TABLE contacts DROP COLUMN IF EXISTS location;

-- Add unique index on LinkedIn URL (case-insensitive) when present
CREATE UNIQUE INDEX IF NOT EXISTS uniq_contacts_linkedin_url
ON contacts ((lower(linkedin_url)))
WHERE linkedin_url IS NOT NULL AND length(trim(linkedin_url)) > 0;

-- Recreate view with new columns
CREATE VIEW contacts_with_emails AS
SELECT 
  c.id,
  c.first_name AS "First Name",
  c.last_name AS "Last Name",
  c.job_title AS "Job Title",
  c.company AS "Company",
  c.city AS "City",
  c.state AS "State",
  c.country AS "Country",
  COALESCE(
    (
      SELECT array_agg(e.email ORDER BY e.is_primary DESC, e.email)
      FROM contact_emails e
      WHERE e.contact_id = c.id
    ),
    ARRAY[]::text[]
  ) AS "Email(s)",
  c.is_verified AS "Verified",
  c.linkedin_url AS "LinkedIn",
  c.created_at,
  c.updated_at
FROM contacts c;


