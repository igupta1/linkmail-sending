-- Update template structure to replace fileUrl with file and add subject field
-- This migration updates existing templates to match the new structure:
-- { body, icon, title, subject, file, strict_template }

-- Create a function to update template structure
CREATE OR REPLACE FUNCTION update_template_structure() RETURNS void AS $$
DECLARE
    user_record RECORD;
    updated_templates JSONB;
BEGIN
    -- Loop through all user profiles with templates
    FOR user_record IN 
        SELECT user_id, templates 
        FROM user_profiles 
        WHERE templates IS NOT NULL AND templates != '[]'::jsonb
    LOOP
        -- Transform each template to new structure
        SELECT jsonb_agg(
            jsonb_build_object(
                'body', template->>'body',
                'icon', template->>'icon', 
                'title', template->>'title',
                'subject', COALESCE(template->>'subject', template->>'title', 'Subject Line'), -- Use existing subject, fallback to title, then default
                'file', template->>'fileUrl', -- Rename fileUrl to file
                'strict_template', COALESCE((template->>'strict_template')::boolean, false)
            )
        ) INTO updated_templates
        FROM jsonb_array_elements(user_record.templates) AS template;
        
        -- Update the user's templates
        UPDATE user_profiles 
        SET templates = updated_templates,
            updated_at = NOW()
        WHERE user_id = user_record.user_id;
        
        RAISE NOTICE 'Updated templates for user_id: %', user_record.user_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the migration
SELECT update_template_structure();

-- Drop the function after use
DROP FUNCTION update_template_structure();
