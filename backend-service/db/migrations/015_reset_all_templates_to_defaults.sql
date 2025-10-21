-- Reset ALL users' templates to the 2 default templates
-- This migration overwrites existing templates for all users

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
    -- Reset templates for ALL users (no WHERE clause condition)
    UPDATE user_profiles
    SET templates = default_templates,
        updated_at = NOW();
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Reset templates to defaults for % user(s)', updated_count;
END $$;

