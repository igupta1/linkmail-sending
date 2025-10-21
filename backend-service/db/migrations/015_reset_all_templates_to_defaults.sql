-- Reset ALL users' templates to the 2 default templates
-- This migration overwrites existing templates for all users

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
    -- Reset templates for ALL users (no WHERE clause condition)
    UPDATE user_profiles
    SET templates = default_templates,
        updated_at = NOW();
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Reset templates to defaults for % user(s)', updated_count;
END $$;

