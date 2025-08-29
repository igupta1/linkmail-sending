-- Add is_verified flags at contact and per-email levels

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE contact_emails
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark all existing emails as verified
UPDATE contact_emails SET is_verified = TRUE WHERE is_verified IS DISTINCT FROM TRUE;

-- Mark contacts as verified if they have any email (all existing are now verified)
UPDATE contacts SET is_verified = TRUE
WHERE id IN (SELECT DISTINCT contact_id FROM contact_emails);

-- Update the view to include the contact-level Verified column
DROP VIEW IF EXISTS contacts_with_emails;

CREATE VIEW contacts_with_emails AS
SELECT 
  c.id,
  c.first_name AS "First Name",
  c.last_name AS "Last Name",
  c.job_title AS "Job Title",
  c.company AS "Company",
  c.location AS "Location",
  COALESCE(
    (
      SELECT array_agg(e.email ORDER BY e.is_primary DESC, e.email)
      FROM contact_emails e
      WHERE e.contact_id = c.id
    ),
    ARRAY[]::text[]
  ) AS "Email(s)",
  c.is_verified AS "Verified",
  c.created_at,
  c.updated_at
FROM contacts c;


