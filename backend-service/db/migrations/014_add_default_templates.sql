-- Add default templates to user_profiles
-- This migration:
-- 1. Adds 2 default templates to existing users who have empty templates
-- 2. Updates the column default so new users automatically get templates

-- Define the default templates
DO $$
DECLARE
    default_templates JSONB := '[
        {
            "icon": "☕",
            "title": "Coffee Chat Request",
            "subject": "Would love to learn more about [Recipient Company]!",
            "body": "Hi [Recipient First Name],\n\nI''m [My First Name]]. I''m interested in [Recipient Company] because [Mention something specific about the recipient''s current company that is interesting].\n\nIf you have a moment, I''d love to learn more about your experience and/or hop on a brief call?\n\nBest regards,\n[My First Name]",
            "file": null,
            "strict_template": false
        },
        {
            "icon": "💼",
            "title": "Inquire About Open Roles",
            "subject": "Wondering About Potential Opportunities at [Recipient Company]",
            "body": "Hi [Recipient First Name],\n\nI''m [My First Name]]. I''d love to work at [Recipient Company] because [Mention something specific about the recipient''s current company that is interesting].\n\n. I''d love to learn about potential opportunities at [Recipient Company].\n\nBest regards,\n[My First Name]",
            "file": null,
            "strict_template": false
        }
    ]'::jsonb;
    updated_count INTEGER;
BEGIN
    -- Update existing users who have empty templates
    UPDATE user_profiles
    SET templates = default_templates,
        updated_at = NOW()
    WHERE templates = '[]'::jsonb OR templates IS NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Added default templates to % existing user(s)', updated_count;
END $$;

-- Update the column default for new users
ALTER TABLE user_profiles
ALTER COLUMN templates SET DEFAULT '[
    {
        "icon": "☕",
        "title": "Coffee Chat Request",
        "subject": "Would love to learn more about [Recipient Company]!",
        "body": "Hi [Recipient First Name],\n\nI''m [My First Name]]. I''m interested in [Recipient Company] because [Mention something specific about the recipient''s current company that is interesting].\n\nIf you have a moment, I''d love to learn more about your experience and/or hop on a brief call?\n\nBest regards,\n[My First Name]",
        "file": null,
        "strict_template": false
    },
    {
        "icon": "💼",
        "title": "Inquire About Open Roles",
        "subject": "Wondering About Potential Opportunities at [Recipient Company]",
        "body": "Hi [Recipient First Name],\n\nI''m [My First Name]]. I''d love to work at [Recipient Company] because [Mention something specific about the recipient''s current company that is interesting].\n\n. I''d love to learn about potential opportunities at [Recipient Company].\n\nBest regards,\n[My First Name]",
        "file": null,
        "strict_template": false
    }
]'::jsonb;

