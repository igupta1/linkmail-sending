-- Update Coffee Chat Request template body for all users
-- And update the default templates for new users

DO $$
DECLARE
  new_body TEXT := 'Hey [Recipient First Name],\n\nI''m [My First Name] –– I came across your profile while browsing Linkedin and thought [very briefly mention something about recipient''s work] is really cool. I''m sure you''re busy, but if you have a moment, I''d love to learn more about your experiences. Let me know!\n\nBest,\n[My First Name]';
  updated_count INTEGER;
BEGIN
  -- Update only the Coffee Chat Request template body within each user''s templates array
  UPDATE user_profiles
  SET templates = (
    SELECT jsonb_agg(
      CASE
        WHEN (elem->>'title') = 'Coffee Chat Request'
          THEN jsonb_set(elem, '{body}', to_jsonb(new_body))
        ELSE elem
      END
    )
    FROM jsonb_array_elements(COALESCE(user_profiles.templates, '[]'::jsonb)) AS elem
  ),
  updated_at = NOW();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated Coffee Chat template for % user(s)', updated_count;
END $$;

-- Update the column default so new users receive the updated body
ALTER TABLE user_profiles
ALTER COLUMN templates SET DEFAULT '[
  {
    "icon": "☕",
    "title": "Coffee Chat Request",
    "subject": "Would love to learn more about [Recipient Company]!",
    "body": "Hey [Recipient First Name],\n\nI''m [My First Name] –– I came across your profile while browsing Linkedin and thought [very briefly mention something about recipient''s work] is really cool. I''m sure you''re busy, but if you have a moment, I''d love to learn more about your experiences. Let me know!\n\nBest,\n[My First Name]",
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


