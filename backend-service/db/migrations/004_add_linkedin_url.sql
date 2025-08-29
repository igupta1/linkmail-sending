-- Add linkedin_url to contacts and expose in the view

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS linkedin_url TEXT;

-- Update view to include LinkedIn URL
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
  c.linkedin_url AS "LinkedIn",
  c.created_at,
  c.updated_at
FROM contacts c;


