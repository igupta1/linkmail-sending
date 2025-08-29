require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const url = process.env.DATABASE_URL;
  const ssl = /neon\.tech/.test(url) ? { rejectUnauthorized: false } : undefined;
  const pool = new Pool({ connectionString: url, ssl });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const insertContact = `
      INSERT INTO contacts (first_name, last_name, job_title, company, location)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    const r = await client.query(insertContact, [
      'Juskeerat',
      'Anand',
      'Software Engineer',
      'Datadog',
      'New York City'
    ]);
    const id = r.rows[0].id;
    await client.query(
      'INSERT INTO contact_emails (contact_id, email, is_primary) VALUES ($1, $2, $3) ON CONFLICT (contact_id, email) DO NOTHING',
      [id, 'jusanand@ucla.edu', true]
    );
    await client.query('COMMIT');
    const v = await pool.query('SELECT * FROM contacts_with_emails WHERE id = $1', [id]);
    console.log(JSON.stringify(v.rows[0], null, 2));
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Seed error:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();


