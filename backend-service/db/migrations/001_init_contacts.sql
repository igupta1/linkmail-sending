-- Enable updated_at auto-management
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id BIGSERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  job_title TEXT,
  company TEXT,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Update trigger for contacts.updated_at
DROP TRIGGER IF EXISTS set_contacts_updated_at ON contacts;
CREATE TRIGGER set_contacts_updated_at
BEFORE UPDATE ON contacts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Contact emails (multiple emails per contact)
CREATE TABLE IF NOT EXISTS contact_emails (
  id BIGSERIAL PRIMARY KEY,
  contact_id BIGINT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contact_id, email)
);

CREATE INDEX IF NOT EXISTS idx_contact_emails_contact_id ON contact_emails(contact_id);

-- At most one primary email per contact
CREATE UNIQUE INDEX IF NOT EXISTS uniq_contact_primary_email
ON contact_emails (contact_id)
WHERE is_primary;


