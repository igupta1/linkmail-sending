-- Fix typos in default templates for all users
-- This migration corrects:
-- 1. Extra bracket in [My First Name]] -> [My First Name]
-- 2. Extra period in ". I'd love to learn" -> "I'd love to learn"

-- Define the corrected default templates
DO $$
DECLARE
    corrected_templates JSONB := '[
        {
            "icon": "☕",
            "title": "Coffee Chat Request",
            "subject": "Would love to learn more about [Recipient Company]!",
            "body": "Hi [Recipient First Name],\n\nI''m [My First Name]. I''m interested in [Recipient Company] because [Mention something specific about the recipient''s current company that is interesting].\n\nIf you have a moment, I''d love to learn more about your experience and/or hop on a brief call?\n\nBest regards,\n[My First Name]",
            "file": null,
            "strict_template": false
        },
        {
            "icon": "💼",
            "title": "Inquire About Open Roles",
            "subject": "Wondering About Potential Opportunities at [Recipient Company]",
            "body": "Hi [Recipient First Name],\n\nI''m [My First Name]. I''d love to work at [Recipient Company] because [Mention something specific about the recipient''s current company that is interesting].\n\nI''d love to learn about potential opportunities at [Recipient Company].\n\nBest regards,\n[My First Name]",
            "file": null,
            "strict_template": false
        }
    ]'::jsonb;
    updated_count INTEGER;
BEGIN
    -- Update all users' templates to the corrected version
    UPDATE user_profiles
    SET templates = corrected_templates,
        updated_at = NOW();
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Fixed template typos for % user(s)', updated_count;
END $$;

-- Update the column default for new users
ALTER TABLE user_profiles
ALTER COLUMN templates SET DEFAULT '[
    {
        "icon": "☕",
        "title": "Coffee Chat Request",
        "subject": "Would love to learn more about [Recipient Company]!",
        "body": "Hi [Recipient First Name],\n\nI''m [My First Name]. I''m interested in [Recipient Company] because [Mention something specific about the recipient''s current company that is interesting].\n\nIf you have a moment, I''d love to learn more about your experience and/or hop on a brief call?\n\nBest regards,\n[My First Name]",
        "file": null,
        "strict_template": false
    },
    {
        "icon": "💼",
        "title": "Inquire About Open Roles",
        "subject": "Wondering About Potential Opportunities at [Recipient Company]",
        "body": "Hi [Recipient First Name],\n\nI''m [My First Name]. I''d love to work at [Recipient Company] because [Mention something specific about the recipient''s current company that is interesting].\n\nI''d love to learn about potential opportunities at [Recipient Company].\n\nBest regards,\n[My First Name]",
        "file": null,
        "strict_template": false
    }
]'::jsonb;

