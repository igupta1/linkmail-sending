-- Create a view that flattens contacts and their emails into one row
-- with an array column for easier browsing in Neon console

CREATE OR REPLACE VIEW contacts_with_emails AS
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
  c.created_at,
  c.updated_at
FROM contacts c;


