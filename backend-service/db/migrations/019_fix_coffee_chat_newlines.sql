-- Fix Coffee Chat Request template to use real newlines (not literal \n)

DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE user_profiles
  SET templates = (
    SELECT jsonb_agg(
      CASE
        WHEN (elem->>'title') = 'Coffee Chat Request' THEN
          jsonb_set(
            elem,
            '{body}',
            to_jsonb(replace(elem->>'body', E'\\n', E'\n'))
          )
        ELSE elem
      END
    )
    FROM jsonb_array_elements(COALESCE(user_profiles.templates, '[]'::jsonb)) AS elem
  ),
  updated_at = NOW();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Replaced literal \\n with real newlines for % user(s)', updated_count;
END $$;


