-- Backfill LinkedIn URLs for known contacts
UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/juskeerat/'
WHERE first_name = 'Juskeerat' AND last_name = 'Anand' AND (linkedin_url IS NULL OR linkedin_url = '');

UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/nitinsub/'
WHERE first_name = 'Nitin' AND last_name = 'Subramanian' AND (linkedin_url IS NULL OR linkedin_url = '');

UPDATE contacts SET linkedin_url = 'https://www.linkedin.com/in/saanyaojha/'
WHERE first_name = 'Saanya' AND last_name = 'Ojha' AND (linkedin_url IS NULL OR linkedin_url = '');
