-- Add category column to contacts table and populate based on job_title patterns

-- Add the category column
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS category TEXT;

-- Function to determine category based on job_title
-- Order matters for precedence (University Recruiter before Recruiter, Co-Founder before Founder, etc.)
UPDATE contacts SET category = 
  CASE
    -- University Recruiter (check before general Recruiter)
    WHEN LOWER(job_title) LIKE '%university%' AND LOWER(job_title) LIKE '%recruit%' THEN 'University Recruiter'
    
    -- Co-Founder (check before general Founder)
    WHEN LOWER(job_title) LIKE '%co-founder%' THEN 'Co-Founder'
    
    -- Specific multi-word titles
    WHEN LOWER(job_title) LIKE '%data scientist%' THEN 'Data Scientist'
    WHEN LOWER(job_title) LIKE '%product manager%' THEN 'Product Manager'
    WHEN LOWER(job_title) LIKE '%software engineer%' THEN 'Software Engineer'
    WHEN LOWER(job_title) LIKE '%talent acquisition%' THEN 'Talent Acquisition'
    
    -- Single word matches
    WHEN LOWER(job_title) LIKE '%analyst%' THEN 'Analyst'
    WHEN LOWER(job_title) LIKE '%ceo%' THEN 'CEO'
    WHEN LOWER(job_title) LIKE '%founder%' THEN 'Founder'
    WHEN LOWER(job_title) LIKE '%consultant%' THEN 'Consultant'
    WHEN LOWER(job_title) LIKE '%designer%' THEN 'Designer'
    WHEN LOWER(job_title) LIKE '%recruit%' THEN 'Recruiter'
    
    -- Default for unmatched job titles
    ELSE NULL
  END
WHERE job_title IS NOT NULL AND TRIM(job_title) != '';

-- Update the contacts_with_emails view to include the new category column
DROP VIEW IF EXISTS contacts_with_emails;

CREATE VIEW contacts_with_emails AS
SELECT 
  c.id,
  c.first_name AS "First Name",
  c.last_name AS "Last Name",
  c.job_title AS "Job Title",
  c.company AS "Company",
  c.category AS "Category",
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

-- Create index on category for faster filtering
CREATE INDEX IF NOT EXISTS idx_contacts_category ON contacts(category);

-- Log completion message
DO $$
DECLARE
  total_categorized INTEGER;
  total_contacts INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_categorized 
  FROM contacts 
  WHERE category IS NOT NULL;
  
  SELECT COUNT(*) INTO total_contacts 
  FROM contacts 
  WHERE job_title IS NOT NULL AND TRIM(job_title) != '';
  
  RAISE NOTICE 'Category column added successfully. Categorized % out of % contacts with job titles.', 
    total_categorized, total_contacts;
END $$;
