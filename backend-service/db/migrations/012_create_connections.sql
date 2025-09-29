-- Connections table to track reach-outs between users and contacts
-- Represents a connection/relationship between a user and a contact
-- Composite primary key: (user_id, contact_id) ensures one connection per user-contact pair

CREATE TABLE IF NOT EXISTS connections (
  user_id TEXT NOT NULL,
  contact_id BIGINT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'follow_up_needed', 'responded', 'meeting_scheduled', 'converted')),
  notes TEXT,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Composite primary key
  PRIMARY KEY (user_id, contact_id)
);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS set_connections_updated_at ON connections;
CREATE TRIGGER set_connections_updated_at
BEFORE UPDATE ON connections
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_connections_user_id ON connections(user_id);
CREATE INDEX IF NOT EXISTS idx_connections_contact_id ON connections(contact_id);
CREATE INDEX IF NOT EXISTS idx_connections_status ON connections(status);
CREATE INDEX IF NOT EXISTS idx_connections_updated_at ON connections(updated_at DESC);

-- GIN index for efficient JSONB queries on messages
CREATE INDEX IF NOT EXISTS idx_connections_messages_gin ON connections USING GIN (messages);

-- Add foreign key constraint for user_id (assuming it references user_profiles)
-- Note: This assumes user_id matches the user_profiles.user_id format
-- If you have a different user table, adjust the reference accordingly
-- ALTER TABLE connections ADD CONSTRAINT fk_connections_user_id 
--   FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE;
