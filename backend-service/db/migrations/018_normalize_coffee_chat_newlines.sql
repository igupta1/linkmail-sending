-- Normalize Coffee Chat template newlines (convert literal "\\n" to real newlines)
-- and update column default using JSONB builders to avoid double-escaping

DO $$
DECLARE
  normalized_coffee_body TEXT := E'Hey [Recipient First Name],\n\nI''m [My First Name] –– I came across your profile while browsing Linkedin and thought [very briefly mention something about recipient''s work] is really cool. I''m sure you''re busy, but if you have a moment, I''d love to learn more about your experiences. Let me know!\n\nBest,\n[My First Name]';
  updated_count INTEGER;
BEGIN
  -- Replace any literal "\\n" with real newlines in Coffee Chat Request bodies
  UPDATE user_profiles
  SET templates = (
    SELECT jsonb_agg(
      CASE
        WHEN (elem->>'title') = 'Coffee Chat Request' THEN
          jsonb_set(
            elem,
            '{body}',
            to_jsonb(replace(elem->>'body', '\\n', E'\n'))
          )
        ELSE elem
      END
    )
    FROM jsonb_array_elements(COALESCE(user_profiles.templates, '[]'::jsonb)) AS elem
  ),
  updated_at = NOW();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Normalized Coffee Chat template newlines for % user(s)', updated_count;
END $$;

-- Update the column default using JSONB builders with real newlines
ALTER TABLE user_profiles
ALTER COLUMN templates SET DEFAULT (
  jsonb_build_array(
    jsonb_build_object(
      'icon', '☕',
      'title', 'Coffee Chat Request',
      'subject', 'Would love to learn more about [Recipient Company]!',
      'body', E'Hey [Recipient First Name],\n\nI''m [My First Name] –– I came across your profile while browsing Linkedin and thought [very briefly mention something about recipient''s work] is really cool. I''m sure you''re busy, but if you have a moment, I''d love to learn more about your experiences. Let me know!\n\nBest,\n[My First Name]',
      'file', NULL,
      'strict_template', FALSE
    ),
    jsonb_build_object(
      'icon', '💼',
      'title', 'Inquire About Open Roles',
      'subject', 'Wondering About Potential Opportunities at [Recipient Company]',
      'body', E'Hi [Recipient First Name],\n\nI''m [My First Name]. I''d love to work at [Recipient Company] because [Mention something specific about the recipient''s current company that is interesting].\n\nI''d love to learn about potential opportunities at [Recipient Company].\n\nBest regards,\n[My First Name]',
      'file', NULL,
      'strict_template', FALSE
    )
  )
);


