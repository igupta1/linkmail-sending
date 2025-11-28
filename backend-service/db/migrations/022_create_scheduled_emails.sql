-- Migration 022: Create scheduled_emails table for storing scheduled emails

CREATE TABLE IF NOT EXISTS scheduled_emails (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    attachments JSONB DEFAULT '[]',
    contact_info JSONB DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    gmail_message_id TEXT,
    gmail_thread_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying pending emails by scheduled time
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_pending_time ON scheduled_emails (scheduled_at) WHERE status = 'pending';

-- Index for querying user's scheduled emails
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_user ON scheduled_emails (user_id, status);

