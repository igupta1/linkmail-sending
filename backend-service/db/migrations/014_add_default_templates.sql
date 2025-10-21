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
            "subject": "Coffee Chat Request",
            "body": "Hi [Recipient First Name],\n\n[Mention something specific about recipient company or recent work that interests me].\n\nI''d love to connect and learn more about your experience in [mention recipient field/industry]. Would you be open to a brief coffee chat?\n\nBest regards,\n[My Name]",
            "file": null,
            "strict_template": false
        },
        {
            "icon": "💼",
            "title": "Inquire About Open Roles",
            "subject": "Wondering About Potential Opportunities at [Recipient Company Name]",
            "body": "Hi [Recipient First Name],\n\nI''m [brief personal introduction including my background]. I''m really impressed by [mention something specific about recipient company''s work or mission].\n\n[Connect recipient company''s work to my own experience or interests]. I''d love to learn about potential opportunities at [Recipient Company Name].\n\nBest regards,\n[My Name]",
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
        "subject": "Coffee Chat Request",
        "body": "Hi [Recipient First Name],\n\n[Mention something specific about recipient company or recent work that interests me].\n\nI''d love to connect and learn more about your experience in [mention recipient field/industry]. Would you be open to a brief coffee chat?\n\nBest regards,\n[My Name]",
        "file": null,
        "strict_template": false
    },
    {
        "icon": "💼",
        "title": "Inquire About Open Roles",
        "subject": "Wondering About Potential Opportunities at [Recipient Company Name]",
        "body": "Hi [Recipient First Name],\n\nI''m [brief personal introduction including my background]. I''m really impressed by [mention something specific about recipient company''s work or mission].\n\n[Connect recipient company''s work to my own experience or interests]. I''d love to learn about potential opportunities at [Recipient Company Name].\n\nBest regards,\n[My Name]",
        "file": null,
        "strict_template": false
    }
]'::jsonb;

